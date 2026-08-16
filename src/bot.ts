/**
 * Opponent decision-making. Pure functions — no game state, no DOM — so the
 * bot's judgment can be reasoned about the same way the rules engine is.
 *
 * The bot is intentionally simple: greedy shanten minimisation with an
 * isolation tie-break. It plays "reasonably," not well — it never reads
 * danger tiles or defends against your wait. That's a real gap, not hidden:
 * see the README.
 */

import { def } from './tiles';
import { shanten } from './rules';

/**
 * How connected a tile is to the rest of the hand — duplicates and same-suit
 * neighbours within 2 ranks both count. Returns a *cost* of discarding it, so
 * lower is safer to cut.
 */
function connectedness(hand: string[], id: string): number {
  const d = def(id);
  const dupes = hand.filter((t) => t === id).length - 1;
  let neighbours = 0;
  if (d.kind === 'suit') {
    for (const t of hand) {
      if (t === id) continue;
      const dt = def(t);
      if (dt.kind === 'suit' && dt.suit === d.suit && Math.abs(dt.rank! - d.rank!) <= 2) {
        neighbours++;
      }
    }
  }
  return dupes * 2 + neighbours;
}

/**
 * Pick a discard from a 14-tile hand: try cutting each tile, keep whichever
 * leaves the lowest shanten. Ties go to the most isolated tile, so the bot
 * doesn't arbitrarily break an obvious pair when a dead honour is sitting
 * right there.
 */
export function chooseBotDiscard(hand14: string[], meldCount: number): string {
  let bestShanten = Infinity;
  let candidates: string[] = [];

  for (let i = 0; i < hand14.length; i++) {
    const rest = hand14.slice(0, i).concat(hand14.slice(i + 1));
    const s = shanten(rest, meldCount);
    if (s < bestShanten) {
      bestShanten = s;
      candidates = [hand14[i]];
    } else if (s === bestShanten) {
      candidates.push(hand14[i]);
    }
  }

  let best = candidates[0];
  let bestCost = Infinity;
  for (const id of candidates) {
    const cost = connectedness(hand14, id);
    if (cost < bestCost) {
      bestCost = cost;
      best = id;
    }
  }
  return best;
}
