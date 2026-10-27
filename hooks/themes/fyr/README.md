# fyr

The sky's first theme, and the one it starts with: a striped lighthouse on its rocks in the sea at the right of the window, and its keeper, a small Clawd. The engine draws the sky above it (the sun, moon and stars, the clouds, the weather, the engine's own events); fyr draws the island and everything on it.

Its manifest is [`manifest.ts`](manifest.ts) and its GLSL the parts in [`glsl/`](glsl), joined in this order by [`index.ts`](index.ts). `tools/theme/run.sh pack fyr <folder>` writes the same theme as a `manifest.json` and a `theme.glsl`, the form a theme from elsewhere takes.

## What it draws, and where

| Part | What | The engine calls |
|---|---|---|
| [`sea.ts`](glsl/sea.ts) | Where the lighthouse stands (the middle of the stage strip, or near the right edge), the sea, the tower and its lantern, the beam when Claude waits, and the dolphins | `scenery`, `themeEvent`, `themeWindow` |
| [`keeper.ts`](glsl/keeper.ts) | The keeper: his poses, his pixel grid, the door in the tower | |
| [`surf.ts`](glsl/surf.ts) | His surf, now and then, on a wave of his own | |
| [`night.ts`](glsl/night.ts) | His nights: the hammock and its post, the snore, the binoculars, the fishing lantern, his watch beside the lit lantern | |
| [`routine.ts`](glsl/routine.ts) | His day by `iTime`: fishing on the rocks, in through the door, a lap of the gallery, and which of it he is doing now | |
| [`catch.ts`](glsl/catch.ts) | The context window as his catch: a fish for each tenth on a line from the tower to the hammock's post, the landing, the grill, its smoke and the embers | |
| [`ufo.ts`](glsl/ufo.ts) | The UFO that comes for him, and the keeper drawn at the lighthouse | `resident` |

`themeWindow` is 1.0 everywhere: the whole island is outdoors, so the clouds, the events in front and the rain and snow fall over it as over the rest of the sky.

## What it reads from the engine

- **Claude waiting** (`WAITING`, `WAITING_URGENT`): the lantern lit and its beam turning, orange while Claude asks and white when it is done, quicker once a question has waited; the keeper goes up to the gallery and stands by it.
- **Clawd's day** (`CLAWD_ASLEEP`): the keeper sleeps in his hammock from 03 to 06, as Clawd in the band does.
- **The context window** (`contextFish()`, `contextState()`): the fish on his line, the catch as another tenth fills, the grill as the conversation compacts or clears, and the embers after. fyr's manifest says `context: "resident"`, so the engine leaves its wastebasket out of fyr's shader.
- **Its previews** (`THEME_FORCE`): 1 is the UFO taking him (`/solar event ufo abduction`), 2 his surf (`/solar event surf`). The shader plays both from `iTime` on its own, so they are never scheduled.
- **The stage** (`STAGE_PX`): the width of the strip at the right where he stands, from the margin `/solar ghostty` adds.

## Its events

| Kind | Word | When |
|---|---|---|
| `dolphin` | dolphin (`delfin`) | by day, wind under 12 m/s, dry; one in each half hour |
| `pinkDolphin` | pink dolphin (`rosa delfin`) | the same, half of the six-hour slots |

Their salts, 7 and 8, are their places in the engine's list from before the island was a theme, so they leap at the minutes they always did.
