# One-shot round 2: what the judges found, and what the guide learned

Round 2 of F7's protocol, run on 2026-10-28 while Vincent slept. Two fresh authors each had `docs/THEME-GUIDE.md` as round 1 left it (`61f752c` on `teman`) and Vincent's paragraph, and a fresh judge went through §14's checklist with each theme's sheet. This note is the learning pass: each failure, its class, what changed in the guide, the engine and tool gaps, and whether each theme passed. The themes and their branches were not touched.

## The two themes

| Theme | Branch, commit | Stage | Size | Bench (judge) | Judge |
|---|---|---|---|---|---|
| `terminal` (the airport) | `tema-terminal-r2`, `2e07024` | 440 pt | 66,001 of 80,000 | 1.06 (rounds 1.10, 1.06, 0.82) | **passes**, every line |
| `floor` (the trading floor) | `tema-floor-r2`, `9029abf` | 480 pt | 53,106 of 80,000 | 0.81 (rounds 0.87, 0.81, 0.75, a busy machine) | **passes**; one soft line fails (own events and previews) |

Both lint clean, compile, draw every frame of the sheet, keep the text readable by day and by night, and show the waiting light in every still. Both read as their paragraph in five seconds, with the outdoors at the left and the room at the right and the entrance between them clear. Round 1's cost failure did not come back: both are well under the line, and the airport's author got there from 1.35 by acting on §10 (one airliner drawing for four planes, one `screen` per material).

## Did each theme pass

- `terminal`: **yes**, all six hard lines and every soft one. The weak spots the judge names: the command state is a small glow low in the baggage hall, the done lamp's white glow washes out the sign beside it and LANDED is the same cream as the board's other rows, and the glass front is a 1.6 `u` strip that reads as the building's edge.
- `floor`: **yes**, all six hard lines. The soft line it fails is §14 item 9's own events and previews: of four, only the bell reads; the chest thump, the bull run and the Jenga fall are small changes to one figure or prop, drawn by the sheet on a closed Saturday. Its other weak spots: the "packed classic trading floor" is a strip of 4-pixel traders under a board that takes most of the stage, half the tickers read wrong (`M`, `N`, `W`), and the hall goes dark under a bright Saturday sky.

F7 counts a theme as passed when the judge passes it in one sweep. Both did, so round 2 is the first round in which both themes passed; F7 is done after two such rounds in a row, so round 3 runs the authors again from nothing with this guide.

## Each failure and the guide change

The judges' lists and the authors' own reports, together. Where the author's guess turned out right, the guide now says so, so the next author need not guess.

| # | Failure | Class | Guide change |
|---|---|---|---|
| 1 | The airport's author could not tell whether the small helpers (`screen`, `lift`, `tone`, `ink`, `keyPlate`) count as call sites on the bench; the first full version measured 1.35 and was rebuilt on a guess | budget | §10's table has rows for ten extra calls of `screen`, `lift`, `ink` and `keyPlate` (measured below), a sentence that they count as call sites too, at under a millisecond each, and are not where a theme's cost is, and "lay raw inks on a layer, print it once" as an example under "Share the work". |
| 2 | The guide had the author bench only once the theme stood, so a finished theme came out over budget | budget | The opening steps: bench once (`--bench 100`, no rounds) as soon as the stage's main pieces stand, and again after each large piece. |
| 3 | `tumble()` was not known to be a plain rotation with `flip` 1, nor that it divides y by `flip`; the floor's author wrote rotations by hand three times, one with slips 2 to 3 times too large | reinvented primitive | §5: `tumble`'s line says "its y divided by flip"; a paragraph "Turning a shape": `tumble(q, angle, 1.0)` is a rotation, clockwise on the screen, and a distance across a turning shape goes back through `abs(flip)`; a `slip()` example. No new primitive: the one there was only undocumented. |
| 4 | `M`, `N` and `W`: the guide said to choose a larger cell or other words, but a larger cell scales the same bitmap; NDX, MSFT, NVDA, AMZN and META read as ΠDX, HSFT, ΠVDA, AHZΠ and HETA | identity (letters), engine | §5 says what the three letters look like at every size, to choose words without them where the words are yours, and that names you cannot change read only from their context and must not carry the waiting light's meaning. §11's example words now have none of them. The font itself is a gap (below). |
| 5 | Where outside things must be no lighter than the sky, there was no helper; the airport's author wrote `under()` | reinvented primitive | Engine: `sky_under(c, sky)` in `COMMON` (below). §5 lists it, §9's brightness check says to pass what stands outside through it, and the idiom's `outdoors()` uses it. |
| 6 | The engine's own props (the national day's flag, the maypole) stand where an indoor theme puts its wall; the airport's glass hid all but a sliver of the flag | state (engine's business) | §2: a table of what the engine stands at fixed places (the flag and the maypole at 0.72 W on the horizon, the Lucia train along it, the wastebasket), that they are front-pass and need `themeWindow` above 0, that 0.72 W is 17 px inside a 440-point stage, and what to do: leave it open, or fly your own flag with `FLAG_DAY`. |
| 7 | §8's `momentAge` let a moment happen in `/solar demo`'s time-lapse, which §7 says fyr's never does | still/state | `momentAge` returns -1 while `DEMO_COUNT > 0`, and its comment says so. |
| 8 | §11 listed LAST CALL among bad words, though its rule is about blinking; the done lamp's white glow washed out a sign beside it and LANDED was the board's cream | waiting light | §11: words are welcome if they stay legible in every still, are in the light's own orange or white rather than the board's ink, have no `M`, `N` or `W`; keep the glow off other signs. |
| 9 | The command state (the airport) and `other` (the floor) were the faintest kinds, a glow low in a corner | identity | §4: make the kinds about equally plain; the faintest one is the one that fails. |
| 10 | The airport's gate is upstairs, and the idiom assumed a ground-floor room | style, doc | The idiom's "Where things are": an upstairs room keeps its floor on the horizon, with what is under it below. |
| 11 | The glass front was too thin to read as glass | identity | The idiom's "The entrance": a glass front three units or more wide. |
| 12 | The floor's crowd was 4-pixel figures in a 70-pixel strip under a board that dominated: the paragraph's "packed trading floor" read as specks | identity | §6 "Room for what the paragraph names first": give that the most room; a crowd that is the point at a cell of `floor(0.35 * u)` or more in rows of at least a quarter of the stage's height; 4 px is for one figure alone. The idiom's width paragraph and §14 item 7 point to it. |
| 13 | Three of the floor's four own moments did not read: a fist, a statue moved, a few blocks fallen | identity | §12: an event or a preview changes the frame at the world's scale, with examples of details and of moments; §14 item 9: each noticed in its day frame by someone not told where to look. |
| 14 | The sheet draws events on a Saturday, so a market theme's crowd is never there to carry them | identity, state | §12 says the sheet's event times and that an event needing a full floor brings its own crowd or light. |
| 15 | No New York weekday or trading-day signal; the author worked New York's weekday out from `WEEKDAY` and the hours' gap, which holds only in some time zones, and the closing bell can ring on a holiday | missing signal | §4, after "Two clocks": `sky_MARKET_OPEN` is the only trading-day knowledge; key the market's life to it; a bell as a state, the opening bell while open before 9.6 and the closing one while open from 15.9. The signal itself is F5 task 6's (below). |
| 16 | No "new high" signal, so the spec's confetti at bitcoin's all-time high could not be built; the author used "up 5 % today" | missing signal | §4 lists what the market's signals do not carry: highs, history, volume, other symbols. |
| 17 | The bell and the Jenga previews are states drawn from constants, not moments from `iTime`, and §8 only described moments | still/state | §8: a preview may be a state from a constant; while `THEME_FORCE` is its place, show it for the first 30 s of every minute, which all three sheet times catch; `bellRings()` as an example. |
| 18 | The bull run moves a thing `scenery` draws, so it was drawn from `scenery` through `eventUp` and its manifest layer was nominal; §12 covered only events inside a room | prototype/manifest | §12's last paragraph covers any event that moves or changes something `scenery` or `resident` draws, and says its layer then only names a pass. |
| 19 | The hall went dark whenever New York's floor was empty, so Saturday daytime frames show a dark block under a bright sky and every night looks alike | style | §9 Interiors: a room whose lamps follow another clock still takes daylight; only its lamps, screens and boards go out; a closed night differs from an open one by something lit. |
| 20 | §10 said to bench events with `--event`, but with an event up the ratio is not a measure: the floor's author saw a negative ratio, and the judge measured `none` at 133 to 137 ms plain and about 300 with any event | budget (tooling) | §10: why (below), and how: bench your theme alone with and without the event, `--bench-alone`, and keep the ratio for the scene without events. The bench warns when given `--event`. |
| 21 | The sheet took 40 minutes, not a quarter of an hour, and died twice at a busy Chrome, losing the rest; it clears its folder, so a rerun draws all of it | tooling | §13: 30 to 45 minutes while another checkout previews; a busy frame is tried four times; `KEEP=1` goes on where a sheet stopped. Both added to `sheet.sh`. |
| 22 | Frames 35 to 37 for a theme with `"market": false`: nothing said what they are for | doc | §13's scene table: ordinary frames for such a theme, nothing judged as the market's. |
| 23 | Which helpers loop: `steam()` was not listed, so the airport's author drew a wisp of his own | doc | §10: `fbm`, `fire`, `smoke` and `sky_numberCode` loop (four, nine, four, nine); `steam`, `flame`, `lamp` and the rest do not. |
| 24 | GLSL 4.30: the floor's author could not check it and only avoided §3's three words | compile | §13 says plainly that nothing in the kit compiles 4.30, that no difference beyond the three words is known, and that plain top-level variables have been compiled only in WebGL. |
| 25 | `?:` between structs, though the guide warns about it, was hit once; the compiler found it and §13's line arithmetic led to the line | compile | None: the guide's warning and the error arithmetic worked as meant. A lint is still not worth its false alarms (round 1). |

Every glsl block of the guide lints clean (`hooks/guide.test.tsx`). The new and changed ones (`slip`, `bellRings`, `momentAge`, the idiom with `sky_under`) were also compiled and drawn in two scratch themes: the slip turns, the bell rings, and the idiom's outdoors is darker than the sky under `--prose`.

## What the small helpers cost on the bench

The template (§15) with ten more calls of one helper written out in its `scenery`, each with its own arguments so that none folds away, benched with `--bench 100 --bench-alone` at the guide's scene, five rounds taken by turns, the middle one. The machine had no other preview, but the variance between rounds was as large as most of the effects (the template alone from 107 to 123 ms).

| Ten more calls written out in `scenery` | The five rounds, ms a frame | Middle | Less the template's |
|---|---|---|---|
| None (the template) | 107.5, 122.7, 112.1, 107.0, 123.0 | 112.1 | |
| `screen` | 121.3, 127.1, 113.9, 111.4, 120.2 | 120.2 | +8 |
| `lift` | 120.8, 135.8, 118.9, 123.4, 121.2 | 121.2 | +9 |
| `ink` | 153.1, 133.6, 109.5, 122.8, 110.6 | 122.8 | +11 |
| `keyPlate` (which calls `ink`) | 123.2, 119.6, 110.6, 114.6, 112.0 | 114.6 | +2 |

The variants and the log are in this session's scratchpad (`learn2/`) and are not kept.

So the small helpers do count as call sites, but at under a millisecond each, against two for each of the template's `clawd()` and about one for a `sky_glyph`; `keyPlate` coming out cheaper than the `ink` it calls says how much of each number is noise. The airport's author was right that they count and wrong that they were the cost: of the rebuild from 1.35 to 0.95, one airliner drawing in place of four is the likely saving. The guide says so in §10's table and under "Share the work", with the layer idiom (lay raw inks into a `vec4`, lift and print once) as a small saving where a function lays many inks.

## Why `--event` breaks the ratio

`mainImage` (`hooks/glsl/main.ts`) draws the clouds, the events in front and the weather only where `themeWindow` is above 0, after the theme's own functions. `none` has no walls, so an event's pass (the whole `events()` loop, with every engine event's code in its body, which SwiftShader pays in full once any pixel enters the loop) is paid over the whole window; a theme with walls pays it only outside them. Theme less `none` then subtracts more of the pass than the theme paid, so the theme looks cheaper than it is, and below 0 when the walls are wide enough. Fyr has few walls, so its cost barely changes. That is the floor judge's guess, and the code bears it out; the size of the pass (about 165 ms a frame with one event up) is the judge's measure, not mine.

## Engine and tool gaps

Done on `teman`, with the tests at 187 passing, `tsc` clean and fyr's parity checked against `.worktrees/takt/.preview/parity-takt` (53 of 53 scenes identical):

- **`sky_under(vec3 c, vec3 sky)`** in `COMMON` after `lift`: `c` no lighter than `sky`, its hue kept (its luminance scaled down to the sky's where it is above it). Listed in the contract test, the guide's §5 and §9 and the idiom, and the README's 0.9.0 list. Uncalled by fyr, so fyr's frames do not change.
- **A guide test for the props' places**: `hooks/guide.test.tsx` holds §2's rows for the flag and the maypole to `flag()` and `maypole()` in `hooks/glsl/events.ts`, and that both are drawn in the front pass.
- **The sheet retries a busy frame four times**, half a minute apart, before it stops (`render()` in `tools/preview/sheet.sh`). A shader that does not compile now takes a minute and a half longer to stop.
- **`KEEP=1` for the sheet**: the folder is not cleared, and a theme sheet's frames already there are kept, so a sheet that stopped goes on where it stopped.
- **The bench warns with `--event`** (`tools/preview/shader.mjs`) that the ratio is not a measure, and says how to bench an event instead.

Left for a decision or a later round:

- **The font's `M`, `N` and `W`.** They need wider glyphs (five columns with a wider advance, or a variable advance) or a second, larger font. Every board, `sky_line16`, `sky_number` and the glyph tests change with it, and the font's look is Vincent's. The tickers stay half unreadable until then. Round 1 left this too; round 2 shows it costs a market theme its most visible element.
- **New York's weekday, a trading-day flag or a session state** (`sky_NEW_YORK_WEEKDAY`, `sky_TRADING_DAY`, or pre, open, post and closed), and **a "new high" flag per symbol**. F5 task 6 grows: `hooks/newyork.ts` already knows the holidays and early closes; a high needs history the price fetch does not keep.
- **A plain rotation primitive** is not needed: `tumble(q, angle, 1.0)` is one, now documented.
- **Anchors for the engine's props**, a constant or a hook saying where the flag and the maypole stand so that a theme can move them, are not done; the guide gives their places instead. Moving them per theme would change the engine's events and fyr's parity frame 23.
- **The bench under load.** A ratio taken while `none` is far above its quiet value (about 109 ms on Vincent's machine) is noise even when its rounds agree; the tool leaves out only rounds slower than its own quietest. A fixed reference is machine-dependent, so it stays with the guide's "`none` near 109 ms" and the judges. Serialising previews across worktrees (round 1's gap) would remove most of it.
- **The sheet's event frames are all on a closed Saturday**, and frames 01 to 04 before New York opens, so a market theme's events never show on a working floor. A weekday, market-open frame for a theme with `"market": true` would change the sheet's numbering after 37; left for Vincent with the next sheet change.
- **Frames 35 to 37 for a theme without the market** could be skipped or labelled; the guide now says what they are.
- **No GLSL 4.30 compile in the kit** (F8's `glslangValidator` step), and **no lint for `?:` between structs or arrays**, as in round 1.
