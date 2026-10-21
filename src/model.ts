export type Value = number | null;

export interface Board {
  shapes: Value[];
  colors: Value[];
}

export interface Change {
  cell: number;
  shape: Value;
  color: Value;
}

export interface Step {
  elapsedMs: number;
  wallMs: number;
  changes: Change[];
}

export type RecordingStatus = 'playing' | 'won';

export interface Recording {
  id: string;
  puzzleHash: string;
  date: string;
  n: number;
  level: string | null;
  kind: string | null;
  givens: Board | null;
  initial: Board;
  initialElapsedMs: number;
  partial: boolean;
  steps: Step[];
  createdAt: number;
  updatedAt: number;
  status: RecordingStatus;
  finalElapsedMs: number | null;
}

export const RECORDING_PREFIX = 'rec:';

export const recordingKey = (id: string) => `${RECORDING_PREFIX}${id}`;

export function cloneBoard(board: Board): Board {
  return { shapes: board.shapes.slice(), colors: board.colors.slice() };
}

export function emptyBoard(size: number): Board {
  return { shapes: Array(size).fill(null), colors: Array(size).fill(null) };
}

export function applyChanges(board: Board, changes: Change[]): Board {
  const next = cloneBoard(board);
  for (const change of changes) {
    next.shapes[change.cell] = change.shape;
    next.colors[change.cell] = change.color;
  }
  return next;
}

export function diffBoards(from: Board, to: Board): Change[] {
  const changes: Change[] = [];
  for (let cell = 0; cell < to.shapes.length; cell++) {
    if (from.shapes[cell] !== to.shapes[cell] || from.colors[cell] !== to.colors[cell]) {
      changes.push({ cell, shape: to.shapes[cell], color: to.colors[cell] });
    }
  }
  return changes;
}

export function boardAt(recording: Recording, stepCount = recording.steps.length): Board {
  let board = cloneBoard(recording.initial);
  for (const step of recording.steps.slice(0, stepCount)) board = applyChanges(board, step.changes);
  return board;
}

export function isFull(board: Board): boolean {
  return board.shapes.every((v) => v !== null) && board.colors.every((v) => v !== null);
}

export function moveCount(recording: Recording): number {
  return recording.steps.reduce((sum, step) => sum + step.changes.length, 0);
}

export function isRecording(value: unknown): value is Recording {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<Recording>;
  return typeof r.id === 'string' && typeof r.puzzleHash === 'string' && Array.isArray(r.steps) && !!r.initial;
}
