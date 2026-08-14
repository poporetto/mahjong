/**
 * Lesson content. Each step is declarative: what to put on the table, what to
 * say, and what the learner has to do to move on.
 */

import { def, isHonour } from './tiles';
import { HOUSE_RULES } from './rules';

export interface Layout {
  hand: string[];
  discards?: string[];
  melds?: string[][];
  wall?: number;
}

export type Task =
  | {
      kind: 'pick';
      prompt: string;
      /** Return true when this hand position is a correct answer. */
      accept: (id: string, index: number, hand: string[]) => boolean;
      success: string;
      wrong?: (id: string) => string;
      hint: string;
    }
  | {
      kind: 'pickMany';
      prompt: string;
      /** Every index that must be selected, in any order. */
      answer: number[];
      success: string;
      hint: string;
    }
  | {
      kind: 'quiz';
      prompt: string;
      options: Array<{ label: string; correct: boolean; why: string }>;
    };

export interface Step {
  title: string;
  /** HTML. Keep it short — the table is the teacher, this is the caption. */
  body: string;
  layout?: Layout;
  /** Tiles to pre-highlight, as hand index → CSS colour. */
  marks?: Record<number, string>;
  dimUnmarked?: boolean;
  task?: Task;
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  steps: Step[];
}

const GOLD = '#f5c542';
const CYAN = '#3fd0d4';
const ROSE = '#ff7a8a';

export const LESSONS: Lesson[] = [
  {
    id: 'tiles',
    title: 'The Tiles',
    subtitle: 'Three suits, 1 through 9',
    emoji: '🀙',
    steps: [
      {
        title: 'Meet the three suits',
        body: `A Hong Kong set has <b>144 tiles</b>. Most of them belong to three suits, each numbered <b>1 to 9</b>.
        <ul>
          <li><b>Dots</b> (筒 <i class="jyut">tung4</i>) — count the circles.</li>
          <li><b>Bamboo</b> (索 <i class="jyut">sok3</i>) — count the sticks. <i>1 Bamboo is a bird</i>, which trips up every beginner exactly once.</li>
          <li><b>Characters</b> (萬 <i class="jyut">maan6</i>) — read the top glyph; the bottom one is always 萬 <i class="jyut">maan6</i>.</li>
        </ul>
        Drag the table to look around. Hover a tile to lift it.`,
        layout: { hand: ['d1', 'd5', 'd9', 'b1', 'b5', 'b9', 'c1', 'c5', 'c9'] },
      },
      {
        title: 'Read a number',
        body: `Characters are the suit beginners misread most, because the number is a Chinese numeral rather than a shape you can count.
        <div class="cheat">一 1 &nbsp; 二 2 &nbsp; 三 3 &nbsp; 四 4 &nbsp; 五 5 &nbsp; 六 6 &nbsp; 七 7 &nbsp; 八 8 &nbsp; 九 9</div>`,
        layout: { hand: ['c2', 'c7', 'c4', 'c9', 'c1', 'c6', 'c3'] },
        task: {
          kind: 'pick',
          prompt: 'Click <b>7 Characters</b> (七萬 cat1 maan6).',
          accept: (id) => id === 'c7',
          success: '七萬 cat1 maan6. The 七 (cat1, seven) sits above 萬 (maan6) — that is all a Characters tile ever says.',
          wrong: (id) => `That is ${def(id).cn} — ${def(id).en}. Look for 七 (cat1) on top.`,
          hint: 'Seven is 七 cat1 — two strokes, like a sideways cross.',
        },
      },
      {
        title: 'The bird counts as one',
        body: `1 Bamboo is drawn as a sparrow (麻雀 <i class="jyut">maa4 zoek2</i> — the game's own name). It is still just the number 1 of the Bamboo suit and forms runs with 2 and 3 Bamboo like anything else.`,
        layout: { hand: ['b1', 'b2', 'b3', 'b7', 'b8', 'b9'] },
        marks: { 0: GOLD, 1: GOLD, 2: GOLD },
        task: {
          kind: 'quiz',
          prompt: 'Do the three highlighted tiles make a legal run?',
          options: [
            { label: 'Yes — 1-2-3 Bamboo', correct: true, why: 'Correct. The bird is a 1, so 1-2-3 Bamboo is an ordinary run.' },
            { label: 'No — the bird is a special tile', correct: false, why: 'A common misread. The bird is decoration; the tile is simply 1 Bamboo.' },
            { label: 'Only if you drew it yourself', correct: false, why: 'How you got a tile never changes what it is.' },
          ],
        },
      },
    ],
  },

  {
    id: 'honours',
    title: 'Honours & Flowers',
    subtitle: 'Winds, dragons, and the bonus tiles',
    emoji: '🀄',
    steps: [
      {
        title: 'Four winds, three dragons',
        body: `Beyond the suits sit the <b>honour</b> tiles. They have no numbers, so they can never form runs — only triplets or a pair.
        <ul>
          <li><b>Winds</b>: 東 <i class="jyut">dung1</i> East, 南 <i class="jyut">naam4</i> South, 西 <i class="jyut">sai1</i> West, 北 <i class="jyut">bak1</i> North</li>
          <li><b>Dragons</b>: 中 <i class="jyut">zung1</i> Red, 發 <i class="jyut">faat3</i> Green, 白 <i class="jyut">baak6</i> White (the blank frame)</li>
        </ul>
        These are the scoring tiles. A triplet of dragons, or of your own seat wind, is worth faan.`,
        layout: { hand: ['we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw'] },
      },
      {
        title: 'Spot the honours',
        body: `Sorting honours out of a fresh hand is the first thing you do every deal — they are either worth a lot or worth nothing, and you decide early which.`,
        layout: { hand: ['d3', 'dr', 'b5', 'we', 'c8', 'dw', 'b2'] },
        task: {
          kind: 'pickMany',
          prompt: 'Select every honour tile in this hand (there are 3).',
          answer: [1, 3, 5],
          success: '中 zung1, 東 dung1 and 白 baak6 — two dragons and a wind. No numbers, no runs.',
          hint: 'Honours have no digits and no countable pips. The blank framed tile is one of them.',
        },
      },
      {
        title: 'Flowers are free points',
        body: `Eight <b>bonus</b> tiles — four Flowers (梅蘭菊竹 <i class="jyut">mui4 laan4 guk1 zuk1</i>) and four Seasons (春夏秋冬 <i class="jyut">ceon1 haa6 cau1 dung1</i>) — sit outside the hand entirely. Draw one, set it aside face-up, and immediately draw a replacement.
        <p>The flower matching your seat is worth <b>1 faan</b>. They never form sets and never count toward your 14 tiles.</p>`,
        layout: { hand: ['f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4'] },
      },
    ],
  },

  {
    id: 'shape',
    title: 'The Winning Shape',
    subtitle: 'Four sets and a pair',
    emoji: '🎯',
    steps: [
      {
        title: 'Every hand is the same shape',
        body: `Almost every winning hand in Hong Kong mahjong is <b>four sets plus one pair</b> — 14 tiles.
        <p>A <b>set</b> is either:</p>
        <ul>
          <li>a <b>run</b> (順 <i class="jyut">seon6</i>) — three consecutive tiles in one suit, e.g. 3-4-5 Dots</li>
          <li>a <b>triplet</b> (刻 <i class="jyut">hak1</i>) — three identical tiles, e.g. three 東 <i class="jyut">dung1</i></li>
        </ul>
        The <b>pair</b> (眼 <i class="jyut">ngaan5</i>) is two identical tiles — the "eyes" of the hand.`,
        layout: { hand: ['d2', 'd3', 'd4', 'b6', 'b7', 'b8', 'c3', 'c3', 'c3', 'we', 'we', 'we', 'dr', 'dr'] },
        marks: { 0: CYAN, 1: CYAN, 2: CYAN, 3: CYAN, 4: CYAN, 5: CYAN, 6: GOLD, 7: GOLD, 8: GOLD, 9: GOLD, 10: GOLD, 11: GOLD, 12: ROSE, 13: ROSE },
      },
      {
        title: 'Find the pair',
        body: `Reading a hand starts with finding the eyes. Everything else has to divide cleanly into threes around it.`,
        layout: { hand: ['b1', 'b2', 'b3', 'd7', 'd8', 'd9', 'c5', 'c5', 'c5', 'ws', 'ws', 'ws', 'd4', 'd4'] },
        task: {
          kind: 'pickMany',
          prompt: 'Select the two tiles that form the pair.',
          answer: [12, 13],
          success: 'Two 4 Dots are the eyes. The remaining twelve tiles split into four clean sets.',
          hint: 'Twelve of these tiles group into four sets of three. The two left over are the pair.',
        },
      },
      {
        title: 'Runs cannot wrap around',
        body: `A run must be three <i>consecutive</i> numbers in <i>one</i> suit. 8-9-1 is not a run. Mixing suits is not a run. Honours never make runs at all.`,
        layout: { hand: ['d8', 'd9', 'd1', 'b4', 'c5', 'b6', 'we', 'ws', 'ww'] },
        task: {
          kind: 'quiz',
          prompt: 'How many legal runs are on the table?',
          options: [
            { label: 'None', correct: true, why: 'Right. 8-9-1 wraps, 4-5-6 is split across two suits, and 東南西 (dung1 naam4 sai1) are honours.' },
            { label: 'One', correct: false, why: 'Check again — 4 Bamboo, 5 Characters, 6 Bamboo are not the same suit.' },
            { label: 'Three', correct: false, why: 'All three groups fail: wrapping, mixed suits, and honours.' },
          ],
        },
      },
    ],
  },

  {
    id: 'turn',
    title: 'Taking a Turn',
    subtitle: 'Draw, decide, discard',
    emoji: '🔄',
    steps: [
      {
        title: 'Thirteen, draw, discard',
        body: `You hold <b>13 tiles</b>. On your turn you draw one — now 14 — then discard one, back to 13. Play passes to your right (counter-clockwise).
        <p>Every turn is the same question: <b>which tile helps least?</b></p>`,
        layout: {
          hand: ['d2', 'd3', 'd4', 'b6', 'b7', 'b8', 'c3', 'c4', 'c5', 'we', 'we', 'dr', 'dg', 'ww'],
          discards: ['b9', 'c1', 'wn', 'd9'],
          wall: 12,
        },
        task: {
          kind: 'pick',
          prompt: 'You just drew 西. Discard the tile that helps least.',
          accept: (id) => id === 'ww' || id === 'dg' || id === 'dr',
          success:
            'Any of the lone honours is defensible. 西 is the cleanest — it is a wind you do not hold a pair of, so it can only ever become a triplet you are three tiles away from.',
          wrong: (id) =>
            `${def(id).cn} is part of a run or your pair. Look for a tile with no neighbours and no partner — ${
              isHonour(id) ? 'you are close!' : 'try the honours.'
            }`,
          hint: 'Three sets are already complete and 東東 is your pair. Which tiles are doing nothing at all?',
        },
      },
      {
        title: 'Claiming a discard',
        body: `When someone discards, you may interrupt:
        <ul>
          <li><b>Pung</b> (碰 <i class="jyut">pung3</i>) — you hold two matching tiles, take the discard for a triplet. Anyone, any seat.</li>
          <li><b>Kong</b> (槓 <i class="jyut">gong3</i>) — you hold three matching, take the fourth. Draw a replacement tile.</li>
          <li><b>Chow</b> (上 <i class="jyut">soeng5</i>) — complete a run, but <b>only from the player to your left</b>.</li>
        </ul>
        <p>Pung beats chow. Winning beats both. Claimed sets go face-up and can no longer change — and they cost you the <i>Fully Concealed</i> faan.</p>`,
        layout: {
          hand: ['d5', 'd6', 'b3', 'b3', 'c7', 'c8', 'c9', 'we', 'we', 'dr'],
          melds: [['b3', 'b3', 'b3']],
          discards: ['b3'],
        },
      },
      {
        title: 'Which claim is available?',
        body: `Your left-hand neighbour just discarded <b>4 Dots</b>. Look at what you are holding.`,
        layout: {
          hand: ['d3', 'd5', 'b7', 'b7', 'c2', 'c3', 'c4', 'we', 'we', 'we', 'dg', 'dg', 'd9'],
          discards: ['d4'],
        },
        task: {
          kind: 'quiz',
          prompt: 'Can you claim the 4 Dots, and how?',
          options: [
            { label: 'Chow — 3-4-5 Dots', correct: true, why: 'Yes. You hold 3 and 5 Dots, and the discard came from your left, which is the only seat you may chow from.' },
            { label: 'Pung', correct: false, why: 'A pung needs two matching tiles in hand. You have no 4 Dots.' },
            { label: 'Nothing — you cannot use it', correct: false, why: '3 Dots and 5 Dots are sitting right there waiting for a 4.' },
          ],
        },
      },
    ],
  },

  {
    id: 'ready',
    title: 'Getting Ready',
    subtitle: 'One tile from a win',
    emoji: '⏳',
    steps: [
      {
        title: 'Ready means one away',
        body: `A hand is <b>ready</b> (聽牌 <i class="jyut">teng1 paai4</i>) when a single tile completes it. Recognising your own wait is most of the skill in mahjong.
        <p>The Practice table (in the menu) shows your wait live as you play — but first, read one by eye.</p>`,
        layout: { hand: ['d2', 'd3', 'd4', 'b6', 'b7', 'b8', 'c3', 'c4', 'c5', 'we', 'we', 'we', 'dr'] },
        task: {
          kind: 'quiz',
          prompt: 'What is this hand waiting for?',
          options: [
            { label: 'A second 中 zung1 — a single-tile pair wait', correct: true, why: 'Four sets are already complete. The lone 中 zung1 needs its partner to become the eyes. This is a 單吊 <i class="jyut">daan1 diu3</i> wait.' },
            { label: '2 or 5 Dots', correct: false, why: 'The Dots run 2-3-4 is already finished. Extending it would not help.' },
            { label: 'Nothing — the hand is already won', correct: false, why: 'Count again: thirteen tiles. A win needs fourteen.' },
          ],
        },
      },
      {
        title: 'Two-sided waits are better',
        body: `An open-ended pair like <b>4-5</b> accepts both 3 and 6 — eight tiles. A closed wait like <b>4-6</b> accepts only 5 — four tiles.
        <p>Given the choice, keep the wider wait.</p>`,
        layout: { hand: ['d4', 'd5', 'b4', 'b6'] },
        marks: { 0: CYAN, 1: CYAN, 2: ROSE, 3: ROSE },
      },
      {
        title: 'Choose the better discard',
        body: `You drew a tile and must break one of two shapes. Both leave you ready — but not equally ready.`,
        layout: { hand: ['d3', 'd4', 'd5', 'b6', 'b7', 'b8', 'c2', 'c3', 'c7', 'c9', 'we', 'we', 'we', 'dr'] },
        task: {
          kind: 'pick',
          prompt: 'Discard to keep the widest wait.',
          accept: (id) => id === 'dr',
          success:
            'Discarding 中 zung1 leaves 2-3 Characters (waits on 1 and 4) and 7-9 Characters (waits on 8). Breaking either run-in-progress instead would throw away live tiles.',
          wrong: (id) =>
            id === 'c7' || id === 'c9'
              ? 'That leaves you narrower. The lone honour is doing nothing at all — throw that first.'
              : `${def(id).cn} is part of a finished set or your triplet. Look for the tile with no future.`,
          hint: 'One tile in this hand has no partner and no neighbour.',
        },
      },
    ],
  },

  {
    id: 'scoring',
    title: 'Faan & Scoring',
    subtitle: `The ${HOUSE_RULES.minimumFaan}-faan minimum`,
    emoji: '💰',
    steps: [
      {
        title: 'You need a reason to win',
        body: `This is what separates Hong Kong Old Style from every other mahjong. There are <b>no minipoints and no fu</b> — only <b>faan</b>, doubles earned by scoring patterns.
        <p>And you may not declare a win below <b>${HOUSE_RULES.minimumFaan} faan</b> (三番起糊 <i class="jyut">saam1 faan1 hei2 wu2</i>). A hand with four sets and a pair but no pattern is a <b>雞糊 chicken hand</b> — structurally complete, and worthless. You must keep playing.</p>
        <p>Payment doubles with each faan: ${HOUSE_RULES.minimumFaan} faan pays ${Math.pow(2, HOUSE_RULES.minimumFaan)} units, and everything at ${HOUSE_RULES.limitFaan}+ pays the limit.</p>`,
        layout: { hand: ['d2', 'd3', 'd4', 'b6', 'b7', 'b8', 'c3', 'c4', 'c5', 'd6', 'd7', 'd8', 'b2', 'b2'] },
        task: {
          kind: 'quiz',
          prompt: 'This hand is complete — four runs and a pair. Can you declare a win?',
          options: [
            { label: 'No — it scores below the minimum', correct: true, why: `Correct. All-sequences is 1 faan and staying concealed is another — 2 faan, short of the ${HOUSE_RULES.minimumFaan}-faan minimum. This is the hand every beginner builds and then cannot cash.` },
            { label: 'Yes — four sets and a pair is a win', correct: false, why: `Structurally yes, legally no. Hong Kong Old Style requires ${HOUSE_RULES.minimumFaan} faan to declare.` },
            { label: 'Only on a self-draw', correct: false, why: `Self-draw adds 1 faan — still under ${HOUSE_RULES.minimumFaan}.` },
          ],
        },
      },
      {
        title: 'The patterns that pay',
        body: `Three patterns carry most beginner hands over the line:
        <ul>
          <li><b>對對糊 <i class="jyut">deoi3 deoi3 wu2</i> All Pungs</b> — 3 faan. Four triplets and a pair. No runs at all.</li>
          <li><b>混一色 <i class="jyut">wan6 jat1 sik1</i> Half Flush</b> — 3 faan. One suit plus honours.</li>
          <li><b>清一色 <i class="jyut">cing1 jat1 sik1</i> Full Flush</b> — 7 faan. One suit, nothing else.</li>
        </ul>
        <p>Each of these clears the minimum on its own. Aim at one from your very first discard.</p>`,
        layout: { hand: ['d1', 'd1', 'd1', 'd4', 'd4', 'd4', 'd7', 'd8', 'd9', 'd2', 'd3', 'd4', 'd6', 'd6'] },
        marks: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i, GOLD])),
      },
      {
        title: 'Which pattern is this?',
        body: `Read the whole hand before answering — the pattern is a property of all 14 tiles, not of any one set.`,
        layout: { hand: ['b2', 'b2', 'b2', 'b5', 'b5', 'b5', 'b8', 'b8', 'b8', 'we', 'we', 'we', 'dr', 'dr'] },
        task: {
          kind: 'quiz',
          prompt: 'What does this hand score?',
          options: [
            { label: 'All Pungs + Half Flush', correct: true, why: 'Four triplets and a pair (對對糊 deoi3 deoi3 wu2, 3) all in one suit plus honours (混一色 wan6 jat1 sik1, 3) — 6 faan before anything else. The 東 dung1 triplet adds 1 more for each of seat and round wind if East applies to you, and staying concealed adds 1. The 中 zung1 pair adds nothing: only dragon triplets score.' },
            { label: 'Full Flush', correct: false, why: '清一色 cing1 jat1 sik1 allows no honours. The 東 dung1 triplet and 中 zung1 pair disqualify it — this is the mixed version, 混一色 wan6 jat1 sik1.' },
            { label: 'Chicken hand — no pattern at all', correct: false, why: 'Four triplets is All Pungs on its own, which already clears the minimum.' },
          ],
        },
      },
      {
        title: 'The big ones',
        body: `Worth knowing on sight, because someone will eventually do it to you:
        <ul>
          <li><b>大三元 <i class="jyut">daai6 saam1 jyun4</i> Great Dragons</b> — triplets of 中 zung1, 發 faat3 and 白 baak6. 8 faan.</li>
          <li><b>字一色 <i class="jyut">zi6 jat1 sik1</i> All Honours</b> — winds and dragons only. 10 faan.</li>
          <li><b>十三么 <i class="jyut">sap6 saam1 jiu1</i> Thirteen Orphans</b> — one of every terminal and honour, plus a duplicate. Limit hand.</li>
        </ul>
        <p>The table below is Thirteen Orphans, waiting on any one of its thirteen tiles.</p>`,
        layout: { hand: ['c1', 'c9', 'd1', 'd9', 'b1', 'b9', 'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw'] },
        marks: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [i, ROSE])),
      },
    ],
  },
];
