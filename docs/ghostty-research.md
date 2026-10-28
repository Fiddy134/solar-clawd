# What Ghostty offers the sky (research, 2026-10-27)

Four read-only sweeps on 2026-10-27: the whole config reference, the features
pages and the whole VT reference on ghostty.org/docs, Ghostty's GitHub (code at
tag v1.3.1 and at main `a7325808`, releases, issues, discussions), and r/Ghostty
with the repos linked from it. The installed Ghostty is 1.3.1; no release after
it exists yet, only nightly (`tip`). Labels: [docs] ghostty.org, [code] the
Ghostty source, [community] Reddit posts and third-party repos (not
authoritative), [design]/[hypotes] ours.

## What changes something we already decided

- **The vsync report is moot; it was not sent and should not be.** [code] In
  1.3.1 focus starts the display link whatever the config says
  (`src/renderer/generic.zig#L1037-L1047`), and `hasAnimations()` is just
  `has_custom_shaders` (#L1013-L1015), so a focused surface redraws every vsync
  even with `false`; `false` only stops the 8 ms timer (`Thread.zig#L295-L316`).
  That explains every row of the F2 table. Main has fixed it (PRs
  [#13943](https://github.com/ghostty-org/ghostty/pull/13943),
  [#14035](https://github.com/ghostty-org/ghostty/pull/14035), issue
  [#14033](https://github.com/ghostty-org/ghostty/issues/14033), discussion
  [#14030](https://github.com/ghostty-org/ghostty/discussions/14030)): `false`
  draws only when something is pending, the display link stops when idle, a
  hidden surface stops animating and frees its GPU memory. So on 1.3.1 only
  unfocusing saves power; on the next release `false` and hidden tabs become
  nearly free. [hypotes] On tip each OSC 4 write may draw exactly one frame,
  which would let the mod set a slow frame rate itself by writing the mark.
- **The tab mark can be wiped.** [code] From the next release `reset`/RIS
  resets the whole palette (PR
  [#14480](https://github.com/ghostty-org/ghostty/pull/14480)); [community]
  ghostty-ai-themes resets with a bare `OSC 104`, which clears all 256 entries.
  Already handled: `refreshGhostty` writes the mark again every minute
  (`HEARTBEAT_MS`).
- **`iDate` and `iMouse` are never filled** [code] (`generic.zig#L791-L797`:
  "not currently updated"; `iFrameRate` is always 60). The sky never reads them
  (pinned by a test in `hooks/sky.test.tsx`).

## Ranked by value to us

1. **Uniforms we do not use yet** [code]
   (`src/renderer/shaders/shadertoy_prefix.glsl#L3-L31`, same in 1.3.1):
   `iFocus`, `iTimeFocus`, `iForegroundColor`, `iCursorColor`,
   `iPreviousCursor*`, `iCursorVisible`, `iCurrentCursorStyle`, `iTimeDelta`,
   `iSelection*` (swapped in 1.3.1, fixed only on main, PR #14460).
   [design] `iFocus == 0` lets the sky skip its heavy stages unfocused under
   `always` (the "full sky" setting in the work plan, F4 post 8); `iTimeFocus`
   gives a fade-in when a tab regains focus; `iForegroundColor` tells text
   pixels from the rest better than "anything not the background", for the rim.
2. **A wider per-tab channel** [docs] `iPalette[256]` reaches the shader, and
   one OSC 4 can carry several `n;c` pairs ([OSC 4](https://ghostty.org/docs/vt/osc/4)).
   [design] Colours 16–19 in one write give 12 bytes a tab, reset with
   `OSC 104;16;17;18;19`. The cursor colour (OSC 12, `iCursorColor`, and
   `iPreviousCursorColor` with `iTimeCursorChange` for a smooth change) is a
   second channel; [community] ghostty-blackhole
   ([repo](https://github.com/s0xDk/ghostty-blackhole)) carries Claude Code's
   context in it with a 16-bit signature. [design] A checksum in our mark would
   keep a theme that sets colour 16 from faking a state; today the only guard is
   blue exactly 1/255 and red, green in range.
3. **A still sky as a background image when nothing moves** [docs]
   `background-image` (1.2.0, PNG/JPEG, per terminal in VRAM).
   [hypotes] On 1.3.1, where `false` saves nothing focused, writing a rendered
   PNG of the current sky and an empty `custom-shader` into the include when
   the sky is still could take the idle cost to near zero. Untested: whether
   reload swaps the image, and whether text over it reads as well.
4. **Installation, as iglass does it** [community]
   ([repo](https://github.com/vukkt/iglass)): one marked line
   `config-file = ?"…"` appended to the user's config, a byte-exact backup for
   uninstall, support detected by `ghostty +validate-config` in a temporary HOME
   instead of version guessing. [docs] The config file is `config.ghostty`
   (`config` before 1.2.3) under XDG or Application Support; the site and the
   1.3.1 man page disagree on their load order. AppleScript (a preview in 1.3,
   breaking changes promised for 1.4) asks for Automation permission (TCC) the
   first time. For F6.
5. **Themes as Ghostty themes** [docs] `theme = light:X,dark:Y` follows the
   system appearance without a reload, and a theme file may set any key,
   `custom-shader` included ([theme](https://ghostty.org/docs/features/theme)).
   [design] For F7/F8: a sky theme could ship as a standard theme file plus its
   sky parameters, which galleries like ghostty.style and paletty.dev can show;
   iglass's contrast report (worst-case backgrounds, OKLCH lightness nudged to
   WCAG targets) is a ready test for our two themes against the brightest and
   darkest sky.
6. **"Claude is waiting" outside the shader** [docs]: a native progress bar
   ([OSC 9;4](https://ghostty.org/docs/vt/osc/conemu), indeterminate while
   working, paused while waiting, reset after ~15 s without a keep-alive),
   `bell-features = border`/`attention` (a border round the tab, the Dock icon
   bouncing), OSC 9 notifications (Claude Code may send its own). None costs the
   GPU.
7. **Several shaders chain** [docs] (`custom-shader` repeated). [design] The
   installer must keep a user's cursor shaders and decide our place: a cursor
   shader before ours changes the pixels our text key sees. There is no
   per-surface shader, and a PR for one was closed
   ([#14127](https://github.com/ghostty-org/ghostty/pull/14127)); the palette
   stays the only per-tab channel, as maintainers also say
   ([#9104](https://github.com/ghostty-org/ghostty/discussions/9104)).
8. **Glass** [docs] `background-blur = macos-glass-regular | macos-glass-clear`
   with `background-opacity` (macOS 26+, 1.3.0); opacity needs a full restart
   on macOS, so policy cannot switch it. Unknown whether a custom shader's
   output blends with it at all.
9. **Smaller**: `alpha-blending` set explicitly so the shader's colours match
   `window-colorspace` and the preview; `unfocused-split-opacity` dims splits
   over the sky; [community] `macos-titlebar-style = tabs` draws wrong on
   macOS 27; a Tahoe-wide Ghostty power issue means power must be read against
   a no-shader baseline on the same OS, as F2 did.

## Not verified

- On tip: `false` idle at ~0 fps focused, and one frame per OSC 4 write (the
  F2 `iFrame` probe on a nightly from ghostty.org/docs/install/pre).
- Colours 17–19 and the cursor colour reaching only their own tab's shader
  (a probe shader drawing `iPalette[17]` / `iCursorColor`), and whether Claude
  Code's TUI resets the cursor colour.
- `background-image` swapped by `reload_config`, and combined with or instead of
  a custom shader; whether a custom shader blends with `macos-glass-*`.
- That a reload reaches every open tab's shader (an old community claim says
  only new surfaces; our policy depends on it).
- The config load order on macOS (`ghostty +show-config` with the same key set
  differently in both places).
- Comments on the iglass thread (Reddit rate-limited every fetch).

## Second pass (GitHub, same day)

Two code findings first:

- **SIGUSR2 reloads Ghostty on macOS too**, not only on Linux. [code]
  `macos/Sources/App/macOS/AppDelegate.swift` at v1.3.1, `setupSignals()`:
  `DispatchSource.makeSignalSource(signal: SIGUSR2…)` → `reloadConfig()`
  (checked by hand 2026-10-27). The mod uses AppleScript `reload_config` on the
  Mac, which needs Automation permission and a front window. [hypotes] A
  signal needs neither. `pgrep -x ghostty` finds nothing on this Mac (the
  process is `/Applications/Ghostty.app/Contents/MacOS/ghostty`); match the
  basename from `ps -axo pid=,comm=`. Untested here: no signal was sent.
- **A reload re-reads a shader at the same path, by accident.** [code]
  `changeConfig` rebuilds shaders only when `custom_shaders.equal()` says the
  list changed; `Path.equal` compares slices by address and each reload clones
  them, so it always reports a change (the same for `background-image`). That
  is why rewriting our one shader path works. If Ghostty ever compares the
  strings, open tabs stop picking up a new shader; two projects below name
  their files by content hash for that reason.

New projects worth borrowing from (all MIT unless said; few stars, so little
tested by others):

1. [r3dg0d/ghostfx](https://github.com/r3dg0d/ghostfx): 253 background
   shaders on a shared core: a text mask against `iBackgroundColor`, a 4-tap
   halo behind glyphs, a soft brightness cap that turns into a floor on light
   themes, quality levels as `#define`s, `mod(iTime, 7200)` for float
   precision; a CLI with a marked block, atomic write, backup and rollback, and
   `--chain`/`--replace` for users who already have shaders. [design] The halo
   and cap against our rim; the installer for F6.
2. [an0sunshy/ghostty-shaders](https://github.com/an0sunshy/ghostty-shaders):
   a live-weather sky with the real moon phase; CI fails a scene over 5 % of
   the frame budget at 3456×2234/120 Hz; after a reload it reads `log show`
   for `spirv error` and restores the previous include. [design] A cost gate
   for our tests, and a compile check with revert for the mod.
3. [vinzw/ghostty-term-tag](https://github.com/vinzw/ghostty-term-tag): per-tab
   labels in palette colours 16–23 (24 bytes, a length byte), 5×7 glyphs packed
   in a `uvec2`. Confirms the wider tab mark in F5.
4. [3-rt/ghostty-landscapes](https://github.com/3-rt/ghostty-landscapes): the
   still scene as `background-image`, the shader drawing only what moves,
   content-hashed file names, an offscreen Metal check (glslang → SPIR-V →
   spirv-cross). Our still-sky lab cell, working.
5. [pglockner/ghostty-bg](https://github.com/pglockner/ghostty-bg): keeps text
   readable by writing stronger dim palette colours into the include when the
   background washes them out, and raising `faint-opacity`.
6. [evanspn/shader-lab](https://github.com/evanspn/shader-lab): headless
   checks that text pixels change by at most ε and text edge energy stays
   ≥ 0.85, deterministic animation, ms a frame against a budget. [design] The
   text metric for `hooks/sky.test.tsx`.
7. [ashuttl/linecast](https://github.com/ashuttl/linecast) (646★): an
   almanac; a METAR from an airport within 25 km replaces modelled weather;
   MeteoAlarm warnings cover Sweden. [design] Observed cloud and storm warnings.
8. [cstelmach/terminal-agent-visual-signals](https://github.com/cstelmach/terminal-agent-visual-signals):
   a Claude Code plugin with states for compacting, subagent, tool error and a
   fading idle. [design] Moods for the keeper.
9. Smaller: rashedInt32/eddy (tints glyph fringes within 10/255 of the
   background so no halo shows); evanspn/ghostty-profiles (`off` empties the
   include but keeps the `config-file = ?…` line); nerrad/ghostty-tab-colors
   (no licence: ideas only; OSC 21 as another way to write the palette).

Rejected: no licence (hackrdotsh/ghostty-shaders, lexrus and others), GPL or
NC/SA, overwriting the user's config, `background-opacity = 0` (a restart on
macOS). Unsettled: which way `fragCoord.y` runs on Metal (projects disagree; the
mod already has `Y_UP` and probed it on 2026-10-25).

## Ghostty 1.4.0 (released 2026-10-27, read 2026-10-28)

One pass over the whole of the 1.4.0 release notes
([page](https://ghostty.org/docs/install/release-notes/1-4-0),
[source](https://github.com/ghostty-org/website/blob/main/docs/install/release-notes/1-4-0.mdx)),
set against the mod. Seven months, 2,889 commits. Labels as above; [notes] is
the release notes.

### What it does to what we built

- **The pace now rests on a release, not on main.** [notes] "The display link
  now pauses when there is nothing to draw, and unfocused terminals that are
  animating draw at most once per display refresh instead of once per write"
  (GH-14035, GH-14068), the PRs the first section read in the code. So
  `needsVsyncLine` is right to leave 1.4 alone. Still [hypotes], and the first
  thing Vincent's trial must answer: that **each OSC 4 write draws one frame**
  even when it sets colour 16 to the value it already has, as every tick does.
  If 1.4 skips a write that changes nothing, the sky stands still; the way out
  is a tick that alternates between two marks one step apart.
- **The GPU tables are 1.3.1's.** [notes] Besides the display link, the
  renderer holds the terminal lock 2.7x to 11x less per frame, and GH-13585
  fixes a renderer that, after a long uptime, rebuilt the whole terminal state
  every frame. Our protocol measured fresh instances, so the tables hold for
  1.3.1, but an everyday 1.3.1 cost more than they say. [design] The "~40 %
  device floor at 120 Hz is Ghostty's loop" should largely go on 1.4: measure
  again (passthrough, `day-clear`, `night-lit`, focused and unfocused) as a
  "1.4.0" section in `docs/gpu-measurements.md`.
- **RIS resets the palette** (GH-14480), as foreseen above. The mark is
  written again each minute (`hooks/ghostty.ts`, writeGhosttySky) and every
  tick, so a `reset` hides the sky in that tab for at most a minute when it
  is not ticking.
- **Fixes that remove risks we carried.** [notes] GH-14833: a freeze when the
  config was reloaded while a program flooded the terminal with queries, such
  as colour queries; the mod reloads at every scene change, and Claude Code
  asks for colours. GH-13638: config parsing silently dropped every setting
  after a comment or blank line that ended on an internal buffer boundary, in
  long configs; the mod appends its include, the vsync include and the
  stage's padding at the end of the person's config, exactly where they could
  vanish. Hidden tabs free their GPU resources (385 MiB to 18 MiB with 20
  hidden tabs), so a hidden Claude tab's 224 KB shader and its ticks cost
  nothing. Small OSC sequences parse about 6x faster.
- **The shader fix is not ours.** GH-14460 un-swaps the selection colour
  uniforms; the sky reads only `iPalette`, `iCurrentCursor` and
  `iBackgroundColor`.

### Ideas it opens

1. **A focus signal per terminal**, which would close "spar with many
   windows". [notes] The AppleScript `terminal` class now has `tty` and `pid`
   (GH-11592), and every process gets `GHOSTTY_SURFACE_ID` (GH-12027).
   [design] The mod could ask for the focused terminal of the front window and
   compare it with its own tty or surface id, so that in `spar` only the
   focused session ticks. An `osascript` costs more than `lsappinfo`, so only
   when `lsappinfo` already says Ghostty is in front.
2. **Ghostty's program status protocol (OSC 7501):** idle, working, done,
   blocked, failed, the first spec of Ghostty's own. Parsed; the GUI ignores
   it for now. It is nearly what the mod knows already (working, done, blocked
   while Claude asks); writing it on each change costs next to nothing and
   pays once Ghostty shows it. Low priority.
3. **Linux.** The GTK renderer is new (EGL on its own thread, triple
   buffered, hidden tabs no longer render, a systemd 262 reload fix). The
   pace keeps Linux on today's rules until the ticks are tried there; 1.4
   makes that trial worth more.
4. **The macOS 27 glass tab bar** now blends with the terminal's background
   colour. [hypotes] Setting the background (OSC 11) to the sky's colour at
   its top edge would join the tab bar to the sky, but the shader reads
   `iBackgroundColor` to decide light or dark (`hooks/glsl/main.ts`), and the
   background must be given back (OSC 111) when the sky goes. An experiment,
   not a task.

### Not for us

Visibility reports (mode 2033) answer on the program's stdin, which is Claude
Code's, not the mod's. Kitty graphics (now complete, with animation) live in
the text layer, scroll with it and are drawn over by Claude Code's redraws;
the sky has to stay behind everything. Kitty clipboard, `+ssh`, scrollback
compression, splits, key encoding, and the Glyph Protocol (parsed, not drawn).

### For Vincent when he updates

`copy-on-select` now defaults to `none` on macOS (set `primary` for the old
behaviour); `cmd+arrow_up/down` jump between prompts again. Updates installed
by themselves no longer ask to restart and take effect at the next launch, so
an update never has to end a running session.

## Everything else the sweeps found

Kept so that nothing found is lost; less likely to matter than the above.

Config (ghostty.org/docs/config/reference, checked against the 1.3.1 man page):

- `minimum-contrast` (a WCAG ratio, 1–21) compares text with `background`,
  never with the shader's output. [hypotes] Writing a mean sky colour per
  time of day into `background` (ratio ~3) would make Ghostty lift text
  against that stand-in; but `background` also feeds `iBackgroundColor`, which
  the sky keys text on. `faint-opacity` (1.2.0) and `font-thicken` (macOS) are
  further levers for text over a bright sky.
- `config-file`: a `?` prefix keeps a missing file from being an error, and an
  included file loads after the whole file that includes it, so the include
  wins over the person's own lines. Whether `~` works in it is untested.
- `osc-color-report-format`: OSC 4/10/11 queries are answered (16-bit by
  default), so a hook could read the mark back with `ESC]4;16;?ESC\` to check
  it. `palette-generate` (1.3.0, off by default) leaves set indices alone.
- OSC 11 sets a surface's background colour, and with the default
  `macos-titlebar-style = transparent` the titlebar follows it. [hypotes] A
  per-tab `iBackgroundColor` and a titlebar in the sky's colour; a poor
  channel, though, since the sky keys text on that colour.
- `window-vsync` (macOS, new terminals only); no key caps the frame rate;
  `window-padding-x/y` reach only new terminals; `window-padding-color =
  extend`; `toggle_background_opacity` (a macOS action); the quick terminal is
  one shared window and `quick-terminal-position` needs a restart on macOS;
  `notify-on-command-finish` (1.3.0) needs OSC 133, which Claude Code's long
  session does not give.

Features and VT (ghostty.org/docs/features, /docs/vt):

- AppleScript (1.3.1 sdef): the application has `frontmost` and `front
  window`, a window its `selected tab`, a tab `selected` and `focused
  terminal`, a terminal `id`, `name` and `working directory` (all read-only).
  [design] One `osascript` call can answer "Ghostty in front and this tab
  selected" if the tab has a unique title (OSC 2) to match by `name`; it
  still costs a process, and Claude Code rewriting the title would break it.
  On Ghostty's main a terminal also has `pid` and `tty`, and tabs and
  terminals a writable `name override` (PR
  [#14733](https://github.com/ghostty-org/ghostty/pull/14733)): a hook could
  find its own terminal by tty.
- Titles: OSC 2 is read as UTF-8; the `set_tab_title` action sets an override
  (empty clears it). [design] A state glyph in the tab title.
- OSC 22 sets the pointer shape by CSS name (a `progress` pointer while Claude
  works; the docs advise against the sequence). OSC 7, 5/105, 52 are of no
  use here; OSC 1 is unimplemented; OSC 21 (Kitty colours) is only linked to
  Kitty's spec.
- The docs list `iCurrentCursorStyle` and `iCursorVisible` as vec4, the 1.3.1
  prelude declares them int.
- [design] The shader can tell a light theme from a dark one by the
  brightness of `iBackgroundColor`, which it already reads.

Ghostty's code and GitHub:

- `iTime` advances only on frames actually drawn, and `iFrame` counts drawn
  frames (`generic.zig#L2435-L2455`).
- [Discussion #8818](https://github.com/ghostty-org/ghostty/discussions/8818):
  a no-op animated shader holds ~120 Hz with the graphics pipe ~27 %, against
  ~45 Hz and < 1 % without; macOS's power scheduler sets the vsync rate; no
  cooldown or trigger option was added. A battery-aware rendering request was
  closed as not planned
  ([#11928](https://github.com/ghostty-org/ghostty/issues/11928)). So the mod's
  own idle policy stays necessary.
- Not read in depth: closed PR #12153 (an `iSurfaceOffset` uniform), open issue
  #10995 (debouncing cursor positions).

Community (r/Ghostty and the repos it links):

- [akiyosi/ghostty-hyperspace](https://github.com/akiyosi/ghostty-hyperspace)
  ([post](https://www.reddit.com/r/Ghostty/comments/1u6bcvn/)): a space sky
  behind text that keys terminal against sky by luma
  (`smoothstep(0.12, 0.22, max(rgb))`), drops its motion blur to one sample
  in cruise and runs the costly passes only in rare warps or nebulae;
  `WARP_INTERVAL=0` gives a still sky. [design] Spend the heavy effects on rare
  events; [hypotes] keying on `iBackgroundColor`, as we do, holds better on
  light themes than a fixed luma.
- [elisaliman/ghostty-shaders](https://github.com/elisaliman/ghostty-shaders)
  ([post](https://www.reddit.com/r/Ghostty/comments/1tnmdq7/)): pixel-art snow
  and stars on a `PIXEL_SIZE` grid with parallax layers; CC BY-NC-SA 3.0, so a
  reference only, never code.
- ghostty-blackhole, beyond its mark: hooks have no controlling tty, so it
  finds the pty by walking up the parent processes; it reloads with SIGUSR2
  after finding the PID with `ps` (`pgrep` skips its own ancestors); tmux needs
  passthrough; it glides between levels with `iPreviousCursorColor` and
  `iTimeCursorChange`.
- iglass also refuses an opacity below 0.66 without `--force`, and says
  transparency is read only at launch.
- [Battery thread](https://www.reddit.com/r/Ghostty/comments/1ux5eek/): shaders
  drop to 20–30 Hz on battery under Linux's tlp.
- Cursor-shader users: pulses freeze unfocused unless
  `custom-shader-animation = always`; the warp-shader README asks for absolute
  shader paths and a `ghostty +validate-config` after editing.
- pixel-agents-terminal (no licence, an idea only): it follows Claude Code's
  transcript by byte offset.
- The raw reports of the five sweeps were in session scratch files and are
  not kept; this document is their record.
