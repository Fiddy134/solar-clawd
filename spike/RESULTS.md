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

## After the living sky (2026-10-25)

Ghostty 1.3.1, M1 Pro, 3024×1964 at 120 Hz, a night scene with the asking
lighthouse, 20 s each, while a Claude session in the same window was
working (its spinner redrawing the terminal):

| custom-shader-animation, focus | Ghostty CPU | GPU |
|---|---|---|
| true, focused | 15.9% | 76% |
| always, unfocused | 18.5% | 73% |
| false, unfocused | 7.7% | 50% |
| false, focused | 16.3% | 76% |
| no shader, focused | 5.9% | 6% |

- Real stars and constellations cost nothing measurable: old shader 74/73%,
  new 73/73% (focused, 30 s twice each, 2026-01-15 22:00 scene).
- The lighthouse sweeps with Ghostty in the background under `always`
  (two screenshots 2 s apart with Finder in front: the beam moved).
- `false` saves nothing while the terminal itself keeps changing: Ghostty
  draws the whole shader again on every change, and a working Claude
  changes it many times a second. A still sky (battery, the lighthouse
  after five minutes) only saves while the terminal is quiet. Same as the
  spike's finding that `false` "does not help".
- Every event, the demo and the lighthouse/ISS/aurora mix compile in
  WebGL; groups of four events compile in Ghostty itself (sky shown).
- An ISS pass reloads Ghostty every 2 s: Ghostty CPU 17.7% → 19.8%, GPU
  71% → 72% (20 s each, a night shader alternating the station's place).
