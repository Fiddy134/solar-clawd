# One-shot round 1: what the judges found, and what the guide learned

Round 1 of F7's protocol, run on 2026-10-28 while Vincent slept. Two fresh authors each had `docs/THEME-GUIDE.md` (as of `4b6b63e` on `teman`) and Vincent's paragraph, and a fresh judge went through §14's checklist with each theme's sheet. This note is the learning pass: each failure, its class, what changed in the guide, the engine and tool gaps, and what was measured to decide the cost advice. The themes and their branches were not touched.

## The two themes

| Theme | Branch, commits | Stage | Size | Judge | Hard line that failed |
|---|---|---|---|---|---|
| `terminal` (the airport) | `tema-terminal-r1`, `1f1f750` and `789d07c` | 440 pt | 67,210 of 80,000 | **fails** | 3, the bench: 1.42, 1.22, 1.40, middle 1.40 |
| `floor` (the trading floor) | `tema-floor-r1`, `e4e09bb` | 400 pt | 64,626 of 80,000 | **passes** | none; the bench's middle was 1.18, close to the line |

Both lint clean, compile, draw all 49 frames of the sheet, keep the text readable and show the waiting light in every still. Both read as their paragraph in five seconds. Neither passed in one sweep the way F7 means it: the airport failed a hard line, and the floor passed it narrowly after its author had spent most of the work on cost, with ratios of 2.8 to 4.1 on the way.

I measured the airport again on a quiet machine with no other preview running (below): it costs 62.8 ms a frame against fyr's 45.2 at the guide's scene, a ratio of 1.39. The judge's verdict stands.

## What the bench measures

Both authors reported that §10's main lever, the box test, did nothing on the bench, and that cost followed how much code was compiled in. One judge confirmed it on a copy of the airport; the other asked for it to be checked before the guide said so. I checked it, since §10 would be rewritten on it.

Each line below is the template (§15) with something added to its `scenery`, benched with `--bench 100 --bench-alone` at the guide's scene, 1512 × 982, three rounds taken by turns, the middle one, less the plain template (about 108 to 109 ms a frame, the same as `none`). The logs and the variants are in this session's scratchpad, `learn/bench*.txt` and `learn/<variant>/`, and are not kept.

| Added to the template | ms a frame |
|---|---|
| A loop of eight `fbm` (32 octaves) at four call sites, run for every stage pixel | +34.5 |
| The same four behind an `if` no pixel passes (a uniform, not foldable) | +7 |
| The same four after an early `return sky;` that every pixel takes | +3 |
| The same four behind a box of 32 × 32 pixels: as an `if` / as an early return | +6 / +3 |
| Ten calls of the template's `clawd()`, each with its own box test | +20 |
| The same ten behind an `if` no pixel passes | +24 |
| One `clawd()`, its slot picked by `p` | +5 |
| Four functions each with a `vec3[8]` and a `float[16]`: run / never reached | +5 / +8 |
| Ten picks of an ink from a `vec3[8]` / from a `?:` chain, all run | +14 / +10 |
| One `sky_glyph` / five, reached / five behind a test no pixel passes | ~0 / +5 / +5 |
| A copy of the font as a `?:` tree: one call / five | +4 / +8 |
| One `sky_line16` with an `int[16]` literal / one line from a `uvec4` | ~0 / ~+1 |
| A board of three lines: three `sky_line16` / one `sky_glyph` with the row picked | +6 / +4 |
| The airport theme / the same with `scenery`, `resident` and `themeWindow` returning in their first line (foldable test, and not foldable) | 62.8 / 66.7 and 67.0 |

What this says about SwiftShader, as far as the numbers go: straight-line code costs at every call site whether or not a pixel reaches it, and only a loop no pixel enters is skipped. That is why the airport's skip costs as much as the theme (its cost is dozens of call sites of straight-line drawing), why ten boxed `clawd()` calls cost the same reached or not, and why the box tests round a loop of `fbm` save nearly all of it. Arrays are a little dearer than `?:` chains when they run, and like any straight-line code they cost when they are not reached. The authors' "arrays are the biggest trap" (180 to 96 ms) is better explained by the call sites that went with them (`sky_line16` per line, a drawing per sign) than by the arrays as such. The author's own copy of the font, a `?:` tree, costs more than `sky_glyph`, not less.

The first-run penalty (2.8 to 3.6 on a fresh shader, reported by the floor's author) did not show in my `--bench-alone` runs: round 0 of each variant was within the noise of rounds 1 and 2. The noise itself, on a quiet machine: `none` from 108.6 to 112.7 ms, fyr's cost from 44.3 to 52.6 in the judges' runs. With previews of the other theme running in another worktree, `none` went from 108 to 373 ms and ratios from −751 to 12.

## Each failure and the guide change

| # | Failure | Class | Guide change |
|---|---|---|---|
| 1 | §10's box-test advice did not move the bench; the airport failed at 1.40, and the floor's author found by trial that fewer call sites, fewer `sky_glyph` calls and fewer loops took it from 4.1 to 1.07 | budget | §10 rewritten: what the bench measures (straight-line code at every call site, reached or not; a loop no pixel enters skipped), the measured table, and the levers in order: one call of a drawing function per layer, chosen by the cell `p` is in; the box test still first (for the GPU and for loops); never loop over instances; one glyph a function; share the work (inks, `night()`, one hash per thing); write less. §13's "a slow theme" names the same drawing called in many places. |
| 2 | One bench run decides pass or fail: 1.22 to 1.47 on one theme in a quiet hour, 1.50 against 1.18 on a first run, negative ratios under load | budget, tooling | §10's bench paragraph and §14 line 3: the hard line is `--bench 200 --rounds 3` on a machine where no other preview draws; the warm-up round and busy rounds are left out, the middle ratio counts; `none` near 109 ms and fyr near 45 ms are the signs of a quiet run; a negative ratio is noise. §13: previews in another checkout share the machine. |
| 3 | The guide's own examples teach the costly pattern: the crowd's `vec3 jumpers[4]`, `sky_line16` with an `int[16]` per line, a sign per call | budget | The crowd picks its jumper by a `?:` chain. §5 Letters rewritten: "One glyph a function", a line as a `uvec4` of 20 characters (one-liner to print it, `codeIn` to read it), `hello` and `tape` with one `sky_glyph`, and a board of three lines and a price drawn with one `sky_glyph` through a `Letter` struct. |
| 4 | The airport's author copied the engine's font into the theme (read off rendered glyphs) to save cost | reinvented primitive | §5: do not copy the font; it would not follow the engine's, and a copy chosen by `?:` measured dearer than `sky_glyph`. The engine needs no cheaper primitive: one `sky_glyph` costs under a millisecond; the cost was the number of call sites. |
| 5 | `?:` between structs does not compile in WebGL, and nothing said so | compile error | §13: "No `?:` between structs or arrays", with the compiler's words and the `if` form. Checked: ANGLE refuses both, "ternary operator is not allowed for structures" and "… for arrays". §5 says that is why a line is a `uvec4`. |
| 6 | The resident is lost among other Clawds: Viktor among six seated travellers, the floor's Clawd among about forty traders, under the stand-in status bar | identity | §6: "Among other Clawds": a place nobody else takes, a larger cell, plain coral where the others dress, 2 u from other coral bodies, out of the status bar's rows; the test is pointing at him within five seconds in frame 01. §14 line 7 says the same. |
| 7 | The airport's NOW BOARDING row inverts into dark letters on orange for 30 % of every second, so a third of stills catch it unreadable | waiting light | §11 Bad: words that spell the wait out and blink or invert into low contrast; a blink may change the light's strength, never whether it reads. |
| 8 | A split-flap turn on the whole minute is caught by frame 03 (`iTime` 60), two rows garbled | still | §5 "Text that changes": the sheet's `iTime` values, a turn on the whole minute lands in frame 03, offset each row, turn a few flaps at a time. |
| 9 | The floor on the horizon leaves 38 % of the stage below it, and the guide said nothing of it; the airport filled 17 % of the window with a smooth slab | style | The idiom after §12, "Below the floor": a basement or lower floor in the same cutaway, or the floor's thickness and foundations with halftone earth; never a smooth gradient. |
| 10 | The lit hall keeps its day blue at night and dominates the night frames | style | §9 Interiors: at night a room is lit by its lamps alone, its walls about 0.3 toward indigo and a little warmer, the lamps, screens and boards at full light. The idiom's `building()` does it. |
| 11 | Edit, read and web showed as 20 px props in Clawd's hands; `other` showed nothing | identity | §4, after the mark: what Claude is doing shows at the scale of the world, each kind told apart in the whole frame, `other` a plain busy state; a worked example in a workshop (not either theme's world). §14 line 9. |
| 12 | The sheet's New York times were not stated: frames 01 to 04 and 07 are 08:00 before the open, the events fall on a Saturday | state | §13's scene table has a column with New York's time and whether the market is open for every frame (worked out with `hooks/newyork.ts`); §4 has "Two clocks": what follows the person's day, what follows the market. |
| 13 | The momentAge idiom handled one preview, and looked at the slot before for nothing (its own `momentStart` keeps a moment inside its slot) | state/still, doc | §8: one slot only, with the reason; `momentAge` takes the preview's place (0 for a moment that is not a preview) and keeps out of another preview's way; two previews in code, the second waiting for the first. |
| 14 | The stand-in status bar crosses the stage at y 862 to 884 and hides what stands there | tooling, doc | §13: its exact rows, why it is there, not to put the only sight of Clawd, the waiting light or a state in them, and `--zoom` or a Retina frame to look. |
| 15 | Small guesses: which end `sky_numberCode`'s column counts from; whether an `inout` struct with ints is allowed; whether plain globals are; what the mark's functions cost; how long a sheet takes | doc | §5: column 0 is the leftmost. §3 lint: an `out`/`inout` struct or `ivec2` is fine. §3: plain globals allowed, one pixel long, with the order the four functions are called in. §4: the mark's four functions are cheap, read once a function. §13: a sheet takes about a quarter of an hour, run it in the background. |
| 16 | `M`, `N` and `W` read as `H`, `Π` and `U` at a board's size | style, engine | §5: look at a board's words at the sheet's size, choose a larger cell or other words. The font itself is left (below). |

Every glsl block of the guide lints clean (`hooks/guide.test.tsx`), and the new ones (`codeIn`, `hello`, `tape`, `board`, `momentAge` with two previews, the crowd, the idiom's `building()`) were also compiled and drawn together in one scratch theme; the board reads correctly at the sheets' size.

## Engine and tool gaps

Done on `teman`, with the tests at 186 passing, `tsc` clean and fyr's parity checked against `.worktrees/takt/.preview/parity-takt`:

- **`--rounds n` for the bench** (`tools/preview/shader.mjs`): a warm-up round thrown away, then n rounds of the theme, `none` and fyr by turns, each round printed, rounds whose `none` is over 15 % slower than the quietest left out, and `ratio to fyr` the middle of the rest. Without it the bench is as before.
- **A warning when the machine is busy**: before measuring, the bench looks for another headless Chrome (`pgrep`) and says the bench is noise if it finds one. It does not wait or lock.
- **No hang when Chrome crashes** (`tools/preview/lib.mjs`): `--dump-dom` now writes into a file instead of a pipe, so a crash helper Chrome leaves behind cannot hold the run open, and every Chrome run is stopped after 15 minutes.
- **`/solar event` and a theme's words**: `kindOf` compares in lower case and in composed Unicode, so an alias with `ä` is found however it was typed and a word with a capital (`A380 landing`) is reachable now that `/solar` lowers what the person types. It only counts a table's own entries, which also settles the old loose thread `kindOf('constructor')`. Test in `hooks/theme.test.tsx`.

Left for a decision or a later round:

- **The hard gate measures something the GPU does not.** On SwiftShader straight-line code costs at every call site whether or not a pixel reaches it; on a GPU a box test skips it. A theme can pass the bench and waste the GPU (loops no box guards), or fail the bench while cheap on the GPU (many boxed call sites). Options: a `--gpu` bench with many repeats and medians as a second line (one `--gpu` run here was too noisy to use: fyr 1.13 against 0.12 ms), or state the line as compiled code as well. Vincent's call.
- **Previews across worktrees are not serialised.** The warning only tells; a workflow that runs two authors at once should run their benches and sheets one at a time, or a lock in the tools should make them wait.
- **The stand-in status bar runs across the stage.** Ghostty's stops at `STAGE_PX`. Stopping the stand-in there would change every parity frame of fyr, so it waits for a new baseline.
- **Nothing compiles a theme as GLSL 4.30.** Plain globals, and anything else the two dialects differ on, are checked in WebGL only (F8's `glslangValidator` step).
- **The font's `M`, `N` and `W`** at 3 × 5. A wider glyph option or redrawn letters would change the glyph test and any theme's board; not done blind.
- **No lint for `?:` between structs or arrays.** The compiler names it plainly and the guide now lists it; a lint that knows the theme's struct types was not worth the false alarms.
- **The resident's identity and a tool's scale** cannot be linted; they stay with the judge and §14.

## Did each theme pass

- `terminal`: **no**. Hard line 3 fails at 1.40 (judge) and 1.39 (my quiet re-measure). Everything else passes, with the resident hard to find and a third of asking stills unreadable on the board row.
- `floor`: **yes**, with a bench of 1.18 on a loaded machine and 1.06 to 1.08 on the author's quiet runs, the resident lost in the crowd, the tools seen only as small props, and the hall day-blue at night.

F7 counts a round as passed when both themes pass in one sweep; round 1 did not. Round 2 runs the authors again from nothing with this guide, and the judges should bench with `--rounds 3` on a machine where no other preview is drawing.
