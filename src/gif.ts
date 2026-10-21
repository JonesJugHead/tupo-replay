import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import type { Recording } from './model.js';
import { drawFrame, FRAME_WIDTH, frameHeight, type Theme } from './render.js';
import type { Frame } from './timeline.js';

const MAX_GIF_DELAY_MS = 600_000;

function framePixels(ctx: CanvasRenderingContext2D, recording: Recording, frames: Frame[], frame: Frame, theme: Theme) {
  drawFrame(ctx, recording, frame, frames.length, theme);
  return ctx.getImageData(0, 0, FRAME_WIDTH, frameHeight()).data;
}

function sharedPalette(ctx: CanvasRenderingContext2D, recording: Recording, frames: Frame[], theme: Theme) {
  const samples = [...new Set([frames[0], frames[Math.floor(frames.length / 2)], frames[frames.length - 1]])];
  const pixels = samples.map((frame) => framePixels(ctx, recording, frames, frame, theme));
  const merged = new Uint8ClampedArray(pixels.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const p of pixels) {
    merged.set(p, offset);
    offset += p.length;
  }
  return quantize(merged, 256);
}

export function splitDelay(durationMs: number): number[] {
  const parts: number[] = [];
  let left = durationMs;
  while (left > MAX_GIF_DELAY_MS) {
    parts.push(MAX_GIF_DELAY_MS);
    left -= MAX_GIF_DELAY_MS;
  }
  parts.push(left);
  return parts;
}

export async function encodeGif(
  recording: Recording,
  frames: Frame[],
  theme: Theme,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_WIDTH;
  canvas.height = frameHeight();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const palette = sharedPalette(ctx, recording, frames, theme);
  const encoder = GIFEncoder();
  let first = true;
  for (const [i, frame] of frames.entries()) {
    const index = applyPalette(framePixels(ctx, recording, frames, frame, theme), palette);
    for (const delay of splitDelay(frame.durationMs)) {
      encoder.writeFrame(index, FRAME_WIDTH, frameHeight(), first ? { palette, delay, repeat: 0 } : { delay });
      first = false;
    }
    onProgress(i + 1, frames.length);
    if (i % 5 === 4) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  encoder.finish();
  return new Blob([encoder.bytes()], { type: 'image/gif' });
}
