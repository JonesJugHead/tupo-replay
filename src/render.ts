import type { Recording } from './model.js';
import { formatClock, type Frame } from './timeline.js';

export type Theme = 'light' | 'dark';

interface Palette {
  page: string;
  ink: string;
  muted: string;
  emptyTile: string;
  tileEdge: string;
  highlight: string;
  progressTrack: string;
}

export const TILE_COLORS = ['#73bafd', '#00d5be', '#ffb900', '#ff637e', '#9475f2'];
const TILE_INK = '#273a6d';

const PALETTES: Record<Theme, Palette> = {
  light: {
    page: '#f8fafc',
    ink: '#273a6d',
    muted: '#62748e',
    emptyTile: '#ffffff',
    tileEdge: '#273a6d',
    highlight: '#ff637e',
    progressTrack: '#e2e8f0',
  },
  dark: {
    page: '#020618',
    ink: '#cad5e2',
    muted: '#90a1b9',
    emptyTile: '#1d293d',
    tileEdge: '#314158',
    highlight: '#ffb900',
    progressTrack: '#1d293d',
  },
};

export const FRAME_WIDTH = 480;
const PADDING = 24;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 28;
const TILE_GAP = 8;
const FONT = 'Lufga, system-ui, -apple-system, "Segoe UI", sans-serif';
const DISPLAY_FONT = '"BLT Heirloom", system-ui, -apple-system, "Segoe UI", sans-serif';

export async function loadRenderFonts() {
  try {
    await Promise.all([document.fonts.load(`900 40px ${DISPLAY_FONT}`), document.fonts.load(`600 15px ${FONT}`)]);
  } catch {
    return;
  }
}

export const frameHeight = () => HEADER_HEIGHT + (FRAME_WIDTH - 2 * PADDING) + FOOTER_HEIGHT + PADDING;

export function recordingTitle(recording: Recording): string {
  const level = recording.level ? recording.level[0].toUpperCase() + recording.level.slice(1) : `${recording.n}×${recording.n}`;
  const kind = recording.kind && recording.kind !== 'daily' ? `${recording.kind[0].toUpperCase()}${recording.kind.slice(1)} · ` : '';
  return `${kind}${level}${recording.date ? ` · ${recording.date}` : ''}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawFrame(ctx: CanvasRenderingContext2D, recording: Recording, frame: Frame, frameCount: number, theme: Theme) {
  const p = PALETTES[theme];
  const width = FRAME_WIDTH;
  const height = frameHeight();
  ctx.save();
  ctx.fillStyle = p.page;
  ctx.fillRect(0, 0, width, height);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.ink;
  ctx.font = `900 22px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('Tupo', PADDING, HEADER_HEIGHT / 2 + 4);
  const brandWidth = ctx.measureText('Tupo ').width;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = p.muted;
  ctx.fillText(recordingTitle(recording), PADDING + brandWidth, HEADER_HEIGHT / 2 + 5);
  ctx.textAlign = 'right';
  ctx.fillStyle = p.ink;
  ctx.font = `900 22px ${DISPLAY_FONT}`;
  ctx.fillText(formatClock(frame.clockMs), width - PADDING, HEADER_HEIGHT / 2 + 4);

  const n = recording.n;
  const boardSize = width - 2 * PADDING;
  const tile = (boardSize - TILE_GAP * (n - 1)) / n;
  const changed = new Set(frame.changed);
  for (let cell = 0; cell < n * n; cell++) {
    const x = PADDING + (cell % n) * (tile + TILE_GAP);
    const y = HEADER_HEIGHT + Math.floor(cell / n) * (tile + TILE_GAP);
    drawTile(ctx, recording, frame, cell, x, y, tile, changed.has(cell), p);
  }

  const barY = HEADER_HEIGHT + boardSize + FOOTER_HEIGHT / 2 + 4;
  const progress = frameCount > 1 ? frame.index / (frameCount - 1) : 1;
  ctx.fillStyle = p.progressTrack;
  roundedRect(ctx, PADDING, barY, boardSize, 6, 3);
  ctx.fill();
  ctx.fillStyle = p.ink;
  roundedRect(ctx, PADDING, barY, Math.max(6, boardSize * progress), 6, 3);
  ctx.fill();
  ctx.restore();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  recording: Recording,
  frame: Frame,
  cell: number,
  x: number,
  y: number,
  size: number,
  changed: boolean,
  p: Palette,
) {
  const shape = frame.board.shapes[cell];
  const color = frame.board.colors[cell];
  const radius = size * 0.16;
  ctx.fillStyle = color === null ? p.emptyTile : TILE_COLORS[color] ?? p.emptyTile;
  roundedRect(ctx, x, y, size, size, radius);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color === null ? p.tileEdge : TILE_INK;
  ctx.stroke();

  if (shape !== null) {
    ctx.fillStyle = color === null ? p.ink : TILE_INK;
    ctx.font = `900 ${Math.round(size * 0.55)}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(shape + 1), x + size / 2, y + size / 2 + size * 0.03);
  }

  const givens = recording.givens;
  const markColor = color === null ? p.ink : TILE_INK;
  if (givens && givens.shapes[cell] !== null) {
    ctx.fillStyle = markColor;
    ctx.beginPath();
    ctx.arc(x + size * 0.15, y + size * 0.15, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  if (givens && givens.colors[cell] !== null) {
    ctx.strokeStyle = markColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + size * 0.85, y + size * 0.15, size * 0.05, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (changed) {
    ctx.strokeStyle = p.highlight;
    ctx.lineWidth = 5;
    roundedRect(ctx, x - 5, y - 5, size + 10, size + 10, radius + 4);
    ctx.stroke();
  }
}
