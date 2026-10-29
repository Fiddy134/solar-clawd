# Tuning the text live: what Ghostty 1.4.0 and ghostty-designer say

Research for `/solar tune`'s text section (font size, thickness, line height, family, the gap to the stage, the shade around the text), 2026-10-29. Two tracks read in parallel: Ghostty's source at tag v1.4.0 (commit `83fb956`), and the whole of [ghostty-designer](https://github.com/reemus-dev/ghostty-designer) (MIT), a GUI that previews Ghostty settings live. [claude-inline-images](https://github.com/kbrianps/claude-inline-images) was read in full first and led to `/solar look`. Nothing was run in Vincent's Ghostty. Every claim is tagged: [källkod] with the file and line, [docs], or [hypotes].

## What changes the plan

1. **SIGUSR2 reloads Ghostty on macOS too, since 1.2.0.** [labbad 2026-10-29: Vincent sent `kill -USR2 619` from a shell in Ghostty 1.4.0, and its log said `reloading configuration in response to SIGUSR2` at 11:33:57, then read the config files; no window in front was needed and nothing asked for permission] [källkod `macos/Sources/App/AppDelegate.swift:590-599`, set up at `:333`] The handler calls `reloadConfig()`, which re-reads every file, includes too, and updates every surface (`src/App.zig:172-176`). No window and no focus is involved. ghostty-designer reloads this way on both systems, finding the app's PID by its bundle id `com.mitchellh.ghostty` (`crates/host/src/ghostty.rs:264-311`). The mod assumes SIGUSR2 is Linux's alone (`hooks/ghostty.ts:82`) and reloads on macOS with AppleScript on the front window (`hooks/ghostty.ts:23`), which needs a window in front and the Automation permission; `isReloadOwed` retries when it fails. The AppleScript action is app-wide as well (`src/input/Binding.zig:1365`, `src/Surface.zig:4945-4968`), so both routes reload all of Ghostty.
2. **The text settings apply live, on a reload, in open windows.** `Surface.updateConfig` (`src/Surface.zig:1804-1897`) builds the font grid anew every time. [källkod]
   - `font-family` and `adjust-cell-height` are in the font grid's config (`src/font/SharedGridSet.zig:479-534`).
   - `font-thicken` and `font-thicken-strength` are in the glyph cache key, so the glyphs are drawn again (`src/font/SharedGrid.zig:501-534`). These two are macOS only.
   - `font-size` applies too, but **not in a window whose size was changed by hand**: ⌘+, ⌘− or `set_font_size` set a per-surface flag (`Surface.zig:90`, `5250-5298`). Only `reset_font_size` clears it, and it applies to one surface at a time. ghostty-designer runs it over every terminal after a change of size, as JXA through `osascript`, unawaited, since the first Apple Event waits for the person's consent (`crates/host/src/ghostty.rs:313-337`, `preview.rs:344-364`).
3. **The gap to the stage cannot move live.** With `window-padding-balance` at its default, `false`, a reload leaves the padding of open surfaces as it was. The doc says so (`src/config/Config.zig:1998-1999`), and the code sets it only at the start, on a change of scale, or through balancing (`Surface.zig:551-558`, `2652-2657`). ghostty-designer classes padding "New tabs and splits only" (`ui/core/options.ts:417-431`). Balancing would centre the text and break the stage's one-sided margin. So the gap reaches new windows, as the stage's width does today. [källkod, with the balancing case a hypotes]
4. **Claude Code's dim grey may be a setting away from readable.** `faint-opacity` (default 0.5, since 1.2.0) draws SGR-faint text at that opacity (`Config.zig:3922-3927`, `src/renderer/generic.zig:3193`). Half-transparent grey over a light sky is what Vincent's screenshot of a queued message showed. Claude Code's dim text is SGR faint: with `faint-opacity = 1` added to Vincent's config and Ghostty reloaded, the dim lines read clearer and opaque over the day sky. [labbad 2026-10-29, Vincent's eye; the line stays in his own config]
5. **`minimum-contrast` does not help, and can hurt.** It compares each glyph with its own cell's background over the config's `background`, never with the shader's output, and turns text white or black (`src/renderer/shaders/shaders.metal:111-125`, `640-656`). With the dark background behind the sky it would push grey text towards white, the wrong way over a bright day. [källkod]
6. **Any halo around the text is ours to draw.** Ghostty has no shadow, glow or outline setting. [källkod grep of `Config.zig`] iChannel0 is the whole surface, padding included, background and text (`generic.zig:1911-2010`), with a linear sampler (`Metal.zig:297-298`). The mod's rim is 12 taps over a 1.5–1.75 px disc (`hooks/glsl/main.ts:155-186`). For text darker than the sky, which dim grey on a bright day is, it gives the weaker `SHADE`, and a dark rim helps grey text little when the sky itself is too light for it. A wider and softer darkening behind text (a backdrop) is the shader's other way. [hypotes, to be tried on frames]

## How a live change should be made (from ghostty-designer)

- **One include of the mod's, optional, and last.** `config-file = ?…`, appended after every other `config-file` line with a comment saying to keep it below them. ghostty-designer detects a file loaded after its own, which then shadows it, and warns (`crates/host/src/config_file.rs:52-122`). Includes load breadth-first after the file that names them, and an empty `config-file =` clears the queue (`Config.zig:2578-2605`). [källkod]
- **Validate before writing.** A broken include opens Ghostty's Configuration Errors window (`AppDelegate.swift:870-876`). ghostty-designer checks every draft with `ghostty +validate-config --config-file=<temp>` and drops the keys it names as invalid (`preview.rs:392-480`). It pipes the output, since the CLI truncates a file given as stdout. [källkod]
- **Write atomically, latest value only.** It uses a temporary file and a rename, sends at most one change per control every 100 ms, and runs one validation and write at a time, the newest draft winning (`preview.rs:8-21`, `279-331`, `555-566`; `ui/core/live.ts:22-78`). [källkod]
- **Put things back on every way out.** On quit, SIGINT, SIGTERM, SIGHUP and panic it empties the preview and reloads, and at the next start it reverts a draft a crash left (`preview.rs:129-163`, `205-247`). [källkod]
- **A repeatable key is cleared first.** `font-family = ""` comes before the chosen family, so the choice replaces rather than adds a fallback (`ui/core/preview.ts:17-30`). [källkod]
- **The PIDs to signal.** On macOS take the app's process by bundle id, never a `ghostty` CLI process; SIGUSR2's default action would kill one (`ghostty.rs:235-297`). [källkod]
- It never touches `custom-shader`: the sky is our own ground. [källkod `ui/core/options.ts`]

## The shader on a reload

A changed `custom-shader` sets `reinitialize_shaders`, and each surface reads the file and compiles it on its next frame (`generic.zig:876-901`, `1817-1821`, `2217-2245`). The check that it changed compares the path list with `std.meta.eql`. If that compares the slices by address, which a reload allocates anew, **every reload recompiles the shader in every open surface**, even when the path is the same. That would also be why the mod's rewritten shader shows at all. [hypotes, stöds av källkod] A change of a text setting would then cost a shader compile in every tab. This is what step 1 of the tune plan measures. It matters beyond tune: Ghostty's log on 2026-10-29 shows a config reload every 3 to 10 seconds from 11:33:34 to 11:34:22, from the mod's two sessions. [labbad, the log; the cost is not measured]

The test that settled SIGUSR2 read the log, not the screen, since the mod reloads Ghostty itself within seconds: `/usr/bin/log show --last 5m --style compact --info --predicate 'process == "ghostty"' | grep SIGUSR2` (zsh has a builtin named `log`). Ghostty's process on the Mac is `/Applications/Ghostty.app/Contents/MacOS/ghostty`; `pgrep -x ghostty` did not find it from the sandbox, `ps -axo pid,comm` did.

## What this means for /solar tune

- The text section can be one set for all hours, beside the sky's four:
  - size, with `reset_font_size` over the terminals and one consent prompt
  - thickness (`font-thicken`, `font-thicken-strength`)
  - line height (`adjust-cell-height`)
  - family (from `ghostty +list-fonts`)
  - faint text's opacity (`faint-opacity`)
  - the gap to the stage (new windows only)
  - the rim, already in the design as text shade
- These settings are Ghostty's, for **every** window, not only the ones where Claude runs, as the stage's margin is today.
- The reload path could become SIGUSR2 for the whole mod, which removes the need for a front window and for Automation. That is a change of its own, worth making before tune.

## Ej verifierat

1. What a reload costs with the shader recompiled in every tab, and whether an unchanged path recompiles: step 1 of the tune plan.
2. Whether `font-family` and `adjust-cell-height` reflow a running Claude Code without artefacts, and whether `font-thicken` is drawn again at once: a live try.
3. Whether `window-padding-balance` would move padding live, and what it does to a one-sided stage. A sandboxed try; it is not the path recommended here.
