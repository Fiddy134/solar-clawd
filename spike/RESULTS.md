# Spike: the sky as a Ghostty shader (2026-10-25)

Ghostty 1.3.1, Apple M1 Pro, 3024×1964 Retina at 120 Hz.

| Check | Result |
|---|---|
| Readability behind Claude Code | Pass: text, prompt, status line, highlighted rows sharp, no halos (`mask = smoothstep(0.02, 0.12, distance(term.rgb, BG))`) |
| Outside reload (`perform action "reload_config"`) | Pass: no automation prompt (osascript runs under Ghostty itself); no flicker in 16 screenshots around a reload |
| `iTime` on reload | Does **not** restart: events loop while active |
| Unfocused | Free: the loop stops |
| Focused cost | ~15 % of a core over no shader (2.6 % → 17–20 %), GPU utilization 9 % → 40 % (passthrough) / 73 % (sky) |
| `custom-shader-animation = false` | No help: same cost, on reload and on a fresh instance's command line |

Found on the way:

- Ghostty's `fragCoord` starts at the **top left**; the sky is drawn in `p = (x, height - y)`, while `iChannel0` is sampled at `fragCoord / iResolution`.
- Ghostty logs no shader errors to the unified log: a shader that does not compile is silently ignored.
- `screencapture` works once Ghostty has Screen Recording; ffmpeg's avfoundation capture returns a frozen frame without a restart.

## Decision

Ghostty, with idleness: the sky is switched off (include emptied, reload) once the person has been away ~2 minutes (HIDIdleTime) and back on when they return, so the focused cost is paid only while someone is at the window.

Measurements: `measure.sh`, `measure-idle.sh` (→ `measure-idle.txt`), `instance-test.sh` (→ `instance-test.txt`), `still-test.sh`.
