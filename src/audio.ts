/**
 * Table sounds, synthesised with WebAudio — no audio assets, same as the tiles.
 *
 * A mahjong tile is a small dense block: the sound is a short noise burst with a
 * fast decay plus a bit of resonant body. Picking one up is soft and high,
 * dropping one on felt is a hard clack, and a shuffle is many overlapping
 * clacks smeared over about a second.
 *
 * Browsers refuse to start audio before a gesture, so the context is created
 * lazily on the first sound and resumed on the first click.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

const STORAGE_KEY = 'mahjong.muted';

if (typeof localStorage !== 'undefined') {
  muted = localStorage.getItem(STORAGE_KEY) === '1';
}

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Short burst of filtered noise — the body of every tile sound. */
function clack(
  when: number,
  opts: { gain: number; decay: number; freq: number; q: number; type?: BiquadFilterType },
) {
  const c = ctx!;
  const len = Math.max(0.02, opts.decay);
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // Exponential decay gives the hard "tick" attack a tile has.
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 6);
  }

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.value = opts.freq;
  filter.Q.value = opts.q;

  const gain = c.createGain();
  gain.gain.value = opts.gain;

  src.connect(filter).connect(gain).connect(master!);
  src.start(when);
  src.stop(when + len);
}

/** Lifting a tile off the rack: soft, high, barely there. */
export function playPick() {
  const c = ac();
  if (!c) return;
  clack(c.currentTime, { gain: 0.18, decay: 0.06, freq: 2600, q: 1.4 });
}

/** Selecting or confirming a tile: a touch brighter than a pick. */
export function playSelect() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  clack(t, { gain: 0.3, decay: 0.09, freq: 1900, q: 1.1 });
  clack(t + 0.012, { gain: 0.16, decay: 0.12, freq: 900, q: 2.2 });
}

/** Discarding: the tile hits the felt. Hard attack, low body. */
export function playDrop() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  clack(t, { gain: 0.5, decay: 0.11, freq: 1200, q: 0.9 });
  clack(t + 0.008, { gain: 0.28, decay: 0.17, freq: 420, q: 2.6 });
}

/** Dealing a hand or a new wall: a scatter of clacks over ~0.9s. */
export function playShuffle(count = 22) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < count; i++) {
    clack(t + Math.random() * 0.9, {
      gain: 0.06 + Math.random() * 0.09,
      decay: 0.05 + Math.random() * 0.06,
      freq: 900 + Math.random() * 2200,
      q: 1 + Math.random() * 2,
    });
  }
}

/** A wrong answer: a dull, damped thud. */
export function playWrong() {
  const c = ac();
  if (!c) return;
  clack(c.currentTime, { gain: 0.32, decay: 0.16, freq: 260, q: 3.5, type: 'lowpass' });
}

/** A correct answer or a completed lesson: a small rising figure. */
export function playGood() {
  const c = ac();
  if (!c) return;
  tones([784, 1046.5], 0.16);
}

/** Winning the hand: a fuller arpeggio. */
export function playWin() {
  const c = ac();
  if (!c) return;
  tones([523.25, 659.25, 783.99, 1046.5], 0.5);
}

function tones(freqs: number[], hold: number) {
  const c = ctx!;
  const t0 = c.currentTime;
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = c.createGain();
    const at = t0 + i * 0.075;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.16, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + hold);
    osc.connect(g).connect(master!);
    osc.start(at);
    osc.stop(at + hold + 0.05);
  });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  if (muted && ctx) void ctx.suspend();
  else if (!muted) ac();
}
