# The sky's own frame rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Built inline by one writer (Vincent's and Claude's decision: few files, one writer), then one fresh reviewer on the whole branch before merge. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The sky moves 24 times a second, ticked by the mod writing the tab's mark, in place of Ghostty's 120; two paces, `full` and `spar`, saved for every session; vsync off only after `/solar vsync off`, for every Ghostty window until `/solar vsync on`.

**Architecture:** A pure rules table (`hooks/pace.ts`) says, from the pace, whether ticks can run at all (macOS, Ghostty's version, the vsync line), the person's idleness, the app in front, the battery, the wait and the sky's liveliness, what Ghostty's animation is, whether the sky is the light one and whether it ticks. `writeGhosttySky` applies it as it applies `animationOf` today; a clock-driven chain of `$.clock.after` writes the tab's mark at 24 Hz while it says so. The mark goes to the tab's tty without a process per write.

**Tech Stack:** TypeScript hooks module for Claude Code (`claude plugin test .`, `claude-code/testing` mocks), Ghostty 1.3.1 config includes, zsh for the lab.

**Spec:** `docs/superpowers/specs/2026-10-27-himlens-takt-design.md` (Swedish). Measurements behind it: `docs/gpu-measurements.md`, "The sky at a frame rate of its own"; the work plan's cell "Labbcell före F6: himlens egen takt".

## Global Constraints

- 24 Hz, one constant (`PACE_HZ = 24`); no other rate.
- `full` stands still after 20 minutes without a key or the mouse (`FULL_STILL_MS = 20 * 60_000`) and is never the light sky; `spar` keeps today's rules (`AWAY_MS` 5 minutes, battery, `livelyAt`, `WAITING_SWEEP_MS`) at 24 Hz. `spar` is the default.
- `window-vsync = false` is written only by `/solar vsync off`, and stays in every Ghostty window, hidden sky or not, session or not, until `/solar vsync on`. It never goes into the person's own config, only into a file of the mod's.
- Under ticks the include's animation is always `false`; never `true` without vsync (Ghostty's 8 ms timer then runs free).
- Without ticks (Linux, a Ghostty version not known, or 1.3.x without the vsync line) everything is exactly as at `main` today: `animationOf`, the light sky on battery and away, no ticks.
- No process per tick. Ticks stop with the session, the hidden sky, and a sky not included.
- The shader does not change: `tools/preview/parity.sh check .preview/parity-takt` prints `identical` for every scene at the end.
- `claude plugin test .` (124 tests at the start) and `npx -y -p typescript@5.6.3 tsc -p . --noEmit` clean after every task; test output to a file.
- Work in `.worktrees/takt` on branch `takt` from `main` (`ln -s ../../../.claude-plugin/types .worktrees/takt/.claude-plugin/types`). Merge to `main` only after the merged result is tested in the worktree: the mirror copies `main` into the live sky.
- Never run `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`; no signals to Vincent's running Ghostty without asking. Measurements in Ghostty are Vincent's. Push only on Vincent's yes, as `Fiddy134`.
- One commit per task, subjects describing the world as it now is; comments in the project's plain prose; models: Opus 5.5 where anything says `fable`.

## Where the code stands (3cc6dc9), and the decisions that follow

1. **The mark costs a process per write today.** `markTab` (`hooks/ghostty.ts:100-103`) runs `sh -c 'tty=$(ps -o tty= -p $PPID …); printf … > /dev/$tty'` each time. The tty is found once instead (`ttyOf`, the same `ps` line, one `sh` at session start) and every mark, ticks included, is `$.fs.write('/dev/<tty>', sequence)`, if the lab (Task 0) finds the host writes a device that way at 24 Hz under 1 % of a core. If it does not, Task 0 says which writer replaces it and this decision is edited before Task 1.
   **Lab, 2026-10-28 (headless `claude -p` under `script`, Claude Code 2.1.312):** `$.fs.write` to `/dev/ttys001` works: 480 of 480 sequences arrived in 20 s, no rejection, lateness median 1.7 ms, p95 4 ms, max 15 ms. Claude Code's CPU over 20 s: no probe 0.68–0.71 s, the chain without writes 0.81–0.91 s, the chain with writes 1.00–1.09 s, so about 1.4 % of a core for the ticks, half of it the chain (`clock.now` + `clock.after`) and half the writes. A `$.clock.every(42)` writer drifts to 22.5 Hz (450 in 20 s) and saved nothing measurable. One `/bin/zsh` per session (`$.process.spawn`, `term.sh`'s loop, the mark read when its file changes) delivered 481 of 481, left Claude Code's CPU at its baseline and cost 0.18–0.20 s in its own process over about 19 s, about 1.0 % of a core. **Chosen: `$.fs.write` on the clock-driven chain**: a fraction of a percent more than the helper, no second process to start, stop and hand marks to, and all of it under the test kit's clock. Task 5 measures it live; above 1 % of a core there, the zsh helper replaces the chain behind the same `startTicks`.
2. **Ghostty's version comes from `TERM_PROGRAM_VERSION`** (`1.3.1` in Vincent's tabs), asked once with `$.env.get`, no process. `ghosttyKnowsReloadSignal` stays as it is for Linux.
3. **Ticks can run** (`canTick`) on macOS when the version is known and is either later than 1.3 (draws on change with vsync on, read in Ghostty's code, not tried) or 1.3.x with the vsync line present. Anything else: no ticks.
4. **The pace is a file** beside the runtime folder: `<…>/solar-clawd/sky.json` (`dirname` of `runtimeFolder`), `{"pace":"full"}` or `{"pace":"spar"}`; missing, unreadable or anything else is `spar`. Each Ghostty session reads it every `ACTIVITY_MS` (3 s) and updates the sky when it changed.
5. **The vsync line is a file of its own,** `runtime/vsync.ghostty`, holding `window-vsync = false\n` or nothing; its text is the saved choice (no second record). Its include, `config-file = ?<runtime>/vsync.ghostty`, goes into the config that holds the mod's include, on the line after it, added by `/solar vsync off` only and never removed (pointing at an empty file it says nothing). The emptying paths for the sky's include (`writeGhosttySky` hidden, `endGhosttySky`) never touch it, and `includeInGhostty` keeps it. On a Ghostty later than 1.3 the session empties it at start.
6. **No uninstall event exists** in the engine's types, so the line cannot leave with the mod by itself. README's uninstall note says: `/solar vsync on` first, or delete the `vsync.ghostty` include line. *(Deviation from the spec's "Avinstalleras modden ska raden bort med den"; Vincent to confirm.)*
7. **The rules are one pure function,** `skyRules` in `hooks/pace.ts`, beside an unchanged `animationOf`. `spar` ticks where today's animation would draw: `always` ticks, `true` ticks while Ghostty is in front (`isGhosttyInFront !== false`), `false` does not. `AWAY_MS` moves from `register.tsx` to `pace.ts`; `activity` keeps the raw `idleMs` beside `isAway`.
8. **Ticks repeat `ghostty.written.mark`,** what `writeGhosttySky` last wrote; a change of mark still goes through `writeGhosttySky` at once, as today.
9. **Timing against the clock:** the chain starts at `origin`, each tick schedules `$.clock.after` to `nextTickAt(now, origin, PACE_HZ)`, the first boundary of the 1000/24 ms grid after `now`; a late tick skips to the next boundary, never a burst. The chain runs only while `written.isTicking`; `writeGhosttySky` starts it when that turns true.
10. **The app in front** is asked each `ACTIVITY_MS` only while `canTick` and the pace is `spar` (today only for the white lighthouse).
11. **The pause during turns is not built** unless the live check (Task 5) shows broken text; the spec makes it the remedy, not the default (Claude Code's spinner alone would draw the sky at its own lower rate).
12. **Old tabs** (opened before the line came or went) get a measurement row in Task 5, no Ghostty-restart detection unless a row fails.

## Review Focus

- **The session ends, cleared or not:** after `session.end` (not `clear`/`resume`) no tick writes, and the tty's last write is `UNMARK_TAB`, even with a tick write in flight. Pinned in Task 4.
- **A late or sleeping clock** (the Mac wakes after an hour): one tick, then the grid; never a burst of the missed ones. Pinned in Task 2 (`nextTickAt`); Task 4's chain takes every delay from it.
- **The person's config:** `/solar vsync off` twice adds one include line; an unreadable config is never written; `/solar ghostty` and the start-time move keep the vsync include; without the mod's include it says to run `/solar ghostty` first. Pinned in Task 3.
- **Another session changes the pace** (or the vsync line): this one follows within seconds. Pinned in Task 4.
- **No ticks possible** (Linux, no `TERM_PROGRAM_VERSION`, 1.3.1 without the line): the include and the tty writes are exactly today's. Pinned in Task 4.

---

### Task 0: The lab: a tick without a process, and what it costs

**Files:**
- Create: `<scratchpad>/takt-probe/` (a plugin, not committed), `.preview/parity-takt/` (record, not committed)
- Modify: this plan, decision 1, with the result

- [ ] **Step 1:** Make the worktree (`git worktree add .worktrees/takt -b takt main`, the types link), run the tests and `tsc` there (124, clean), and `tools/preview/parity.sh record .preview/parity-takt`.
- [ ] **Step 2:** Write a probe plugin shaped like this repo (`.claude-plugin/plugin.json` named `takt-probe`, `hooks/hooks.json` → `./probe.ts`). On `session.start` it finds its tty once (`sh -c 'ps -o tty= -p $PPID'`), then for 20 s writes `\x1b]4;16;rgb:00/00/01\x1b\\` with `$.fs.write('/dev/<tty>', …)` on the chain of decision 9 (`$.clock.now`, `$.clock.after`), logging each write's lateness and any rejection to a file in the scratchpad at the end. A second build of it with `PROBE_HZ=0` does everything but write.
- [ ] **Step 3:** Run each under a pty: `script -q <typescript> claude --plugin-dir <probe> -p 'Run sleep 25 with Bash, then say done.' --allowedTools Bash`, sampling `ps -o %cpu=,time= -p <claude pid>` each second. If the session cannot start a nested `claude`, Vincent runs the two commands from a terminal.
  Expected for (1): 480 ± 2 sequences in the typescript (`grep -o $'\e]4;16;' | wc -l`), no rejection, median lateness under 10 ms, CPU time at 24 Hz minus at 0 Hz under 0.2 s over the 20 s (1 % of a core).
- [ ] **Step 4:** Only if Step 3 fails: the same probe with writer (2), one `/bin/zsh` per session through `$.process.spawn` running `term.sh`'s tick loop (`zsh/zselect`, `EPOCHREALTIME`) against the tty, its mark read from a file only when `zstat` says it changed, killed by leaving the spawn's loop. Same measurements.
- [ ] **Step 5:** Write the outcome (numbers, writer chosen) into decision 1 and commit: "The lab finds how the mod writes its tab 24 times a second, and what it costs".

### Task 1: The tab's tty, found once; every mark written without a process

**Files:**
- Modify: `hooks/ghostty.ts` (`markTab`, `Ghostty`, `endGhosttySky`), `hooks/register.tsx` (session start), `hooks/test-kit.tsx` (`ghosttyWorld`), `hooks/session.test.tsx` (the mark helpers at `:251-260`, `:799`)

**Interfaces:**
- Produces: `ttyOf($: EngineInterface): Promise<string | null>` (`/dev/ttys004`, null when `ps` says nothing or `?`); `Ghostty.tty: string | null`; `markTab($, ghostty: Ghostty, sequence: string): Promise<void>` (writes nothing when `tty` is null; never throws). `ghosttyWorld` answers `sh` with `ttys004\n` and exports `TTY = '/dev/ttys004'`.

- [ ] **Step 1:** Change the two mark helpers in `session.test.tsx` to read `world.files.get(TTY)?.text`, and add `test('the tab is found once, and its marks are written to it without a process each')`: start a Ghostty session, play `/solar catch` and `/solar grill`, advance 70 s; expect `runs.filter(argv => argv[0] === 'sh').length` to be `1`, the tty's text to contain `]4;16;rgb:`, and after `session.end` the tty's text to be `UNMARK_TAB`.
- [ ] **Step 2:** Run `claude plugin test . > .preview/test.txt`; expected: the new test and the mark tests fail.
- [ ] **Step 3:** Implement `ttyOf` and the new `markTab` in `hooks/ghostty.ts`; `register.tsx` sets `tty` at session start, only in Ghostty.
- [ ] **Step 4:** Tests and `tsc`: all pass (125).
- [ ] **Step 5:** Commit: "A session finds its tab once and marks it without starting a process".

### Task 2: The rules: when the sky ticks, how Ghostty animates it, and when it is light

**Files:**
- Create: `hooks/pace.ts`
- Modify: `hooks/register.tsx` (`AWAY_MS` imported from `pace.ts`), `hooks/sky.test.tsx`

**Interfaces:**
- Consumes: `animationOf`, `Waiting`, `WAITING_SWEEP_MS` from `hooks/waiting.ts`.
- Produces, from `hooks/pace.ts`: `PACE_HZ = 24`; `AWAY_MS = 5 * 60_000`; `FULL_STILL_MS = 20 * 60_000`; `type Pace = 'full' | 'spar'`; `asPace(text: string): Pace`; `versionOf(text: string | undefined): [number, number] | null` (`'1.3.1'` → `[1, 3]`, `'1.4.0-dev+abc'` → `[1, 4]`); `needsVsyncLine(version: [number, number]): boolean` (1.3.x and earlier); `canTick(o: { isLinux: boolean; version: [number, number] | null; isVsyncOff: boolean }): boolean`; `skyRules(o: { pace: Pace; canTick: boolean; waiting: Waiting | null; now: number; idleMs: number | null; isOnBattery: boolean; isLively: boolean; isGhosttyInFront: boolean | null }): { animation: 'true' | 'false' | 'always'; isLight: boolean; isTicking: boolean }`; `nextTickAt(now: number, origin: number, hz: number): number`.

- [ ] **Step 1:** In `sky.test.tsx`, `test('without ticks the rules are today\'s, to the letter')`: for every combination of waiting (none, fresh, past the sweep), idle (1 s, 6 min), battery, lively and front, `skyRules({ pace, canTick: false, … })` equals `{ animation: animationOf(…), isLight: isOnBattery || isAway, isTicking: false }` for both paces.
- [ ] **Step 2:** `test('full ticks in front and behind, on battery, until twenty minutes away, and is never light')`: `canTick: true, pace: 'full'`: `isGhosttyInFront: false, isOnBattery: true, isLively: false, idleMs: 19 * 60_000` → `{ animation: 'false', isLight: false, isTicking: true }`; `idleMs: 20 * 60_000` → `isTicking: false`; `idleMs: null` → `isTicking: true`.
- [ ] **Step 3:** `test('spar ticks where today\'s sky would move, and only in front unless the lighthouse sweeps')`: `canTick: true, pace: 'spar'`, animation always `'false'`; `isTicking` is true for (front, lively, mains, here) and for (behind, fresh `asking` wait, here); false behind without a wait, on battery without a wait, not lively, away 5 min, and for a wait past `WAITING_SWEEP_MS`; `isGhosttyInFront: null` counts as front; `isLight` is `isOnBattery || isAway`.
- [ ] **Step 4:** `test('ticks need macOS, a known Ghostty, and on 1.3 the vsync line')`: `canTick` false on Linux, with version null, and for `[1, 3]` without the line; true for `[1, 3]` with it and `[1, 4]` without; `versionOf(undefined)`, `versionOf('')`, `versionOf('tip')` are null; `asPace('{"pace":"full"}')` is `'full'`, `asPace('')`, `asPace('{"pace":"fast"}')`, `asPace('{')` are `'spar'`.
- [ ] **Step 5:** `test('a late tick goes to the next frame of the grid, never back for the ones it missed')`: with `origin = 1000`, `nextTickAt(1000, 1000, 24)` is `1000 + 1000 / 24`; `nextTickAt(1000 + 3600_000 + 5, 1000, 24)` is the first grid point after it and less than `5 + 1000 / 24` ms later.
- [ ] **Step 6:** Run the tests; expected: these five fail (no `pace.ts`).
- [ ] **Step 7:** Implement `hooks/pace.ts` (comments in the file's own voice: what each pace does, why `false` under ticks); `register.tsx` imports `AWAY_MS`.
- [ ] **Step 8:** Tests and `tsc`: all pass (130).
- [ ] **Step 9:** Commit: "The sky's rules in one table: full and spar at 24 a second, and today's when it cannot tick".

### Task 3: The pace and the vsync line, chosen with `/solar`

**Files:**
- Modify: `hooks/ghostty.ts` (`Ghostty.settings`, `Ghostty.vsync`, `includeVsync`, `setVsync`), `hooks/tidy.ts` (`vsync\.ghostty` among the temp names), `hooks/register.tsx` (command words, help, `argumentHint`, start-time emptying on a later Ghostty), `hooks/test-kit.tsx` (`ghosttyWorld` env as a mutable `env` map), `hooks/session.test.tsx`, `hooks/sky.test.tsx` (tidy)

**Interfaces:**
- Consumes: `asPace`, `versionOf`, `needsVsyncLine`, `Pace` (Task 2).
- Produces: `Ghostty.settings` (`…/solar-clawd/sky.json`), `Ghostty.vsync` (`…/runtime/vsync.ghostty`), `Ghostty.version: [number, number] | null`; `VSYNC_OFF_LINE = 'window-vsync = false\n'`; `includeVsync($, ghostty): Promise<'added' | 'there' | 'unreadable' | 'no-include'>`; `setVsync($, ghostty, isOff: boolean): Promise<void>` (writes the file whole, reloads); `readPace($, ghostty): Promise<Pace>`; `isVsyncOff($, ghostty): Promise<boolean>`.

The answers, exact (`NEEDS_VSYNC` follows `full`'s or `spar`'s text whenever the version is 1.3.x and the line is missing; that is the first time and every time after, until it is there):

```ts
const FULL = 'Solar: full. The sky moves 24 times a second whenever it shows, in front or behind, on battery too, and stands still after 20 minutes without you.'
const SPAR = 'Solar: spar. The sky moves 24 times a second while Ghostty is in front and something in it moves, and stands still on battery, behind other apps and after 5 minutes without you; the lighthouse still sweeps behind them.'
const NEEDS_VSYNC = ' On Ghostty 1.3 that takes vsync off: /solar vsync off turns it off in every Ghostty window, with Claude or without, until /solar vsync on. Ghostty warns that drawing out of sync can cause a kernel panic on macOS 14.4 and later. Until then the sky runs as it did.'
const VSYNC_OFF = 'Solar: vsync is off in every Ghostty window, with Claude or without, until /solar vsync on. New tabs and windows draw the sky 24 times a second (⌘T opens one); tabs already open draw as before until they close, so restart Ghostty to have it everywhere. Ghostty warns that drawing out of sync can cause a kernel panic on macOS 14.4 and later.'
const VSYNC_ON = 'Solar: vsync is on again for new Ghostty tabs and windows; tabs already open keep it off until they close.'
const VSYNC_NOT_NEEDED = 'Solar: this Ghostty draws the sky 24 times a second with vsync on; there is nothing to turn off.'
const NOT_ON_LINUX = 'Solar: on Linux the sky keeps its pace as it is, for now.'
const INCLUDE_FIRST = 'Solar: run /solar ghostty first; the sky is not in Ghostty\'s config yet.'
```

Outside Ghostty every new word answers today's `'Solar: this session is not running in Ghostty.'`; an unreadable config answers today's `could not read Ghostty's config` text. The help line gains `/solar full, /solar spar, /solar vsync off|on`, the hint `full | spar | vsync off|on`.

- [ ] **Step 1:** `test('/solar full and spar are saved for every session, and on Ghostty 1.3 say what 24 a second takes')`: with `TERM_PROGRAM_VERSION=1.3.1`, `/solar full` answers `FULL + NEEDS_VSYNC` and writes `{"pace":"full"}` to `/Users/test/Library/Application Support/solar-clawd/sky.json`; after `/solar vsync off`, `/solar spar` answers `SPAR` alone.
- [ ] **Step 2:** `test('/solar vsync off writes the line in a file of its own, included once, and /solar vsync on empties it')`: `/solar ghostty`, then `/solar vsync off` twice: the config has `config-file = ?/Users/test/Library/Application Support/solar-clawd/runtime/vsync.ghostty` exactly once, on the line after the mod's include; the file is `window-vsync = false\n`; reloads went up; answer `VSYNC_OFF`. `/solar vsync on`: the file is `''`, the include line stays, answer `VSYNC_ON`.
- [ ] **Step 3:** `test('the vsync line outlives the hidden sky, the last session, and /solar ghostty')`: after `/solar vsync off`, `/solar` (hide), `session.end`, and a new session's `/solar ghostty` and start-time move, the file still reads `window-vsync = false\n` and the config holds the vsync include once.
- [ ] **Step 4:** `test('/solar vsync off never writes a config it cannot read, nor one without the sky')`: unreadable config → today's text, config and file unwritten; config without the mod's include → `INCLUDE_FIRST`, nothing written.
- [ ] **Step 5:** `test('a Ghostty later than 1.3 needs no vsync line: the session takes it away, and the words say so')`: `TERM_PROGRAM_VERSION=1.4.0`, the file holding the line at start → `''` and a reload; `/solar vsync off` → `VSYNC_NOT_NEEDED`, nothing written. On Linux, `/solar full` → `NOT_ON_LINUX`, nothing written.
- [ ] **Step 6:** In `sky.test.tsx`'s tidy test, a stale `vsync.ghostty.tmp-other` is taken and `vsync.ghostty` itself never is.
- [ ] **Step 7:** Run the tests; expected: the six fail.
- [ ] **Step 8:** Implement in `ghostty.ts`, `tidy.ts`, `register.tsx`.
- [ ] **Step 9:** Tests and `tsc`: all pass (135).
- [ ] **Step 10:** Commit: "/solar full and spar choose the sky's pace for every session, and /solar vsync off and on the line Ghostty 1.3 needs for it".

### Task 4: The ticks

**Files:**
- Modify: `hooks/ghostty.ts` (`SkyState`, `Ghostty.written`, `writeGhosttySky`, `startTicks`, `endGhosttySky`), `hooks/register.tsx` (`activity.idleMs`, the activity loop, `skyState`), `hooks/session.test.tsx`

**Interfaces:**
- Consumes: `skyRules`, `canTick`, `nextTickAt`, `PACE_HZ` (Task 2); `readPace`, `isVsyncOff`, `Ghostty.version` (Task 3); `markTab`, `Ghostty.tty` (Task 1).
- Produces: `SkyState` = `{ idleMs: number | null; isOnBattery: boolean; isGhosttyInFront: boolean | null; pace: Pace; waiting; catchAt; livelyAt }`; `Ghostty.written.isTicking: boolean`, `Ghostty.ticks: { origin: number; isRunning: boolean; writing: Promise<void> | null }`; `startTicks($, ghostty): void`.

`writeGhosttySky` computes `canTick` (with `isVsyncOff` read from the file each run) and `skyRules`, writes `custom-shader-animation = ${rules.animation}`, passes `isLight: rules.isLight`, and sets `written.isTicking = isWanted && ghostty.isIncluded && rules.isTicking`, calling `startTicks` when it turns true. The chain writes `written.mark` while `isTicking && !isEnded`; `endGhosttySky` sets `isEnded`, awaits `ticks.writing`, then unmarks. The activity loop keeps `activity.idleMs`, re-reads the pace, asks `isGhosttyInFront` when decision 10 says so, and updates the sky when the pace, the front app or the ticking idleness thresholds changed.

- [ ] **Step 1:** `test('full with the vsync line ticks the mark 24 times a second, as the animation false')`: 1.3.1, the vsync file holding the line, `sky.json` full, Ghostty behind, on battery: after start, writes to `TTY` over `clock.advance(10_000)` number 240 ± 1, the include says `custom-shader-animation = false`, the shader is not the light one; idle at 20 minutes → no writes over the next 10 s, back at 1 s → writes again within `ACTIVITY_MS` + one frame.
- [ ] **Step 2:** `test('spar ticks only in front while something moves, and the sweep behind')`: spar, lively (`/solar event dolphin`): Safari in front → at most one write (the heartbeat's mark) in 10 s; Ghostty in front → 240 ± 1; a question asked with Safari in front → ticks until `WAITING_SWEEP_MS`, then none.
- [ ] **Step 3:** `test('no ticks where they cannot run: everything as before')`: (a) no `TERM_PROGRAM_VERSION`, (b) 1.3.1 without the line, (c) Linux 1.3.1 with `sky.json` full and a vsync file: the include and the tty's writes over 70 s are the same as at `main` (animation `true` for a lively sky in front, the light sky on battery) and no write comes between heartbeats.
- [ ] **Step 4:** `test('another session changes the pace: this one follows within seconds')`: ticking in full with Ghostty behind; write `{"pace":"spar"}` to `sky.json` behind the session; within `ACTIVITY_MS` + one frame the writes stop. Empty the vsync file behind it: within `SKY_MS` the include says `true` again and no ticks run.
- [ ] **Step 5:** `test('hidden, or ended, the sky ticks no more, and the last word to the tab is its unmarking')`: ticking; `/solar` → no tty writes over 5 s and the vsync file unchanged; `/solar` again → ticks resume; `session.end` with reason `exit` mid-chain → the tty's last write is `UNMARK_TAB` and none follows over 5 s; with reason `clear`, ticks go on.
- [ ] **Step 6:** Run the tests; expected: the five fail.
- [ ] **Step 7:** Implement in `ghostty.ts` and `register.tsx`; the chain computes each delay with `nextTickAt` only (the mock clock cannot hold a timer back, so Task 2's test is what pins a late tick).
- [ ] **Step 8:** Tests, `tsc`, and `tools/preview/parity.sh check .preview/parity-takt`: all pass (140), every scene `identical`.
- [ ] **Step 9:** Commit: "The sky ticks 24 times a second where its pace says, and stops with the session".

### Task 5: README, review, merge, and the sky seen and measured

**Files:**
- Modify: `README.md` ("What it costs", the commands, uninstall), `.claude-plugin/plugin.json` (0.8.0), `docs/gpu-measurements.md` (the live rows), this plan (outcomes)

- [ ] **Step 1:** README: in "What it costs", the 24 Hz rows from `docs/gpu-measurements.md` (day 5.9 W → 1.26 W focused, −79 %; lit night −83 %; floor −59 %), what `full` and `spar` cost and do, Ghostty's warning quoted, the vsync line's reach (every Ghostty window until `/solar vsync on`), and decision 6's uninstall step; the commands list gains `full`, `spar`, `vsync off|on`. Version 0.8.0. Commit: "Version 0.8.0: the sky at 24 a second, full or spar, and vsync off only on the person's word".
- [ ] **Step 2:** A fresh reviewer (Opus 5.5) on `main..takt` with the spec and this plan; findings fixed or answered on the branch, each with its test.
- [ ] **Step 3:** Merge `main` into `takt` if `main` moved; tests, `tsc`, parity in the worktree; then merge `takt` into `main`. No push.
- [ ] **Step 4 (Vincent, mirror armed, nothing heavy running):** in a session on 0.8.0 (check `~/solar-clawd-live/.claude-plugin/plugin.json`): `/solar full`, `/solar vsync off`, ⌘T, Claude in the new tab. `tools/measure/gpu.sh live`: focused by day near 1.3 W; Claude Code's CPU (`ps -o %cpu= -p <pid>` over a minute) with ticks against `/solar spar` with Ghostty behind: under 1 % of a core more.
- [ ] **Step 5 (Vincent):** a session where Claude writes a lot (a long answer, many tool calls, a long diff) with ticks running: no broken text. If any shows: on a branch, ticks pause from `turn.start` to `turn.complete` of the main conversation (`e.agentId === undefined`), with a test that no tty write comes between them, and the check is run again.
- [ ] **Step 6 (Vincent, the old tabs of the spec's "Mina beslut"):** a tab opened before `/solar vsync off`, under `false` and ticks: focused, unfocused, during the lighthouse's sweep: it neither freezes nor stutters. A tab opened while vsync was off, after `/solar vsync on`, under `true`: frames per second with the probe shader (`gpu.sh`), bounded near 120. A row that fails is brought to Vincent before anything is built for it.
- [ ] **Step 7:** The live rows into `docs/gpu-measurements.md`, the outcomes into this plan; commit. Push on Vincent's yes, as `Fiddy134`.

**Outcome on Ghostty 1.4.0 (2026-10-28, Vincent's eye):** with 0.8.0 loaded from the mirror, `/solar full` answered without a word about vsync and wrote no vsync file, the include held `custom-shader-animation = false`, and with Ghostty behind and the tab showing the sky moved smoothly. So on 1.4 each OSC 4 write draws a frame even when it sets colour 16 to the value it already has, and the ticks need no alternating marks. Steps 4 and 6 on 1.4 (old tabs, ⌘Q, the GPU rows, Claude Code's CPU) follow.

**Claude Code's CPU on 1.4.0, live (2026-10-28 14:49–14:51, Vincent, `top -pid 799 -l 7 -s 10` from Terminal.app, Ghostty behind, Claude idle at the prompt):** ticking in `full`, the six samples after the first 14.5, 14.0, 14.2, 15.1, 18.0, 15.1 % (mean 15.2); the sky hidden with `/solar`, 4.9, 3.8, 6.2, 3.7, 4.4, 5.0 % (mean 4.7). The ticks cost about 10 % of a core, against the lab's 1.4 % in a headless `claude -p` and Step 4's bar of 1 %. Fails the bar; next an outside writer at the same rate, with the sky hidden, to tell the chain's own cost from what the writes set off in Claude Code.

**The outside writer (14:54–14:55):** the sky hidden, a `zsh` loop in Terminal.app writing `ESC]4;16;rgb:00/00/01` to `/dev/ttys000` about 25 times a second (`zselect -t 4`), the same `top`: 5.7, 5.8, 5.6, 6.1, 6.1, 5.6 % (mean 5.8). What the writes set off in Claude Code is about 1 % of a core; the remaining ~9 % is the chain itself (`$.fs.write` and `$.clock.after` 24 times a second) inside the interactive Claude Code. So, as Step 4 says, the zsh helper (`$.process.spawn`, one per session, the mark read when its file changes) replaces the chain behind the same `startTicks`.

**The display:** the MacBook Pro had its built-in display alone through the trials above, as the protocol has it; Vincent drove it from his Mac mini with Universal Control ("link keyboard and mouse"), which shares the keyboard and pointer and no display.
