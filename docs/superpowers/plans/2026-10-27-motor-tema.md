# Engine and theme, split (F5) Implementation Plan

> **For agentic workers:** this plan is executed by the workflow `motor-tema` (one writer at a time, in one worktree, then three verifiers and a judge). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The sky becomes an engine and a theme: everything the island is (lighthouse, keeper, dolphins, surf, UFO, his line and grill) moves into the built-in theme `fyr` behind a fixed GLSL and manifest contract, and the sky draws pixel for pixel what 0.6.0 draws.

**Architecture:** Raw GLSL under a strict engine contract (the decision and its reasons are in the work plan, F5). The engine's parts are joined as today; a new `PROTOTYPES` part declares the four functions a theme defines (`scenery`, `resident`, `themeEvent`, `themeWindow`), and the theme's GLSL is appended after `MAIN`. A theme is `{ manifest, glsl }`; built-in themes are TypeScript wrappers round exactly that, so a community theme (`manifest.json` + `theme.glsl`) has the same power.

**Tech Stack:** TypeScript hooks module for Claude Code (`claude plugin test .`), GLSL ES 3.00 in the preview (headless WebGL via `tools/preview/shader.mjs`), GLSL 4.30 in Ghostty 1.3.1.

**Spec:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`, section "F5. Motor/tema-split" (contract, manifest format, signals, helpers, `when` vocabulary). This plan records where the code has moved since that section was written and the decisions that follow; where the two disagree, this plan wins.

## Global Constraints

- Pixels do not change. Every task ends with `tools/preview/parity.sh check .preview/parity-f5` printing `identical` for every scene, `claude plugin test .` green (108 tests at the start), and `npx -y -p typescript@5.6.3 tsc -p . --noEmit` clean. Test output goes to a file.
- All work happens in the worktree `.worktrees/motor-tema` on branch `motor-tema` (made from `main` at `d7ba2c7`). Never the main checkout: the mirror is armed and copies `hooks/` from it into the live sky.
- Only one preview render at a time per worktree (they share `.preview/shader.bundle.mjs`); a second renderer bundles to its own `--outfile`.
- One commit per task, subjects describing the world as it now is, comments in the project's plain prose, plans and code in English.
- `tool.check` stays a pure pass-through; nothing makes the sky more lively.
- Don't bump the version or push: Vincent decides that after the judge.

## Where the code stands (d7ba2c7), and the decisions that follow

The work plan's line numbers predate F3b and F4. Current facts, and what changes in the design:

1. **Themes live in `hooks/themes/`, not top-level `themes/`.** The mirror copies only `hooks`, `assets`, `types` (`.claude/hooks/mirror.sh:82`), and the root `tsconfig.json` only extends `.claude-plugin/types/tsconfig.json` whose include is `hooks`, `types`, `tests`. Paths below: `hooks/themes/index.ts`, `hooks/themes/theme.ts`, `hooks/themes/fyr/…`. The import-from-top-level spike falls away.
2. **`CATCH` splits.** `hooks/glsl/catch.ts:11-20` (`CONTEXT_IDLE/CLEARING/CLEARED/GAINED`, `contextFish()`, `contextState()`) is engine and becomes `hooks/glsl/context.ts` exporting `CONTEXT_MARK`; the rest of `catch.ts` (fish, line, landing, grill, smoke) is fyr. The fyr part list is `[SEA, KEEPER, SURF, NIGHT, ROUTINE, CATCH, UFO]`.
3. **Themes never read `iPalette`.** They read the context through `contextFish()` and `contextState()` only; the lint forbids `iPalette` in theme GLSL. The tab test in `MAIN` (`main.ts:217`) stays engine.
4. **The basket comes back as the engine's reserve.** `BASKET` (`hooks/glsl/basket.ts`) is imported by nothing today. It rejoins the engine parts, reads through `contextFish()`/`contextState()` instead of `iPalette[16]` (`basket.ts:33-34`), and `MAIN` calls it last before the rim only when the baked `const int CONTEXT_BY_ENGINE` is 1 (manifest `context: "engine"`). fyr is `"resident"`, so for fyr the call folds away.
5. **Size caps are set from what exists.** fyr is about 67 KB of GLSL and the whole shader 170 KB by day, 179 KB at night with 102 stars, so the work plan's 40 KB / 128 KB are void. New caps: theme GLSL ≤ 80 KB, whole shader ≤ 224 KB, both checked by a test on fyr at night.
6. **Helpers already in COMMON:** `smin`, `limb`, `widthShown`, `tumble`, `flame` (`common.ts:127-162`). Only `box` moves (from `events.ts:549`; `night.ts:82-83` uses it). Counts at d7ba2c7: `max(3.0, u * 0.24)` 13 in the shader (plus `unit * 0.24` at `clouds.ts:22`, `main.ts:277`, which are the same expression with another name and are replaced too; `rainbow()`'s `iResolution.y / 60.0 * 0.24` stays), `nightness(sceneNow().elevation)` 8, `lift(INK_INDIGO, k)` 29 in the shader (31 with basket).
7. **The key plate is not one idiom.** Shifts, widths and alphas differ per thing (balloon `vec2(0.12,0.1)*u`/`0.08*u`/0.7, kite no shift/`0.06*u`/0.6, dolphin `vec2(0.1,0.08)*u`/`0.05*u`/0.6, cloud and UFO `*px`, the keeper's grid `off`, …). `keyPlate()` replaces an occurrence only where the result is the same operations in the same order; the others are left as written. A parity mismatch after a replacement means revert that one, not tune it.
8. **Event numbers.** Kinds live in `EVENT_INDEX` (`shader.ts:103-129`): dolphin 21, pinkDolphin 22, abduction 23, surf 24 (the last two are `KEEPER_FORCE`, not events). `EVENTS` (`events.ts:87-114`) index 7 and 8 are the dolphins; the seed is `hash(index * 1_000_003 + slot * 7919 + 17)` (`events.ts:280`), so `salt` replaces `index` with the same values (engine specs 0..6 and 9 keep their index, fyr pins 7 and 8).
9. **`SIGNALS` is taken** (`hooks/test-kit.tsx:106`, a pkill counter). The documented signal list is `THEME_SIGNALS`, exported from `hooks/shader.ts`.
10. **Engine code must not name a fyr type or function.** Before the move, every reference from an engine part (`COMMON`, `SKY`, `CLOUDS`, `EVENTS`, `MAIN`, the new `CONTEXT_MARK`, `BASKET`) to a fyr symbol (`Lighthouse`, `lighthouse(`, `Keeper`, `keeper`, `beacon(`, `dolphin(`, `fishingSpot`, …) is either a call through one of the four prototypes or a bug to fix. A GLSL struct cannot be prototyped, so a fyr struct named in engine code means that code moves to fyr.
11. **The parity harness exists** (`tools/preview/parity.sh record|check <dir>`, sha256 of each frame, 16 scenes). Task 0 extends it rather than writing the work plan's `parity.mjs`; on a mismatch, `tools/preview/diff.mjs` shows where.

## Review Focus

- **The event schedule after the dolphins leave `EVENTS`:** over a fortnight of slots, the same events at the same minutes as before (salt equals the old index). Pinned in Task 3.
- **Old and Swedish words:** `/solar event delfin`, `rosa delfin`, `dolphin`, `pinkDolphin` still force the dolphins (aliases now). Pinned in Task 3.
- **The "only in Ghostty" refusal** for `abduction` and `surf` outside Ghostty still refuses, now for any theme's preview kinds (`session.test.tsx:52-71`). Pinned in Task 3.
- **The night shader with stars, aurora, ISS and the fish** stays under the new caps and still compiles in the preview (the size test runs fyr at 04:00 with `--aurora --iss --fish 9,grill`). Pinned in Task 3.
- **A tab without the mark, the light sky, `--y-up`, `--p3`:** engine paths the theme split touches indirectly; all in the parity matrix (Task 0).

---

### Task 0: Parity matrix and the GLSL spikes

**Files:**
- Modify: `tools/preview/parity.sh`
- Create: `.preview/parity-f5/` (record, not committed)

- [ ] **Step 1:** Extend `parity.sh`'s scene list to the work plan's matrix (keeper loop `--time 20/45/60/75`, `--event dolphin`, `pinkDolphin`, `surf`, `abduction` at `--time 88` and `126`, `--beacon asking` at dusk, `--urgent` at night, `--beacon done`, night with `--aurora`, `--iss`, moon, hammock at 04:00, rain, snow, storm with kite, `--fish 6`, `--fish 9,grill`, `--fish 0,embers`, `--fish 7,catch`, `comet,constellation`, `rainbow --rained`, `balloon,plane,birds`, christmas, flag day, new year, `milestone`, `--demo`, `--stage 0`, `--y-up`, `--diff --p3`, `--light`, `--unmarked`, band with `--sky-context`, and the current 16). Every scene is `same`. Add `--large`: the eight scenes marked in the work plan again at `--width 3024 --height 1964 --stage 480`.
- [ ] **Step 2:** Add `parity.sh twice <dir>`: render every scene twice and fail on any frame that differs. Run it; expected: all identical. A scene that isn't deterministic is reported, not silently tolerated.
- [ ] **Step 3:** `tools/preview/parity.sh record .preview/parity-f5` and `… --large record .preview/parity-f5-large` at d7ba2c7.
- [ ] **Step 4 (spike, own bundle file):** in a scratch copy of the shader, prove in the preview that (a) a function called in `MAIN` and defined after it with a prototype before compiles, and (b) a sized array parameter `uint rows[8]` compiles and reads. Report both; nothing from the spike is committed.
- [ ] **Step 5:** Commit: "A parity matrix that renders the sky before and after, twice over, and compares the frames".

### Task 1: Helpers in COMMON

**Files:** Modify `hooks/glsl/common.ts`, `events.ts`, `sea.ts`, `surf.ts`, `ufo.ts`, `night.ts`, `keeper.ts`, `routine.ts`, `catch.ts`, `clouds.ts`, `main.ts`, `basket.ts`; test `hooks/sky.test.tsx`.

**Interfaces — produces (GLSL, in COMMON):** `float pitch(float u)` = `max(3.0, u * 0.24)`; `float night()` = `nightness(sceneNow().elevation)`; `vec3 keyInk(float k)` = `lift(INK_INDIGO, k)`; `vec2 keyShift(float u)` = `vec2(0.12, 0.1) * u`; `vec3 keyPlate(vec3 sky, float sdShifted, float width, float alpha, float k)`; `float box(vec2 p, vec2 b)` moved verbatim. Plus the work plan's `nightInk`, `noise2`, `fbm`, `steam`, `lamp`, `spriteAt`, `sprite` with the signatures given there.

- [ ] **Step 1:** Test in `sky.test.tsx`: each helper above is defined exactly once in the shader text, and none of `max(3.0, u * 0.24)`, `nightness(sceneNow().elevation)`, `lift(INK_INDIGO, k)` remains outside COMMON. Run; expected FAIL.
- [ ] **Step 2:** Add the helpers, move `box`, replace the occurrences (decision 6), `keyPlate` only where identical (decision 7).
- [ ] **Step 3:** Tests, tsc, `parity.sh check` all green and identical.
- [ ] **Step 4:** Commit: "The sky's parts share pitch, night, keyInk and the key plate from COMMON".

### Task 2: Prototypes and the draw order

**Files:** Create `hooks/glsl/prototypes.ts`, `hooks/glsl/context.ts`; modify `main.ts`, `events.ts` (GLSL), `sea.ts`, `ufo.ts`, `catch.ts`, `basket.ts`, `hooks/shader.ts`; tests `sky.test.tsx`, `band.test.tsx:81-108`.

**Interfaces — produces:** the four prototypes, verbatim from the work plan; `CONTEXT_MARK` (decision 2); `const int CONTEXT_BY_ENGINE` baked from `ShaderParams.contextByEngine: boolean`; in `MAIN` after `events(behind)` and ISS: `scenery` → `resident` → `float window = themeWindow(p, unit)`; if `window > 0.0`: clouds (with the `LIGHT` gate) → `events(front)` → `weather`, mixed as the work plan says; then `if (CONTEXT_BY_ENGINE == 1) sky = basket(…)`; then the rim. `events()` dispatches `kind >= 100` to `themeEvent(…, kind - 100, …)` first in the loop; `EVENT_INDEX` gives dolphin 100, pinkDolphin 101.

- [ ] **Step 1:** Tests: shader text has `PROTOTYPES` directly after `COMMON`; `beacon(`, `keeper(` no longer called in `MAIN`; `themeEvent(` called in `events()`; the band test's expectations move from `CATCH` to `CONTEXT_MARK` for `iPalette[16]`. Run; FAIL.
- [ ] **Step 2:** Grep the engine parts for fyr symbols (decision 10) and resolve each before moving anything.
- [ ] **Step 3:** Rename `beacon()` → `scenery()` (sea.ts:88), `keeper()` → `resident()` (ufo.ts:159), add `themeWindow` returning 1.0 and `themeEvent` mapping 0/1 to `dolphin(…, kind == 1)` in sea.ts, split catch.ts, fix basket.ts, rewire `MAIN` and `events()`.
- [ ] **Step 4:** Tests, tsc, parity identical.
- [ ] **Step 5:** Commit: "The sky draws its scenery, resident and theme events through four prototypes".

### Task 3: The theme `fyr`

**Files:** Create `hooks/themes/theme.ts`, `hooks/themes/index.ts`, `hooks/themes/fyr/index.ts`, `hooks/themes/fyr/manifest.ts`; `git mv hooks/glsl/{sea,keeper,surf,night,routine,catch,ufo}.ts hooks/themes/fyr/glsl/`; modify `hooks/shader.ts`, `hooks/events.ts`, `hooks/register.tsx`, `tools/preview/shader.mjs`; tests `sky.test.tsx:476-497`, `session.test.tsx:52-71, 151-182`, a new `hooks/theme.test.tsx`.

**Interfaces — produces:**
- `hooks/themes/theme.ts`: `type ThemeManifest` (format 1 as in the work plan), `type Theme = { manifest: ThemeManifest; glsl: string }`, `themeOf(manifest: unknown, glsl: string): Theme | { error: string }`, `lintTheme(glsl: string, engineNames: readonly string[]): string[]`, `whenOf(when: ThemeWhen): (ctx: EventContext) => boolean`, `ENGINE_EVENT_BASE = 1`, `THEME_EVENT_BASE = 100`, `THEME_GLSL_MAX = 80_000`, `SHADER_MAX = 224_000`.
- `hooks/themes/index.ts`: `THEMES = { fyr: FYR } as const`, `BASE_THEME = 'fyr'`.
- `hooks/shader.ts`: `skyShader(params: ShaderParams, theme: Theme): string`; `THEME_FORCE` replaces `KEEPER_FORCE` (1-based manifest preview position; abduction 1, surf 2 in fyr).
- `hooks/events.ts`: `eventsAt(ms, ctx, forced, specs: readonly Spec[])`; `specsOf(theme)`, `wordsOf(theme)`, `kindOf(word, theme)`; `Spec` gains `salt: number`; `EventKind = EngineEventKind | (string & {})`.
- `register.tsx`: `let theme = THEMES[BASE_THEME]`, passed to `eventsNow`, `viewAt`, `shaderAt`, `/solar events`, `/solar event`; the Ghostty-only refusal covers every preview kind of the theme.
- `tools/preview/shader.mjs --theme <name>` (default `fyr`).

- [ ] **Step 1:** Before anything moves: a test that pins `eventsAt` over 14 days of slots from 2026-10-20 (kind and start minute of every event) as a literal, run green on d7ba2c7.
- [ ] **Step 2:** `theme.test.tsx`: `themeOf` rejects a duplicate kind, a word clashing with an engine word, `minutes >= slotMinutes`, liveliness over 0.08; `lintTheme` flags each forbidden token in the work plan's list plus `iPalette`, and passes fyr's GLSL; `whenOf` reproduces every current `EVENTS` predicate; fyr's GLSL ≤ `THEME_GLSL_MAX`; the night shader (04:00, aurora, ISS, fish 9 grill) ≤ `SHADER_MAX`; `delfin`, `rosa delfin` resolve through aliases. Run; FAIL.
- [ ] **Step 3:** Implement. If fyr breaks a lint rule, either rewrite that GLSL identically (parity) or relax the rule and say which and why in `theme.ts`.
- [ ] **Step 4:** All tests (the schedule test unchanged), tsc, parity identical.
- [ ] **Step 5:** Commit: "The island is the theme fyr, and the sky its engine".

### Task 4: The waiting light by its own name

As the work plan's task 4, at current lines: `BEACON`/`BEACON_URGENT` → `WAITING`/`WAITING_URGENT` (`shader.ts:404-405`, fyr's sea/surf/routine), `KEEPER_ASLEEP` → `CLAWD_ASLEEP` (`shader.ts:417`, routine, surf), `hooks/beacon.ts` → `hooks/waiting.ts` (`beaconAt` → `waitingAt`, `BEACON_*_MS` → `WAITING_*_MS`, `animationOf` keeps its name and its `isLively`), `ShaderParams.beacon` and `SkyExtras.beacon` (`ghostty.ts:168`) → `waiting`, the token at `register.tsx:327`. Tests `sky.test.tsx:255-262, 290-311, 468`, `session.test.tsx:608-724, 764-791`, `band.test.tsx:52`. User-facing text that says lighthouse stays (it is fyr's word, shown while fyr is the theme). Parity identical. Commit: "Claude's waiting is the engine's, and the lighthouse only the way fyr shows it".

### Task 5: The last edges

`activityAt`/`activityOn` → `hooks/hours.ts` (so `shader.ts` stops importing `clawd`), `isPrintable` → `paint.ts`, `field`/`number` → `hooks/json.ts`, `tabMark`/`markOf`/`UNMARK_TAB` → `hooks/mark.ts`, delete the unused `hooks/print.ts`. A test: no file under `hooks/` outside `hooks/themes/` imports from `hooks/themes/fyr`. Commit: "The engine's files import no character and no theme".

### Task 6: Signals

Bake `LOCAL_HOUR` (0..24 with minutes), `WEEKDAY`, `MONTH`, `DAY`, `TEMPERATURE`, `CLAWD_ACTIVITY` (0 earlyBird .. 5 sleep); export `THEME_SIGNALS` listing every constant a theme may read (the work plan's list plus `LIGHT`, `CONTEXT_BY_ENGINE`, and the renamed ones), with a test that each is declared in the shader text. Commit: "A theme reads the hour, the day, the weather and Clawd's day from a documented list".

### Task 7: Theme tools

`tools/theme/lint.mjs <dir|name>` (runs `lintTheme` and the size caps), `tools/theme/pack.mjs fyr <out>` (writes `manifest.json` + `theme.glsl`; a test packs fyr to a temp dir, reads it back through `themeOf` and lints clean), `tools/preview/sheet.sh theme <name>` (the parity scenes for one theme at small size, contact sheet via ffmpeg `tile`), `--theme none` in `shader.mjs` (the four prototypes stubbed to return `sky` / 1.0) so `--bench` can print `theme cost = frame(theme) − frame(none)` and the ratio to fyr. Commit: "Tools to lint, pack, sheet and bench a theme".

### Task 8: Docs

README "Developing": engine and themes, the contract, the caps, the tools. `hooks/themes/fyr/README.md`: what fyr draws and where. Commit: "The README tells how the engine and a theme fit together".
