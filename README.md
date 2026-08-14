# Mahjong, properly

An interactive 3D tutorial for **Hong Kong Old Style** mahjong (香港麻雀). Six lessons
plus a practice table with a live coach. Everything is taught by clicking tiles on a 3D
table rather than by reading rules text.

```bash
npm install
npm run dev
```

## Deploying

`npm run build` outputs to **`docs/`**, which GitHub Pages can serve directly from the
default branch (*Settings → Pages → Source: Deploy from a branch → `main` / `/docs`*).
Asset URLs are relative, so it works both at a domain root and under a project path like
`https://<user>.github.io/mahjong/`. `docs/` is committed on purpose — don't gitignore it.

## What's in it

**Lessons** — each step puts a hand on the table and asks you to do something with it:
click the right tile, select a group of tiles, or answer about what you're looking at.
You can't advance past a task until you get it right.

1. **The Tiles** — the three suits, reading Chinese numerals, why 1 Bamboo is a bird
2. **Honours & Flowers** — winds, dragons, and the bonus tiles
3. **The Winning Shape** — four sets and a pair; runs vs. triplets
4. **Taking a Turn** — draw and discard, and the pung / kong / chow claims
5. **Getting Ready** — reading your own wait, and why two-sided waits beat closed ones
6. **Faan & Scoring** — the 3-faan minimum, and the patterns that clear it

**Practice table** — a real deal from a shuffled 144-tile wall. Draw, discard, and watch
your shanten count, your live wait, and a per-tile readout of what discarding would cost
you. Flowers are set aside and replaced automatically. Complete a hand and it gets scored
against the faan table — including telling you when you've built a hand you aren't
allowed to declare.

## Reading the tiles without hanzi

Every tile face carries its Cantonese pronunciation printed along the bottom — `8 maan6`,
`dung1`, `faat3` — and every Chinese term in the interface is followed by the same. The
romanisation is [Jyutping](https://en.wikipedia.org/wiki/Jyutping), which is the right
system for a Hong Kong ruleset; the trailing digit on each syllable is the tone number.
The Chinese characters are all still there, so you pick them up by association as you play.

## Sound

Tile sounds are synthesised with WebAudio — there are no audio files, same as the tile
faces. Picking a tile up is a soft high tick, discarding is a hard clack on felt, and
dealing is a scatter of overlapping clacks. Correct and wrong answers get their own cues,
and winning gets an arpeggio. The speaker button in the header mutes everything and the
choice is remembered. Browsers block audio until the first interaction, so the very first
sound may not fire until you've clicked something.

## House rules

Hong Kong Old Style is a family of house rules, not one fixed code. Everything variable
lives in `HOUSE_RULES` in [`src/rules.ts`](src/rules.ts) — the faan values, the minimum,
and the limit — and the app shows the table it's using under *House rules* in the menu.

This build uses a **3-faan minimum** (三番起糊) and a **13-faan limit** (滿糊), scores
清一色 at 7, and has the discarder pay the whole amount alone. If your table plays it
differently, that one object is the only thing to edit.

There are no fu or minipoints; that's the point of this ruleset.

## Structure

| File | What it holds |
| --- | --- |
| `src/tiles.ts` | Tile identity and the 144-tile deck. Pure data. |
| `src/rules.ts` | Hand decomposition, shanten, waits, and the faan table. Pure functions — no DOM, no 3D. |
| `src/textures.ts` | Every tile face, drawn procedurally into a canvas — artwork plus the Jyutping label. Cached per tile type (42 faces), not per tile (144). |
| `src/audio.ts` | Synthesised tile sounds and the mute toggle. |
| `src/scene.ts` | The Three.js table: layout, lighting, pointer picking. |
| `src/lessons.ts` | Lesson content, declarative. |
| `src/main.ts` | Lesson runner and practice table. |

There are no image assets — the tile faces are generated at runtime. CJK glyphs come from
system fonts, so faces will look slightly different across platforms; on a machine with no
CJK font installed the honour tiles would fall back to tofu boxes.

The camera stays at a fixed reading angle and pulls back to fit whatever is on the table.
Drag to look around; it eases back.
