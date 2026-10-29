# /solar tune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A keyboard pane, `/solar tune`, where anyone sets the sky's brightness, text shade, colour and warmth for dawn, day, dusk and night, and Ghostty's text (size, weight, line height, font, faint text, the gap to the stage) once for all hours and themes, and watches both follow while they change them.

**Architecture:** One pure module, `hooks/tune.ts`, owns the settings: their shape, limits, the phase weights from the sun, and the blend into the four numbers a moment needs. `skyShader` bakes those numbers in as `TUNE` (and `DEMO_TUNE` per demo scene); the GLSL applies them only at the sky's own gradient and in the rim round text. Settings and an unsaved preview live in the shared `sky.json` beside `pace`, read at every sky update so every session draws the same sky. The pane is a `Client` surface module that posts key presses to the hooks module, which writes the preview and the saved values.

**Tech Stack:** TypeScript mod (`claude plugin test .`), GLSL baked as text, headless-Chrome preview (`tools/preview`), zsh for the measurement.

**Spec:** `docs/superpowers/specs/2026-10-28-solar-tune-design.md` (Swedish). Read it first; this plan argues from it.

## Global Constraints

- Work in `.worktrees/tune` on branch `tune` from `main`; in the new worktree `ln -s ../../../.claude-plugin/types .worktrees/tune/.claude-plugin/types`.
- Never run `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh` or `.claude/hooks/mirror.sh --now`; never write to `~/.claude/settings.json`, `.claude/` or `.git/`. No merge to `main`, no push: Vincent decides both.
- Measurements in Ghostty are Vincent's. Prepare the script, ask him to run it, wait for his numbers.
- Every task ends green: `claude plugin test . > /private/tmp/claude-501/tune-test.txt 2>&1` (read the file), and `npx -y -p typescript@5.6.3 tsc -p . --noEmit`.
- With the default settings the sky is exactly today's: `tools/preview/parity.sh check .worktrees/takt/.preview/parity-takt` reports 53/53 identical (runs >10 min; run it in the background, behind the Chrome lock if another render is going).
- Labels and every word the mod says are English; comments plain prose matching the file around them; commit subjects describe the world as it now is; commit messages end with the attribution lines in the session's reminder.
- Brightness only lowers the sky from today's, text shade only strengthens the rim from today's, and no setting may make the tuned sky lighter than today's sky at the same moment (spec, Anti-mål).
- Brightness acts on the sky's own gradient (with the stars and moon drawn into it) and nothing else: clouds, weather, events, scenery, the waiting light keep today's light (spec, "Det Vincent har bestämt").
- No visible number in the pane reads as a meme: not 67, 42, 69 or 420 (the ranges below never show them; keep it that way if you change a step).
- Bump `.claude-plugin/plugin.json` to `0.10.0` (`teman` holds `0.9.0`).

## Review Focus

1. A `sky.json` from an older Solar (`{"pace":"full"}`), hand-edited, cut short or with values out of range: the sky draws with defaults or clamped values, `/solar full|spar` still works, nothing throws. (Task 2 tests.)
2. The tuning session dies with a preview showing: every other session stops drawing it within 60 s of its last heartbeat, and an `until` far in the future is treated as at most 60 s from now. (Task 4 tests.)
3. `/solar full` or `/solar spar` after tuning keeps the tune, and saving a tune keeps the pace. (Task 2 tests.)
4. `/solar demo` with a tuned day and an untuned night: the demo's day is dimmed and its night is not, through the whole 48 s. (Task 3 tests.)
5. `/solar tune` outside Ghostty (iTerm2, Linux, plain terminal): one line saying it is Ghostty's, no pane, nothing written. (Task 5 tests.)
6. A text value Ghostty refuses never reaches the config, so Ghostty's error window never opens; closing the pane without keeping leaves the text as it was; the person's own `font-family` list is replaced only when they chose a font. (Task 5b tests.)

---

### Task 1: Measure how fast Ghostty takes a changed shader (Vincent runs it)

**Files:**
- Create: `tools/measure/reload.sh`
- Modify: `docs/superpowers/plans/2026-10-28-solar-tune.md` (record the result under this task)

**Interfaces:**
- Produces: a decision recorded here: `reload` (the live path below) or `palette` (stop and replan).

- [ ] **Step 1: Write `tools/measure/reload.sh <interval-ms> <seconds>`** (zsh, header comment like `tools/measure/gpu.sh`). It copies the live shader from `~/Library/Application Support/solar-clawd/runtime/` (find the file name in `hooks/ghostty.ts`), then for `<seconds>` alternates two versions every `<interval-ms>`: the original, and one with `sky = tone(sky, k);` replaced by `sky = tone(sky, k * 0.72);`, each written by write-then-rename as `hooks/ghostty.ts` does, each followed by a reload as `reloadGhostty` in `hooks/ghostty.ts` makes it on a Mac since 0.9.2: `kill -USR2` to the app's pid (`ps -axo pid=,ppid=,comm=`, the line whose parent is 1 and whose command ends in `/Ghostty.app/Contents/MacOS/ghostty`). A running Solar session rewrites the shader at its next update (every 10 s) when the text differs; that blip is expected and the script's next write follows within the interval. It samples Ghostty's CPU with `top -pid <ghostty pid> -l <n> -s 1 -stats pid,cpu` alongside, and puts the original back on exit (trap). It prints mean CPU and the count of signals `kill` reported as failed. Note in the result that the mod itself already reloads Ghostty every 3 to 10 seconds (Ghostty's log, 2026-10-29), and that every reload may recompile the shader in every open tab (`docs/superpowers/notes/text-tuning-research.md`); measure with two tabs open as well as one.

- [ ] **Step 2: Check it without Ghostty**

Run: `zsh -n tools/measure/reload.sh && tools/measure/reload.sh 2>&1 | head -3`
Expected: no syntax error; the usage line.

- [ ] **Step 3: Commit**, then ask Vincent to run, from Ghostty with the sky showing and nothing heavy running: `tools/measure/reload.sh 200 20` and `tools/measure/reload.sh 300 20`, and to say for each whether the sky followed without lag he minds and without flicker.

- [ ] **Step 4: Record his answer here and decide.** `reload` if 200 or 300 ms followed well and Ghostty's CPU stayed under about 20 % of a core; take the faster interval that did as `PREVIEW_MS`. Otherwise `palette`: stop after Task 4 and replan the live preview through palette colours 17+ (spec, "Hur snabbt direkt kan bli", point 3).

---

### Task 2: The settings, their limits and where they are kept

**Files:**
- Create: `hooks/tune.ts`, `hooks/tune.test.tsx`
- Modify: `hooks/pace.ts` (`asPace` reads through the new parser), `hooks/ghostty.ts:448-451` (`readPace` → `readSettings`), `hooks/register.tsx:807` (merge instead of overwrite), every caller of `readPace`

**Interfaces:**
- Produces, in `hooks/tune.ts`:
  - `export type Phase = 'dawn' | 'day' | 'dusk' | 'night'`, `export const PHASES: readonly Phase[]` in that order.
  - `export type TuneValues = { brightness: number; shade: number; colour: number; warmth: number }`.
  - `export type TuneSettings = Record<Phase, TuneValues>`.
  - `export const NEUTRAL: TuneValues = { brightness: 1, shade: 1, colour: 1, warmth: 0 }` (today's sky) and `export const DEFAULT_TUNE: TuneSettings` (every phase `NEUTRAL` until Task 7).
  - `export const LIMITS: Record<keyof TuneValues, { min: number; max: number; step: number }>`: brightness 0.5–1 step 0.05; shade 1–1.5 step 0.05; colour 0.5–1.3 step 0.05; warmth −1–1 step 0.25.
  - `export function clampTune(values: Partial<Record<keyof TuneValues, unknown>>): TuneValues` (non-numbers → NEUTRAL's, out of range → clamped, snapped to step).
  - `export type Settings = { pace: Pace; tune: TuneSettings; preview: { tune: TuneSettings; phase: Phase; until: number } | null }`.
  - `export function asSettings(text: string): Settings` (any text; never throws).
  - `export function withSettings(text: string, patch: Partial<Settings>): string` (the file's JSON with `patch` merged over what it says, unknown keys kept).
- Produces, in `hooks/ghostty.ts`: `export async function readSettings($: EngineInterface, ghostty: Ghostty): Promise<Settings>` and `export async function writeSettings($: EngineInterface, ghostty: Ghostty, patch: Partial<Settings>): Promise<void>` (read, `withSettings`, write-then-rename as the shader file is written).

- [ ] **Step 1: Write the failing tests** in `hooks/tune.test.tsx`:
  - `'settings from an older Solar, broken or out of range give defaults and limits'`: `asSettings('{"pace":"full"}')` → `pace 'full'`, `tune` equal to `DEFAULT_TUNE`, `preview null`; `asSettings('{"pace":"ful')` → spar, defaults; `asSettings('{"tune":{"day":{"brightness":0.1,"shade":"x","warmth":7}}}').tune.day` equal to `{ brightness: 0.5, shade: 1, colour: 1, warmth: 1 }`; `clampTune({ brightness: 0.73 }).brightness` is `0.75`.
  - `'a tune saved keeps the pace and the pace kept keeps the tune'`: `asSettings(withSettings(withSettings('{"pace":"full"}', { tune: T }), { pace: 'spar' }))` has `pace 'spar'` and `tune` equal to `T`, for a `T` whose day brightness is 0.8; `withSettings('{"other":1}', { pace: 'full' })` keeps `other: 1`.
  - In `hooks/session.test.tsx`, beside the existing `/solar full` test: `'/solar spar keeps a tune already saved'` (seed the kit's `sky.json` with a tune, run `/solar spar`, read the file back through `asSettings`).

- [ ] **Step 2: Run them and see them fail**

Run: `claude plugin test . > /private/tmp/claude-501/tune-test.txt 2>&1; grep -E "✗|fail" /private/tmp/claude-501/tune-test.txt | head`
Expected: the three new tests fail (missing module, then wrong values).

- [ ] **Step 3: Implement** `hooks/tune.ts` as above; make `asPace` delegate to `asSettings(text).pace` so its tests stand; replace `readPace` with `readSettings` (callers take `.pace`); change `register.tsx:807` to `writeSettings($, ghostty, { pace })`.

- [ ] **Step 4: Run all tests and tsc**; expected green.

- [ ] **Step 5: Commit** (`hooks/tune.ts`, tests, pace/ghostty/register changes).

---

### Task 3: The tune in the shader, the rim and the wallpaper

**Files:**
- Modify: `hooks/tune.ts` (phase weights, blend, colour), `hooks/shader.ts` (`ShaderParams.tune`, `shaderParams` option, `TUNE`/`DEMO_TUNE` constants), `hooks/glsl/common.ts` (`tuneNow()`, `tuned()`), `hooks/glsl/main.ts:276` and `shade()`/`shaded()`, `hooks/sky.ts` (the wallpaper's gradient), `tools/preview/shader.mjs` (`--tune`)
- Test: `hooks/tune.test.tsx`, `hooks/sky.test.tsx`

**Interfaces:**
- Consumes: Task 2's types and `NEUTRAL`/`DEFAULT_TUNE`.
- Produces, in `hooks/tune.ts`:
  - `export function phaseWeights(scene: Scene): Record<Phase, number>`: `day = smoothstep(4, 12, elevation)`, `night = smoothstep(-5, -13, elevation)` (the sky's `nightness`), `twilight = max(0, 1 - day - night)`, `evening = isDay ? smoothstep(0.35, 0.65, progress) : 1 - smoothstep(0.35, 0.65, progress)`, `dawn = twilight * (1 - evening)`, `dusk = twilight * evening`. Continuous at sunrise, sunset, noon and midnight by construction; sums to 1.
  - `export function tuneAt(settings: TuneSettings, scene: Scene): TuneValues` (the weighted sum, each value rounded to 0.01 so the shader text changes only when a value does).
  - `export function tunedColour(c: number, k: number, values: TuneValues): number` (packed RGB as `hooks/paint.ts` uses): warmth first as a luminance-keeping tint (multiply by `mix(1, WARM, w)` for `w > 0` or `mix(1, COOL, -w)` for `w < 0`, with `WARM = [1.08, 1.0, 0.86]`, `COOL = [0.9, 0.98, 1.1]`, then scale back to the colour's own luminance; skipped entirely at `w == 0`, so today's sky is bit for bit today's), then the sky's `tone` with `k * brightness` and `SATURATION * colour`.
- Produces, in `hooks/shader.ts`: `ShaderParams.tune: { now: TuneValues; demo: TuneValues[] }`; `shaderParams(input, { …, tune?: TuneSettings })` (defaults to `DEFAULT_TUNE`), computing `now` from the scene and `demo` per demo scene; constants `const vec4 TUNE = vec4(brightness, shade, colour, warmth);` and `const vec4 DEMO_TUNE[n]`.
- Produces, in GLSL: `vec4 tuneNow()` (as `sceneNow()` does, from `DEMO_TUNE` in a demo) and `vec3 tuned(vec3 sky, float k, vec4 t)` mirroring `tunedColour`.

- [ ] **Step 1: Write the failing tests** in `hooks/tune.test.tsx`:
  - `'the phases follow the sun and blend without a jump'`: at elevation 30 day weight 1; at −20 night 1; at −2 with `isDay false, progress 0.9` dawn 1; at −2 with `isDay false, progress 0.1` dusk 1; sweeping a real Stockholm day in 1-minute steps through `sceneAt` (2026-10-24 and 2026-12-21, both: noon below 12° in December), no weight changes by more than 0.02 between neighbouring minutes, and the weights sum to 1 ± 1e-9 everywhere.
  - `'a phase tuned leaves the others as they were'`: settings with only `day.brightness 0.7`: `tuneAt` at elevation 30 gives brightness 0.7, at −20 gives 1.
  - `'no setting makes the sky lighter than today'`: for every stop colour in `STOPS` (`hooks/sky.ts`), every `k` in {1, 0.85}, and every corner of `LIMITS` (all 16 combinations of min/max), `luminance(tunedColour(c, k, v)) <= luminance(tunedColour(c, k, NEUTRAL)) + 0.005`.
  - `'today's settings draw today's sky'`: `tunedColour(c, k, NEUTRAL)` equals the wallpaper's untuned tone of `c` for every stop.
  - In `hooks/sky.test.tsx`: `'the shader carries the tune of its moment, and a demo the tune of each scene'`: `skyShader(shaderParams(noonInput, { tune }))` contains `const vec4 TUNE = vec4(0.7, 1.0, 1.0, 0.0);` for day brightness 0.7; with `demo: { seconds: 48 }` the `DEMO_TUNE` array has 96 entries, the ones at midday scenes `0.7`, the ones at midnight scenes `1.0`; with no `tune` given the shader contains `vec4(1.0, 1.0, 1.0, 0.0)`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement** the three functions, the params and constants. In `main.ts` replace `sky = tone(sky, k);` (line 276) with `vec4 t = tuneNow(); sky = tuned(sky, k, t);` and pass `t.y` to the rim: `shade()` returns `min(1.0, … * t.y)` for its strength (both `SHADE` and `SHADE_NEAR`). Clouds, events, scenery, `sunAt` keep plain `k`. Mirror `tunedColour` in the wallpaper's gradient in `hooks/sky.ts` (`WALLPAPER_*` path, `paintWallpaper`'s gradient only), taking the tune through its existing input. Add `--tune b,s,c,w` to `tools/preview/shader.mjs` (all four phases set to it).

- [ ] **Step 4: Run tests and tsc**; green. Then render `tools/preview/run.sh shader --at 2026-10-24T13:00 --weather 2,12,3,45 --tune 0.72,1,1,0 --out tune-check` behind the lock and compare by eye with `.superpowers`'s `jf-himlen.png` (the frame Vincent chose): the same picture.

- [ ] **Step 5: Parity** in the background: `tools/preview/parity.sh check .worktrees/takt/.preview/parity-takt`; expected 53/53 identical. Then the cost: `tools/preview/run.sh shader --at 2026-10-24T13:00 --bench 200` on this branch and on `main` (`BUNDLE` or a main worktree), behind the lock; the branch's ms a frame within 3 % of main's.

- [ ] **Step 6: Commit.**

---

### Task 4: Every session draws the saved tune, and the preview while there is one

**Files:**
- Modify: `hooks/register.tsx` (`shaderAt` around :362, the update path around :470, the activity loop around :525), `hooks/ghostty.ts` (`updateGhosttySky` reads settings first), `hooks/tune.ts` (`activeTune`, `previewMoment`)
- Test: `hooks/session.test.tsx`

**Interfaces:**
- Consumes: Task 2's `readSettings`/`writeSettings`, Task 3's `shaderParams({ tune })`.
- Produces, in `hooks/tune.ts`:
  - `export const PREVIEW_LIFE_MS = 60_000`.
  - `export function activeTune(settings: Settings, now: number, firstSeen: number | null): { tune: TuneSettings; phase: Phase | null }`: the preview's tune and phase while `now < until` and `now < firstSeen + PREVIEW_LIFE_MS`, where `firstSeen` is when this session first read that `until` (so an `until` hours ahead, a dead session's or a skewed clock's, still lapses within a minute; the tuning session renews `until` every 20 s, which a reader sees as a new `until`); otherwise the saved tune and `null`.
  - `export function previewMoment(phase: Phase, now: number, place: Place): number`: today's sunrise for dawn, solar noon for day, sunset for dusk, solar noon + 12 h for night (the rise/set the sky already computes in `hooks/astro.ts`/`dayArc`); `now` where the sun neither rises nor sets that day.
- Behaviour: iTerm2's wallpaper reads the same file, `~/Library/Application Support/solar-clawd/sky.json`, when it exists, and draws the saved tune (no preview, no text shade).
- Behaviour: at the start of each sky update the session reads `sky.json` (not only in the 3 s activity loop), so a session never writes a shader from settings older than its own update. While a preview has a phase, the shader's moment is `previewMoment(phase, …)` and its tune is that phase's values for every weight (one-hot), so the pane shows exactly the phase being changed.

- [ ] **Step 1: Write the failing tests** in `hooks/session.test.tsx` (the kit's Ghostty world, `RELOADS` to count reloads):
  - `'a saved tune reaches the shader of every session'`: seed `sky.json` with day brightness 0.7, start a session at noon, read the written shader: it holds `TUNE = vec4(0.7`.
  - `'a preview shows while its session lives and goes within a minute of its last word'`: seed a preview for `night` with `until = now + 30_000`; at noon the written shader's `ELEVATION` is below −5 and `TUNE` is the preview's night values; advance the clock 31 s: the next update writes today's noon and the saved tune. Seed `until = now + 3_600_000`: gone after 61 s.
  - `'a second session draws the preview instead of writing over it'`: two sessions on the kit's shared files; one writes a preview; after the other's next update (≤ 10 s simulated) both write identical shader text, and the reload count stops rising.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement** `activeTune` and `previewMoment`, read settings in the update, pass `tune` and the preview's moment into `shaderAt`. Keep the pace logic reading `settings.pace` as it read `readPace` before.

- [ ] **Step 4: Run tests, tsc, and the existing ticking tests** (`TICKING` timeouts); green.

- [ ] **Step 5: Commit.** If Task 1 decided `palette`, stop here and replan the live preview with Vincent.

---

### Task 5: The pane

**Files:**
- Create: `hooks/tune-pane.tsx` (the `Client` surface module), and its words in `hooks/tune.ts` (`TUNE_WORDS`)
- Modify: `hooks/register.tsx` (`/solar tune` in the command, `argumentHint`, the help line at :930; `ui.render` for `{ component: 'Pane' }` with id `solar-tune`; `ui.message` from the pane; `ui.close`)
- Test: `hooks/tune.test.tsx` (pure key handling), `hooks/session.test.tsx` (command, pane, files)

**Interfaces:**
- Consumes: Tasks 2–4; Task 1's `PREVIEW_MS` (default 250 if unrecorded).
- Produces, in `hooks/tune.ts`:
  - `export type PaneState = { phase: Phase; row: keyof TuneValues; tune: TuneSettings; opened: TuneSettings }`.
  - `export function onTuneKey(state: PaneState, key: string): { state: PaneState; action: 'none' | 'preview' | 'keep' }` — `up`/`down` move `row` (brightness, shade, colour, warmth, wrapping); `left`/`right` move the value one `LIMITS` step, clamped (→ `preview`); `tab` or `]` next phase, `[` previous (→ `preview`); `r` sets the row to `DEFAULT_TUNE`'s value (→ `preview`); `u` sets `tune` back to `opened` (→ `preview`); `return` → `keep`. Use Tab only if the focused `Client` receives it (check with the `plugin-authoring` skill and the types: a focused `Pane` walks its elements with Tab); otherwise `[`/`]` only, and the hint line says so.
- Behaviour:
  - `/solar tune`: outside Ghostty on a Mac, `TUNE_WORDS.notGhostty` and nothing else; otherwise `$.ui.open({ id: 'solar-tune', title: 'Solar tune', focus: true, closeOnEscape: true })`, starting on the phase with the largest weight now.
  - The pane's `Client` handles keys with `onTuneKey`, draws, and `post`s `{ state, action }`. The hooks module, on `preview`, writes `preview: { tune, phase, until: now + PREVIEW_LIFE_MS }` at most once per `PREVIEW_MS` (the last state wins) and refreshes the sky at once; while the pane is open it renews `until` every 20 s. On `keep`, `writeSettings({ tune, preview: null })`, refresh, and the pane says `TUNE_WORDS.kept` on its hint row. On `ui.close` (Escape, the close mark): `writeSettings({ preview: null })` and refresh; unsaved changes are dropped.
  - Look (risograph within the terminal): a dark blue body (`backgroundColor` on `ui.open`, `#10142a`), labels pink `#ff6fc0`, the chosen row and the knob yellow `#ffe800`, the bar's filled part `▓` and empty part `░`, the phase tabs with the current one inverted pink on dark blue, the hint row light blue `#9fd3ff`. Values shown as the spec's mock: brightness as a percent, shade/colour/warmth as `normal` at their neutral value and a signed step count otherwise (`+2`, `−1`).
  - Words (`TUNE_WORDS`, English): `notGhostty: 'Solar: tune is for the sky in Ghostty on a Mac.'`, `kept: 'kept'`, and the hint `↑ ↓ pick   ← → move   tab phase   ⏎ keep   r reset   u undo   esc close`.

- [ ] **Step 1: Write the failing tests:**
  - `hooks/tune.test.tsx`: `'keys move, clamp, reset, undo and keep'` — right at brightness 1 stays 1; left from 1 gives 0.95; `r` after two lefts gives `DEFAULT_TUNE`'s; `u` returns every phase to `opened`; `tab` from `night` wraps to `dawn`; `return` gives `keep`.
  - `hooks/session.test.tsx`: `'/solar tune outside Ghostty says so and opens nothing'` (iTerm2 world: the reply equals `TUNE_WORDS.notGhostty`, `$.ui.panes()` empty, `sky.json` untouched); `'the pane previews as you move, keeps on enter and forgets on escape'` (Ghostty world: open, send `left` three times within 100 ms → one preview write after `PREVIEW_MS` with day brightness 0.85; `return` → `sky.json` `tune.day.brightness` 0.85 and `preview null`; reopen, `left`, close → saved value still 0.85, `preview null`).

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement** the module, the hooks and the words.

- [ ] **Step 4: Run tests and tsc**; green. Ask Vincent to try it in Ghostty once the mirror carries the branch (he arms it; you do not), and note what he says here.

- [ ] **Step 5: Commit**, with the version bump to `0.10.0`, the README's `/solar` list, and `/solar tune` in `argumentHint` and the help line.

---

### Task 5b: The text tab

Ghostty's own text settings, one set for every hour and every theme (spec, "Texten"; research in `docs/superpowers/notes/text-tuning-research.md`). They are not the shader's: they go into a Ghostty include of their own and reach Ghostty through the same reload.

**Files:**
- Modify: `hooks/tune.ts` (the values, limits, lines), `hooks/ghostty.ts` (the text include, validation, the font-size reset, the gap in the padding line), `hooks/register.tsx` (the pane's text tab, the reload), `hooks/tune-pane.tsx`
- Test: `hooks/tune.test.tsx`, `hooks/session.test.tsx`

**Interfaces:**
- Produces, in `hooks/tune.ts`:
  - `export type TextValues = { size: number | null; weight: number | null; lineHeight: number | null; font: string | null; faint: number | null; gap: number }`. `null` means untouched: the person's own config decides, and no line is written.
  - `export const TEXT_LIMITS`: size 8–28 step 0.5; weight 0–255 step 32 (any number turns `font-thicken` on, `null` leaves it off); lineHeight 0–40 step 5 (percent, up only: 0 is today's); faint 0.5–1 step 0.1 (up only from Ghostty's 0.5); gap 0–120 step 8 points (0 is today's).
  - `Settings` gains `text: TextValues` (default all `null`, `gap: 0`); `asSettings` reads it as it reads `tune`, clamping and snapping, and an unknown font is kept as text.
  - `export function textLines(text: TextValues): string[]`: `font-size = 14.5`; `font-thicken = true` and `font-thicken-strength = 128`; `adjust-cell-height = 10%`; `font-family = ""` then `font-family = <name>` (so the choice replaces the person's list); `faint-opacity = 0.8`; nothing for a `null`, nothing for the gap.
- Produces, in `hooks/ghostty.ts`:
  - The text lines in `runtime/text.ghostty`, included by `config-file = ?<runtime>/text.ghostty` beside the mod's own include line, the way `vsync.ghostty` is (`includeVsync`). The mod never empties it when the sky goes: these are the person's Ghostty settings, kept while no session runs.
  - Before each write, `ghostty +validate-config --config-file=<temp>` with the app's binary (the path in the `ps` line `reloadGhostty` finds); its output piped, not sent to a file. On a failure the old file stays and the pane names the key. Then write-then-rename, and a reload.
  - After a write that changed `size`: `osascript -l JavaScript` running `reset_font_size` on every terminal of the app (as ghostty-designer does, `crates/host/src/ghostty.rs:313-337`), not awaited, since macOS asks the person once for Automation. Without it a window whose size was changed by hand keeps its size.
  - The gap: the mod's padding line becomes `window-padding-x = <left>,<stagePt + gap>`; `restageGhostty` and `includeInGhostty` take it. It reaches new windows only, as the stage's width does.
- Behaviour, in the pane:
  - A fifth tab, `text`, after `night`. Rows: size, weight, line height, font, faint text, gap. Each untouched row shows the person's own value from `ghostty +show-config` (read once as the pane opens), dimmed, with `own`.
  - ← → move a row by its step, the font row through `ghostty +list-fonts`'s families. A change is written at most once per `PREVIEW_MS`, the last one winning. `⏎` keeps (`writeSettings({ text })`); `r` sets the row back to untouched; `u` returns every row to what it was when the pane opened. Escape or the close mark write the opened values back, so nothing unkept stays.
  - The gap row says `new windows` beside its value.
- Not here: `minimum-contrast` (it does not see the sky and pushes grey text towards white), and a wider darkening of the sky behind text, which is a [hypotes] for frames first (spec, "Texten").

- [ ] **Step 1: Write the failing tests:**
  - `hooks/tune.test.tsx`: `'text values clamp, snap and stay untouched as null'` (a `sky.json` with no `text`, with a size of 40, with a lineHeight of −5 and with a font of `"Iosevka"`: 28, 0, kept); `'textLines writes only what was touched, the font list cleared first'` (all null gives `[]`; a font gives `['font-family = ""', 'font-family = Iosevka']`).
  - `hooks/session.test.tsx`: `'a text change is validated, written to its own include and reloaded'` (Ghostty world: `+validate-config` runs before `text.ghostty` is renamed into place, then one `kill -USR2`); `'a text change Ghostty refuses is not written'` (`+validate-config` failing: `text.ghostty` as before, no reload); `'a change of size resets the font size of every terminal'` (one `osascript -l JavaScript` with `reset_font_size`; none for a change of weight); `'the gap widens the padding line for new windows'` (gap 16 on a 400-point stage: `window-padding-x = 2,416`); `'hiding the sky keeps the text include'`.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Implement**, reusing `writeSettings`, the reload and the include helpers.

- [ ] **Step 4: Run tests and tsc**; green. Ask Vincent to try the text tab live (he arms the mirror): a change of size, of weight and of line height in an open window, and a new window for the gap. Note what he says here, and whether `font-family` and `adjust-cell-height` reflow a running Claude Code cleanly (research, "Ej verifierat" 2).

- [ ] **Step 5: Commit.**

---

### Task 6: Review the branch

- [ ] **Step 1:** Dispatch a fresh reviewer (superpowers:requesting-code-review) over `main..tune` with this plan and the spec; fix Critical and Important findings, each with a test.
- [ ] **Step 2:** Parity once more (53/53), tests, tsc. Record the results in this plan.
- [ ] **Step 3:** Merge `main` into the branch in a worktree if `main` has moved, test the merged result there, and tell Vincent the branch is ready. He decides the merge and the push.

### Task 7: Vincent's values become the defaults (after he has used it)

**Files:**
- Modify: `hooks/tune.ts` (`DEFAULT_TUNE`), `hooks/tune.test.tsx`

- [ ] **Step 1:** Read his `tune` from `~/Library/Application Support/solar-clawd/sky.json` (read only), and write it as `DEFAULT_TUNE`. `NEUTRAL` and the limits stay today's sky, so 100 % brightness is still today's.
- [ ] **Step 2:** Update the tests that assumed `DEFAULT_TUNE` is all `NEUTRAL` to say what they mean (`NEUTRAL` where they meant today's sky). Parity is no longer identical by design: record the new baseline and say so in the commit.
- [ ] **Step 3:** Tests, tsc; commit; bump the patch version.
