import { describe, expect, it } from 'vitest';
import { boardAt, type Recording } from '../src/model.js';
import { Recorder, type RecordingStore } from '../src/recorder.js';
import type { KeyValueStore } from '../src/tupo-storage.js';

const HASH = 'abc123';
const PROGRESS_KEY = `tupo:progress:${HASH}`;
const PUZZLE_KEY = 'tupo:puzzle:2026-10-21';

function fakeTupo(initial: Record<string, unknown> = {}) {
  const data = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const store: KeyValueStore = { keys: () => [...data.keys()], get: (key) => data.get(key) ?? null };
  return { store, set: (key: string, value: unknown) => data.set(key, JSON.stringify(value)), remove: (key: string) => data.delete(key) };
}

function memoryStore() {
  const recordings = new Map<string, Recording>();
  const store: RecordingStore = {
    async findPlaying(puzzleHash) {
      const found = [...recordings.values()].find((r) => r.puzzleHash === puzzleHash && r.status === 'playing');
      return found ? structuredClone(found) : null;
    },
    async save(recording) {
      recordings.set(recording.id, structuredClone(recording));
    },
  };
  return { store, all: () => [...recordings.values()] };
}

const progress = (shapes: (number | null)[], colors: (number | null)[], elapsedMs: number, started = true, moves = 0) => ({
  puzzleHash: HASH,
  date: '2026-10-21',
  state: { shapes, colors, elapsedMs, started, moves, hintsUsed: 0, history: [] },
  updatedAt: 0,
});

const empty = () => [null, null, null, null];

const puzzleFile = {
  schema: 2,
  date: '2026-10-21',
  level: 'easy',
  n: 2,
  puzzleHash: HASH,
  givens: [{ cell: 0, shape: 0, color: 1 }],
  solution: { shapes: [0, 1, 1, 0], colors: [1, 0, 0, 1] },
};

describe('Recorder', () => {
  it('records each move with game time and wall time, mistakes included', async () => {
    const tupo = fakeTupo({ [PROGRESS_KEY]: progress([0, null, null, null], [1, null, null, null], 0, false), [PUZZLE_KEY]: puzzleFile });
    const memory = memoryStore();
    let now = 1000;
    const recorder = new Recorder(tupo.store, memory.store, () => now);

    tupo.set(PROGRESS_KEY, progress([0, 0, null, null], [1, null, null, null], 1000, true, 1));
    now = 2000;
    await recorder.scan();
    tupo.set(PROGRESS_KEY, progress([0, 1, null, null], [1, null, null, null], 3000, true, 2));
    now = 4000;
    await recorder.scan();

    const [recording] = memory.all();
    expect(recording.partial).toBe(false);
    expect(recording.level).toBe('easy');
    expect(recording.givens?.shapes).toEqual([0, null, null, null]);
    expect(recording.steps.map((s) => [s.elapsedMs, s.wallMs, s.changes])).toEqual([
      [1000, 2000, [{ cell: 1, shape: 0, color: null }]],
      [3000, 4000, [{ cell: 1, shape: 1, color: null }]],
    ]);
  });

  it('ignores saves that leave the board unchanged (pause, resume)', async () => {
    const tupo = fakeTupo({ [PROGRESS_KEY]: progress(empty(), empty(), 0, false) });
    const memory = memoryStore();
    const recorder = new Recorder(tupo.store, memory.store, () => 0);
    tupo.set(PROGRESS_KEY, progress([1, null, null, null], empty(), 500, true, 1));
    await recorder.scan();
    tupo.set(PROGRESS_KEY, progress([1, null, null, null], empty(), 9000, true, 1));
    await recorder.scan();
    expect(memory.all()[0].steps).toHaveLength(1);
  });

  it('does not record a puzzle that is only opened', async () => {
    const tupo = fakeTupo();
    const memory = memoryStore();
    const recorder = new Recorder(tupo.store, memory.store);
    tupo.set(PROGRESS_KEY, progress(empty(), empty(), 0, false));
    await recorder.scan();
    expect(memory.all()).toHaveLength(0);
  });

  it('marks a game started before the extension as partial', async () => {
    const tupo = fakeTupo({ [PROGRESS_KEY]: progress([1, 0, null, null], empty(), 60_000, true, 2) });
    const memory = memoryStore();
    const recorder = new Recorder(tupo.store, memory.store);
    tupo.set(PROGRESS_KEY, progress([1, 0, 1, null], empty(), 65_000, true, 3));
    await recorder.scan();
    const [recording] = memory.all();
    expect(recording.partial).toBe(true);
    expect(recording.initialElapsedMs).toBe(60_000);
    expect(recording.steps).toHaveLength(1);
  });

  it('completes the board from the solution when the winning save is never seen', async () => {
    const tupo = fakeTupo({ [PROGRESS_KEY]: progress([0, null, null, null], [1, null, null, null], 0, false), [PUZZLE_KEY]: puzzleFile });
    const memory = memoryStore();
    const recorder = new Recorder(tupo.store, memory.store, () => 10);
    tupo.set(PROGRESS_KEY, progress([0, 1, 1, 0], [1, 0, 0, null], 8000, true, 6));
    await recorder.scan();
    tupo.remove(PROGRESS_KEY);
    tupo.set('tupo:results', { v: 4, results: [{ puzzleHash: HASH, date: '2026-10-21', level: 'easy', kind: 'daily', timeMs: 9000 }] });
    await recorder.scan();
    const [recording] = memory.all();
    expect(recording.status).toBe('won');
    expect(recording.finalElapsedMs).toBe(9000);
    expect(recording.kind).toBe('daily');
    expect(boardAt(recording)).toEqual(puzzleFile.solution);
    expect(recording.steps.at(-1)?.elapsedMs).toBe(9000);
  });
});
