/**
 * Procedural tile faces. We have no image assets, so every face is drawn into a
 * 2D canvas and uploaded as a CanvasTexture.
 *
 * Textures are cached per tile *type* (42 faces), not per tile instance (144),
 * so a full table costs 42 uploads.
 */

import * as THREE from 'three';
import { def } from './tiles';

const W = 256;
const H = 340;

const IVORY = '#fbf6e9';
const INK = '#1b1b1f';
const RED = '#c0392b';
const GREEN = '#1e7a4b';
const BLUE = '#1f5fa8';

const cache = new Map<string, THREE.CanvasTexture>();

export function faceTexture(id: string): THREE.CanvasTexture {
  const hit = cache.get(id);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  drawFace(ctx, id);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(id, tex);
  return tex;
}

/** Height of the bottom band reserved for the Jyutping label. */
const LABEL_BAND = 46;

function drawFace(ctx: CanvasRenderingContext2D, id: string) {
  ctx.fillStyle = IVORY;
  ctx.fillRect(0, 0, W, H);

  // A faint inner border gives the flat face some depth at a glance.
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  const d = def(id);

  // Squeeze the artwork upward to make room for the romanisation, scaling
  // uniformly about the centre line so the dots stay circular.
  ctx.save();
  const s = (H - LABEL_BAND) / H;
  ctx.translate(W / 2, 0);
  ctx.scale(s, s);
  ctx.translate(-W / 2, 0);
  drawArtwork(ctx, id, d.kind);
  ctx.restore();

  drawLabel(ctx, d.label);
}

/** Jyutping under every face, so the tile is readable without knowing hanzi. */
function drawLabel(ctx: CanvasRenderingContext2D, label: string) {
  ctx.save();
  ctx.font = `700 34px ui-sans-serif, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = '#55503f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, W / 2, H - 14, W - 26);
  ctx.restore();
}

function drawArtwork(ctx: CanvasRenderingContext2D, id: string, kind: string) {
  const d = def(id);
  if (kind === 'suit') {
    if (d.suit === 'c') drawCharacters(ctx, d.rank!);
    else if (d.suit === 'd') drawDots(ctx, d.rank!);
    else drawBamboo(ctx, d.rank!);
  } else if (kind === 'wind') {
    drawGlyph(ctx, d.cn, INK);
  } else if (kind === 'dragon') {
    if (id === 'dr') drawGlyph(ctx, '中', RED);
    else if (id === 'dg') drawGlyph(ctx, '發', GREEN);
    else drawWhiteDragon(ctx);
  } else {
    drawBonus(ctx, id, d.cn);
  }
}

/* ---------------------------------------------------------------- glyphs -- */

function cjk(size: number) {
  return `bold ${size}px "PingFang TC", "Hiragino Sans", "Heiti TC", "Noto Sans CJK TC", "Microsoft JhengHei", serif`;
}

function centerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.font = cjk(size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGlyph(ctx: CanvasRenderingContext2D, ch: string, color: string) {
  centerText(ctx, ch, W / 2, H / 2, 190, color);
}

const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function drawCharacters(ctx: CanvasRenderingContext2D, rank: number) {
  centerText(ctx, NUM_CN[rank], W / 2, H * 0.29, 120, BLUE);
  centerText(ctx, '萬', W / 2, H * 0.71, 130, RED);
}

function drawWhiteDragon(ctx: CanvasRenderingContext2D) {
  // 白板 is a blank face with a rectangular frame.
  ctx.save();
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  ctx.strokeRect(44, 58, W - 88, H - 116);
  ctx.restore();
}

function drawBonus(ctx: CanvasRenderingContext2D, id: string, ch: string) {
  const flower = id.startsWith('f');
  centerText(ctx, ch, W / 2, H * 0.46, 150, flower ? GREEN : RED);
  centerText(ctx, flower ? 'FLOWER' : 'SEASON', W / 2, H * 0.84, 26, '#8a8578');
}

/* ------------------------------------------------------------------ dots -- */

/** Traditional-ish dot layouts, as (col, row) pairs on a 3x4 grid. */
const DOT_LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[1, 1.5]],
  2: [
    [1, 0.6],
    [1, 2.4],
  ],
  3: [
    [0.2, 0.4],
    [1, 1.5],
    [1.8, 2.6],
  ],
  4: [
    [0.35, 0.7],
    [1.65, 0.7],
    [0.35, 2.3],
    [1.65, 2.3],
  ],
  5: [
    [0.25, 0.55],
    [1.75, 0.55],
    [1, 1.5],
    [0.25, 2.45],
    [1.75, 2.45],
  ],
  6: [
    [0.35, 0.35],
    [1.65, 0.35],
    [0.35, 1.5],
    [1.65, 1.5],
    [0.35, 2.65],
    [1.65, 2.65],
  ],
  7: [
    [0.3, 0.25],
    [1, 0.55],
    [1.7, 0.85],
    [0.35, 1.9],
    [1.65, 1.9],
    [0.35, 2.75],
    [1.65, 2.75],
  ],
  8: [
    [0.35, 0.2],
    [1.65, 0.2],
    [0.35, 1.07],
    [1.65, 1.07],
    [0.35, 1.93],
    [1.65, 1.93],
    [0.35, 2.8],
    [1.65, 2.8],
  ],
  9: [
    [0, 0.3],
    [1, 0.3],
    [2, 0.3],
    [0, 1.5],
    [1, 1.5],
    [2, 1.5],
    [0, 2.7],
    [1, 2.7],
    [2, 2.7],
  ],
};

/** Per-rank dot colours, following the usual table conventions loosely. */
const DOT_COLORS: Record<number, string[]> = {
  1: [RED],
  2: [GREEN, GREEN],
  3: [BLUE, GREEN, RED],
  4: [GREEN, GREEN, GREEN, GREEN],
  5: [BLUE, GREEN, RED, GREEN, BLUE],
  6: [GREEN, GREEN, RED, RED, RED, RED],
  7: [GREEN, GREEN, GREEN, RED, RED, RED, RED],
  8: [BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE],
  9: [RED, RED, RED, GREEN, GREEN, GREEN, BLUE, BLUE, BLUE],
};

function drawDots(ctx: CanvasRenderingContext2D, rank: number) {
  const cells = DOT_LAYOUT[rank];
  const colors = DOT_COLORS[rank];
  const big = rank === 1;
  const r = big ? 58 : rank >= 8 ? 26 : 30;

  const x0 = 58;
  const dx = 70;
  const y0 = 62;
  const dy = 72;

  cells.forEach(([cx, cy], i) => {
    dot(ctx, x0 + cx * dx, y0 + cy * dy, r, colors[i] ?? BLUE);
  });
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = IVORY;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/* ---------------------------------------------------------------- bamboo -- */

const BAM_LAYOUT: Record<number, Array<[number, number]>> = {
  2: [
    [1, 0.55],
    [1, 2.45],
  ],
  3: [
    [1, 0.4],
    [0.3, 2.3],
    [1.7, 2.3],
  ],
  4: [
    [0.35, 0.7],
    [1.65, 0.7],
    [0.35, 2.3],
    [1.65, 2.3],
  ],
  5: [
    [0.25, 0.5],
    [1.75, 0.5],
    [1, 1.5],
    [0.25, 2.5],
    [1.75, 2.5],
  ],
  6: [
    [0.3, 0.4],
    [1, 0.4],
    [1.7, 0.4],
    [0.3, 2.5],
    [1, 2.5],
    [1.7, 2.5],
  ],
  7: [
    [1, 0.2],
    [0.3, 1.4],
    [1, 1.4],
    [1.7, 1.4],
    [0.3, 2.7],
    [1, 2.7],
    [1.7, 2.7],
  ],
  8: [
    [0.35, 0.3],
    [1.65, 0.3],
    [0.6, 1.2],
    [1.4, 1.2],
    [0.6, 1.9],
    [1.4, 1.9],
    [0.35, 2.8],
    [1.65, 2.8],
  ],
  9: [
    [0.3, 0.35],
    [1, 0.35],
    [1.7, 0.35],
    [0.3, 1.55],
    [1, 1.55],
    [1.7, 1.55],
    [0.3, 2.75],
    [1, 2.75],
    [1.7, 2.75],
  ],
};

function drawBamboo(ctx: CanvasRenderingContext2D, rank: number) {
  if (rank === 1) {
    drawSparrow(ctx);
    return;
  }
  const cells = BAM_LAYOUT[rank];
  const x0 = 58;
  const dx = 70;
  const y0 = 60;
  const dy = 72;
  const h = rank >= 8 ? 46 : 56;
  cells.forEach(([cx, cy], i) => {
    // 5 Bamboo traditionally has a red centre stick; 9 has a red middle row.
    const red = (rank === 5 && i === 2) || (rank === 9 && i >= 3 && i <= 5);
    stick(ctx, x0 + cx * dx, y0 + cy * dy, h, red ? RED : GREEN);
  });
}

function stick(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) {
  const w = 15;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
  ctx.fill();
  // node lines make it read as bamboo rather than a bar
  ctx.strokeStyle = IVORY;
  ctx.lineWidth = 3;
  for (const t of [0.33, 0.67]) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2 + h * t);
    ctx.lineTo(x + w / 2, y - h / 2 + h * t);
    ctx.stroke();
  }
  ctx.restore();
}

/** 1 Bamboo is a bird (麻雀) rather than a stick. Stylised sparrow. */
function drawSparrow(ctx: CanvasRenderingContext2D) {
  const cx = W / 2;
  const cy = H / 2;
  ctx.save();
  ctx.translate(cx, cy);

  // body
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.ellipse(0, 10, 46, 62, 0, 0, Math.PI * 2);
  ctx.fill();

  // wing
  ctx.fillStyle = '#14603a';
  ctx.beginPath();
  ctx.ellipse(-6, 12, 24, 44, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // tail
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.moveTo(20, 55);
  ctx.lineTo(78, 104);
  ctx.lineTo(44, 40);
  ctx.closePath();
  ctx.fill();

  // head
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(-4, -62, 32, 0, Math.PI * 2);
  ctx.fill();

  // beak
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(-32, -66);
  ctx.lineTo(-72, -54);
  ctx.lineTo(-32, -46);
  ctx.closePath();
  ctx.fill();

  // eye
  ctx.fillStyle = IVORY;
  ctx.beginPath();
  ctx.arc(-10, -70, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-10, -70, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // perch
  ctx.strokeStyle = RED;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-52, 96);
  ctx.lineTo(52, 96);
  ctx.stroke();

  ctx.restore();
}

/* ------------------------------------------------------- 2D DOM rendering -- */

/** Small face bitmap for HTML UI (lesson panels, quiz buttons). */
export function faceDataUrl(id: string, width = 64): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  drawFace(ctx, id);
  void width;
  return canvas.toDataURL();
}
