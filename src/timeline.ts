import { applyChanges, cloneBoard, type Board, type Recording } from './model.js';

export type TimingMode = 'real' | 'smooth';

export interface TimelineOptions {
  mode: TimingMode;
  smoothGapMs: number;
  speed: number;
  endHoldMs: number;
}

export interface Frame {
  board: Board;
  changed: number[];
  clockMs: number;
  durationMs: number;
  index: number;
}

export const DEFAULT_OPTIONS: TimelineOptions = { mode: 'smooth', smoothGapMs: 500, speed: 1, endHoldMs: 3000 };

export const MIN_FRAME_MS = 20;
const WALL_CLOCK_TOLERANCE_MS = 500;

export function playedGaps(recording: Recording): number[] {
  return recording.steps.map((step, i) => {
    const previous = recording.steps[i - 1];
    const previousElapsed = previous?.elapsedMs ?? recording.initialElapsedMs;
    const gameGap = Math.max(0, step.elapsedMs - previousElapsed);
    if (!previous) return gameGap;
    const wallGap = step.wallMs - previous.wallMs;
    const timerRanThroughout = wallGap >= 0 && Math.abs(wallGap - gameGap) <= WALL_CLOCK_TOLERANCE_MS;
    return timerRanThroughout ? wallGap : gameGap;
  });
}

export function buildFrames(recording: Recording, options: TimelineOptions): Frame[] {
  const gaps = playedGaps(recording);
  const frames: Frame[] = [];
  let board = cloneBoard(recording.initial);
  let clockMs = recording.initialElapsedMs;
  frames.push({ board, changed: [], clockMs, durationMs: 0, index: 0 });
  recording.steps.forEach((step, i) => {
    clockMs += gaps[i];
    board = applyChanges(board, step.changes);
    frames.push({ board, changed: step.changes.map((c) => c.cell), clockMs, durationMs: 0, index: i + 1 });
  });
  const finalClock = recording.finalElapsedMs;
  if (finalClock !== null && finalClock > clockMs && frames.length > 1) frames[frames.length - 1].clockMs = finalClock;

  frames.forEach((frame, i) => {
    const next = gaps[i];
    const duration =
      next === undefined ? options.endHoldMs : options.mode === 'smooth' ? options.smoothGapMs : next / Math.max(options.speed, 0.01);
    frame.durationMs = Math.max(MIN_FRAME_MS, Math.round(duration));
  });
  return frames;
}

export const totalDuration = (frames: Frame[]) => frames.reduce((sum, f) => sum + f.durationMs, 0);

export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
