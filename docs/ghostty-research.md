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
