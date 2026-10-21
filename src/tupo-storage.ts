import type { Board, Value } from './model.js';

export const PROGRESS_PREFIX = 'tupo:progress:';
const PUZZLE_PREFIX = 'tupo:puzzle:';
export const RESULTS_KEY = 'tupo:results';

export interface TupoState {
  shapes: Value[];
  colors: Value[];
  elapsedMs: number;
  started: boolean;
  moves: number;
}

export interface TupoProgress {
  puzzleHash: string;
  date: string;
  owner: string | null;
  state: TupoState;
}

export interface TupoPuzzle {
  puzzleHash: string;
  n: number;
  level: string | null;
  givens: Board;
  solution: Board | null;
}

export interface TupoResult {
  puzzleHash: string;
  owner: string | null;
  level: string | null;
  kind: string | null;
  timeMs: number | null;
}

export interface KeyValueStore {
  keys(): string[];
  get(key: string): string | null;
}

export const browserStore = (storage: Storage): KeyValueStore => ({
  keys: () => Object.keys(storage),
  get: (key) => storage.getItem(key),
});

const isValue = (v: unknown): v is Value => v === null || (Number.isInteger(v) && (v as number) >= 0);

const valueArray = (v: unknown): Value[] | null => (Array.isArray(v) && v.every(isValue) ? (v as Value[]) : null);

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseProgress(raw: string | null): TupoProgress | null {
  const data = parseJson(raw) as Record<string, any> | null;
  if (!data || typeof data.puzzleHash !== 'string' || !data.state) return null;
  const shapes = valueArray(data.state.shapes);
  const colors = valueArray(data.state.colors);
  if (!shapes || !colors || shapes.length !== colors.length) return null;
  return {
    puzzleHash: data.puzzleHash,
    date: typeof data.date === 'string' ? data.date : '',
    owner: typeof data.owner === 'string' ? data.owner : null,
    state: {
      shapes,
      colors,
      elapsedMs: Number.isFinite(data.state.elapsedMs) ? data.state.elapsedMs : 0,
      started: data.state.started === true,
      moves: Number.isFinite(data.state.moves) ? data.state.moves : 0,
    },
  };
}

export const boardOfState = (state: TupoState): Board => ({ shapes: state.shapes.slice(), colors: state.colors.slice() });

export function findPuzzle(store: KeyValueStore, puzzleHash: string): TupoPuzzle | null {
  for (const key of store.keys()) {
    if (!key.startsWith(PUZZLE_PREFIX)) continue;
    const data = parseJson(store.get(key)) as Record<string, any> | null;
    if (!data || data.puzzleHash !== puzzleHash || !Number.isInteger(data.n)) continue;
    const size = data.n * data.n;
    const givens: Board = { shapes: Array(size).fill(null), colors: Array(size).fill(null) };
    for (const given of Array.isArray(data.givens) ? data.givens : []) {
      if (!Number.isInteger(given?.cell) || given.cell < 0 || given.cell >= size) continue;
      if (isValue(given.shape)) givens.shapes[given.cell] = given.shape;
      if (isValue(given.color)) givens.colors[given.cell] = given.color;
    }
    const shapes = valueArray(data.solution?.shapes);
    const colors = valueArray(data.solution?.colors);
    const solution = shapes && colors && shapes.length === size && colors.length === size ? { shapes, colors } : null;
    return { puzzleHash, n: data.n, level: typeof data.level === 'string' ? data.level : null, givens, solution };
  }
  return null;
}

export function parseResults(raw: string | null): TupoResult[] {
  const data = parseJson(raw) as any;
  const list: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
  return list.flatMap((entry: any) =>
    entry && typeof entry.puzzleHash === 'string'
      ? [
          {
            puzzleHash: entry.puzzleHash,
            owner: typeof entry.owner === 'string' ? entry.owner : null,
            level: typeof entry.level === 'string' ? entry.level : null,
            kind: typeof entry.kind === 'string' ? entry.kind : null,
            timeMs: Number.isFinite(entry.timeMs) ? entry.timeMs : null,
          },
        ]
      : [],
  );
}
