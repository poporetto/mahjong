/**
 * Hong Kong Old Style rules — hand structure, shanten, and the faan table.
 *
 * IMPORTANT: HK Old Style is a family of house rules, not one fixed code. The
 * faan values, the minimum, and the limit below are ONE common table. They are
 * all collected in HOUSE_RULES so a table that plays differently can be matched
 * by editing this single object. The app displays these values to the learner.
 *
 * Everything here is pure — no DOM, no Three.js — so it can be reasoned about
 * and tested on its own.
 */

import { def, isHonour, isTerminalOrHonour, sortKey } from './tiles';

/* ------------------------------------------------------------ house rules -- */

export interface FaanRule {
  id: string;
  cn: string;
  /** Cantonese romanisation of `cn`, in Jyutping. */
  jyut: string;
  en: string;
  faan: number;
  note: string;
}

export const HOUSE_RULES = {
  /** 三番起糊 — you may not declare a win below this. */
  minimumFaan: 3,
  /** 滿糊 — everything at or above this pays the limit. */
  limitFaan: 13,
  /** Payment: the discarder pays the whole amount alone (出銃全包). */
  discarderPaysAll: true,
  patterns: [
    { id: 'chicken', cn: '雞糊', jyut: 'gai1 wu2', en: 'Chicken Hand', faan: 0, note: 'A legal hand with no scoring pattern. Below the minimum, so it cannot win.' },
    { id: 'allchow', cn: '平糊', jyut: 'peng4 wu2', en: 'All Sequences', faan: 1, note: 'Four runs and a pair that is not a dragon or your wind.' },
    { id: 'concealed', cn: '門前清', jyut: 'mun4 cin4 cing1', en: 'Fully Concealed', faan: 1, note: 'You never claimed a discard.' },
    { id: 'selfdraw', cn: '自摸', jyut: 'zi6 mo1', en: 'Self Draw', faan: 1, note: 'You completed the hand on your own draw.' },
    { id: 'dragonpung', cn: '三元牌', jyut: 'saam1 jyun4 paai2', en: 'Dragon Pung', faan: 1, note: 'One faan per set of 中, 發 or 白.' },
    { id: 'seatwind', cn: '門風', jyut: 'mun4 fung1', en: 'Seat Wind Pung', faan: 1, note: 'A set of your own seat wind.' },
    { id: 'roundwind', cn: '圈風', jyut: 'hyun1 fung1', en: 'Round Wind Pung', faan: 1, note: 'A set of the prevailing wind.' },
    { id: 'flower', cn: '花牌', jyut: 'faa1 paai2', en: 'Your Flower / Season', faan: 1, note: 'One faan for the flower matching your seat.' },
    { id: 'allpungs', cn: '對對糊', jyut: 'deoi3 deoi3 wu2', en: 'All Pungs', faan: 3, note: 'Four triplets and a pair — no runs.' },
    { id: 'halfflush', cn: '混一色', jyut: 'wan6 jat1 sik1', en: 'Half Flush', faan: 3, note: 'One suit plus honours.' },
    { id: 'smalldragons', cn: '小三元', jyut: 'siu2 saam1 jyun4', en: 'Small Dragons', faan: 5, note: 'Two dragon triplets plus a pair of the third.' },
    { id: 'fullflush', cn: '清一色', jyut: 'cing1 jat1 sik1', en: 'Full Flush', faan: 7, note: 'Every tile in one suit, no honours. Some tables play this as 6.' },
    { id: 'bigdragons', cn: '大三元', jyut: 'daai6 saam1 jyun4', en: 'Great Dragons', faan: 8, note: 'Triplets of all three dragons.' },
    { id: 'allhonours', cn: '字一色', jyut: 'zi6 jat1 sik1', en: 'All Honours', faan: 10, note: 'Winds and dragons only.' },
    { id: 'allterminals', cn: '清老頭', jyut: 'cing1 lou5 tau4', en: 'All Terminals', faan: 10, note: 'Only 1s and 9s.' },
    { id: 'thirteen', cn: '十三么', jyut: 'sap6 saam1 jiu1', en: 'Thirteen Orphans', faan: 13, note: 'One of each terminal and honour, plus a duplicate.' },
    { id: 'bigwinds', cn: '大四喜', jyut: 'daai6 sei3 hei2', en: 'Great Four Winds', faan: 13, note: 'Triplets of all four winds.' },
    { id: 'lastdraw', cn: '海底撈月', jyut: 'hoi2 dai2 laau1 jyut6', en: 'Last-Tile Self-Draw', faan: 1, note: 'You drew the very last tile in the wall and it won you the hand.' },
    { id: 'lastdiscard', cn: '河底撈魚', jyut: 'ho4 dai2 laau1 jyu4', en: 'Last Discard', faan: 1, note: 'You won by claiming the last discard of the hand, with the wall exhausted.' },
    { id: 'kongdraw', cn: '槓上開花', jyut: 'gong3 soeng6 hoi1 faa1', en: 'Kong Replacement Win', faan: 1, note: 'The tile you drew to replace a kong completed your hand.' },
    { id: 'kongdiscard', cn: '槓上炮', jyut: 'gong3 soeng6 paau3', en: 'Discard After a Kong', faan: 1, note: 'You won by claiming the discard someone threw right after declaring a kong.' },
    { id: 'robkong', cn: '搶槓', jyut: 'coeng2 gong3', en: 'Robbing the Kong', faan: 1, note: "You completed your hand by claiming the tile someone added to upgrade a pung into a kong." },
  ] as FaanRule[],
} as const;

export const RULE_BY_ID: Record<string, FaanRule> = Object.fromEntries(
  HOUSE_RULES.patterns.map((p) => [p.id, p]),
);

/* --------------------------------------------------------------- counting -- */

export type Counts = Record<string, number>;

export function toCounts(ids: string[]): Counts {
  const c: Counts = {};
  for (const id of ids) c[id] = (c[id] ?? 0) + 1;
  return c;
}

export function fromCounts(c: Counts): string[] {
  const out: string[] = [];
  for (const [id, n] of Object.entries(c)) for (let i = 0; i < n; i++) out.push(id);
  return out.sort((a, b) => sortKey(a) - sortKey(b));
}

function present(c: Counts): string[] {
  return Object.keys(c)
    .filter((k) => c[k] > 0)
    .sort((a, b) => sortKey(a) - sortKey(b));
}

/** The id of the tile `step` ranks above `id` within the same suit, if any. */
function up(id: string, step: number): string | null {
  const d = def(id);
  if (d.kind !== 'suit') return null;
  const r = d.rank! + step;
  return r >= 1 && r <= 9 ? `${d.suit}${r}` : null;
}

/* ---------------------------------------------------------- decomposition -- */

export type SetKind = 'pung' | 'chow' | 'pair' | 'kong';

export type KongStyle =
  /** 暗槓 — declared from a concealed hand, never touched by a claim. */
  | 'concealed'
  /** 明槓 — completed by claiming someone else's discard. */
  | 'claimed'
  /** 加槓 — an existing exposed pung upgraded with a self-drawn 4th tile. */
  | 'added';

export interface TileSet {
  kind: SetKind;
  tiles: string[];
  /** True when the set was formed by claiming a discard. */
  exposed?: boolean;
  /** Kong sets only: how the fourth tile was acquired. */
  kongStyle?: KongStyle;
}

/**
 * A kong still counts as one of the four "sets" in a hand — the fourth tile is
 * extra, replaced by an immediate draw from the dead wall — so scoring code
 * treats 'kong' exactly like 'pung' everywhere except tile count.
 */
function isTripletLike(kind: SetKind): boolean {
  return kind === 'pung' || kind === 'kong';
}

/**
 * Every way the concealed tiles split into `need` melds plus (optionally) the
 * pair. Returns [] when it cannot be done.
 */
function meldSplits(c: Counts, need: number): TileSet[][] {
  if (need === 0) return present(c).length === 0 ? [[]] : [];

  const keys = present(c);
  if (keys.length === 0) return [];
  const t = keys[0];
  const results: TileSet[][] = [];

  // triplet
  if (c[t] >= 3) {
    const next = { ...c, [t]: c[t] - 3 };
    for (const rest of meldSplits(next, need - 1)) {
      results.push([{ kind: 'pung', tiles: [t, t, t] }, ...rest]);
    }
  }

  // run
  const a = up(t, 1);
  const b = up(t, 2);
  if (a && b && (c[a] ?? 0) > 0 && (c[b] ?? 0) > 0) {
    const next = { ...c, [t]: c[t] - 1, [a]: c[a] - 1, [b]: c[b] - 1 };
    for (const rest of meldSplits(next, need - 1)) {
      results.push([{ kind: 'chow', tiles: [t, a, b] }, ...rest]);
    }
  }

  return results;
}

/**
 * All valid 4-sets-and-a-pair readings of a hand. `melds` are already-claimed
 * sets; `concealed` is everything still in hand including the winning tile.
 */
export function winningSplits(concealed: string[], melds: TileSet[] = []): TileSet[][] {
  const need = 4 - melds.length;
  const c = toCounts(concealed);
  const out: TileSet[][] = [];

  for (const t of present(c)) {
    if (c[t] < 2) continue;
    const rest = { ...c, [t]: c[t] - 2 };
    for (const split of meldSplits(rest, need)) {
      out.push([...melds, ...split, { kind: 'pair', tiles: [t, t] }]);
    }
  }
  return out;
}

const THIRTEEN = ['c1', 'c9', 'd1', 'd9', 'b1', 'b9', 'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw'];

export function isThirteenOrphans(concealed: string[]): boolean {
  if (concealed.length !== 14) return false;
  const c = toCounts(concealed);
  if (!THIRTEEN.every((t) => (c[t] ?? 0) >= 1)) return false;
  return Object.keys(c).every((k) => THIRTEEN.includes(k));
}

export function isWinningHand(concealed: string[], melds: TileSet[] = []): boolean {
  return isThirteenOrphans(concealed) || winningSplits(concealed, melds).length > 0;
}

/* ---------------------------------------------------------------- shanten -- */

/**
 * How many tile swaps away from a winning shape. 0 = ready (聽牌), -1 = won.
 * Standard 4-sets-and-a-pair shape only; thirteen orphans is handled separately.
 */
export function shanten(concealed: string[], meldCount = 0): number {
  if (isThirteenOrphans(concealed)) return -1;

  let best = 8;
  const c = toCounts(concealed);

  const search = (counts: Counts, melds: number, partials: number, pair: boolean) => {
    const score = 8 - 2 * melds - Math.min(partials + (pair ? 1 : 0), 4 - melds + (pair ? 1 : 0));
    if (score < best) best = score;

    const keys = present(counts);
    if (keys.length === 0) return;
    const t = keys[0];

    if (melds + partials + (pair ? 1 : 0) >= 5) {
      // Blocks are full; drop the lowest tile and keep looking for a better read.
      search({ ...counts, [t]: counts[t] - 1 }, melds, partials, pair);
      return;
    }

    if (counts[t] >= 3) {
      search({ ...counts, [t]: counts[t] - 3 }, melds + 1, partials, pair);
    }
    const a = up(t, 1);
    const b = up(t, 2);
    if (a && b && (counts[a] ?? 0) > 0 && (counts[b] ?? 0) > 0) {
      search(
        { ...counts, [t]: counts[t] - 1, [a]: counts[a] - 1, [b]: counts[b] - 1 },
        melds + 1,
        partials,
        pair,
      );
    }
    if (counts[t] >= 2) {
      if (!pair) search({ ...counts, [t]: counts[t] - 2 }, melds, partials, true);
      search({ ...counts, [t]: counts[t] - 2 }, melds, partials + 1, pair);
    }
    if (a && (counts[a] ?? 0) > 0) {
      search({ ...counts, [t]: counts[t] - 1, [a]: counts[a] - 1 }, melds, partials + 1, pair);
    }
    if (b && (counts[b] ?? 0) > 0) {
      search({ ...counts, [t]: counts[t] - 1, [b]: counts[b] - 1 }, melds, partials + 1, pair);
    }
    search({ ...counts, [t]: counts[t] - 1 }, melds, partials, pair);
  };

  search(c, meldCount, 0, false);
  return best;
}

const ALL_REGULAR = (() => {
  const out: string[] = [];
  for (const s of ['c', 'd', 'b']) for (let r = 1; r <= 9; r++) out.push(`${s}${r}`);
  return [...out, 'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw'];
})();

/** Tiles that would improve a 13-tile hand (its 進張). */
export function usefulTiles(concealed13: string[], meldCount = 0): string[] {
  const base = shanten(concealed13, meldCount);
  return ALL_REGULAR.filter(
    (t) => shanten([...concealed13, t], meldCount) < base,
  );
}

/** Tiles that complete a ready hand (its 聽牌). */
export function waitingTiles(concealed13: string[], melds: TileSet[] = []): string[] {
  return ALL_REGULAR.filter((t) => isWinningHand([...concealed13, t], melds));
}

/* ---------------------------------------------------------------- scoring -- */

export interface ScoreContext {
  concealed: string[];
  melds?: TileSet[];
  flowers?: string[];
  selfDraw?: boolean;
  /** 'e' | 's' | 'w' | 'n' */
  seatWind?: 'e' | 's' | 'w' | 'n';
  roundWind?: 'e' | 's' | 'w' | 'n';
  /** 海底撈月 — this self-draw was the last tile in the live wall. */
  isLastTile?: boolean;
  /** 河底撈魚 — this claimed discard was the last tile of the hand. */
  isLastDiscard?: boolean;
  /** 槓上開花 — this self-draw was a kong's replacement tile. */
  isKongReplacement?: boolean;
  /** 槓上炮 — this claimed discard was thrown right after a kong. */
  isAfterKong?: boolean;
  /** 搶槓 — this claimed tile was someone's added-kong tile, not a discard. */
  isRobbedKong?: boolean;
}

export interface ScoreResult {
  faan: number;
  cappedFaan: number;
  patterns: Array<{ rule: FaanRule; count: number }>;
  /** Chips paid to the winner by each losing player. */
  payout: { fromDiscarder: number; fromEach: number };
  canDeclare: boolean;
}

const WIND_TILE: Record<string, string> = { e: 'we', s: 'ws', w: 'ww', n: 'wn' };

export function score(ctx: ScoreContext): ScoreResult {
  const melds = ctx.melds ?? [];
  const hits: Array<{ rule: FaanRule; count: number }> = [];
  const add = (id: string, count = 1) => {
    if (count > 0) hits.push({ rule: RULE_BY_ID[id], count });
  };

  const all = [...ctx.concealed, ...melds.flatMap((m) => m.tiles)];

  if (isThirteenOrphans(ctx.concealed)) {
    add('thirteen');
  } else {
    // Score the best-paying reading of the hand.
    const splits = winningSplits(ctx.concealed, melds);
    if (splits.length === 0) {
      return {
        faan: 0,
        cappedFaan: 0,
        patterns: [],
        payout: { fromDiscarder: 0, fromEach: 0 },
        canDeclare: false,
      };
    }
    let bestHits: Array<{ rule: FaanRule; count: number }> = [];
    let bestFaan = -1;
    for (const split of splits) {
      const h = scoreSplit(split, ctx);
      const f = h.reduce((s, x) => s + x.rule.faan * x.count, 0);
      if (f > bestFaan) {
        bestFaan = f;
        bestHits = h;
      }
    }
    hits.push(...bestHits);
  }

  // Hand-wide patterns that do not depend on how the sets are read.
  const suits = new Set(all.filter((t) => def(t).kind === 'suit').map((t) => def(t).suit));
  const honours = all.some(isHonour);
  if (!honours && suits.size === 1) add('fullflush');
  else if (honours && suits.size === 1) add('halfflush');
  else if (honours && suits.size === 0) add('allhonours');
  if (all.every(isTerminalOrHonour) && suits.size > 0 && !all.some(isHonour)) add('allterminals');

  if (ctx.selfDraw) add('selfdraw');
  if (melds.every((m) => !m.exposed)) add('concealed');

  // Situational faan — mutually exclusive by construction (each depends on a
  // different moment in the turn), so no suppression logic is needed.
  if (ctx.isLastTile) add('lastdraw');
  if (ctx.isLastDiscard) add('lastdiscard');
  if (ctx.isKongReplacement) add('kongdraw');
  if (ctx.isAfterKong) add('kongdiscard');
  if (ctx.isRobbedKong) add('robkong');

  const myFlower = ctx.seatWind ? ['e', 's', 'w', 'n'].indexOf(ctx.seatWind) : -1;
  if (myFlower >= 0 && ctx.flowers) {
    const mine = ctx.flowers.filter(
      (f) => f === `f${myFlower + 1}` || f === `s${myFlower + 1}`,
    ).length;
    add('flower', mine);
  }

  // Higher patterns absorb the lower ones they imply.
  const ids = new Set(hits.map((h) => h.rule.id));
  const suppress = (loser: string, byAny: string[]) => {
    if (byAny.some((w) => ids.has(w))) {
      for (let i = hits.length - 1; i >= 0; i--) if (hits[i].rule.id === loser) hits.splice(i, 1);
    }
  };
  suppress('smalldragons', ['bigdragons']);
  suppress('dragonpung', ['bigdragons', 'smalldragons', 'allhonours']);
  suppress('halfflush', ['fullflush', 'allhonours']);
  suppress('allpungs', ['allterminals', 'allhonours', 'bigwinds']);

  const faan = hits.reduce((s, x) => s + x.rule.faan * x.count, 0);
  const cappedFaan = Math.min(faan, HOUSE_RULES.limitFaan);
  const unit = Math.pow(2, cappedFaan);

  return {
    faan,
    cappedFaan,
    patterns: hits,
    payout: ctx.selfDraw
      ? { fromDiscarder: 0, fromEach: unit }
      : { fromDiscarder: unit * 3, fromEach: 0 },
    canDeclare: faan >= HOUSE_RULES.minimumFaan,
  };
}

function scoreSplit(split: TileSet[], ctx: ScoreContext) {
  const hits: Array<{ rule: FaanRule; count: number }> = [];
  const add = (id: string, count = 1) => {
    if (count > 0) hits.push({ rule: RULE_BY_ID[id], count });
  };

  const pungs = split.filter((s) => isTripletLike(s.kind));
  const chows = split.filter((s) => s.kind === 'chow');
  const pair = split.find((s) => s.kind === 'pair');

  const dragonPungs = pungs.filter((p) => def(p.tiles[0]).kind === 'dragon');
  const windPungs = pungs.filter((p) => def(p.tiles[0]).kind === 'wind');
  const pairIsDragon = pair ? def(pair.tiles[0]).kind === 'dragon' : false;

  if (dragonPungs.length === 3) add('bigdragons');
  else if (dragonPungs.length === 2 && pairIsDragon) add('smalldragons');
  else add('dragonpung', dragonPungs.length);

  if (windPungs.length === 4) add('bigwinds');
  else {
    if (ctx.seatWind && windPungs.some((p) => p.tiles[0] === WIND_TILE[ctx.seatWind!])) {
      add('seatwind');
    }
    if (ctx.roundWind && windPungs.some((p) => p.tiles[0] === WIND_TILE[ctx.roundWind!])) {
      add('roundwind');
    }
  }

  if (pungs.length === 4) add('allpungs');
  if (chows.length === 4 && pair && def(pair.tiles[0]).kind === 'suit') add('allchow');

  return hits;
}
