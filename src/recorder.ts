import { boardAt, diffBoards, type Recording } from './model.js';
import {
  boardOfState,
  findPuzzle,
  parseProgress,
  parseResults,
  PROGRESS_PREFIX,
  RESULTS_KEY,
  type KeyValueStore,
  type TupoProgress,
  type TupoResult,
} from './tupo-storage.js';

export interface RecordingStore {
  findPlaying(puzzleHash: string): Promise<Recording | null>;
  save(recording: Recording): Promise<void>;
}

export class Recorder {
  private seen = new Map<string, string>();
  private lastResults: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private tupo: KeyValueStore,
    private store: RecordingStore,
    private now: () => number = Date.now,
  ) {
    for (const key of this.progressKeys()) {
      const raw = tupo.get(key);
      if (raw !== null) this.seen.set(key, raw);
    }
  }

  scan(): Promise<void> {
    const wallMs = this.now();
    const present = new Set<string>();
    for (const key of this.progressKeys()) {
      present.add(key);
      const raw = this.tupo.get(key);
      const previousRaw = this.seen.get(key);
      if (raw === null || raw === previousRaw) continue;
      this.seen.set(key, raw);
      const next = parseProgress(raw);
      if (!next) continue;
      const previous = parseProgress(previousRaw ?? null);
      this.enqueue(() => this.record(previous, next, wallMs));
    }
    for (const key of this.seen.keys()) if (!present.has(key)) this.seen.delete(key);

    const results = this.tupo.get(RESULTS_KEY);
    if (results !== this.lastResults) {
      this.lastResults = results;
      const parsed = parseResults(results);
      this.enqueue(() => this.finish(parsed, wallMs));
    }
    return this.queue;
  }

  private progressKeys() {
    return this.tupo.keys().filter((key) => key.startsWith(PROGRESS_PREFIX));
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch((error) => console.warn('[tupo-replay]', error));
  }

  private async record(previous: TupoProgress | null, next: TupoProgress, wallMs: number) {
    if (!next.state.started) return;
    const existing = await this.store.findPlaying(next.puzzleHash);
    const recording = existing ?? this.start(previous, next, wallMs);
    const changes = diffBoards(boardAt(recording), boardOfState(next.state));
    if (changes.length === 0 && existing) return;
    if (changes.length > 0) recording.steps.push({ elapsedMs: next.state.elapsedMs, wallMs, changes });
    recording.updatedAt = wallMs;
    await this.store.save(recording);
  }

  private start(previous: TupoProgress | null, next: TupoProgress, wallMs: number): Recording {
    const puzzle = findPuzzle(this.tupo, next.puzzleHash);
    const size = next.state.shapes.length;
    const usablePrevious = previous && previous.state.shapes.length === size ? previous : null;
    const base = {
      id: `${next.puzzleHash}:${wallMs}`,
      puzzleHash: next.puzzleHash,
      date: next.date,
      n: puzzle?.n ?? Math.round(Math.sqrt(size)),
      level: puzzle?.level ?? null,
      kind: null,
      steps: [],
      createdAt: wallMs,
      updatedAt: wallMs,
      status: 'playing' as const,
      finalElapsedMs: null,
    };
    if (usablePrevious) {
      const freshStart = !usablePrevious.state.started || usablePrevious.state.moves === 0;
      return {
        ...base,
        givens: puzzle?.givens ?? (freshStart ? boardOfState(usablePrevious.state) : null),
        initial: boardOfState(usablePrevious.state),
        initialElapsedMs: usablePrevious.state.elapsedMs,
        partial: !freshStart,
      };
    }
    if (puzzle) return { ...base, givens: puzzle.givens, initial: puzzle.givens, initialElapsedMs: 0, partial: false };
    return { ...base, givens: null, initial: boardOfState(next.state), initialElapsedMs: next.state.elapsedMs, partial: true };
  }

  private async finish(results: TupoResult[], wallMs: number) {
    for (const result of results) {
      const recording = await this.store.findPlaying(result.puzzleHash);
      if (!recording) continue;
      const lastElapsed = recording.steps.at(-1)?.elapsedMs ?? recording.initialElapsedMs;
      const finalElapsedMs = result.timeMs ?? lastElapsed;
      const solution = findPuzzle(this.tupo, result.puzzleHash)?.solution;
      const missing = solution ? diffBoards(boardAt(recording), solution) : [];
      if (missing.length > 0) {
        recording.steps.push({ elapsedMs: Math.max(finalElapsedMs, lastElapsed), wallMs, changes: missing });
      }
      recording.status = 'won';
      recording.finalElapsedMs = finalElapsedMs;
      recording.level ??= result.level;
      recording.kind ??= result.kind;
      recording.updatedAt = wallMs;
      await this.store.save(recording);
    }
  }
}
