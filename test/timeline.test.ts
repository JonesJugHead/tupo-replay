import { describe, expect, it } from 'vitest';
import { splitDelay } from '../src/gif.js';
import type { Recording } from '../src/model.js';
import { buildFrames, formatClock, playedGaps, totalDuration } from '../src/timeline.js';

const recording = (steps: [number, number][]): Recording => ({
  id: 'x',
  puzzleHash: 'x',
  date: '2026-10-21',
  n: 2,
  level: 'easy',
  kind: null,
  givens: null,
  initial: { shapes: [null, null, null, null], colors: [null, null, null, null] },
  initialElapsedMs: 0,
  partial: false,
  steps: steps.map(([elapsedMs, wallMs], i) => ({ elapsedMs, wallMs, changes: [{ cell: i % 4, shape: 0, color: null }] })),
  createdAt: 0,
  updatedAt: 0,
  status: 'playing',
  finalElapsedMs: null,
});

describe('timeline', () => {
  it('uses the precise wall clock while the timer ran, the game timer across a pause', () => {
    const rec = recording([
      [1000, 10_000],
      [1250, 10_330],
      [4000, 600_000],
    ]);
    expect(playedGaps(rec)).toEqual([1000, 330, 2750]);
  });

  it('keeps the real timeline, scaled by the speed', () => {
    const rec = recording([
      [1000, 1000],
      [601_000, 601_000],
    ]);
    const frames = buildFrames(rec, { mode: 'real', smoothGapMs: 500, speed: 2, endHoldMs: 3000 });
    expect(frames.map((f) => f.durationMs)).toEqual([500, 300_000, 3000]);
    expect(frames.map((f) => f.clockMs)).toEqual([0, 1000, 601_000]);
  });

  it('smooths every pause to the same length whatever the real gap', () => {
    const rec = recording([
      [1, 1],
      [600_000, 600_000],
      [600_002, 600_002],
    ]);
    const frames = buildFrames(rec, { mode: 'smooth', smoothGapMs: 500, speed: 1, endHoldMs: 3000 });
    expect(frames.map((f) => f.durationMs)).toEqual([500, 500, 500, 3000]);
    expect(totalDuration(frames)).toBe(4500);
  });

  it('never emits a frame shorter than browsers honour', () => {
    const rec = recording([
      [0, 0],
      [5, 5],
    ]);
    const frames = buildFrames(rec, { mode: 'real', smoothGapMs: 500, speed: 1, endHoldMs: 3000 });
    expect(Math.min(...frames.map((f) => f.durationMs))).toBe(20);
  });

  it('splits holds longer than a GIF frame delay allows', () => {
    expect(splitDelay(1_500_000)).toEqual([600_000, 600_000, 300_000]);
    expect(splitDelay(500)).toEqual([500]);
  });

  it('formats the clock like Tupo', () => {
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(3_725_000)).toBe('1:02:05');
  });
});
