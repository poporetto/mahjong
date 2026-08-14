/**
 * Tile identity + the 144-tile Hong Kong deck. Pure data — no Three.js in here.
 *
 * A tile is identified by a short code that doubles as a texture-cache key:
 *   c1..c9  characters (萬)   d1..d9  dots/circles (筒)   b1..b9  bamboo (索)
 *   we ws ww wn  winds (東南西北)      dr dg dw  dragons (中發白)
 *   f1..f4  flowers (梅蘭菊竹)          s1..s4  seasons (春夏秋冬)
 */

export type Suit = 'c' | 'd' | 'b';
export type TileKind = 'suit' | 'wind' | 'dragon' | 'bonus';

export interface TileDef {
  id: string;
  kind: TileKind;
  /** Suit tiles only. */
  suit?: Suit;
  /** Suit tiles only: 1-9. */
  rank?: number;
  /** Chinese name, e.g. 五萬. */
  cn: string;
  /** Cantonese romanisation of `cn` in Jyutping, e.g. "ng5 maan6". */
  jyut: string;
  /** English name, e.g. "5 Characters". */
  en: string;
  /** Short label printed on the tile face, e.g. "5 maan6" or "dung1". */
  label: string;
}

const SUIT_CN: Record<Suit, string> = { c: '萬', d: '筒', b: '索' };
const SUIT_JYUT: Record<Suit, string> = { c: 'maan6', d: 'tung4', b: 'sok3' };
const SUIT_EN: Record<Suit, string> = { c: 'Characters', d: 'Dots', b: 'Bamboo' };
const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const NUM_JYUT = ['', 'jat1', 'ji6', 'saam1', 'sei3', 'ng5', 'luk6', 'cat1', 'baat3', 'gau2'];

/** id, hanzi, jyutping, english */
type HonourRow = [string, string, string, string];

const WINDS: HonourRow[] = [
  ['we', '東', 'dung1', 'East Wind'],
  ['ws', '南', 'naam4', 'South Wind'],
  ['ww', '西', 'sai1', 'West Wind'],
  ['wn', '北', 'bak1', 'North Wind'],
];

const DRAGONS: HonourRow[] = [
  ['dr', '中', 'zung1', 'Red Dragon'],
  ['dg', '發', 'faat3', 'Green Dragon'],
  ['dw', '白', 'baak6', 'White Dragon'],
];

const BONUS: HonourRow[] = [
  ['f1', '梅', 'mui4', 'Plum'],
  ['f2', '蘭', 'laan4', 'Orchid'],
  ['f3', '菊', 'guk1', 'Chrysanthemum'],
  ['f4', '竹', 'zuk1', 'Bamboo Plant'],
  ['s1', '春', 'ceon1', 'Spring'],
  ['s2', '夏', 'haa6', 'Summer'],
  ['s3', '秋', 'cau1', 'Autumn'],
  ['s4', '冬', 'dung1', 'Winter'],
];

/** Every distinct tile face — 34 regular + 8 bonus = 42. */
export const TILE_DEFS: TileDef[] = (() => {
  const out: TileDef[] = [];
  for (const suit of ['c', 'd', 'b'] as Suit[]) {
    for (let rank = 1; rank <= 9; rank++) {
      out.push({
        id: `${suit}${rank}`,
        kind: 'suit',
        suit,
        rank,
        cn: `${NUM_CN[rank]}${SUIT_CN[suit]}`,
        jyut: `${NUM_JYUT[rank]} ${SUIT_JYUT[suit]}`,
        en: `${rank} ${SUIT_EN[suit]}`,
        label: `${rank} ${SUIT_JYUT[suit]}`,
      });
    }
  }
  const honour = (kind: TileKind) => ([id, cn, jyut, en]: HonourRow) =>
    out.push({ id, kind, cn, jyut, en, label: jyut });
  WINDS.forEach(honour('wind'));
  DRAGONS.forEach(honour('dragon'));
  BONUS.forEach(honour('bonus'));
  return out;
})();

export const TILE_BY_ID: Record<string, TileDef> = Object.fromEntries(
  TILE_DEFS.map((t) => [t.id, t]),
);

export function def(id: string): TileDef {
  const d = TILE_BY_ID[id];
  if (!d) throw new Error(`Unknown tile id: ${id}`);
  return d;
}

/** The full HK wall: 4 copies of each of the 34 regular tiles + 1 of each bonus = 144. */
export function buildDeck(): string[] {
  const deck: string[] = [];
  for (const t of TILE_DEFS) {
    const copies = t.kind === 'bonus' ? 1 : 4;
    for (let i = 0; i < copies; i++) deck.push(t.id);
  }
  return deck;
}

/** Terminals (1 and 9) and honours — the 么九 tiles. */
export function isTerminalOrHonour(id: string): boolean {
  const d = def(id);
  if (d.kind === 'wind' || d.kind === 'dragon') return true;
  return d.rank === 1 || d.rank === 9;
}

export function isHonour(id: string): boolean {
  const k = def(id).kind;
  return k === 'wind' || k === 'dragon';
}

/** Sort order used for laying out a hand: by suit group, then rank. */
const GROUP_ORDER: Record<string, number> = { c: 0, d: 1, b: 2, w: 3, dg: 4 };
export function sortKey(id: string): number {
  const d = def(id);
  if (d.kind === 'suit') return GROUP_ORDER[d.suit!] * 100 + d.rank!;
  if (d.kind === 'wind') return 300 + WINDS.findIndex((r) => r[0] === id);
  if (d.kind === 'dragon') return 400 + DRAGONS.findIndex((r) => r[0] === id);
  return 500 + BONUS.findIndex((r) => r[0] === id);
}

export function sortHand(ids: string[]): string[] {
  return [...ids].sort((a, b) => sortKey(a) - sortKey(b));
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
