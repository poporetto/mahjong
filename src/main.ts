/**
 * App shell: lesson runner + practice table, both driving the same 3D Table.
 */

import './style.css';
import { Table } from './scene';
import type { TileHandle } from './scene';
import { LESSONS } from './lessons';
import type { Lesson, Step, Task } from './lessons';
import { faceDataUrl } from './textures';
import { buildDeck, def, shuffle, sortHand, sortKey } from './tiles';
import type { ScoreResult, TileSet } from './rules';
import {
  HOUSE_RULES,
  isWinningHand,
  score,
  shanten,
  usefulTiles,
  waitingTiles,
} from './rules';
import { chooseBotDiscard } from './bot';
import {
  isMuted,
  playDrop,
  playGood,
  playSelect,
  playShuffle,
  playWin,
  playWrong,
  setMuted,
} from './audio';

const app = document.getElementById('app')!;
app.innerHTML = `
  <aside id="panel">
    <header id="brand">
      <div class="logo">🀄</div>
      <div>
        <h1>Mahjong, properly</h1>
        <p>Hong Kong Old Style · 香港麻雀 <i>hoeng1 gong2 maa4 zoek2</i></p>
      </div>
      <button id="mute" title="Toggle sound"></button>
    </header>
    <div id="content"></div>
    <footer id="foot"></footer>
  </aside>
  <main id="stage"><div id="canvas-host"></div><div id="toast"></div></main>
`;

const content = document.getElementById('content')!;
const foot = document.getElementById('foot')!;
const toastEl = document.getElementById('toast')!;
const table = new Table(document.getElementById('canvas-host')!);let toastTimer = 0;
function toast(msg: string, tone: 'good' | 'bad' | 'info' = 'info') {
  toastEl.className = `show ${tone}`;
  toastEl.innerHTML = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.className = ''), 4200);
}

const muteBtn = document.getElementById('mute') as HTMLButtonElement;
function paintMute() {
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(isMuted()));
}
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  paintMute();
  if (!isMuted()) playSelect();
});
paintMute();

function tileChip(id: string): string {
  const d = def(id);
  return `<span class="tile-card" title="${d.cn} ${d.jyut} — ${d.en}">
    <img class="chip" src="${faceDataUrl(id)}" alt="${d.en}">
    <button class="pronounce" data-pronounce="${id}" aria-label="Hear ${d.cn} in Cantonese" title="Hear Cantonese pronunciation">🔊</button>
  </span>`;
}

function pronounceTile(id: string) {
  const d = def(id);
  if (!('speechSynthesis' in window)) {
    toast(`${say(d.cn, d.jyut)} — ${d.en}`, 'info');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(d.cn);
  utterance.lang = 'zh-HK';
  utterance.rate = 0.78;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

content.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pronounce]');
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  pronounceTile(target.dataset.pronounce!);
});

/** Hanzi followed by its Cantonese romanisation, for inline use. */
function say(cn: string, jyut: string): string {
  return `${cn} <i class="jyut">${jyut}</i>`;
}

/* ================================================================== menu == */

function renderMenu() {
  table.onTileClick = null;
  table.onTileHover = null;
  table.setLayout({
    hand: ['dr', 'we', 'b1', 'd5', 'c8', 'dg', 'b9'],
    discards: ['d1', 'c3', 'b6', 'ws'],
    wall: 14,
  });
  table.clearMarks();

  content.innerHTML = `
    <p class="lede">${LESSONS.length} short lessons and a practice table. Everything is clickable — you learn by touching the tiles, not by reading about them.</p>
    <p class="fine">Every tile is labelled with its Cantonese pronunciation, and so is every Chinese term below. You don't need to read hanzi to play.</p>
    <div class="cards">
      ${LESSONS.map(
        (l, i) => `
        <button class="card" data-lesson="${l.id}">
          <span class="card-emoji">${l.emoji}</span>
          <span class="card-text">
            <b>${i + 1}. ${l.title}</b>
            <small>${l.subtitle}</small>
          </span>
          <span class="card-len">${l.steps.length}</span>
        </button>`,
      ).join('')}
      <button class="card practice" data-practice="1">
        <span class="card-emoji">🎮</span>
        <span class="card-text">
          <b>Play vs Computer</b>
          <small>A real 4-seat table with a live coach for your hand</small>
        </span>
        <span class="card-len">4p</span>
      </button>
    </div>
    <button class="ghost" id="rules-btn">House rules used here</button>
  `;
  foot.innerHTML = '';

  content.querySelectorAll<HTMLElement>('[data-lesson]').forEach((el) =>
    el.addEventListener('click', () => startLesson(el.dataset.lesson!)),
  );
  content.querySelector('[data-practice]')!.addEventListener('click', startGame);
  content.querySelector('#rules-btn')!.addEventListener('click', renderHouseRules);
}

function renderHouseRules() {
  content.innerHTML = `
    <h2>House rules</h2>
    <p class="lede">Hong Kong Old Style is a family of house rules, not one fixed code. These are the values this tutorial uses. Your table may differ — especially on ${say('清一色', 'cing1 jat1 sik1')} and the limit.
    Every Chinese term in this app is followed by its Cantonese pronunciation in
    <a href="https://en.wikipedia.org/wiki/Jyutping" target="_blank" rel="noopener">Jyutping</a>;
    the trailing digit is the tone.</p>
    <div class="stat-row">
      <div class="stat"><b>${HOUSE_RULES.minimumFaan}</b><small>faan minimum<br>三番起糊 saam1 faan1 hei2 wu2</small></div>
      <div class="stat"><b>${HOUSE_RULES.limitFaan}</b><small>faan limit<br>滿糊 mun5 wu2</small></div>
      <div class="stat"><b>144</b><small>tiles</small></div>
    </div>
    <table class="faan">
      <tbody>
      ${HOUSE_RULES.patterns
        .map(
          (p) =>
            `<tr><td class="cn">${p.cn}<i class="jyut">${p.jyut}</i></td><td>${p.en}<small>${p.note}</small></td><td class="n">${p.faan}</td></tr>`,
        )
        .join('')}
      </tbody>
    </table>
    <p class="fine">Payment doubles per faan. On a discard the discarder pays the full amount alone; on a self-draw all three players pay. Fu and minipoints do not exist in this ruleset.</p>
  `;
  foot.innerHTML = `<button class="ghost" id="back">← Back</button>`;
  foot.querySelector('#back')!.addEventListener('click', renderMenu);
}

/* =============================================================== lessons == */

let lesson: Lesson;
let stepIndex = 0;
let solved = false;
let selection: number[] = [];

function startLesson(id: string) {
  lesson = LESSONS.find((l) => l.id === id)!;
  stepIndex = 0;
  playShuffle(12);
  renderStep();
}

function renderStep() {
  const step: Step = lesson.steps[stepIndex];
  solved = false;
  selection = [];

  if (step.layout) {
    table.setLayout(step.layout);
    playShuffle(Math.min(step.layout.hand.length, 14));
  }
  table.clearMarks();
  if (step.marks) table.markHand(step.marks, step.dimUnmarked ?? false);

  content.innerHTML = `
    <div class="crumb">${lesson.emoji} ${lesson.title}</div>
    <div class="progress">${lesson.steps
      .map((_, i) => `<i class="${i < stepIndex ? 'done' : i === stepIndex ? 'now' : ''}"></i>`)
      .join('')}</div>
    <h2>${step.title}</h2>
    <div class="body">${step.body}</div>
    <div id="task"></div>
  `;

  renderFoot();
  if (step.task) renderTask(step.task);
  else wireHandHighlightOnly();
}

function renderFoot() {
  const last = stepIndex === lesson.steps.length - 1;
  const step = lesson.steps[stepIndex];
  const locked = !!step.task && !solved;
  foot.innerHTML = `
    <button class="ghost" id="menu">Menu</button>
    <button class="ghost" id="prev" ${stepIndex === 0 ? 'disabled' : ''}>←</button>
    <button class="primary" id="next" ${locked ? 'disabled' : ''}>${
      last ? 'Finish ✓' : 'Next →'
    }</button>
  `;
  foot.querySelector('#menu')!.addEventListener('click', renderMenu);
  foot.querySelector('#prev')!.addEventListener('click', () => {
    stepIndex = Math.max(0, stepIndex - 1);
    renderStep();
  });
  foot.querySelector('#next')!.addEventListener('click', () => {
    if (stepIndex === lesson.steps.length - 1) {
      playWin();
      toast(`<b>${lesson.title}</b> complete. ${say('恭喜', 'gung1 hei2')}!`, 'good');
      renderMenu();
    } else {
      stepIndex++;
      renderStep();
    }
  });
}

function unlock() {
  solved = true;
  renderFoot();
}

function wireHandHighlightOnly() {
  table.onTileClick = null;
  table.onTileHover = null;
}

function renderTask(task: Task) {
  const host = document.getElementById('task')!;

  if (task.kind === 'quiz') {
    table.onTileClick = null;
    host.innerHTML = `
      <div class="task">
        <p class="prompt">${task.prompt}</p>
        <div class="options">
          ${task.options
            .map((o, i) => `<button class="opt" data-i="${i}">${o.label}</button>`)
            .join('')}
        </div>
        <div class="verdict"></div>
      </div>`;
    const verdict = host.querySelector('.verdict')!;
    host.querySelectorAll<HTMLButtonElement>('.opt').forEach((btn) =>
      btn.addEventListener('click', () => {
        const o = task.options[+btn.dataset.i!];
        btn.classList.add(o.correct ? 'right' : 'wrong');
        verdict.className = `verdict ${o.correct ? 'good' : 'bad'}`;
        verdict.innerHTML = o.why;
        if (o.correct) {
          playGood();
          host.querySelectorAll('.opt').forEach((b) => ((b as HTMLButtonElement).disabled = true));
          unlock();
        } else {
          playWrong();
        }
      }),
    );
    return;
  }

  const hand = lesson.steps[stepIndex].layout!.hand;

  if (task.kind === 'pick') {
    host.innerHTML = `
      <div class="task">
        <p class="prompt">${task.prompt}</p>
        <p class="nudge">Click a tile on the table.</p>
        <div class="verdict"></div>
        <button class="ghost small" id="hint">Need a hint?</button>
      </div>`;
    const verdict = host.querySelector('.verdict')!;
    host.querySelector('#hint')!.addEventListener('click', () => toast(task.hint, 'info'));

    table.onTileClick = (t: TileHandle) => {
      if (t.group !== 'hand' || solved) return;
      if (task.accept(t.id, t.index, hand)) {
        playGood();
        table.markHand({ [t.index]: '#3ddc84' }, true);
        verdict.className = 'verdict good';
        verdict.innerHTML = `${tileChip(t.id)} ${task.success}`;
        unlock();
      } else {
        playWrong();
        table.markHand({ [t.index]: '#ff5566' });
        verdict.className = 'verdict bad';
        verdict.innerHTML = `${tileChip(t.id)} ${task.wrong ? task.wrong(t.id) : 'Not that one.'}`;
        setTimeout(() => !solved && table.clearMarks(), 900);
      }
    };
    return;
  }

  // pickMany
  host.innerHTML = `
    <div class="task">
      <p class="prompt">${task.prompt}</p>
      <p class="nudge">Click tiles to select. <span id="count">0</span>/${task.answer.length} chosen.</p>
      <div class="verdict"></div>
      <button class="ghost small" id="hint">Need a hint?</button>
    </div>`;
  const verdict = host.querySelector('.verdict')!;
  const count = host.querySelector('#count')!;
  host.querySelector('#hint')!.addEventListener('click', () => toast(task.hint, 'info'));

  table.onTileClick = (t: TileHandle) => {
    if (t.group !== 'hand' || solved) return;
    const at = selection.indexOf(t.index);
    if (at >= 0) selection.splice(at, 1);
    else selection.push(t.index);
    playSelect();

    table.markHand(Object.fromEntries(selection.map((i) => [i, '#f5c542'])), false);
    count.textContent = String(selection.length);

    if (selection.length !== task.answer.length) {
      verdict.className = 'verdict';
      verdict.innerHTML = '';
      return;
    }
    const ok =
      [...selection].sort((a, b) => a - b).join() === [...task.answer].sort((a, b) => a - b).join();
    if (ok) {
      playGood();
      table.markHand(Object.fromEntries(task.answer.map((i) => [i, '#3ddc84'])), true);
      verdict.className = 'verdict good';
      verdict.innerHTML = task.success;
      unlock();
    } else {
      playWrong();
      verdict.className = 'verdict bad';
      verdict.innerHTML = 'Not quite — click a tile again to deselect it and try another.';
    }
  };
}

/* ============================================================ vs computer == */
//
// A real 4-seat table: you sit East (dealer), three bots sit South/West/North.
// Turn order is E → S → W → N → E, matching "Taking a Turn". Bots are
// deliberately passive — they draw, self-kong never, and discard by greedy
// shanten minimisation (see bot.ts) — they never claim from you or from each
// other. That's a real scope limit, not an oversight: see the README. What
// *is* real: you can pung/kong/chow/win off any bot discard, the turn jumps
// to you correctly when you claim, and a bot can self-draw a genuine win that
// ends the hand against you.

type Seat = 'e' | 's' | 'w' | 'n';
const SEATS: Seat[] = ['e', 's', 'w', 'n'];
const SEAT_LABEL: Record<Seat, string> = { e: 'You', s: 'South Bot', w: 'West Bot', n: 'North Bot' };
const SEAT_TILE: Record<Seat, string> = { e: 'we', s: 'ws', w: 'ww', n: 'wn' };

interface SeatState {
  hand: string[];
  melds: TileSet[];
  flowers: string[];
}

type ClaimKind = 'win' | 'pung' | 'kong' | 'chow';
interface ClaimOption {
  kind: ClaimKind;
  /** Chow only: the two hand tiles that combine with the discard. */
  chowWith?: [string, string];
}

interface Game {
  wall: string[];
  seats: Record<Seat, SeatState>;
  turnIndex: number;
  /** True right after a claimed pung/chow: the claimant discards without drawing. */
  skipDraw: boolean;
  drawn: string | null;
  isKongReplacement: boolean;
  isLastTile: boolean;
  pond: Array<{ seat: Seat; tile: string }>;
  turn: number;
  phase: 'human' | 'claim' | 'over';
  pending: { seat: Seat; tile: string; options: ClaimOption[] } | null;
  outcome:
    | null
    | { kind: 'humanWin'; result: ScoreResult; claimedFrom?: Seat }
    | { kind: 'botWin'; seat: Seat; result: ScoreResult }
    | { kind: 'draw' };
  thinking: Seat | null;
}

let g: Game;

function startGame() {
  g = {
    wall: shuffle(buildDeck()),
    seats: {
      e: { hand: [], melds: [], flowers: [] },
      s: { hand: [], melds: [], flowers: [] },
      w: { hand: [], melds: [], flowers: [] },
      n: { hand: [], melds: [], flowers: [] },
    },
    turnIndex: 0,
    skipDraw: false,
    drawn: null,
    isKongReplacement: false,
    isLastTile: false,
    pond: [],
    turn: 0,
    phase: 'human',
    pending: null,
    outcome: null,
    thinking: null,
  };
  for (const seat of SEATS) {
    while (g.seats[seat].hand.length < 13) drawOneInto(seat, g.seats[seat].hand);
    g.seats[seat].hand = sortHand(g.seats[seat].hand);
  }
  playShuffle(40);
  humanTurnStart();
}

/** Pull one tile for `seat`, diverting bonus tiles to that seat's flower rack. Returns null once the wall is empty. */
function drawOneInto(seat: Seat, dest: string[]): string | null {
  for (;;) {
    const t = g.wall.pop();
    if (!t) return null;
    if (def(t).kind === 'bonus') {
      g.seats[seat].flowers.push(t);
      continue;
    }
    dest.push(t);
    return t;
  }
}

function removeCopies(arr: string[], id: string, n: number) {
  for (let i = 0; i < n; i++) {
    const idx = arr.indexOf(id);
    if (idx < 0) break;
    arr.splice(idx, 1);
  }
}

function endDraw() {
  g.outcome = { kind: 'draw' };
  g.phase = 'over';
  toast(`The wall is empty — this hand is a draw (${say('流局', 'lau4 guk6')}).`, 'info');
  renderGame();
}

/* --------------------------------------------------------------- human turn */

function humanFullHand(): string[] {
  return g.drawn ? [...g.seats.e.hand, g.drawn] : [...g.seats.e.hand];
}

function humanTurnStart() {
  g.phase = 'human';
  g.pending = null;
  g.thinking = null;
  if (g.skipDraw) {
    g.skipDraw = false;
    g.drawn = null;
  } else {
    if (g.wall.length === 0) return endDraw();
    const tmp: string[] = [];
    const t = drawOneInto('e', tmp);
    g.drawn = t;
    g.isKongReplacement = false;
    g.isLastTile = g.wall.length === 0 && t !== null;
    g.turn++;
    if (!t) return endDraw();
  }
  renderGame();
}

/** Only concealed and added kongs happen from your own turn; a claimed kong is handled in resolveClaim. */
function humanKongAvailable(): 'concealed' | 'added' | null {
  if (!g.drawn) return null;
  const hand = g.seats.e.hand;
  if (hand.filter((t) => t === g.drawn).length >= 3) return 'concealed';
  if (g.seats.e.melds.some((m) => m.kind === 'pung' && m.tiles[0] === g.drawn)) return 'added';
  return null;
}

function declareHumanKong() {
  const style = humanKongAvailable();
  if (!style || !g.drawn) return;
  const id = g.drawn;
  const seat = g.seats.e;

  if (style === 'concealed') {
    removeCopies(seat.hand, id, 3);
    seat.melds.push({ kind: 'kong', tiles: [id, id, id, id], exposed: false, kongStyle: 'concealed' });
  } else {
    const m = seat.melds.find((meld) => meld.kind === 'pung' && meld.tiles[0] === id)!;
    m.kind = 'kong';
    m.tiles.push(id);
    m.kongStyle = 'added';
  }

  playSelect();
  const tmp: string[] = [];
  const t = drawOneInto('e', tmp);
  g.drawn = t;
  g.isKongReplacement = true;
  g.isLastTile = g.wall.length === 0 && t !== null;
  if (!t) return endDraw();
  renderGame();
}

function humanDeclareWin() {
  const hand = humanFullHand();
  const r = score({
    concealed: hand,
    melds: g.seats.e.melds,
    flowers: g.seats.e.flowers,
    selfDraw: true,
    seatWind: 'e',
    roundWind: 'e',
    isLastTile: g.isLastTile,
    isKongReplacement: g.isKongReplacement,
  });
  if (!r.canDeclare) return;
  g.outcome = { kind: 'humanWin', result: r };
  g.phase = 'over';
  playWin();
  renderGame();
}

function humanDiscard(index: number) {
  const hand = humanFullHand();
  const rest = hand.slice();
  const [tile] = rest.splice(index, 1);
  g.seats.e.hand = sortHand(rest);
  g.drawn = null;
  g.pond.push({ seat: 'e', tile });
  playDrop();
  advanceAfter('e');
}

/* ------------------------------------------------------------------- bots */

function advanceAfter(seat: Seat) {
  g.turnIndex = (SEATS.indexOf(seat) + 1) % 4;
  const next = SEATS[g.turnIndex];
  if (next === 'e') {
    humanTurnStart();
  } else {
    g.thinking = next;
    g.phase = 'human';
    renderGame();
    setTimeout(() => botTurn(next), 550);
  }
}

function botTurn(seat: Seat) {
  if (g.wall.length === 0) return endDraw();
  const s = g.seats[seat];
  const t = drawOneInto(seat, s.hand);
  g.turn++;
  if (!t) return endDraw();
  const isLast = g.wall.length === 0;

  if (isWinningHand(s.hand, s.melds)) {
    const r = score({
      concealed: s.hand,
      melds: s.melds,
      flowers: s.flowers,
      selfDraw: true,
      seatWind: seat,
      roundWind: 'e',
      isLastTile: isLast,
    });
    if (r.canDeclare) {
      g.outcome = { kind: 'botWin', seat, result: r };
      g.phase = 'over';
      g.thinking = null;
      playWrong();
      renderGame();
      return;
    }
  }

  const discard = chooseBotDiscard(s.hand, s.melds.length);
  removeCopies(s.hand, discard, 1);
  g.pond.push({ seat, tile: discard });

  const claims = computeHumanClaims(seat, discard);
  if (claims.length) {
    g.pending = { seat, tile: discard, options: claims };
    g.phase = 'claim';
    g.thinking = null;
    renderGame();
  } else {
    advanceAfter(seat);
  }
}

/* ------------------------------------------------------------------ claims */

function computeHumanClaims(fromSeat: Seat, tile: string): ClaimOption[] {
  const hand = g.seats.e.hand;
  const out: ClaimOption[] = [];
  const count = hand.filter((t) => t === tile).length;

  const candidate = [...hand, tile];
  if (isWinningHand(candidate, g.seats.e.melds)) {
    const r = score({
      concealed: candidate,
      melds: g.seats.e.melds,
      flowers: g.seats.e.flowers,
      selfDraw: false,
      seatWind: 'e',
      roundWind: 'e',
      isLastDiscard: g.wall.length === 0,
    });
    if (r.canDeclare) out.push({ kind: 'win' });
  }
  if (count >= 3) out.push({ kind: 'kong' });
  if (count >= 2) out.push({ kind: 'pung' });
  // Chow is only legal from the player whose turn passes to yours — the seat
  // immediately before you in turn order, i.e. North for the human at East.
  if (fromSeat === 'n') {
    const d = def(tile);
    if (d.kind === 'suit') {
      for (const [a, b] of [
        [-2, -1],
        [-1, 1],
        [1, 2],
      ] as const) {
        const ra = d.rank! + a;
        const rb = d.rank! + b;
        if (ra < 1 || ra > 9 || rb < 1 || rb > 9) continue;
        const ta = `${d.suit}${ra}`;
        const tb = `${d.suit}${rb}`;
        if (hand.includes(ta) && hand.includes(tb)) out.push({ kind: 'chow', chowWith: [ta, tb] });
      }
    }
  }
  return out;
}

function takeClaimedTile(fromSeat: Seat, tile: string) {
  for (let i = g.pond.length - 1; i >= 0; i--) {
    if (g.pond[i].seat === fromSeat && g.pond[i].tile === tile) {
      g.pond.splice(i, 1);
      return;
    }
  }
}

function resolveClaim(opt: ClaimOption) {
  if (!g.pending) return;
  const { seat: fromSeat, tile } = g.pending;
  const seat = g.seats.e;

  if (opt.kind === 'win') {
    const r = score({
      concealed: [...seat.hand, tile],
      melds: seat.melds,
      flowers: seat.flowers,
      selfDraw: false,
      seatWind: 'e',
      roundWind: 'e',
      isLastDiscard: g.wall.length === 0,
    });
    // computeHumanClaims already gates this on canDeclare, but a claim is
    // irreversible (the discard leaves the pond) — recheck before committing
    // rather than trust the caller filtered correctly.
    if (!r.canDeclare) return;
    takeClaimedTile(fromSeat, tile);
    g.outcome = { kind: 'humanWin', result: r, claimedFrom: fromSeat };
    g.phase = 'over';
    playWin();
    renderGame();
    return;
  }

  if (opt.kind === 'pung') {
    takeClaimedTile(fromSeat, tile);
    removeCopies(seat.hand, tile, 2);
    seat.melds.push({ kind: 'pung', tiles: [tile, tile, tile], exposed: true });
    g.turnIndex = 0;
    g.skipDraw = true;
    playSelect();
    humanTurnStart();
    return;
  }

  if (opt.kind === 'kong') {
    takeClaimedTile(fromSeat, tile);
    removeCopies(seat.hand, tile, 3);
    seat.melds.push({ kind: 'kong', tiles: [tile, tile, tile, tile], exposed: true, kongStyle: 'claimed' });
    g.turnIndex = 0;
    playSelect();
    const tmp: string[] = [];
    const t = drawOneInto('e', tmp);
    g.drawn = t;
    g.isKongReplacement = true;
    g.isLastTile = g.wall.length === 0 && t !== null;
    g.phase = 'human';
    g.pending = null;
    if (!t) return endDraw();
    renderGame();
    return;
  }

  // chow
  takeClaimedTile(fromSeat, tile);
  removeCopies(seat.hand, opt.chowWith![0], 1);
  removeCopies(seat.hand, opt.chowWith![1], 1);
  const tiles = [tile, ...opt.chowWith!].sort((a, b) => sortKey(a) - sortKey(b));
  seat.melds.push({ kind: 'chow', tiles, exposed: true });
  g.turnIndex = 0;
  g.skipDraw = true;
  playSelect();
  humanTurnStart();
}

function passClaim() {
  if (!g.pending) return;
  const fromSeat = g.pending.seat;
  g.pending = null;
  advanceAfter(fromSeat);
}

/* ------------------------------------------------------------------ render */

const CLAIM_LABEL: Record<ClaimKind, string> = { win: '食糊 Win', pung: '碰 Pung', kong: '槓 Kong', chow: '上 Chow' };

function renderGame() {
  const hand = humanFullHand();
  table.setLayout({
    hand,
    discards: g.pond.map((x) => x.tile).slice(-24),
    melds: g.seats.e.melds.map((m) => m.tiles),
    wall: Math.min(14, g.wall.length / 8),
  });
  table.clearMarks();
  if (g.drawn) table.markHand({ [hand.length - 1]: '#f5c542' }, false);

  if (g.outcome) return renderOutcome();

  const opponents = (['s', 'w', 'n'] as Seat[])
    .map((seat) => {
      const s = g.seats[seat];
      const melds = s.melds.length
        ? `<div class="chips">${s.melds.flatMap((m) => m.tiles).map(tileChip).join('')}</div>`
        : '';
      return `
        <div class="opp ${g.thinking === seat ? 'thinking' : ''}">
          <div class="opp-head">
            <b>${say(def(SEAT_TILE[seat]).cn, def(SEAT_TILE[seat]).jyut)}</b>
            <span>${SEAT_LABEL[seat]}</span>
            <small>${s.hand.length} tiles${g.thinking === seat ? ' · thinking…' : ''}</small>
          </div>
          ${melds}
        </div>`;
    })
    .join('');

  if (g.phase === 'claim' && g.pending) {
    const { seat: fromSeat, tile, options } = g.pending;
    content.innerHTML = `
      <div class="crumb">🎮 Play vs Computer · Dealer, East round (${say('莊家', 'zong1 gaa1')} · ${say('圈風東', 'hyun1 fung1 dung1')})</div>
      <div class="opp-row">${opponents}</div>
      <div class="coach kong-offer">
        <p><b>${SEAT_LABEL[fromSeat]}</b> discarded ${tileChip(tile)} <b>${def(tile).cn}</b> <i class="jyut">${def(tile).jyut}</i> — ${def(tile).en}. Claim it?</p>
        <div class="options">
          ${options
            .map((o, i) => `<button class="opt" data-claim="${i}">${CLAIM_LABEL[o.kind]}</button>`)
            .join('')}
          <button class="opt" id="pass-btn">Pass</button>
        </div>
      </div>
    `;
    foot.innerHTML = `<button class="ghost" id="menu">Menu</button><button class="ghost" id="redeal">New deal</button>`;
    foot.querySelector('#menu')!.addEventListener('click', renderMenu);
    foot.querySelector('#redeal')!.addEventListener('click', startGame);
    content.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) =>
      btn.addEventListener('click', () => resolveClaim(options[+btn.dataset.claim!])),
    );
    content.querySelector('#pass-btn')!.addEventListener('click', passClaim);
    table.onTileClick = null;
    table.onTileHover = null;
    return;
  }

  if (g.thinking) {
    // Transitional frame between your discard and a bot resolving its turn —
    // g.drawn is null here, so this can't reuse the full human-turn template.
    content.innerHTML = `
      <div class="crumb">🎮 Play vs Computer · Dealer, East round (${say('莊家', 'zong1 gaa1')} · ${say('圈風東', 'hyun1 fung1 dung1')})</div>
      <div class="opp-row">${opponents}</div>
      <p class="lede">${SEAT_LABEL[g.thinking]} is thinking…</p>
      ${g.seats.e.flowers.length ? `<div class="coach"><h3>Flowers</h3><div class="chips">${g.seats.e.flowers.map(tileChip).join('')}</div></div>` : ''}
    `;
    foot.innerHTML = `<button class="ghost" id="menu">Menu</button><button class="ghost" id="redeal">New deal</button>`;
    foot.querySelector('#menu')!.addEventListener('click', renderMenu);
    foot.querySelector('#redeal')!.addEventListener('click', startGame);
    table.onTileClick = null;
    table.onTileHover = null;
    return;
  }

  // g.phase === 'human', a real turn: g.drawn is guaranteed set.
  const meldCount = g.seats.e.melds.length;
  const s = shanten(hand.length === 14 ? g.seats.e.hand : hand, meldCount);
  const ready = s === 0;
  const won = isWinningHand(hand, g.seats.e.melds);
  const declareOk =
    won &&
    score({
      concealed: hand,
      melds: g.seats.e.melds,
      flowers: g.seats.e.flowers,
      selfDraw: true,
      seatWind: 'e',
      roundWind: 'e',
      isLastTile: g.isLastTile,
      isKongReplacement: g.isKongReplacement,
    }).canDeclare;
  const waits = ready ? waitingTiles(g.seats.e.hand, g.seats.e.melds) : [];
  const useful = !ready && !won ? usefulTiles(g.seats.e.hand, meldCount) : [];
  const kongStyle = humanKongAvailable();

  content.innerHTML = `
    <div class="crumb">🎮 Play vs Computer · Dealer, East round (${say('莊家', 'zong1 gaa1')} · ${say('圈風東', 'hyun1 fung1 dung1')})</div>
    <div class="opp-row">${opponents}</div>
    <div class="stat-row">
      <div class="stat"><b>${g.turn}</b><small>turns</small></div>
      <div class="stat"><b>${g.wall.length}</b><small>wall left</small></div>
      <div class="stat ${ready ? 'hot' : ''}"><b>${declareOk ? '🎉' : ready ? '聽' : s}</b><small>${
        declareOk ? 'winning hand' : ready ? 'ready · teng1 paai4' : 'tiles from ready'
      }</small></div>
    </div>

    <p class="lede">${
      g.drawn
        ? `You drew ${tileChip(g.drawn)} <b>${def(g.drawn).cn}</b> <i class="jyut">${def(g.drawn).jyut}</i> — ${def(g.drawn).en}${
            g.isKongReplacement ? ` — a kong replacement (${say('槓上開花', 'gong3 soeng6 hoi1 faa1')} if it wins you the hand)` : ''
          }. Click any tile on the table to discard it.`
        : `You claimed the discard — no draw this turn. Click any tile on the table to discard it.`
    }</p>

    ${
      declareOk
        ? `<div class="coach kong-offer"><p>Your hand is complete and clears the faan minimum.</p><button class="primary" id="win-btn">${say('食糊', 'sik6 wu2')} — Declare Win</button></div>`
        : won
          ? `<div class="coach"><p class="bad-text">Structurally complete, but a ${say('雞糊', 'gai1 wu2')} chicken hand — no scoring pattern yet. Keep playing.</p></div>`
          : ''
    }
    ${
      !declareOk && kongStyle
        ? `<div class="coach kong-offer">
            <p>You hold ${kongStyle === 'concealed' ? 'three' : 'an exposed pung'} of this tile — you may declare a
            ${say(kongStyle === 'concealed' ? '暗槓' : '加槓', kongStyle === 'concealed' ? 'am3 gong3' : 'gaa1 gong3')}
            (${kongStyle} kong) and draw a replacement.</p>
            <button class="primary" id="kong-btn">Declare Kong 槓</button>
          </div>`
        : ''
    }
    <div class="coach">
      <h3>Coach</h3>
      ${
        ready
          ? `<p class="good-text">You are <b>ready</b> (${say('聽牌', 'teng1 paai4')}). Any of these wins:</p><div class="chips">${waits.map(tileChip).join('')}</div>`
          : won
            ? ''
            : `<p>You are <b>${s}</b> tile${s === 1 ? '' : 's'} from ready. These would bring you closer:</p><div class="chips">${
                useful.length ? useful.map(tileChip).join('') : '<i>nothing useful left</i>'
              }</div>`
      }
      <p class="fine">Discards that keep you at ${s} shanten are safe; anything else costs you a turn. Hover a hand tile to see what dropping it would do.</p>
    </div>

    ${g.seats.e.flowers.length ? `<div class="coach"><h3>Flowers</h3><div class="chips">${g.seats.e.flowers.map(tileChip).join('')}</div></div>` : ''}
  `;

  foot.innerHTML = `
    <button class="ghost" id="menu">Menu</button>
    <button class="ghost" id="redeal">New deal</button>
    <button class="primary" id="sort">Sort hand</button>
  `;
  foot.querySelector('#menu')!.addEventListener('click', renderMenu);
  foot.querySelector('#redeal')!.addEventListener('click', startGame);
  foot.querySelector('#sort')!.addEventListener('click', () => {
    g.seats.e.hand = sortHand(g.seats.e.hand);
    renderGame();
  });
  document.getElementById('kong-btn')?.addEventListener('click', declareHumanKong);
  document.getElementById('win-btn')?.addEventListener('click', humanDeclareWin);

  table.onTileHover = (t) => {
    const el = document.querySelector('.coach .fine');
    if (!el) return;
    if (!t || t.group !== 'hand') {
      el.textContent = `Discards that keep you at ${s} shanten are safe; anything else costs you a turn. Hover a hand tile to see what dropping it would do.`;
      return;
    }
    const rest = hand.slice();
    rest.splice(t.index, 1);
    const after = shanten(rest, meldCount);
    el.innerHTML =
      after <= s
        ? `Dropping ${say(def(t.id).cn, def(t.id).jyut)} keeps you at <b>${after === 0 ? 'ready' : after}</b>. Fine discard.`
        : `Dropping ${say(def(t.id).cn, def(t.id).jyut)} sets you back to <b>${after}</b>. It is doing real work.`;
  };

  table.onTileClick = (t) => {
    if (t.group !== 'hand') return;
    humanDiscard(t.index);
  };
}

function scoreList(r: ScoreResult): string {
  return r.patterns.length
    ? `<ul class="score">${r.patterns
        .map(
          (h) =>
            `<li><b>${h.rule.cn}</b> <i class="jyut">${h.rule.jyut}</i> ${h.rule.en}${
              h.count > 1 ? ` ×${h.count}` : ''
            }<span>${h.rule.faan * h.count}</span></li>`,
        )
        .join('')}</ul>`
    : `<p>No scoring pattern at all — a ${say('雞糊', 'gai1 wu2')} chicken hand.</p>`;
}

function renderOutcome() {
  table.onTileClick = null;
  table.onTileHover = null;

  let body = '';
  if (g.outcome!.kind === 'draw') {
    body = `<div class="coach"><h3>${say('流局', 'lau4 guk6')} — Wall exhausted</h3><p>No one completed a hand. Deal again.</p></div>`;
  } else if (g.outcome!.kind === 'humanWin') {
    const { result: r, claimedFrom } = g.outcome!;
    const hand = [...g.seats.e.hand, ...g.seats.e.melds.flatMap((m) => m.tiles)];
    body = `
      <div class="coach win">
        <h3>${say('食糊', 'sik6 wu2')}! You win${claimedFrom ? ` — claimed off ${SEAT_LABEL[claimedFrom]}` : ' — self-drawn'}.</h3>
        <div class="chips big">${hand.map(tileChip).join('')}</div>
        ${scoreList(r)}
        <p class="total"><b>${r.faan}</b> faan${r.faan > r.cappedFaan ? ` (capped at ${r.cappedFaan})` : ''}</p>
        <p class="good-text">${
          claimedFrom
            ? `${SEAT_LABEL[claimedFrom]} pays <b>${r.payout.fromDiscarder}</b> alone.`
            : `Self-drawn, so all three opponents pay <b>${r.payout.fromEach}</b> each.`
        }</p>
      </div>`;
  } else {
    const { seat, result: r } = g.outcome!;
    const s = g.seats[seat];
    const hand = [...s.hand, ...s.melds.flatMap((m) => m.tiles)];
    body = `
      <div class="coach">
        <h3 class="bad-text">${SEAT_LABEL[seat]} wins this hand.</h3>
        <p class="fine">Their hand, revealed:</p>
        <div class="chips big">${hand.map(tileChip).join('')}</div>
        ${scoreList(r)}
        <p class="total"><b>${r.faan}</b> faan${r.faan > r.cappedFaan ? ` (capped at ${r.cappedFaan})` : ''}</p>
        <p class="bad-text">You pay <b>${r.payout.fromEach}</b> as one of three losing seats.</p>
      </div>`;
  }

  content.innerHTML = `
    <div class="crumb">🎮 Play vs Computer</div>
    ${body}
  `;
  foot.innerHTML = `
    <button class="ghost" id="menu">Menu</button>
    <button class="primary" id="redeal">New deal</button>
  `;
  foot.querySelector('#menu')!.addEventListener('click', renderMenu);
  foot.querySelector('#redeal')!.addEventListener('click', startGame);
}

/* ================================================================== boot == */

renderMenu();
