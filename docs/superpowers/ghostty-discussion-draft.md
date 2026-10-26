# Draft: Ghostty "Issue Triage" discussion

Not sent. Vincent verifies the repro with his own eyes, edits the text in
his own voice (Ghostty's AI policy requires a human to review and edit, and
the AI use to be disclosed), and posts it himself at
https://github.com/ghostty-org/ghostty/discussions/new?category=issue-triage.
Searched before drafting (2026-10-26): no issue or discussion about `false`
redrawing at vsync; the nearest is a maintainer's remark in discussion
#6901 that with `false` "custom shaders are only drawn on terminal state
change".

Before posting, check the short repro below in a fresh window: with
`false`, the red tint should freeze while nothing is typed; if it pulses,
the report stands. If it freezes, our probe rows need a second look and the
draft does not go out.

---

**Title:** `custom-shader-animation = false` still redraws every vsync while the surface is focused (macOS)

### Issue Description

With `custom-shader-animation = false`, a focused surface keeps rendering
its custom shader at the display's refresh rate even when the terminal is
idle (steady, non-blinking cursor, no output). The docs say that with
`false` "the terminal and custom shader will only render when the terminal
is updated". Unfocused, `false` stops as expected.

I measured it by having a shader write `iFrame` as bits across the window
and reading two screenshots a few seconds apart:

| `custom-shader-animation` | focused, idle | focused, blinking cursor | focused, spinner | unfocused |
|---|---|---|---|---|
| `true` | 119.8 fps | – | – | 0 fps |
| `false` | 118.1 fps | 119.9 fps | 120.1 fps | 0 fps |
| `always` | 119.7 fps | – | – | 113.6 fps |

GPU power and utilization are the same under `false` and `true` while
focused (≈ 783 mW and 36.5 % device utilization for a trivial shader on an
M1 Pro, against 11 mW and 0.5 % without a shader). Setting `false` in a
config file and reloading gave the same cost as `true`. The flag reaches the
instance: `always`, passed the same way, does change the unfocused case.

### Expected Behavior

With `false`, an idle focused surface renders only when the terminal
changes, so the tint in the repro shader stays still.

### Actual Behavior

It renders every vsync (~120 fps on a 120 Hz display), the tint pulses, and
the GPU cost is the same as with `true`.

### Reproduction Steps

1. Save as `/tmp/frames.glsl`:
   ```glsl
   void mainImage(out vec4 fragColor, in vec2 fragCoord) {
     vec4 t = texture(iChannel0, fragCoord / iResolution.xy);
     float on = step(0.5, fract(float(iFrame) / 60.0));
     fragColor = mix(t, vec4(1.0, 0.0, 0.0, 1.0), 0.3 * on);
   }
   ```
2. `ghostty --config-default-files=false --custom-shader=/tmp/frames.glsl --custom-shader-animation=false --cursor-style-blink=false`
3. Leave the new window focused and type nothing. The red tint pulses about
   once a second at 120 Hz. With the window unfocused it stops.

### Ghostty Logs

Nothing shader-related in the unified log.

### Ghostty Version

```
Ghostty 1.3.1

Version
  - version: 1.3.1
  - channel: stable
Build Config
  - Zig version   : 0.15.2
  - build mode    : .ReleaseFast
  - app runtime   : .none
  - font engine   : .coretext
  - renderer      : renderer.generic.Renderer(renderer.Metal)
  - libxev        : kqueue
```

### OS Version Information

macOS 27.0 (26A428), MacBook Pro M1 Pro, built-in display at 120 Hz

### Minimal Ghostty Configuration

```
custom-shader = /tmp/frames.glsl
custom-shader-animation = false
cursor-style-blink = false
```

### AI disclosure

The measurements and a first draft of this report were made with Claude
Code; I ran the repro myself and edited the text.
