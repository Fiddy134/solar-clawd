# /solar tune in the band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/solar tune` draws its sliders in the band above the prompt, left of the weather words, instead of in a pane beside the conversation, and the band loses Clawd and the wastebasket everywhere.

**Architecture:** Solar Clawd's own `AbovePrompt` hook (`hooks/register.tsx`) draws the band. While the tool is open, it draws a row with the tune `Client` (today's `hooks/tune-pane.tsx`, renamed) on the left and the weather `Raster` on the right. While the tool is closed, it draws the weather `Raster` alone. The open flag lives in `$.state`, so a reload can tell that the tool was open. Closing runs one function, `closeTuning`, which holds today's `ui.close` logic. That function is reached from `q`, from `/solar tune` and from a reload. The `Pane` and `TUNE_PANE` go away.

**Tech Stack:** Claude Code hooks module (TypeScript/TSX, `claude-code` API 2.1.312), `claude plugin test`, `tsc` 5.6.3.

**Spec:** `docs/superpowers/specs/2026-10-29-tune-i-raden-design.md`, which builds on `docs/superpowers/specs/2026-10-28-solar-tune-design.md`. Read both.

## Global Constraints

- Work in a worktree under `.worktrees/tune-band`. In it, run `ln -s ../../../.claude-plugin/types .worktrees/tune-band/.claude-plugin/types`. Do not use `EnterWorktree`.
- Tests: `claude plugin test . > /tmp/…/test.txt 2>&1`, with the output written to a file. There is no filter, and a run takes about 65 s. Types: `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Both must be clean at the end of every task.
- Parity: `tools/preview/parity.sh check <dir>` must give 53/53 identical against the baseline. Run it in the background.
- Version in `.claude-plugin/plugin.json` goes to **0.11.0**.
- Nothing is merged to `main` until Vincent has tried the merged result live. Nothing is pushed without his yes. Never run `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh` or `.claude/hooks/mirror.sh --now`, and never write to `.claude/` or `.git/`.
- Nothing new may write to Ghostty's tty during a turn. This is the 0.10.1 tick rule.
- Comments are plain prose in the style of the surrounding code. Commit subjects describe the world as it now is. End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Visible numbers must not read as tired memes. `tune.test.tsx` already checks values; keep those checks passing.

## Review Focus

- A person who types a digit first in an empty prompt while the tool is open: the digit switches tab instead of being typed. Expected, by design, only while the tool is open. Task 5 tests that digits do nothing to the band when the tool is closed.
- A window too low or too narrow for the tool (`maxRows` < 8, or `bodyColumns` < `TOOL_COLUMNS`): the band draws as closed, and the tool stays open, its preview kept. Task 3 tests both.
- The band hidden by a question (`hasSurvey`) while the tool is open: nothing is closed and the preview is still renewed. Task 3 tests it.
- The sky hidden with `/solar` while the tool is open: the tool is still drawn, because the text tab still works. Task 3 tests it.
- A reload of the mod while the tool is open: the next start puts back what was saved and leaves the tool closed. Task 4 tests it.

---

### Task 0: Second keyboard probe (Vincent runs it; not in the repo)

**Files:**
- Modify: `~/.claude/dev-mods/<session>/band-probe/hooks/register.tsx` (throwaway; copy it from `~/.claude/dev-mods/94ad2f64-6707-47b8-acba-e12e9a57c101/band-probe/` if the session is new, and load the `plugin-authoring` skill first)

- [ ] **Step 1: Add `/bandprobe client`.** It draws the band with the `Client` alone: no Buttons and no `autoFocus`. The help line says `ctrl+x tab, then h ← → Tab Enter`. Keep `ui.fault` logging.
- [ ] **Step 2: Add a step 5 line to the full probe:** `type "ab", then 1 2`. This tests a `hotkey` with text in the prompt.
- [ ] **Step 3: Ask Vincent** to hide the sky with `/solar`, run `/bandprobe client` and then `/bandprobe`, follow the lines, and bring the sky back with `/solar`.
- [ ] **Step 4: Read `/private/tmp/claude-501/band-probe.log`.** Record the answers in the spec's "Ej verifierat" section. Each answer moves to "Tangentbordsprovet" as a table row. The questions are:
  - Does ctrl+x tab give the `Client` its keys?
  - Do Tab and Enter reach the `Client` with focus?
  - Does `1` press its button with "ab" in the prompt?
- [ ] **Step 5: Set `TUNE_KEYS` for Task 2** from the answers:
  - Tab missing: phase is `[` `]` only, and the hint says so.
  - Enter missing: keep is `s`.
  - ctrl+x tab missing: the hint starts `click`.
  - Commit the spec change: `git add docs/superpowers/specs/2026-10-29-tune-i-raden-design.md`.

### Task 1: The band without Clawd or the wastebasket

**Files:**
- Modify: `hooks/clawd.ts` (drawing and reactions), `hooks/register.tsx` (reaction bookkeeping that only feeds Clawd; `/solar catch`, `/solar grill`, `/solar storm` answers; the `/solar` help), `README.md`, `hooks/band.test.tsx`, `hooks/session.test.tsx` where they assert Clawd or the basket
- Version: `.claude-plugin/plugin.json` → 0.11.0 (once, here)

**Interfaces:**
- Produces: `drawFrame(view: View): string`, same signature. It draws the band sky, the precipitation, the fireworks and the words, right-aligned to the band's right edge. It draws no sprite, hat, basket, paper, throw or chase. `ROWS` stays 3.
- Keeps everything the shader reads: the keeper's catch and grill timing (`claude.catchUntil`, `fishShownUntil`, `GRILL_SHOWN_MS`, the embers time now in `REACTION_SECONDS.embers`). If `REACTION_SECONDS` goes, move that one value to a named constant in `clawd.ts` or `register.tsx`.

- [ ] **Step 1: Write the failing tests in `hooks/band.test.tsx`:**
  - `test('the band draws the words and no Clawd, at every hour and reaction')`: for a frame at 08:00, 13:00 and 03:00, and with `reaction: 'toss'`, `'burn'`, `'cheer'`, the cells in the last `CORNER` (22) columns hold no non-sky ink. Assert by comparing against the same frame with `isClear: true` and the words removed. The builder picks the exact probe, as long as a sprite pixel would fail it.
  - `test('the words reach the band\'s right edge')`: the first word line ends within 1 column of `columns`.
  - Delete the Clawd-only tests: eyes, looking up, reading or working, wastebasket filling, the throw stopping a chase, a reaction not cut short. Rewrite `"with the keeper's line in the sky Clawd looks round…"` so it keeps only its keeper assertions.
- [ ] **Step 2: Run the tests, expecting the new band tests to FAIL.**
- [ ] **Step 3: Remove Clawd from `drawFrame` and delete what nothing else uses.** That is `paintScene`, `paintClawd`, `paintHat`, `chaseAt`, `paintBasket`, `paintThrow`, `paintWork`, `reactionOverrides`, the sprite tables, and in `register.tsx` the reaction state that feeds only them. `tsc` with `noUnusedLocals` and grep finish the list.
- [ ] **Step 4: Change the command answers outside Ghostty's sky:**
  - `/solar catch`: `Solar: the keeper's catch shows in the sky in Ghostty.`
  - `/solar grill`: `Solar: the keeper's grill shows in the sky in Ghostty.`
  - Both still play in Ghostty as today.
  - `/solar storm` on: `Solar: a storm, to see the wind.`
  - Update the `/solar` help table in `README.md` to match.
- [ ] **Step 5: Rewrite the README.** The opening sentence and the "Claude's state" bullet describe the band as words above the prompt, and nothing in them describes Clawd in the band or the wastebasket. The keeper in Ghostty stays as written.
- [ ] **Step 6: Run the tests, `tsc` and parity.** All tests PASS, `tsc` is clean, and parity is 53/53 identical. The parity scenes draw the shader, not the band. If parity moves, stop and find out why.
- [ ] **Step 7: Commit.** Example subject: `The band above the prompt shows the words alone, without Clawd or the wastebasket, at 0.11.0`.

### Task 2: The tune keys for the band

**Files:**
- Modify: `hooks/tune.ts`, `hooks/tune.test.tsx`

**Interfaces:**
- Produces:
  - `TuneAction` gains `'close'`.
  - `onTuneKey(state, 'q', world)` returns `{ state, action: 'close' }` on every tab.
  - `onTuneKey(state, '1' … '5', world)` goes to dawn, day, dusk, night or text. The result is the same as cycling there with `tab`: a phase answers `'preview'`, and text answers `'none'`. A digit for the tab already shown answers `'none'`.
  - `export function tabOf(state: PaneState): Phase | typeof TAB_TEXT`.
  - `TUNE_WORDS.hint` is the one fixed line, built from Task 0's answers. Default: `click or ctrl+x tab · ↑↓ row · ←→ move · tab phase · ⏎ keep · q close · esc prompt`.
  - `TUNE_WORDS.closed` is `'Solar: tune closed.'`.

- [ ] **Step 1: Write the failing tests:**
  - In `tune.test.tsx`, extend `'keys move, clamp, reset, undo and keep'`:
    - `q` answers `close` from the day tab and from the text tab, with the state unchanged.
    - `'3'` from day answers `preview` with `phase: 'dusk'`.
    - `'5'` answers `none` with `isOnText: true`.
    - `'2'` on day answers `none`.
  - Add a case: `onPaneKey` on `q` posts `{ action: 'close' }` and carries the keeps already made.
  - Keep the meme test passing with the new hint.
- [ ] **Step 2: Run the tests, expecting the new assertions to FAIL.**
- [ ] **Step 3: Implement the digits and `q` in `onTuneKey`, before the `isOnText` branch.** Implement `tabOf`. Change `TUNE_WORDS.hint`. If Task 0 found Enter missing, `s` also answers `'keep'` in both `onTuneKey` and `onTextKey`.
- [ ] **Step 4: Run the tests and `tsc`; both PASS.**
- [ ] **Step 5: Commit.**

### Task 3: The band draws the tool

**Files:**
- Rename: `hooks/tune-pane.tsx` → `hooks/tune-band.tsx`. Its tab row stays in the module here; Task 5 moves it out.
- Modify: `hooks/register.tsx` (the `/solar tune` command, the `AbovePrompt` hook, the `ui.message` hook, `site` for `$.ui.blit`), `hooks/tune.ts` (`TUNE_PANE` goes and `TUNE_KEY = 'tune'` comes), `hooks/test-kit.tsx` (`TUNE_MOUNT` becomes the band: `component: 'AbovePrompt'`, `requestId: 'band'`, `maxRows: 20`, `bodyColumns: 156`; `paneWorld` stays for `/solar look`), `hooks/session.test.tsx`, `hooks/reload.test.tsx`

**Interfaces:**
- Consumes: Task 2's `onTuneKey` and `TUNE_WORDS`. Task 1's `drawFrame`.
- Produces:
  - `const isTuning = atom({ plugin: 'solar-clawd', key: 'isTuning' } as const, false)`, declared in `types/index.d.ts`.
  - `TOOL_ROWS = 8`.
  - `TOOL_COLUMNS`, the tool's width in cells. The builder measures it from the widest row.
  - `WEATHER_COLUMNS`, the weather's width in cells. The builder picks it, at least 26.
  - `TunePaneProps` is renamed `TuneBandProps` and gains `seq: number` (Task 5 uses it; keep it at 0 here).
  - `ui.message` is handled where `e.component === 'AbovePrompt' && e.element === TUNE_KEY`. The body is today's `TUNE_PANE` handler.
  - `site` gains the weather Raster's own columns, so the timer's `$.ui.blit` paints the right width while the tool is open.

- [ ] **Step 1: Write the failing tests in `session.test.tsx`.** Convert `'the pane previews as you move, keeps on enter and forgets on escape'` to the band, as `'the band tool previews as you move, keeps on enter and forgets on q'`:
  - `/solar tune` answers `{}` or the `notIncluded` text as today, and opens no pane (`panes.opened` empty).
  - `$.ui.mount(TUNE_MOUNT)` finds `' day '`, `'100 %'` and `TUNE_WORDS.hint` in `'tune'`.
  - It also finds the weather Raster by key `'sky'`, with `columns: WEATHER_COLUMNS` and `rows: ROWS`.
  - The moves, preview, renewal and keep assertions stay as they are.
  - `ui.key({ key: 'q' })` drops the preview and puts back the saved tune, as `closeTune` does today.
  - `read($, isTuning)` is false afterwards.
- [ ] **Step 2: Write the other failing tests:**
  - `'the band waits with the tool when the window is too low or narrow'`: `maxRows: 7`, or `bodyColumns: TOOL_COLUMNS - 1`, mounts a band with the `'sky'` Raster and no `'tune'` Client. The preview is still renewed after 20 s.
  - `'a question hides the tool and keeps it open'`: `hasSurvey: true` answers the engine's own band. `isTuning` stays true, and the preview is renewed.
  - `'with the sky hidden the band still draws the tool'`: `/solar` then `/solar tune` mounts the `'tune'` Client.
  - `'the band is three rows of words when the tool is closed'`: it mounts only the Raster, and `rows` is 3.
- [ ] **Step 3: Run the tests, expecting them to FAIL.**
- [ ] **Step 4: Implement the opening.** `/solar tune` with `isTuning` false:
  - sets `tuning.props` as today
  - starts `tuning.renew`
  - sets `isTuning` true
  - calls `$.ui.invalidate('ui.render')`
  - keeps the `notGhostty`, `notIncluded` and `hidden` answers.
- [ ] **Step 5: Implement the band hook:**
  - With `hasSurvey`, it answers `next(e)` as today.
  - With `isTuning` true, `tuning.props` set, `maxRows >= TOOL_ROWS` and `bodyColumns >= TOOL_COLUMNS`, it returns `<Box flexDirection="row"><Client key={TUNE_KEY} module="./tune-band.tsx" props={tuning.props} width={TOOL_COLUMNS} /><Raster key={KEY} … columns={weather} rows={ROWS} /></Box>`. Here `weather` is `Math.min(WEATHER_COLUMNS, bodyColumns - TOOL_COLUMNS)`. Leave the Raster out when that is under 26.
  - This holds even while `isHidden`.
  - Otherwise, the hook draws as today.
  - The band's background under the tool is the builder's call. The pane's `#10142a` is the default, as a `Box backgroundColor`.
- [ ] **Step 6: Move the `ui.message` handler** to the band's `Client`, and remove the `Pane` render hook.
- [ ] **Step 7: Run the tests, `tsc` and parity. All pass.**
- [ ] **Step 8: Commit.**

### Task 4: Closing: q, /solar tune and a reload

**Files:**
- Modify: `hooks/register.tsx`, `hooks/session.test.tsx`, `hooks/reload.test.tsx`

**Interfaces:**
- Produces: `async function closeTuning($: EngineInterface): Promise<void>` inside `register`. Its body is today's `ui.close` hook body for `TUNE_PANE`. It also sets `isTuning` false and invalidates the band. It is reached from:
  - a `ui.message` whose post has `action: 'close'`
  - `/solar tune` while `isTuning` is true, which answers `TUNE_WORDS.closed`
  - `session.start` when `read($, isTuning)` is true, which replaces the `$.ui.panes()` check at `register.tsx` ~1027 and keeps its `isPreviewing` and `isGapDrafted` setup.
- The `ui.close` hook for `TUNE_PANE` goes.

- [ ] **Step 1: Write the failing tests:**
  - `'/solar tune twice opens and closes the tool, dropping what was not kept'`: open, `left`, advance `PREVIEW_MS`, then `/solar tune` answers `TUNE_WORDS.closed`. `saved().preview` is null, `isTuning` is false, and the band mounts without `'tune'`.
  - In `reload.test.tsx`, convert `'a reload with the tune pane left open drops its preview at once, and its text and gap with it'`: seed `isTuning: true` in place of `panes.open.add(TUNE_PANE)`. The same assertions on the preview, the text and the gap hold, and `isTuning` is false after `session.start`.
  - Convert `'a session with the tune pane open leaves a preview, a text and a gap drafted, for a reload'` the same way. It mounts `TUNE_MOUNT` and tabs with `tab`.
  - Every other session test that used `closeTune($, panes)` now presses `q` or runs `/solar tune`. Delete the `closeTune` helper.
- [ ] **Step 2: Run the tests, expecting them to FAIL.**
- [ ] **Step 3: Implement `closeTuning` and its three callers. Remove the `ui.close` hook.**
- [ ] **Step 4: Run the tests and `tsc`; both PASS. Grep finds no `TUNE_PANE` and no `tune-pane`.**
- [ ] **Step 5: Commit.**

### Task 5: The tabs as hotkeys 1–5 (separable: drop this task if Vincent drops the shortcut)

**Files:**
- Modify: `hooks/tune-band.tsx` (drop its tab row; adopt `props.start` when `props.seq` changes), `hooks/register.tsx` (draw the tab row as Buttons above the Client; a press moves `tuning.latest` with `onTuneKey(latest, digit)`, bumps `tuning.props.seq`, previews as a post would, and invalidates), `hooks/session.test.tsx`

**Interfaces:**
- Consumes: Task 2's digit keys and `tabOf`, and Task 3's `TuneBandProps.seq`.
- The Client's local state is `PaneLocal & { seq: number }`. While `surface.state?.seq !== props.seq` it draws and keys from `props.start`. No `setState` in render.
- Posts carry the state on every tab change, so the hook module always knows the tab, including `'none'` moves to text. `TOOL_ROWS` stays 8, with the tab row counted.

- [ ] **Step 1: Write the failing tests:**
  - `'the digits 1 to 5 change the tab from the prompt while the tool is open'`: mount, `ui.press({ key: 'tab-dusk' })`, then `saved().preview.phase` is `'dusk'` after `PREVIEW_MS`, and `' dusk '` is the chosen tab.
  - With the tool closed, the band has no `tab-*` Buttons.
- [ ] **Step 2: Run the tests, expecting them to FAIL.**
- [ ] **Step 3: Implement.** The Button keys are `tab-dawn` … `tab-text`, with `hotkey` `'1'` … `'5'` and `plain`. The chosen tab is marked as today (pink background).
- [ ] **Step 4: Run the tests and `tsc`; both PASS.**
- [ ] **Step 5: Commit.**

### Task 6: Whole check and hand-over to Vincent

- [ ] **Step 1: Run the full tests, `tsc`, and `tools/preview/parity.sh check` against the baseline.** Paste the totals into the commit message. The test count is 264, minus the Clawd tests removed, plus the new ones.
- [ ] **Step 2: Merge `main` into the worktree branch.** Rerun the tests and `tsc` on the merged result.
- [ ] **Step 3: Rewrite `docs/superpowers/HANDOFF.md`** with the branch, the commit ids, and what Vincent should try live:
  - `/solar tune`, then click the tool and use the keys
  - `q`, and `/solar tune` twice
  - a narrow window
  - `/solar` while the tool is open
  - the band without Clawd, in Ghostty and, if he has it, iTerm2

  Commit it.
- [ ] **Step 4: Stop.** Merge to `main` only after Vincent has tried it live and said yes. Push only on his word, as `Fiddy134`.
