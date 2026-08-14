/**
 * App shell: lesson runner + practice table, both driving the same 3D Table.
 */

import './style.css';
import { Table } from './scene';
import type { TileHandle } from './scene';
import { LESSONS } from './lessons';
import type { Lesson, Step, Task } from './lessons';
import { faceDataUrl } from './textures';
import { buildDeck, def, shuffle, sortHand } from './tiles';
import {
  HOUSE_RULES,
  isWinningHand,
  score,
  shanten,
  usefulTiles,
  waitingTiles,
} from './rules';
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
  return `<img class="chip" src="${faceDataUrl(id)}" alt="${d.en}" title="${d.cn} ${d.jyut} — ${d.en}">`;
}

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
    <p class="lede">Six short lessons and a practice table. Everything is clickable — you learn by touching the tiles, not by reading about them.</p>
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
          <b>Practice table</b>
          <small>Draw and discard with a live coach</small>
        </span>
        <span class="card-len">∞</span>
      </button>
    </div>
    <button class="ghost" id="rules-btn">House rules used here</button>
  `;
  foot.innerHTML = '';

  content.querySelectorAll<HTMLElement>('[data-lesson]').forEach((el) =>
    el.addEventListener('click', () => startLesson(el.dataset.lesson!)),
  );
  content.querySelector('[data-practice]')!.addEventListener('click', startPractice);
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

/* ============================================================== practice == */

interface Practice {
  wall: string[];
  hand: string[];
  drawn: string | null;
  discards: string[];
  flowers: string[];
  turn: number;
}

let p: Practice;

function startPractice() {
  const deck = shuffle(buildDeck());
  p = { wall: deck, hand: [], drawn: null, discards: [], flowers: [], turn: 0 };
  playShuffle(30);

  while (p.hand.length < 13) drawInto(p.hand);
  p.hand = sortHand(p.hand);
  draw();
}

/** Pull one tile, diverting bonus tiles to the flower rack. */
function drawInto(dest: string[]) {
  for (;;) {
    const t = p.wall.pop();
    if (!t) return;
    if (def(t).kind === 'bonus') {
      p.flowers.push(t);
      continue;
    }
    dest.push(t);
    return;
  }
}

function draw() {
  const tmp: string[] = [];
  drawInto(tmp);
  p.drawn = tmp[0] ?? null;
  p.turn++;
  renderPractice();
}

function fullHand(): string[] {
  return p.drawn ? [...p.hand, p.drawn] : [...p.hand];
}

function renderPractice() {
  const hand = fullHand();
  table.setLayout({ hand, discards: p.discards.slice(-24), wall: Math.min(14, p.wall.length / 8) });
  table.clearMarks();
  // The freshly drawn tile sits at the end, held slightly apart by the glow.
  if (p.drawn) table.markHand({ [hand.length - 1]: '#f5c542' }, false);

  const won = isWinningHand(hand);
  const s = shanten(hand.length === 14 ? p.hand : hand);
  const ready = s === 0;
  const waits = ready ? waitingTiles(p.hand) : [];
  const useful = !ready && !won ? usefulTiles(p.hand) : [];

  content.innerHTML = `
    <div class="crumb">🎮 Practice table</div>
    <div class="stat-row">
      <div class="stat"><b>${p.turn}</b><small>turns</small></div>
      <div class="stat"><b>${p.wall.length}</b><small>wall left</small></div>
      <div class="stat ${ready ? 'hot' : ''}"><b>${won ? '🎉' : ready ? '聽' : s}</b><small>${
        won ? 'winning hand' : ready ? 'ready · teng1 paai4' : 'tiles from ready'
      }</small></div>
    </div>

    ${
      won
        ? renderWin(hand)
        : `
      <p class="lede">You drew ${tileChip(p.drawn!)} <b>${def(p.drawn!).cn}</b> <i class="jyut">${def(p.drawn!).jyut}</i> — ${def(p.drawn!).en}. Click any tile on the table to discard it.</p>
      <div class="coach">
        <h3>Coach</h3>
        ${
          ready
            ? `<p class="good-text">You are <b>ready</b> (${say('聽牌', 'teng1 paai4')}). Any of these wins:</p><div class="chips">${waits.map(tileChip).join('')}</div>`
            : `<p>You are <b>${s}</b> tile${s === 1 ? '' : 's'} from ready. These would bring you closer:</p><div class="chips">${
                useful.length ? useful.map(tileChip).join('') : '<i>nothing useful left</i>'
              }</div>`
        }
        <p class="fine">Discards that keep you at ${s} shanten are safe; anything else costs you a turn. Hover a hand tile to see what dropping it would do.</p>
      </div>
    `
    }

    ${p.flowers.length ? `<div class="coach"><h3>Flowers</h3><div class="chips">${p.flowers.map(tileChip).join('')}</div></div>` : ''}
  `;

  foot.innerHTML = `
    <button class="ghost" id="menu">Menu</button>
    <button class="ghost" id="redeal">New deal</button>
    ${won ? '' : '<button class="primary" id="sort">Sort hand</button>'}
  `;
  foot.querySelector('#menu')!.addEventListener('click', renderMenu);
  foot.querySelector('#redeal')!.addEventListener('click', startPractice);
  foot.querySelector('#sort')?.addEventListener('click', () => {
    p.hand = sortHand(p.hand);
    renderPractice();
  });

  if (won) {
    playWin();
    table.onTileClick = null;
    table.onTileHover = null;
    return;
  }

  table.onTileHover = (t) => {
    const el = document.querySelector('.coach .fine');
    if (!el) return;
    if (!t || t.group !== 'hand') {
      el.textContent = `Discards that keep you at ${s} shanten are safe; anything else costs you a turn. Hover a hand tile to see what dropping it would do.`;
      return;
    }
    const rest = hand.slice();
    rest.splice(t.index, 1);
    const after = shanten(rest);
    el.innerHTML =
      after <= s
        ? `Dropping ${say(def(t.id).cn, def(t.id).jyut)} keeps you at <b>${after === 0 ? 'ready' : after}</b>. Fine discard.`
        : `Dropping ${say(def(t.id).cn, def(t.id).jyut)} sets you back to <b>${after}</b>. It is doing real work.`;
  };

  table.onTileClick = (t) => {
    if (t.group !== 'hand') return;
    const rest = hand.slice();
    const [discarded] = rest.splice(t.index, 1);
    playDrop();
    p.hand = sortHand(rest);
    p.discards.push(discarded);
    p.drawn = null;
    if (p.wall.length === 0) {
      toast(`The wall is empty — this deal is a draw (${say('流局', 'lau4 guk6')}). Deal again?`, 'info');
      renderPractice();
      return;
    }
    draw();
  };
}

function renderWin(hand: string[]): string {
  const r = score({ concealed: hand, flowers: p.flowers, selfDraw: true, seatWind: 'e', roundWind: 'e' });
  return `
    <div class="coach win">
      <h3>${
        r.canDeclare ? `${say('食糊', 'sik6 wu2')}! You win.` : 'Complete — but you cannot declare.'
      }</h3>
      <div class="chips big">${hand.map(tileChip).join('')}</div>
      ${
        r.patterns.length
          ? `<ul class="score">${r.patterns
              .map(
                (h) =>
                  `<li><b>${h.rule.cn}</b> <i class="jyut">${h.rule.jyut}</i> ${h.rule.en}${
                    h.count > 1 ? ` ×${h.count}` : ''
                  }<span>${h.rule.faan * h.count}</span></li>`,
              )
              .join('')}</ul>`
          : `<p>No scoring pattern at all — a ${say('雞糊', 'gai1 wu2')} chicken hand.</p>`
      }
      <p class="total"><b>${r.faan}</b> faan${r.faan > r.cappedFaan ? ` (capped at ${r.cappedFaan})` : ''}</p>
      <p class="${r.canDeclare ? 'good-text' : 'bad-text'}">${
        r.canDeclare
          ? `Over the ${HOUSE_RULES.minimumFaan}-faan minimum. Self-drawn, so all three opponents pay <b>${r.payout.fromEach}</b> each.`
          : `Below the ${HOUSE_RULES.minimumFaan}-faan minimum — you must keep playing and build a pattern. This is the lesson that costs every beginner their first evening.`
      }</p>
    </div>`;
}

/* ================================================================== boot == */

renderMenu();
