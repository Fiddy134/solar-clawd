# Writing a theme for Solar Clawd

<!--
For the guide's maintainers; a theme's author can pass over this comment.
This guide is the whole of what a theme's author is given. hooks/guide.test.tsx
holds it to the code: the lines of a glsl-signature block are the engine's
own, every glsl block lints clean, the glsl-fyr and glsl-engine excerpts are
lines of fyr and of the engine as they stand, the json-manifest block is
fyr's manifest, the template (json-template and glsl-template) checks clean,
the text-reserved block is the engine's names, the text-clawd block is the
band's Clawd, the codes one-liner has the font's order, and each table after
a guide-test comment lists what the code has. After an edit, run
`node tools/theme/guide.mjs` with no arguments, which writes the copy the
test reads (hooks/themes/guide.ts), and then `claude plugin test .`.
-->

The sky behind Claude Code in Ghostty is an engine and a theme. The engine draws the sky; a theme draws a world in it at the right of the window, and Clawd lives there. This guide is everything you need to write one. With it and a paragraph saying what your theme is, you can write a theme that lints, compiles and looks right in one sweep, without reading the engine (`hooks/`) or another theme. Every signature, signal name, reserved name, manifest field and excerpt in it is checked against the code by a test, and every example lints clean; the rest (the signals' types and values, timings, the tools' flags, the prose) is written from the code but not tested against it.

Work like this, from the repository's root:

1. Read the guide through once. Themes go wrong in §2 (the world), §3 (the contract), §8 (time) and §11 (the waiting light).
2. Make `themes/<name>/` and put the template's two files in it (§15): `node tools/theme/guide.mjs template themes/<name>` writes them, with the folder's name in the manifest.
3. Write your world into them, and after every change lint it and draw a frame (step 4): `tools/theme/run.sh lint themes/<name>`. The lint does not check types; only the compiler does.
4. Look at single frames as you go: `tools/preview/run.sh shader --theme themes/<name> --stage <stagePt> --at 2026-10-26T13:00` prints the path of a PNG; read it.
5. When it stands, draw the whole sheet with `tools/preview/sheet.sh theme themes/<name>`, look at every frame against the checklist (§14), and measure what it costs (§10).
6. Put right what the lint, the compiler and the sheet show, until the checklist holds.

The tools need node with npx (they fetch esbuild 0.24.0 the first time, which needs the network), ffmpeg, and Google Chrome at `/Applications/Google Chrome.app`, which they run headless.

## 1. What a theme is

The engine draws what every sky has, the same under every theme:

- the sky itself: its gradient by the sun's height, the sun on its arc, the moon and the real stars where they stand, the aurora;
- the clouds, and rain, snow and thunder, from the real weather where the person is;
- its own events: balloons, planes, migrating birds, kites, autumn leaves, cherry blossom, comets, shooting stars, the ISS on a visible pass, a rainbow after rain, confetti after a long piece of work, the Swedish days;
- the composite: the terminal over the sky, a thin dark rim round the terminal's text so it stays readable, and Claude Code's own coloured fields (a diff's rows, the prompt) as tinted glass;
- when the shader is written and Ghostty reloads it, how fast the sky moves, and, for a theme that leaves it to the engine, the context window as a wastebasket in the bottom right corner;
- Clawd's band above the prompt, which is drawn in the terminal's own cells and is not in the shader at all.

A theme draws its world in that sky: the ground and the props on the strip at the right of the window (the stage), the characters who live there, Clawd first among them, the light that shows Claude is waiting on the person, events of its own, and how much of the clouds, the rain and the engine's events shows at each point. It reads what the engine knows (the sun and the moon, the weather, the local time, Claude waiting, the context window, what Claude is doing right now, the market) as constants and functions (§4).

A theme is two files in a folder named after it:

- `manifest.json` says what the theme is, how wide its stage is, what its waiting light looks like in words, whether it shows the context window itself, and which events of its own it has (§3).
- `theme.glsl` defines the four functions the engine calls, `scenery`, `resident`, `themeEvent` and `themeWindow`, and whatever they need (§3).

That is all a theme has: no TypeScript, no textures or images, no reading of the terminal's image, nothing that runs anywhere but in the shader. It never draws the sky, the sun, the clouds or the weather, never writes over the terminal's text, and never decides when the sky is redrawn. fyr, the lighthouse and its keeper, the theme the sky starts with, is built in as a TypeScript wrapper round exactly these two files, so a theme in a folder can do anything fyr does. §7 shows how fyr and the engine do the things your theme will need.

## 2. The world you draw in

**The pixel.** Each of your functions is called for one pixel, `p`, in device pixels from the window's top left corner: x to the right and y **down**, on every platform (the engine flips Linux's for you). The window is `iResolution.xy` pixels: 1512 × 982 in the sheets, 3024 × 1964 in a full-screen Ghostty on a Retina Mac.

**The unit.** `u` is about a sixtieth of the window's height, `max(4.0, floor(iResolution.y / 60.0 + 0.5))`: 16 in the sheets and 33 on a Retina screen. Give sizes in `u`, and widths across the stage as parts of `STAGE_PX`, and your world keeps its proportions on any screen. Draw characters in cells of whole pixels: `max(1.0, floor(0.25 * u))` is 4 pixels in the sheets and 8 on a Retina screen.

**The horizon.** `ARC.w * iResolution.y`, 0.62 of the way down: the line the sun rises from and sets on, where fyr's sea meets the sky. What stands on the ground stands on it.

**The sun and the moon.** By day the sun rides an arc from x = 0.56 W as it rises to 0.95 W as it sets, highest at y = 0.12 H, at `arcPoint(sceneNow().progress)`. It crosses the right half of the window, so a stage stands in front of it for part of every afternoon, the wider the longer. The moon and the stars stand where they are in the real sky, the window being the sky seen lying on your back with your feet to the south: south on the horizon, the zenith above it, east at the left and west at the right. The moon is at `domeToPixel(MOON_AT)`.

**The stage.** The strip at the right where the terminal's text never goes, `STAGE_PX` pixels wide: the window's right padding, which `/solar ghostty` sets to the `stagePt` your manifest asks for (points, so twice as many pixels on a Retina screen). Your world stands there. Left of it the terminal's text runs over the sky from top to bottom, with the prompt and Clawd's band at the bottom. `STAGE_PX` may be less than you asked, when the person has narrowed their padding, and it is 0 where the width is not known (a preview run without `--stage`): fall back to a part of the window then, as the template does.

```text
x = 0                                               W - STAGE_PX            W
+--------------------------------------------------+-----------------------+  y = 0
| the terminal's text, over the sky                | the stage:            |
|                                                  | your world            |
|                                                  |                       |
+------------------------------ the horizon, y = 0.62 H --------------------+
|                                                  |                       |
| the prompt, and Clawd's band above it            |                       |
+--------------------------------------------------+-----------------------+  y = H
```

**The dimming.** `k` is how far the engine dimmed the sky so that its brightest point stays at `LUMINANCE` (0.8) and the terminal's light text stays readable over it. It is 1, or close to it, nearly always. Pass it on to `tone`, `lift` and every helper that takes it (§9).

**The order of a frame.** For every pixel, every frame:

1. A tab where Claude does not run shows the terminal as it is, and nothing else.
2. The sky's gradient, and `k`.
3. The aurora.
4. The stars, the real ones, and the constellations' lines.
5. The moon.
6. The sky dimmed by `k` and saturated as the print is.
7. The sun.
8. The events behind the clouds: shooting stars, a satellite, a comet, the Clawd constellation, a rainbow, the Christmas star, and your events whose layer is `behind` (`themeEvent` with `isBehind` true).
9. The ISS on a pass.
10. **`scenery`**: your ground, your props and the waiting light.
11. **`resident`**: your characters and their things.
12. **`themeWindow`**: wherever it is above 0, the clouds, the events in front (the engine's balloons, planes, birds and kites, and your events whose layer is `front`, `themeEvent` with `isBehind` false) and the rain and snow, mixed in as much as it says.
13. The wastebasket, if your manifest says `"context": "engine"`: about 2 `u` wide and 2.2 `u` tall, its middle 1.9 `u` from the window's right edge, standing on the bottom edge, with its smoke and flames reaching 7.3 `u` up and 4.4 `u` in from the right. Keep that corner clear, or give it a floor it reads on.
14. The rim round the terminal's text, and the terminal over everything.

What follows from the order:

- What you draw covers the sky, the sun, the moon, the stars and the events behind. A pixel you leave as `sky` shows them; a wall drawn at less than full strength lets the sun show through it.
- The clouds, the events in front and the weather come after you, over whatever you drew wherever `themeWindow` is above 0: your props and your characters too. Make it 0 wherever something must stay in front of them.
- Nothing you draw covers the terminal's text, which is laid over last.

## 3. The contract

This is contract 1, which your manifest names as `"engine": 1`. Every name the engine has added since starts with `sky_`, so a theme written for it keeps working.

### The four functions

The engine declares these, calls them, and leaves their bodies to you:

```glsl-signature
vec3 scenery(vec3 sky, vec2 p, float u, float k);
vec3 resident(vec3 sky, vec2 p, float u, float k);
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind);
float themeWindow(vec2 p, float u);
```

Each is called for every pixel of the window, every frame, with the colour so far as `sky`. It returns that colour with its own laid over, or `sky` as it came where it has nothing to draw. One you leave out, the engine stubs: the first three return `sky`, and `themeWindow` returns 1.0. Keep the signatures exactly: one with other parameters is a new function, and the engine's declared one then has no body, which does not compile. The examples below use the template's helpers (§15).

`scenery` draws the ground, the props and the light that shows Claude waits. It must show `WAITING` (§11): a theme without a waiting light is not finished.

```glsl
// The ground on the stage, darker by night, and the waiting light.
vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  Stage s = stageOf();
  if (p.x < s.left) return sky;
  if (p.y > s.ground) sky = mix(sky, tone(mix(INK_GREEN, INK_INDIGO, 0.55), k) * (1.0 - 0.6 * night()), 0.9);
  return waitingLamp(sky, p, u, k, s);
}
```

`resident` draws the characters and their things, after `scenery`, so they stand in front of it.

```glsl
// Clawd standing on the ground in the stage's middle.
vec3 resident(vec3 sky, vec2 p, float u, float k) {
  Stage s = stageOf();
  return clawd(sky, p, vec2(s.left + 0.6 * s.width, s.ground), max(1.0, floor(0.25 * u)), k);
}
```

`themeEvent` draws one of your manifest's events while it is up (§12). `kind` is its place in the manifest's `events`, counted from 0. `seed` is a whole number from 0 to 999, the same all through one showing of it and another the next time. `t` runs from 0 to 1 through the event's length and starts over, since Ghostty's clock cannot say when it began. `isBehind` is true in the pass behind the clouds (step 8 of the order) and false in the pass in front (step 12): draw each event in the pass its `layer` names, and return `sky` in the other.

```glsl
// A paper kite (0) in front of the clouds, a far-off glow (1) behind them.
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) {
  if (kind == 0 && !isBehind) return paperKite(sky, p, u, k, seed, t);
  if (kind == 1 && isBehind) return farGlow(sky, p, u, k, seed);
  return sky;
}
```

`themeWindow` says how much of the outdoor layers (step 12) shows at `p`: 1.0 in the open, 0.0 behind a wall or under a roof, and between the two through glass. It is asked for every pixel, so keep it cheap.

```glsl
// Outdoors left of the stage, indoors on it.
float themeWindow(vec2 p, float u) {
  return p.x < stageOf().left ? 1.0 : 0.0;
}
```

Your text comes after the engine's in the shader, so you can call any of the engine's functions and read any of its constants. Within your own text a function must be defined above the first line that calls it (GLSL looks no further ahead), or declared there with a prototype, as the engine declares the four.

### The manifest

<!-- guide-test: manifest fields -->
| Field | What it holds |
|---|---|
| `engine` | `1`, the contract this guide describes. |
| `name` | 1 to 32 of `a` to `z`, `0` to `9` and `-`: the folder's name, which the lint holds it to. |
| `title` | A short title. Nothing shows it yet; it is kept for `/solar theme`, which is planned. |
| `description` | A sentence or two: what stands there and what goes on. |
| `author` | Who wrote it. |
| `version` | Its version, as `1.0.0`. |
| `license` | Its licence; the mod's own is `GPL-3.0`. |
| `stage` | `"wanted"` for the strip at the right where the terminal's text never goes, or `"none"` for a theme that draws over the whole window and wants no margin. Only the preview tools honour `"none"` so far: a session still gives such a theme the 240-point strip. |
| `stagePt` | How wide the strip is, in points: 240, 280, 320, 360, 400, 440 or 480, and only with `"stage": "wanted"`; 240 when left out. Wider shows more of your world and leaves the terminal less room: choose by what your world needs, and judge it on the sheet. |
| `waits` | What Claude waiting looks like in your theme, in a sentence, for the person reviewing the theme (nothing shows it yet). |
| `context` | `"resident"` if your theme shows the context window itself, through `contextFish()` and `contextState()` (§4); `"engine"` to have the engine's wastebasket in the bottom right corner instead. |
| `market` | `true` if your theme shows prices (§4): a session fetches them only then. `false`, or leave it out, otherwise. |
| `events` | Your events, which the engine schedules (below, and §12). `[]` for none. |
| `previews` | Moments your theme schedules itself from `iTime`, each `{ "kind": …, "word": … }`. The engine never schedules them; `/solar event <word>` plays one for 90 seconds through `THEME_FORCE` (§8). `[]` for none. |
| `aliases` | Other words `/solar event` takes for your events and previews, each `"word": "kind"`. `{}` for none. |

fyr's manifest, which passes every check:

```json-manifest
{
  "engine": 1,
  "name": "fyr",
  "title": "The lighthouse",
  "description": "A striped lighthouse on its rocks in the sea at the right, and its keeper, a small Clawd: fishing, walking the gallery, surfing, asleep in his hammock at night, his catch the context window on a line, grilled as the conversation compacts. Dolphins leap now and then, and a UFO comes for him.",
  "author": "Solar Clawd",
  "version": "1.0.0",
  "license": "GPL-3.0",
  "stage": "wanted",
  "waits": "The lantern lit, its beam turning: orange while Claude asks, white when it is done, hurrying once a question has waited; the keeper on the gallery beside it.",
  "context": "resident",
  "events": [
    {
      "kind": "dolphin",
      "word": "dolphin",
      "slotMinutes": 30,
      "chance": 1,
      "minutes": 1,
      "layer": "front",
      "when": {
        "sun": "day",
        "windBelow": 12,
        "dry": true
      },
      "salt": 7
    },
    {
      "kind": "pinkDolphin",
      "word": "pink dolphin",
      "slotMinutes": 360,
      "chance": 0.5,
      "minutes": 1,
      "layer": "front",
      "when": {
        "sun": "day",
        "windBelow": 12,
        "dry": true
      },
      "salt": 8
    }
  ],
  "previews": [
    {
      "kind": "abduction",
      "word": "ufo abduction"
    },
    {
      "kind": "surf",
      "word": "surf"
    }
  ],
  "aliases": {
    "delfin": "dolphin",
    "rosa delfin": "pinkDolphin"
  }
}
```

Each of the `events`:

<!-- guide-test: event fields -->
| Field | What it holds |
|---|---|
| `kind` | Its name in the code: a letter, then letters and digits (`dolphin`, `pinkDolphin`). Not one of the engine's kinds (below), and not a name every JavaScript object has (`toString`, `constructor`). |
| `word` | What the band shows while it plays and what `/solar event` takes. Not one of the engine's words (below). |
| `slotMinutes` | The span of time it may come once in. |
| `chance` | 0 to 1: in how many of the slots it comes. |
| `minutes` | How long it lasts: more than 0 and less than `slotMinutes`. |
| `layer` | `"front"`: drawn in front of the clouds, and only where `themeWindow` is above 0. `"behind"`: drawn before the clouds and before `scenery`, which covers it. |
| `when` | When it may come (below); `{}` for any time. |
| `salt` | Optional: a whole number that seeds its schedule; 1000 and its place in the list when left out. |

Together your events may keep the sky moving no more than 8 % of the time, counted as the sum over them of `chance × minutes / slotMinutes`: a one-minute event in every half hour is 0.033 of it.

An event's `when` takes any of these, and it comes only while all it names hold:

<!-- guide-test: when -->
| Key | It may come only while |
|---|---|
| `sun` | `"day"`: the sun is above 2°; `"night"`: below −8°; `"low"`: between −3° and 15°; `"any"`: whenever. |
| `clearAtMost` | the sky is no greyer than this, 0 to 1 (`CLOUDINESS`). |
| `windBelow` | the wind is under this many metres a second. |
| `windAtLeast` | the wind is at least this. |
| `windAtMost` | the wind is at most this. |
| `dry` | (`true`) it does not rain, drizzle, thunder or snow. |
| `months` | the month is one of these, 1 to 12. |
| `elevationAbove` | the sun is higher than this many degrees. |
| `elevationBelow` | the sun is lower than this. |

The engine's own events, whose kinds and words are taken:

<!-- guide-test: engine events -->
| Kind | Word |
|---|---|
| `balloon` | balloon |
| `birds` | migrating birds |
| `plane` | plane |
| `kite` | kite |
| `leaves` | autumn leaves |
| `blossom` | cherry blossom |
| `comet` | comet |
| `constellation` | clawd constellation |
| `witch` | easter witch |
| `feathers` | easter feathers |
| `flag` | national day |
| `maypole` | maypole |
| `luciaTrain` | lucia procession |
| `christmasStar` | christmas star |
| `sleigh` | santa's sleigh |
| `fireworks` | fireworks |
| `satellite` | satellite |
| `rainbow` | rainbow |
| `milestone` | milestone |
| `shootingStar` | shooting star |

### Names

Your top-level names (functions, constants and structs) must not be the engine's, and must not start with `sky_`, which is kept for names the engine adds. These are the engine's, besides the four functions and every `sky_` name:

```text-reserved
ARC AURORA AURORA_FLOOR BALL_AT CLAWD CLAWD_ACTIVITY CLAWD_ASLEEP CLOUDINESS COMET_AT COMET_AWAY
CONTEXT CONTEXT_CLEARED CONTEXT_CLEARING CONTEXT_GAINED CONTEXT_IDLE COVER CREAM DAY DEMO_COUNT
DEMO_DAY DEMO_ELEVATION DEMO_PROGRESS DEMO_SECONDS ELEVATION EVENT_COUNT EVENT_KIND
EVENT_SECONDS EVENT_SEED FIELD_COLOURS FIELD_COUNT FIELD_LIGHTEST FIELD_REACH FIGURE FIREWORKS
FLAG_DAY FLOWER GLASS GLASS_LIGHT GLASS_TEXT HEART INK_BLUE INK_GREEN INK_INDIGO INK_ORANGE
INK_PINK INK_VIOLET INK_YELLOW ISS_AT ISS_TRAIL ISS_UP IS_DAY LEAF_BIRCH LEAF_LOBE LEAF_LOBE_R
LEAF_MAPLE LEAF_OAK LEAF_RIB LEAF_STEM LEAF_VEIN LIGHT LINE_A LINE_B LINE_COUNT LINE_TILE_COUNT
LINE_TILE_LINE LINE_TILE_START LOCAL_HOUR LUMINANCE MONTH MOON_AT MOON_ILLUMINATION MOON_UP
MOON_WAXING NIGHT_INK PETAL PI PRECIPITATION PROGRESS RABBIT SATURATION SHADE SHADE_DARK
SHADE_DISC SHADE_GAP SHADE_NEAR SHADE_RADIUS SHADE_TINT SHOOTING_RATE STAGE_PX STAR_AT
STAR_COUNT STAR_LOOK STOP_AT STOP_HORIZON STOP_MIDDLE STOP_TOP SWEDISH_BLUE SWEDISH_YELLOW Scene
TEMPERATURE TEXT_NEAR THEME_FORCE TILE_COUNT TILE_STAR TILE_START WAITING WAITING_URGENT WEEKDAY
WHALE WIND Y_UP airframe arcPoint aurora balloon basket birdPrint birdShape birdWing birds
blossomShape box chartLines chartTile christmasStar chroma clouds comet confetti constellation
contextFish contextState cursorAt domeToPixel drift driftPrint driftShape events fbm
featherPrint featherShape feathers fire fireworks flag flame glance glass glassTint gradient
grey hashi hashu ink isField isFieldColour isInsideField isSame isTextOnGlass iss keyInk
keyPlate keyShift kite lamp leafShape lift limb luciaTrain luminance mainImage maypole moonAt
night nightInk nightness noise noise2 paperBall pieceKind pieceSize pitch pixelToDome plane
rainbow rand realStars satellite sceneNow screen seas seeded segment shade shaded shapeRow
shootingStarAge shootingStars shy sleigh smin smoke sprite spriteAt stars steam stops sunAt tone
tumble vivid weather widthShown witch
```

The ones themes reach for are `plane`, `birds`, `balloon`, `kite`, `flag`, `fire`, `flame`, `smoke`, `steam`, `lamp`, `glass`, `box`, `ink`, `screen`, `shade`, `stars`, `clouds`, `weather`, `comet`, `drift`, `night`, `pitch`, `CLAWD`, `CREAM`, `DAY`, `LIGHT`, `WIND`, `MONTH`, `PI` and `Scene`: call yours `paperPlane`, `deskLamp` or `CORAL` instead.

Inside a function a name may be anything GLSL allows, but a local named like a function hides that function for the rest of its block: after `float night = 0.5;` a call to `night()` does not compile, and after `float length = 2.0;` neither does `length(v)`. GLSL also keeps words of its own that would make good names: `sample`, `filter`, `input`, `output`, `active`, `common`, `partition`, `patch`, `half`, `fixed`, `long`, `short`, `union`, `class`, `this` and `namespace` do not compile as names, nor does a name with two underscores in a row (`my__thing`). `buffer`, `shared` and `precise` compile in the preview, but they are keywords of Ghostty's GLSL 4.30 and fail there: leave them alone too.

### The lint

`tools/theme/run.sh lint themes/<name>` reads the manifest as the engine does, then checks the GLSL against a subset of GLSL that cannot read the terminal, hang the GPU or redefine the engine. It prints the weights and the stage, then each problem, and `clean` when there are none:

- No `while` or `do` loop.
- A `for` loop only as `for (int i = a; i < b; i++)`: `a` and `b` whole numbers written out, both between −48 and 48 (so at most 97 turns); `<`, `<=`, `>` or `>=`; a step of `i++`, `++i`, `i--`, `--i`, `i += n` or `i -= n` (n a whole number above 0) toward the bound; the index never assigned in the body; the body a `{ }` block. `break` and `continue` are fine. A bound you know only at run time goes in the body: `for (int i = 0; i < 4; i++) { if (i >= EVENT_COUNT) break; … }`.
- Loops nested at most two deep, a loop that calls a function counting that function's own loops under it (the engine's helpers are not counted).
- Nothing that reads an image: no `texture…(` or `texelFetch…(` call (so no function of yours whose name starts with `texture` either), no `iChannel`, no `iPalette` (the tab's mark comes through `contextFish()`, `contextState()`, `sky_tool()` and `sky_agents()`).
- No preprocessor (`#` anywhere outside a comment), no `discard`, no `mainImage`.
- Nothing declared at the top as `uniform`, `in`, `out`, `inout`, `layout`, `buffer`, `attribute`, `varying` or `shared`.
- No `out` or `inout` parameter that is an `int` or a `uint`, and none of the built-ins that write one (`frexp`, `imulExtended`, `umulExtended`, `uaddCarry`, `usubBorrow`): return a struct or an `ivec2` instead.
- None of the engine's names defined again, and no top-level name of yours starting with `sky_`.

When it says it cannot count your loops, it found a block after a `)` whose function's name it could not read, or calls between your functions nested deeper than it follows: write every signature plainly, `vec3 name(vec3 sky, vec2 p) {`, and keep calls between your functions shallow.

### The caps

Your `theme.glsl` may be 80,000 characters at most, comments counted, and the whole shader of a long night (04:00 with the aurora, the ISS, the grill and every star up) 224,000. The lint prints both weights; the engine alone is under 130,000, so the first cap is the one you meet. Every tab compiles the whole shader as it opens and each time the sky changes, so shorter is better.

### The waiting light

`scenery` shows `WAITING`: dark while it is 0, orange while it is 1 (Claude asks), white while it is 2 (Claude is done), hurrying while `WAITING_URGENT` is 1. It must read in a still frame as well as in motion. §11 says what the person needs from it.

## 4. The engine's signals

The engine declares these before your text: constants written into the shader, and four functions that read the tab's mark. Most constants are worked out for a scene on a grid of two minutes. When one changes, the engine writes the shader again and Ghostty reloads it in every tab, while `iTime` runs on: nothing tells your code that a constant has just changed, so it jumps from one value to the next. Make every value of a constant a state that looks right on its own (§8). The tab's mark is different: it is written to this tab alone, at once, with no reload.

"Scene" below means it changes with the scene, about every two minutes; "weather", within seconds of a fetch, every 15 minutes at most; "at once", when it happens, by a reload; "mark", at once in this tab, with no reload.

<!-- guide-test: signals -->
| Signal | Type | Values | What it says | Changes |
|---|---|---|---|---|
| `ELEVATION` | float | −90 to 90 | The sun's height in degrees, to a tenth. In `/solar demo` it stays at the demo's first scene: read `sceneNow().elevation`, or `night()`, which play the demo's day. | scene |
| `PROGRESS` | float | 0 to 1 | How far along its arc the sun is by day, or the moon by night. Read `sceneNow().progress`. | scene |
| `IS_DAY` | float | 0 or 1 | Whether the sun is up (above −0.83°). Read `sceneNow().isDay`. | scene |
| `MOON_ILLUMINATION` | float | 0 to 1 | How much of the moon is lit. | scene |
| `MOON_WAXING` | float | 0 or 1 | Whether the moon is growing. | scene |
| `MOON_AT` | vec2 | the dome | Where the moon is: `domeToPixel(MOON_AT)` is its pixel. | scene |
| `MOON_UP` | float | 0 or 1 | Whether the moon is above the horizon. | scene |
| `AURORA` | float | 0 to 1 | How strong an aurora the Kp index and a clear sky allow, before the night dims it: the engine draws `AURORA * max(AURORA_FLOOR, night())`. | scene |
| `AURORA_FLOOR` | float | 0 or 0.4 | 0.4 while an aurora is forced with `/solar aurora`, so that it shows at dusk too. | at once |
| `SHOOTING_RATE` | float | per hour | Shooting stars an hour: 2 on a clear night, 10 in a meteor shower, 0 otherwise; 900 while `/solar event shooting star` (or the preview's `--event shootingStar`) plays a shower. `shootingStarAge` (§5) finds the latest. | scene |
| `ISS_UP` | float | 0 or 1 | Whether the ISS is on a pass you could see. | every 2 s on a pass |
| `ISS_AT`, `ISS_TRAIL` | vec2 | the dome | Where it is, and where it was 20 seconds before: `domeToPixel(ISS_AT)`. | every 2 s on a pass |
| `FIREWORKS` | float | 0 to 1 | How much of the sky New Year's fireworks fill. | scene |
| `FLAG_DAY` | float | 0 or 1 | 1 while the engine flies the flag on Sweden's national day. | at once |
| `DEMO_COUNT`, `DEMO_SECONDS`, `DEMO_ELEVATION`, `DEMO_PROGRESS`, `DEMO_DAY` | int, float, float[], float[], float[] | | `/solar demo`'s day, a scene every quarter of an hour played round in 48 seconds; `DEMO_COUNT` is 0 outside a demo. Read the scene through `sceneNow()` and `night()` instead. | at once |

<!-- guide-test: signals -->
| Signal | Type | Values | What it says | Changes |
|---|---|---|---|---|
| `CLOUDINESS` | float | 0 to 1 | How grey the weather makes the sky. | weather |
| `COVER` | float | 0 to 1 | Cloud cover; 0.3 while the weather is not known. | weather |
| `WIND` | float | m/s | The wind, in steps of 0.5; 3 while not known. | weather |
| `PRECIPITATION` | int | 0 to 4 | 0 none, 1 drizzle, 2 rain, 3 thunder, 4 snow. | weather |
| `TEMPERATURE` | float | °C | The air, in whole degrees; 10 while not known. | weather |

<!-- guide-test: signals -->
| Signal | Type | Values | What it says | Changes |
|---|---|---|---|---|
| `WAITING` | int | 0, 1, 2 | Claude waiting on the person: 0 not, 1 asking (a permission or a question), 2 done (its answer is finished and it is the person's turn). Every session's waits are shown in every tab, the most pressing first (§11). | at once |
| `WAITING_URGENT` | float | 0 or 1 | 1 once a question has waited two minutes. | at once |
| `CLAWD_ASLEEP` | float | 0 or 1 | Clawd in the band is asleep, from 03:00 to 06:00 (up all New Year's night, and up at 05:00 for Lucia, 13 December). | scene |
| `CLAWD_ACTIVITY` | int | 0 to 5 | Clawd's day: 0 early bird (06–08), 1 coffee (08–12), 2 work (12–16), 3 vibing (16–22), 4 night owl (22–03), 5 asleep (03–06; 03–05 on Lucia, when he is an early bird from 05). | scene |
| `CONTEXT` | int | 0 or 1 | 1 where the tab's mark carries the context window: always in a Ghostty session, and in a preview given `--fish`. | never |
| `contextFish()` | int | 0 to 10 | How many tenths of this tab's context window are full; 0 where `CONTEXT` is 0. | mark |
| `contextState()` | int | `CONTEXT_` | What the context window is doing: `CONTEXT_IDLE`, `CONTEXT_CLEARING` (the conversation compacting or cleared, and 8 seconds after), `CONTEXT_CLEARED` (just compacted, 3 seconds) or `CONTEXT_GAINED` (a tenth just filled, 2.5 seconds). | mark |
| `CONTEXT_IDLE`, `CONTEXT_CLEARING`, `CONTEXT_CLEARED`, `CONTEXT_GAINED` | int | 0 to 3 | The states `contextState()` returns. | never |
| `sky_tool()` | int | `sky_TOOL_` | The kind of Claude's newest call still running, in the main conversation or a subagent; a kind stays at least 1.5 seconds. | mark |
| `sky_TOOL_NONE`, `sky_TOOL_COMMAND`, `sky_TOOL_EDIT`, `sky_TOOL_READ`, `sky_TOOL_WEB`, `sky_TOOL_OTHER` | int | 0 to 5 | None; a command (Bash, BashOutput, KillShell); an edit (Edit, Write, MultiEdit, NotebookEdit); a read or a search (Read, Grep, Glob, LS, NotebookRead, ToolSearch); the web (WebFetch, WebSearch); anything else, an MCP server's tools among them. An Agent or Task call and a question to the person (AskUserQuestion) leave the kind as it was: the subagent's own calls show, and `WAITING` shows the question. | never |
| `sky_agents()` | int | 0 to 7 | How many subagents are at work now. | mark |

<!-- guide-test: signals -->
| Signal | Type | Values | What it says | Changes |
|---|---|---|---|---|
| `LOCAL_HOUR` | float | 0 to 24 | The place's local time, the hour with its minutes (21.5 is half past nine at night). It follows the scene: a time pinned with `/solar 21:30` shows 21.5. | scene |
| `WEEKDAY` | int | 0 to 6 | The day of the week, 0 Sunday. | scene |
| `MONTH` | int | 1 to 12 | The month. | scene |
| `DAY` | int | 1 to 31 | The day of the month. | scene |
| `sky_NEW_YORK_HOUR` | float | 0 to 24 | New York's time at the scene, the hour with its minutes. | scene |
| `sky_MARKET_OPEN` | float | 0 or 1 | 1 from 09:30 to 16:00 in New York on a trading day, by the exchange's holidays and early closes. | scene |

<!-- guide-test: signals -->
| Signal | Type | Values | What it says | Changes |
|---|---|---|---|---|
| `sky_QUOTE_COUNT` | int | 10 | How many symbols there are. | never |
| `sky_BTC`, `sky_ETH`, `sky_NDX`, `sky_AAPL`, `sky_MSFT`, `sky_NVDA`, `sky_GOOGL`, `sky_AMZN`, `sky_META`, `sky_TSLA` | int | 0 to 9 | Each symbol's index into the two arrays below: bitcoin, ether, the Nasdaq-100 and the seven largest stocks. | never |
| `sky_QUOTE_PRICE` | float[10] | | Each price in US dollars (the coins in USDT from Binance, or in USD from Coinbase when Binance does not answer), to five significant figures; 0 while not known. Stocks are 15 minutes late. | scene |
| `sky_QUOTE_CHANGE` | float[10] | percent | Each price's change today, to a hundredth of a percent: a stock against yesterday's close, a coin over 24 hours. | scene |
| `sky_QUOTES_FRESH` | float | 0 or 1 | 1 while every known price was fetched within 15 minutes. | scene |

<!-- guide-test: signals -->
| Signal | Type | Values | What it says | Changes |
|---|---|---|---|---|
| `STAGE_PX` | float | pixels | The stage's width (§2); 0 where it is not known. | at once |
| `LIGHT` | float | 0 or 1 | 1 for the lighter sky of a Mac on battery or a person away, drawn without clouds. Leave out what costs most while it is 1, if you like. | at once |
| `Y_UP` | float | 0 or 1 | Whether Ghostty's own coordinates have y up. `p` is already y down: you never need it. | never |
| `THEME_FORCE` | int | 0, 1, 2… | Which of your manifest's `previews` `/solar event` is playing, counted from 1; 0 for none (§8). | at once |
| `EVENT_COUNT` | int | 0 to 4 | How many events are up, the engine's and yours, previews aside. | at once |
| `EVENT_KIND`, `EVENT_SEED`, `EVENT_SECONDS` | int[], float[], float[] | | Each event up: its number (yours are 100 and up, in your manifest's order), its seed, and its length in seconds. `themeEvent` hands you your own; read these only to draw one of yours elsewhere (§12). | at once |
| `INK_BLUE`, `INK_PINK`, `INK_YELLOW`, `INK_GREEN`, `INK_ORANGE`, `INK_VIOLET`, `INK_INDIGO` | vec3 | | The seven inks (§6). | never |

The market's prices are fetched only for a theme whose manifest says `"market": true`, at most every five minutes, and shared by every session; a new one shows from the next scene on, so prices change the shader only when the scene does anyway. Without the field every price is 0 and `sky_QUOTES_FRESH` is 0, even though the preview's `--market up` shows prices to any theme. `sky_MARKET_OPEN` and `sky_NEW_YORK_HOUR` are there for every theme. A price has five significant figures, so one of 10,000 or more has no decimals to show, one from 1,000 one, one from 100 two, and one under 100 three or more.

Beside the engine's signals, Ghostty's own `iTime` (seconds, §8) and `iResolution` (the window in pixels) are yours to read. Reach the cursor through `cursorAt()`, `glance()` and `shy()` (§5), and nothing else of Ghostty's.

The tab's mark changes at once and its states are short (a tenth just filled shows for 2.5 seconds), so show each state as a state, not as a story that needs its beginning. A theme whose manifest says `"context": "resident"` shows the context window itself, for instance as a row of things, one for each full tenth:

```glsl
// The context window as a row of up to ten jars on a shelf at `at`, one
// for each tenth that is full: the newest lit while a tenth has just
// filled, and all of them clouded while the conversation compacts.
vec3 jars(vec3 sky, vec2 p, vec2 at, float u, float k) {
  float w = 1.2 * u;
  if (p.x < at.x || p.x > at.x + 10.0 * w || p.y < at.y - 1.5 * u || p.y > at.y) return sky;
  int i = int(floor((p.x - at.x) / w));
  int full = contextFish();
  if (i >= full) return sky;
  int state = contextState();
  vec3 glass = state == CONTEXT_GAINED && i == full - 1 ? lift(INK_YELLOW, k) : lift(mix(INK_BLUE, CREAM, 0.5), k);
  if (state == CONTEXT_CLEARING) glass = mix(glass, keyInk(k), 0.5);
  return ink(sky, glass, box(p - vec2(at.x + (float(i) + 0.5) * w, at.y - 0.7 * u), vec2(0.4, 0.65) * u), 1.0);
}
```

## 5. The engine's helpers

These are defined before your text, and each line below is the engine's own. Every helper that takes `k` dims as the sky does (§9).

The sky and the time:

```glsl-signature
const float PI = 3.14159265;
const vec4 ARC = vec4(0.56, 0.95, 0.12, 0.62);                    // the sun's arc as parts of the window: left, right, top, and its foot, the horizon
struct Scene { float elevation; float progress; float isDay; };
Scene sceneNow();                                                 // the scene now; in /solar demo, the demo's day played round
float night();                                                    // how far into the night it is now: 0 by day, 1 in the dark (from -5° to -13°)
float nightness(float elevation);                                 // the same for any height of the sun
vec2 arcPoint(float progress);                                    // the pixel of the sun's arc that far along
vec2 domeToPixel(vec2 d);                                         // a point of the dome (MOON_AT, ISS_AT) as a pixel
float shootingStarAge(float time, out vec2 from);                 // seconds since the latest shooting star at `time` began, and where
```

Numbers and noise:

```glsl-signature
uint hashu(uint x);                                               // a well mixed hash of a uint
uint hashi(int n);                                                // the same of an int
float rand(int n);                                                // a number from 0 to 1 for n, the same every time
float seeded(float seed, int salt);                               // a number from 0 to 1 for an event's seed and a salt
float noise(float x, int seed);                                   // smooth 1D value noise, 0 to 1
float noise2(vec2 x, int seed);                                   // smooth 2D value noise, 0 to 1
float fbm(vec2 x, int seed, int octaves);                         // noise2 in up to four octaves, each finer and fainter, 0 to 1
```

Colour and print:

```glsl-signature
const float LUMINANCE = 0.8;                                      // the brightest the sky gets
const float SATURATION = 1.35;
const vec3 CREAM = vec3(0.9608, 0.9373, 0.8784);                  // the paper under the inks
float luminance(vec3 c);
vec3 grey(vec3 c);
vec3 vivid(vec3 c, float k);                                      // a colour pushed away from its grey by k
vec3 tone(vec3 c, float k);                                       // an ink dimmed as the sky is and saturated as the print is: for large areas
vec3 lift(vec3 c, float k);                                       // half dimmed, so that a small thing stays visible on a dimmed sky
vec3 nightInk(vec3 c, float k);                                   // a character's ink, under the indigo plate at night as Clawd in the band is
vec3 ink(vec3 sky, vec3 color, float d, float alpha);             // lays a colour where the distance d is below 0, its edge antialiased
float screen(vec2 at, float tone, float pitch, float angle);      // how much of a pixel a halftone dot covers, for a tone from 0 to 1
float pitch(float u);                                             // how far apart the halftone's dots are
vec3 keyInk(float k);                                             // the key plate's indigo
vec2 keyShift(float u);                                           // how far off register the key plate is, down and to the right
vec3 keyPlate(vec3 sky, float sdShifted, float width, float alpha, float k);  // an outline `width` either side of an edge measured at p - keyShift(u)
vec3 lamp(vec3 sky, vec2 p, vec2 at, float radius, vec3 color, float strength);  // a lamp's smooth glow round `at`, fading over `radius`
```

Shapes, as signed distances in pixels, below 0 inside:

```glsl-signature
float segment(vec2 p, vec2 a, vec2 b);                            // to the segment from a to b
float limb(vec2 p, vec2 a, vec2 b, float ra, float rb);           // a capsule from a to b, its radius running from ra to rb
float smin(float a, float b, float r);                            // two shapes' union, rounded where they meet, as a cartoon's are
float box(vec2 q, vec2 b);                                        // a box round 0, b half its size
float widthShown(float turn, float least);                        // how much of its width a thing tumbling on the air shows
vec2 tumble(vec2 q, float spin, float flip);                      // q in the frame of a thing spun by `spin` and turned over by `flip`
```

Fire and smoke:

```glsl-signature
float flame(vec2 p, vec2 foot, float h, float w, float phase);    // how much one flickering tongue of fire covers p
vec3 fire(vec3 sky, vec2 p, vec2 foot, float spacing, float tall, float wide, float pitch);  // a fire of three tongues in pink, orange and yellow
vec3 smoke(vec3 sky, vec2 p, vec2 from, float rise, float drift, float r, float rate, float strength, vec3 color, float pitch);  // a column of four puffs, screened
float steam(vec2 p, vec2 foot, float h, float w, float speed, int seed);  // how much a wavering wisp of steam covers p
```

Sprites, up to 8 by 8 cells, four bits a cell, a row a `uint`, its first cell in the lowest bits; 0 is nothing and 1 to 8 a colour of the palette:

```glsl-signature
int spriteAt(uint rows[8], ivec2 size, ivec2 c, bool flip);       // the palette index of cell c, counted from the top left
vec3 sprite(vec3 sky, vec2 p, vec2 origin, float cell, uint rows[8], ivec2 size, bool flip, vec3 palette[8], float k);  // printed lifted, the key plate a whole cell off register
```

The cursor:

```glsl-signature
vec2 cursorAt();                                                  // the terminal cursor's middle, in p's terms
float glance(vec2 at);                                            // how much a thing at `at` glints for the cursor near it, just after it moved
vec2 shy(vec2 at, float u);                                       // `at` nudged out of the cursor's way
```

The tab's mark (§4):

```glsl-signature
int contextFish();
int contextState();
const int CONTEXT_IDLE = 0;
const int CONTEXT_CLEARING = 1;
const int CONTEXT_CLEARED = 2;
const int CONTEXT_GAINED = 3;
int sky_tool();
int sky_agents();
const int sky_TOOL_NONE = 0;
const int sky_TOOL_COMMAND = 1;
const int sky_TOOL_EDIT = 2;
const int sky_TOOL_READ = 3;
const int sky_TOOL_WEB = 4;
const int sky_TOOL_OTHER = 5;
```

### Letters

A bitmap font of 3 × 5 cells for boards, signs and tapes. A glyph advances 4 cells and a line 6, so text `cell` pixels a cell is `4 × cell` pixels a character. Two pixels a cell is the least that reads in the sheets, three reads easily; size it from `u`, as `max(2.0, floor(0.19 * u))`, so that it doubles on a Retina screen.

```glsl-signature
float sky_glyph(vec2 p, vec2 origin, float cell, int code);       // 1 where glyph `code`, its top left at `origin`, is inked, else 0
float sky_line16(vec2 p, vec2 origin, float cell, int text[16]);  // a line of up to 16 glyphs; -1 or 36 is a blank
float sky_number(vec2 p, vec2 origin, float cell, float value, int width, int decimals);  // a number `width` columns wide, right-aligned
int sky_numberCode(float value, int width, int decimals, int column);  // the code in one column of such a number
bool sky_glyphCell(int code, ivec2 c);                            // whether cell c of a glyph is inked
const int sky_GLYPH_COUNT = 50;
const int sky_GLYPH_SPACE = 36;
const int sky_GLYPH_DOT = 37;
const int sky_GLYPH_COMMA = 38;
const int sky_GLYPH_COLON = 39;
const int sky_GLYPH_MINUS = 40;
const int sky_GLYPH_PLUS = 41;
const int sky_GLYPH_PERCENT = 42;
const int sky_GLYPH_SLASH = 43;
const int sky_GLYPH_DOLLAR = 44;
const int sky_GLYPH_BANG = 45;
const int sky_GLYPH_QUESTION = 46;
const int sky_GLYPH_QUOTE = 47;
const int sky_GLYPH_UP = 48;
const int sky_GLYPH_DOWN = 49;
```

The codes: `0` to `9` are 0 to 9, `A` to `Z` are 10 to 35 (as in base 36: `H` is 17, `O` 24), then space 36, `.` 37, `,` 38, `:` 39, `-` 40, `+` 41, `%` 42, `/` 43, `$` 44, `!` 45, `?` 46, `'` 47, `▲` 48 and `▼` 49. There are no lower-case letters and no `#`. A number is drawn right-aligned in `width` columns, with `decimals` (0 to 4) after a point that takes a column of its own, a minus before its first digit, and its leftmost digits cut where it does not fit. This prints the codes of a text, sixteen to a line, as the `int[16]` that `sky_line16` takes:

```sh
node -e 'const font = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .,:-+%/$!?" + String.fromCharCode(39) + "▲▼"; const codes = [...process.argv[1].toUpperCase()].map(c => font.indexOf(c)); for (let i = 0; i < codes.length; i += 16) console.log(`int[16](${[...codes.slice(i, i + 16), ...Array(16).fill(36)].slice(0, 16).join(", ")})`)' "HELLO WORLD!"
```

A line of text, a price with its day's change, and a tape that slides past:

```glsl
// HELLO WORLD! in yellow on the stage, 40 % of the way down.
vec3 hello(vec3 sky, vec2 p, float u, float k) {
  float cell = max(2.0, floor(0.19 * u));
  vec2 at = vec2(iResolution.x - STAGE_PX + u, 0.4 * iResolution.y);
  return mix(sky, lift(INK_YELLOW, k), sky_line16(p, at, cell, int[16](17, 14, 21, 21, 24, 36, 32, 24, 27, 21, 13, 45, 36, 36, 36, 36)));
}

// A symbol's price and its change today at `at`, the change green up and
// pink down with its arrow, or dashes while the price is not known.
vec3 quote(vec3 sky, vec2 p, vec2 at, float cell, int symbol, float k) {
  if (p.x < at.x || p.y < at.y || p.x > at.x + 60.0 * cell || p.y > at.y + 5.0 * cell) return sky;
  float price = sky_QUOTE_PRICE[symbol];
  if (price <= 0.0) return mix(sky, lift(CREAM, k), sky_line16(p, at, cell, int[16](40, 40, 40, 40, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36)));
  float change = sky_QUOTE_CHANGE[symbol];
  sky = mix(sky, lift(CREAM, k), sky_number(p, at, cell, price, 7, price < 1000.0 ? 2 : price < 10000.0 ? 1 : 0));
  vec3 way = lift(change < 0.0 ? INK_PINK : INK_GREEN, k);
  sky = mix(sky, way, sky_glyph(p, at + vec2(32.0 * cell, 0.0), cell, change < 0.0 ? sky_GLYPH_DOWN : sky_GLYPH_UP));
  return mix(sky, way, sky_number(p, at + vec2(36.0 * cell, 0.0), cell, change, 6, 2));
}

// A line sliding left across a band at `y`, from `left` for `width`, at
// `speed` cells a second, and round again once it has gone: 1 where inked.
float tape(vec2 p, float y, float left, float width, float cell, float speed) {
  if (p.y < y || p.y >= y + 5.0 * cell || p.x < left || p.x > left + width) return 0.0;
  float x = left + width - mod(iTime * speed * cell, width + 64.0 * cell);
  return sky_line16(p, vec2(x, y), cell, int[16](17, 14, 21, 21, 24, 36, 32, 24, 27, 21, 13, 45, 36, 36, 36, 36));
}
```

For a board of many lines, work out which line `p` is on (`floor((p.y - top) / (6.0 * cell))`) and draw only that one, rather than every line at every pixel. To make text change, choose its codes by a constant or by time (a board that turns over each minute picks its line by `int(mod(floor(iTime / 60.0), 4.0))`); a split-flap turn is a few frames of other codes before the new ones.

## 6. The house style

The sky is a risograph print: a few inks laid on cream paper through halftone screens, the key plate a little off register. Your world is printed the same way, and a theme that is not looks pasted on.

- **The inks.** `INK_BLUE` (#0078bf), `INK_PINK` (#ff48b0), `INK_YELLOW` (#ffe800), `INK_GREEN` (#00a95c), `INK_ORANGE` (#ff6c2f), `INK_VIOLET` (#765ba7) and `INK_INDIGO` (#2e3192), on the paper, `CREAM` (#f5efe0). Mix every colour from them, as a printer gets one by printing inks over inks: Clawd's coral is orange printed thin on cream with a breath of indigo, `mix(mix(INK_ORANGE, CREAM, 0.15), INK_INDIGO, 0.1)`; wood is orange over indigo, `mix(INK_ORANGE, INK_INDIGO, 0.35)`; red is pink over orange, `mix(INK_PINK, INK_ORANGE, 0.45)`. A flat colour from elsewhere (a grey of your own, a web colour) shows at once as not printed; only small lights may be their own colour.
- **Tones are dots.** Shading and gradients on things are halftone, `screen(p, tone, pitch(u), angle)`, each ink at its own angle: blue 15°, pink 75°, yellow 0°, green 45°, orange 45°, violet 30°, indigo 60°. Shade a thing by screening a deeper mix of its own ink over it: `mix(color, mix(color, INK_INDIGO, 0.35), screen(p, shade, pitch(u), 45.0))`, and give a lamp its glow in dots (§9). A soft gradient on a thing looks like another picture. Where a large plain area meets the far sky (the sea, the ground at the horizon) it may fade into it smoothly, as fyr's sea does, and behind the terminal's text a smooth fade reads better than dots (§9).
- **The key plate.** An indigo outline a little down and to the right of where it should be: round a shape, `keyPlate(sky, distance at p - keyShift(u), 0.05 * u, 0.6, k)`; under a pixel character, the whole grid again, `max(1.0, floor(0.4 * cell))` pixels down and to the right, at 0.55 (§7).
- **No black.** The darkest there is is indigo printed thick, `tone(INK_INDIGO, k) * 0.55`.
- **The night is an indigo plate, not a dimmer.** Darken what stands outside by `1.0 - 0.6 * night()` and lay characters under the indigo plate with `nightInk`; what is lit (lamps, windows, the waiting light) stays lit.
- **The far is hazy.** Mix what stands far off toward the sky, `mix(color, sky, 0.3)`, darker by night; keep the near clear.
- **Small things lifted.** `tone(c, k)` for large areas, `lift(c, k)` for small things, so they stay visible when the sky is dimmed.

### Clawd

Clawd is the character of the band and of the sky, and a theme's resident is a Clawd. He is six cells across and four down, as the band draws him standing:

```text-clawd
.OOOO.
.KOOK.
OOOOOO
.O..O.
```

`O` is his coral, `K` his eyes in indigo. His legs are shaded a deeper coral, `mix(CORAL, INK_INDIGO, 0.22)` with the template's `CORAL` (the band dots it over every other pixel of them; at a theme's cell size a solid deeper coral reads the same), outdoors he is under the indigo plate at night (`nightInk`) while indoors the room's lamps light him (`lift`, §9), and his key plate is a pixel or so off register down and to the right. The band also draws him looking left (`.KOKO.`) or right (`.OKOK.`), with his eyes shut in the deeper coral (`.kOOk.`), with his arms up (the arm row `.OOOO.`, and an `O` above each end of his head, `O....O`), and walking (his legs `O...O.` and `.O...O` by turns). Draw him with a grid function, as the keeper in §7 and the template's `clawd()` are drawn. He may wear things (a hat, glasses, a jumper over his arms), and others may stand beside him in other inks, but he stays a coral box with two eyes, his arms the whole width and two legs. A prop in front of him (a counter, a desk) may hide his legs; his head, eyes and arm row show.

**His size.** At the template's cell of `max(1.0, floor(0.25 * u))` he is 24 × 16 pixels in the sheets, the least that reads, and right beside a lamp post on open ground. Beside larger props size him from them, as fyr sizes its keeper from the lighthouse, so that he stands as tall as a person would among them: indoors behind a counter or at a desk that is a cell of about `0.35 * u` to `0.5 * u` (5 to 8 pixels in the sheets). Look at him in frame 01 at its own size: if you have to search for him, he is too small.

## 7. Worked examples

Six things from the engine and from fyr, each with what to take from it. The excerpts are the code as it stands, with `// …` where lines are left out; what they call and do not show is fyr's own or the engine's. The names taken are the reserved ones (§3) and those starting with `sky_`: the engine's `balloon`, `plane` and the rest among them. Fyr's own names and the guide's examples are not taken, since only one theme is compiled at a time, and you may use them; take a name for what it means in your world, not for what it meant in fyr's.

### The balloon: a thing in the sky, printed

An engine event that crosses the sky in front of the clouds:

```glsl-engine
vec3 balloon(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  float r = 2.2 * u;
  vec2 c = vec2(mix(-0.1, 1.1, t) * iResolution.x, iResolution.y * (0.22 + 0.2 * seeded(seed, 1)) - t * 3.0 * u + sin(iTime * 0.5) * 0.3 * u);
  vec2 q = p - c;
  if (abs(q.x) > 2.0 * r || q.y < -1.6 * r || q.y > 2.4 * r) return sky;
  // The envelope: a ball tapering to its mouth; the basket under it.
  float ball = length(q / vec2(1.0, 1.15)) - r;
  float fall = q.y / (1.7 * r);
  float shoulder = q.y > 0.0 && q.y < 1.55 * r ? r * (1.0 - fall * fall) : 0.0;
  float taper = shoulder > 0.0 ? abs(q.x) - shoulder : 1e9;
  float envelope = min(ball, taper);
  // How wide the envelope is at this height, so the gores follow its curve.
  float across = max(r * sqrt(max(0.0, 1.0 - pow(q.y / (1.15 * r), 2.0))), shoulder);
  // …
  // Gores in three inks, the seed choosing their order; shaded to the right.
  // Never below 0: % of a negative int is undefined in GLSL.
  int gore = max(int(floor((q.x / max(across, 0.01) + 2.0) * 3.0)), 0) + int(seed);
  // …
  vec3 color = gores[gore % 3];
  color = mix(color, mix(color, INK_INDIGO, 0.35), screen(p, clamp(q.x / r * 0.6 + 0.2, 0.0, 1.0), pitch(u), 45.0));
  sky = ink(sky, lift(color, k), envelope, 1.0);
  sky = ink(sky, lift(mix(INK_ORANGE, INK_INDIGO, 0.4), k), min(basket, ropes), 1.0);
  // The key plate, a little off register.
  return keyPlate(sky, length((q - keyShift(u)) / vec2(1.0, 1.15)) - r, 0.08 * u, 0.7, k);
}
```

What to take from it: once it knows where it is, it tests the box round it before anything else, so that every pixel outside the balloon is done after four compares (§10). Its shape is distances joined with `min` and laid with `ink`. Its inks are chosen by an index kept above 0, since `%` of a negative int is undefined. It is shaded by screening a deeper mix of its own ink at 45°, its inks are lifted, and its key plate is the same shape measured at `q - keyShift(u)`. Where it is comes from `t` and its seed, so every moment of its crossing is one you can draw.

### The plane: the same thing by day and by night

An airliner crossing high up, drawn in its own frame, along its course and across it:

```glsl-engine
  vec2 dir = normalize(b - a);
  vec2 n = vec2(-dir.y, dir.x);
  // …
  vec2 d = p - at;
  vec2 q = vec2(dot(d, dir), dot(d, n));
  if (abs(q.x) > 2.0 * s || abs(q.y) > 2.0 * s) return sky;
  float frame = airframe(q, s);
  float engines = limb(vec2(q.x, abs(q.y)), vec2(0.55, 0.6) * s, vec2(0.0, 0.6) * s, 0.12 * s, 0.1 * s);
  if (isNight) {
    sky = ink(sky, NIGHT_INK, min(frame, engines), 0.9);
    // Red on one wingtip, green on the other, a white strobe at the tail.
    vec2 tip = vec2(-0.5, 1.65) * s;
    sky = ink(sky, vec3(1.0, 0.25, 0.2), length(q - vec2(tip.x, -tip.y)) - 0.12 * u, 1.0);
    sky = ink(sky, vec3(0.3, 1.0, 0.5), length(q - tip) - 0.12 * u, 1.0);
    return ink(sky, vec3(1.0), length(q - vec2(-1.55 * s, 0.0)) - 0.14 * u, step(0.85, fract(iTime * 0.8)));
  }
  // The underside pale, screened darker to one side; the engines in the
  // seed's ink.
  vec3 belly = mix(vec3(0.97, 0.96, 0.93), INK_BLUE, 0.08);
```

What to take from it: rotate `p` into the thing's own frame with two dot products, and draw it there as if it flew along x. By night it is not the day's plane made darker but another drawing: a dark silhouette and its lights, which is what you would see. Lights are the one place for colours outside the inks, and a strobe is a short flash, `step(0.85, fract(iTime * 0.8))`, that a still frame mostly does not catch, so it carries nothing the frame needs. (`NIGHT_INK` is the events' own: write your own night silhouette from indigo.)

### The dolphin: an event that happens again and again

fyr's event, in front of the clouds, a minute of dolphins leaping, each leap different:

```glsl-fyr
vec3 dolphin(vec3 sky, vec2 p, float u, float seed, float k, bool isPink) {
  // A little way out from the horizon, nearer than the lighthouse.
  Lighthouse l = lighthouse(u);
  float level = (ARC.w + 0.03) * iResolution.y;
  float period = 7.0;
  float air = 1.6;
  float clock = iTime + seed;
  int n = int(floor(clock / period));
  float local = mod(clock, period);
  float s = 0.7 * l.s;
  float span = 3.4 * s;
  float side = rand(n * 17 + 3) < 0.5 ? 1.0 : -1.0;
  float x0 = l.x - (5.4 + 1.0 * rand(n * 31 + int(seed))) * l.s - side * span * 0.5;
  if (abs(p.x - x0 - side * span * 0.5) > span + 2.0 * s || abs(p.y - level) > 4.0 * s) return sky;
  sky = splash(sky, p, vec2(x0, level), local, s, u, k);
  sky = splash(sky, p, vec2(x0 + side * span, level), local - air, s, u, k);
  if (local >= air || p.y > level) return sky;
  float f = local / air;
  float rise = 2.4 * s;
  vec2 at = vec2(x0 + side * span * f, level - 4.0 * f * (1.0 - f) * rise);
  vec2 vel = normalize(vec2(side * span, -(1.0 - 2.0 * f) * 4.0 * rise));
  // Its back up, whichever way it swims.
  vec2 back = side * vec2(vel.y, -vel.x);
  vec2 d = p - at;
  float beat = sin(local * 12.0);
  vec2 b = dolphinBend(vec2(dot(d, vel), dot(d, back)) / s, beat);
  float shape = dolphinShape(b) * s;
  // …
  sky = ink(sky, color, shape, 1.0);
  // The key plate a little off register, round the whole of it.
  vec2 off = d - vec2(0.1, 0.08) * u;
  vec2 b2 = dolphinBend(vec2(dot(off, vel), dot(off, back)) / s, beat);
  sky = keyPlate(sky, dolphinShape(b2) * s, 0.05 * u, 0.6, k);
  // …
}

// The theme's events: the dolphin (0) and the pink one (1), both in front
// of the clouds.
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) {
  if (isBehind || kind > 1) return sky;
  return dolphin(sky, p, u, seed, k, kind == 1);
}
```

What to take from it: inside its minute the event keeps a clock of its own, `iTime + seed`, cut into leaps of seven seconds; the leap's number `n` picks its side and its place by hash, so each leap is new and every moment of `iTime` is either a leap or the water between two. The box test covers the leap and both splashes. The body is drawn in its own frame along its motion, a cartoon of limbs joined with `smin`, and its key plate is the same body measured at a shifted point. `themeEvent` hands each kind to its drawing in the pass its layer names.

### The keeper: a character as a grid

fyr's resident, a small Clawd. His cell size, and the grid that says what each cell of him is, by his pose:

```glsl-fyr
// The size of one cell of him, in whole pixels, for the lighthouse's unit.
float keeperCell(float s) { return max(1.0, floor(0.13 * s)); }
// …
int keeperGrid(ivec2 c, int pose, int stride) {
  // …
  // An arm up: holding binoculars to his eyes, pointing up and out,
  // waving, up and out by turns, or holding his tongs over the grill.
  bool isArmUp = pose == POSE_GAZE || pose == POSE_POINT || pose == POSE_WAVE || pose == POSE_GRILL;
  if (isArmUp && c == ivec2(5, 1)) return 1;
  // …
  if (c.x < 0 || c.x > 5 || c.y < 0 || c.y > 3) return 0;
  bool isLooking = pose == POSE_LOOK;
  // Head, and a hand up to his brow as he looks out.
  if (c.y == 0) return (c.x >= 1 && c.x <= 4) || (isLooking && c.x == 5) ? 1 : 0;
  // Face: eyes to the front standing, else the way he faces.
  if (c.y == 1) {
    if (c.x < 1 || c.x > 4) return 0;
    return c.x == 4 || c.x == (pose == POSE_STAND ? 1 : 2) ? 2 : 1;
  }
  // …
  // Legs: wide on the board, apart as he walks, one step and then the other.
  if (pose == POSE_SURF) return c.x == 0 || c.x == 5 ? 3 : 0;
  if (pose == POSE_WALK) return c.x == (stride == 0 ? 0 : 1) || c.x == (stride == 0 ? 4 : 5) ? 3 : 0;
  return c.x == 1 || c.x == 4 ? 3 : 0;
}

// Him at p: the cell's kind, the grid's origin at his top left, mirrored
// when he faces left.
int keeperGridAt(vec2 p, vec2 origin, float c, Keeper kp, int stride) {
  ivec2 cell = ivec2(floor((p - origin) / c));
  if (kp.facing < 0.0) cell.x = 5 - cell.x;
  return keeperGrid(cell, kp.pose, stride);
}
```

And him drawn, his stride from the clock, his key plate the grid again:

```glsl-fyr
  vec2 origin = floor(at - vec2(3.0 * c, 4.0 * c) + 0.5);
  if (p.x < origin.x - 2.0 * c || p.x > origin.x + 8.0 * c || p.y < origin.y - c || p.y > origin.y + 5.0 * c) return sky;
  int stride = int(floor(iTime * (kp.pose == POSE_PADDLE || kp.pose == POSE_WAVE ? 1.5 : 3.0))) % 2;
  int cell = keeperGridAt(p, origin, c, kp, stride);
  // …
  if (cell != 0) return mix(sky, cell == 2 ? eye : cell == 3 ? legs : body, 0.97);
  // The key plate, off register.
  float off = max(1.0, floor(0.4 * c));
  if (keeperGridAt(p - vec2(off), origin, c, kp, stride) != 0) sky = mix(sky, keyInk(k), 0.55);
  return sky;
```

What he does is decided in one place, by precedence, and everything else asks it:

```glsl-fyr
// What he is about at `time`, by precedence: at the lantern while it is
// lit, then a surf, then asleep, then the night (an aurora before a full
// moon before the stars), else his day.
int keeperMode(float time) {
  if (WAITING != 0) return MODE_LANTERN;
  if (surfTime(time) >= 0.0) return MODE_SURF;
  if (CLAWD_ASLEEP > 0.5) return MODE_HAMMOCK;
  float darkness = night();
  if (darkness <= 0.6) return MODE_DAY;
  if (AURORA * darkness > 0.3) return MODE_AURORA;
  return MOON_UP > 0.5 && MOON_ILLUMINATION > 0.95 ? MODE_MOON : MODE_STARS;
}
```

The door in his tower opens as he passes, its leaf narrowing as it swings toward you:

```glsl-fyr
  // The leaf, narrower as it swings open, and the dark inside beside it.
  float edge = 2.0 * w * cos(open * 0.5 * PI) - w;
  sky = ink(sky, v.x < edge ? mix(sky, indigo, 0.85) : tone(INK_INDIGO, k) * 0.55, d, 1.0);
  // The leaf's edge against the dark, in the key plate.
  if (open > 0.0) sky = ink(sky, keyInk(k), max(d, abs(v.x - edge) - 0.5), 0.5);
```

What to take from it: a character is a function from a cell to what is printed there, cells of whole pixels so he stays crisp, his poses rules over the cells, his facing a mirrored `x`, his stride a whole number from the clock. His origin is floored to a pixel. His key plate is his grid asked again a pixel or so up and to the left of `p`, so it falls down and to the right of him. What he is about is one function of the time, by precedence, the waiting light first: his place, his pose, his door and the rest all ask it, so they never disagree. A door, a hatch or a sign that moves is a value from 0 to 1 the character's state gives.

### The UFO: a rare moment the theme schedules itself

fyr's preview: a visit, now and then, and every minute while `/solar event ufo abduction` plays it:

```glsl-fyr
// A visit lasts this many seconds, from the saucer gliding in to it gone.
const float ABDUCTION = 31.5;
// …
float abductionStart(float slot, float period) {
  if (THEME_FORCE == 1) return slot * period;
  int n = int(mod(slot, 100000.0));
  if (DEMO_COUNT > 0 || rand(n * 5 + 3) >= 0.7) return -1.0;
  float earliest = slot * period + rand(n * 5 + 4) * (period - 40.0);
  // …
}

// The UFO at `time`, scheduled by the shader itself as the shooting stars
// are, so that any moment of iTime shows a visit from its start: one slot
// a night's half hour, or a day's hour and a half; forced, every minute,
// so that a 90 s preview shows a whole visit, mostly from its start.
// Before this slot's has come, the one before's may still be on (a visit
// put off past a surf can run over into the next slot). Gliding in from
// above the strip's top right (0 to 4 s), its beam on (4 to 5), lifting
// him smoothly up into it (5 to 10), him inside (10 to 25), the hatch open
// and out he drops, a bounce where he was taken (25 to 26.5), and away to
// the top left (27.5 to 31.5).
Abduction abductionAt(float time, Lighthouse l) {
  Abduction a = Abduction(false, -1.0, vec2(0.0), 0.0, 0.0, false);
  float period = THEME_FORCE == 1 ? 60.0 : (night() > 0.6 ? 1800.0 : 5400.0);
  float slot = floor(time / period);
  float start = -1.0;
  for (int i = 0; i < 2; i++) {
    start = abductionStart(slot - float(i), period);
    if (start >= 0.0 && start <= time && time < start + ABDUCTION) break;
    start = -1.0;
  }
  if (start < 0.0) return a;
  float s = l.s;
  float age = time - start;
  vec2 at = keeperAt(start, l).at;
  // …
  a.beam = smoothstep(4.0, 5.0, age) * (1.0 - smoothstep(10.0, 11.0, age));
  a.isInside = age >= 10.0 && age < 25.0;
  // …
  return a;
}
```

What to take from it: a moment the theme schedules itself is a slot of time (`period` seconds), a chance and a start within the slot, both from the slot's hash, so every pixel and every frame agree on it with nothing stored. Look in this slot and the one before, since a moment can run over the edge between them. Its story is a timeline of `age`, each phase a span of seconds. Where it happens comes from the state at its start (`keeperAt(start, l)`), so it does not wander as the character's day goes on. Played, it comes every minute from the minute's start; in a demo's time-lapse, never. §8 has the idiom on its own.

### The surf: a moment woven into a character's day

```glsl-fyr
bool isSurfLoop(float n) {
  if (THEME_FORCE != 0) return THEME_FORCE == 2;
  return PRECIPITATION == 0 && rand(int(n) * 19 + 41) < 0.1;
}
// …
// Seconds into his surf at `time`, or -1 when he isn't surfing: never with
// the lantern lit, and not asleep or at night unless it is forced.
float surfTime(float time) {
  if (WAITING != 0) return -1.0;
  if (THEME_FORCE == 2) return mod(time, SURF_LOOP);
  if (CLAWD_ASLEEP > 0.5 || night() > 0.6) return -1.0;
  float n = floor(time / DAY_LOOP);
  float t = time - n * DAY_LOOP;
  return t < SURF_LOOP && isSurfLoop(n) ? t : -1.0;
}
```

What to take from it: the keeper's day goes round every 90 seconds, and about one round in ten, by the round's hash, its first 40 seconds are a surf instead of fishing. The weather, the waiting light, sleep and the night all have their say before the hash does. Forcing one preview (`THEME_FORCE == 2`) makes every round a surf, and forcing the other makes none, so the two never meet. fyr chose the hash's salt so that none of the first eight rounds is a surf: a Ghostty just opened does not start on the rare thing.

## 8. Time

`iTime` is Ghostty's clock: seconds, running on through every reload, from a start your theme cannot know (when Ghostty drew its first frame, perhaps days ago). Nothing tells a theme when anything began, and it keeps nothing from one frame to the next. So:

- **Every moment is a still.** While nothing lively is up, the sky does not animate: Ghostty draws a frame only when the terminal changes, at whatever `iTime` that is, and under the default pace that is most of the time. A frame at any `iTime` must be a finished moment of your world: no half-built state, no blink that leaves the waiting light dark, no character caught between two places in a way that reads as a glitch. Motion is a gift on top; the still carries the meaning.
- **Nothing your theme does makes the sky lively.** The engine animates the sky for its own reasons: an event up (your manifest's events count), rain or snow, the grill, a demo, Claude freshly waiting. Your characters walking about, your previews and the moments you schedule do not: they show in whatever frames are drawn.
- **Keep numbers from `iTime` small.** Take a phase as `fract(iTime / period)` or `mod(iTime, period)` and a step as `int(floor(iTime * rate)) % 2`. Hash a slot as `int(mod(slot, 100000.0))`: `iTime` can be large, and an `int` made from it and multiplied overflows.
- **Constants jump.** The scene's constants change about every two minutes with a reload, and `iTime` does not start over, so a change cannot be eased in: a light switches, a sign turns over, a crowd thins, all at once, between one scene and the next. Make every state of a constant look right on its own.
- **`/solar demo` plays a day in 48 seconds.** `sceneNow()` and `night()` follow it; `ELEVATION`, `IS_DAY` and `LOCAL_HOUR` do not. Light your world by `night()` and it plays through a demo too.

The engine's shooting stars and fyr's UFO are scheduled the same way: time cut into slots, a moment in a slot by the slot's hash, and the slot before looked at too, since a moment can run over the edge.

```glsl-engine
float shootingStarAge(float time, out vec2 from) {
  float period = 3600.0 / SHOOTING_RATE;
  float slot = floor(time / period);
  float start = 0.0;
  int n = 0;
  for (int i = 0; i < 2; i++) {
    n = int(mod(slot, 100000.0));
    start = slot * period + rand(n * 3 + 1) * max(0.1, period - 1.2);
    if (start <= time) break;
    slot -= 1.0;
  }
  from = iResolution.xy * vec2(0.1 + 0.8 * rand(n * 3 + 2), 0.05 + 0.35 * rand(n * 3 + 3));
  return time - start;
}
```

The idiom on its own, to copy:

```glsl
// When the moment of slot `slot` begins, `period` seconds a slot: one in a
// slot with a chance of `chance`, at a moment that leaves it `lasts`
// seconds; -1 for a slot without one.
float momentStart(float slot, float period, float lasts, float chance, int salt) {
  int n = int(mod(slot, 100000.0)) * 7 + salt;
  if (rand(n) >= chance) return -1.0;
  return slot * period + rand(n + 1) * (period - lasts);
}

// Seconds into the moment at `time`, -1 when none is on: this slot's, or
// the one before's still running. Played (THEME_FORCE), one every minute
// from the minute's start, so a 90 s preview shows a whole one.
float momentAge(float time, float period, float lasts, float chance, int salt) {
  if (THEME_FORCE == 1) return mod(time, 60.0) < lasts ? mod(time, 60.0) : -1.0;
  float slot = floor(time / period);
  for (int i = 0; i < 2; i++) {
    float start = momentStart(slot - float(i), period, lasts, chance, salt);
    if (start >= 0.0 && start <= time && time < start + lasts) return time - start;
  }
  return -1.0;
}
```

Call it with `iTime`; when it is not -1, its result is the age that picks the phase of your moment's story, as the UFO's timeline does. Where the moment happens should come from the state at its start (`iTime - age`), not from now.

**Previews.** A preview is a moment your theme schedules itself, listed in the manifest's `previews` so that `/solar event <word>` can play it: for 90 seconds `THEME_FORCE` is its place in the list, counted from 1. While it is, make your schedule play the moment at once and often (every minute from the minute's start, as above), and keep the other previews and rare things out of its way. The sheet draws each preview at `--time` 24.8 by day and at 88 and 126 by night: a moment of 30 seconds or more that starts every minute shows in all three.

**Events** from your manifest are scheduled by the engine (§12): their `t` runs from 0 to 1 through their length and starts over, and a played event lasts 90 seconds, so `t` crosses its whole range in 90 seconds then. Like everything else, every value of `t` must be a moment.

## 9. Light

**`k` and `LUMINANCE`.** The engine keeps the sky's brightest point at `LUMINANCE` (0.8), so that the terminal's light text stays readable over it, and `k` is how much it dimmed the sky to do so: 1 nearly always, less in a bright sunset. `tone(c, k)` dims an ink the same way and saturates it as the print does: use it for large areas. `lift(c, k)` dims half as much: use it for small things, which would vanish if dimmed with the sky.

**The night is yours to draw.** `k` does not darken your world at night. `night()` is 0 by day and 1 in the dark: darken what stands outdoors by `1.0 - 0.6 * night()`, put characters outdoors under the indigo plate with `nightInk`, and let things far off take the sky's colour. What is lit stays lit: lamps, windows, screens and the waiting light are the brightest things in your world at night.

**Lamps.** A light's glow is halftone, like every tone: `mix(sky, color, screen(p, strength * exp(-d / reach), pitch(u), angle))`. `screen` draws nothing under a tone of 0.01, so the glow ends at `d = reach * ln(100 * strength)`: make your box test that wide, or its edge shows as a cut. `lamp()` is the same glow smooth, for a light seen through haze.

**Interiors.** A room is lit by its own lamps, not by the sky. Do not darken it with `night()` as you do the outdoors: keep it lit, warmer at night if you like, and dark (indigo, never black) only when its lamps are off. A character inside is lit by the room too: draw him with `lift`, not `nightInk`, or with a weaker plate if the room is dim. Through its windows the real sky shows. The idiom after §12 puts it together.

**The brightness check.** The terminal's light text stays readable because the sky is never lighter than `LUMINANCE` and the engine darkens a thin rim round each glyph. Everything you draw left of the stage is behind text, and a real session fills that side from top to bottom: keep it no lighter than the sky beside it, in calm, plain tones, with no large light areas and no fine bright pattern; `CREAM` and white only in small marks. Look at it with text over it: `tools/preview/run.sh shader --theme themes/<name> --stage <stagePt> --at 2026-10-26T13:00 --prose` fills the window below its top third with paragraphs of text, and the first two (light and grey) must read as easily over your world as over the bare sky; do it again at `--at 2026-10-24T22:00`. On the stage, where no text goes, you may be as light as the inks allow, but the waiting light must still stand out (§11).

## 10. Cost

Every one of your functions runs for every pixel of the window, every frame: 1.5 million pixels in the sheets, 6 million on a Retina screen, up to 24 times a second. The sky is paid for out of the battery and the GPU's heat, so a theme has a budget: in the bench (below) it may cost at most 1.25 times what fyr costs.

- **The box test first.** Every function that draws a thing starts by returning `sky` for every pixel outside the box round it, before it works anything out: most pixels must be done after a compare or two. A function for the whole stage starts with `if (p.x < stageLeft) return sky;`.
- **Loops are short and inside the box.** The lint caps a loop at 97 turns and nesting at two, but a loop of 8 run for every pixel of the window is eight times the work. Loop only where the box test has let `p` in, and over the few things that can reach `p`, never over all of them.
- **Never loop over instances.** Windows in a wall, tiles on a floor, seats in a row, a crowd: cut the area into cells, find the one cell `p` is in, and let that cell's hash say what is there. Each pixel then pays for one window or one person, however many there are. If a thing can reach over its cell's edge, make the cell bigger than the thing, or look at one neighbour as well.
- **Share the work.** Work a thing's state out once per call (a struct, as fyr's `Lighthouse` and `Keeper` are) and pass it on, rather than asking for it again in every helper.
- **`fbm`, `fire` and `smoke` loop** (four, nine and four turns): keep them inside small boxes.

Windows in a wall, each lit by its own hash, more of them at night:

```glsl
// The windows of a wall, one in each cell of a grid over `area` (left,
// top, right, bottom), lit by night as each one's hash says: no loop over
// them, each pixel asks the one cell it is in.
vec3 litWindows(vec3 sky, vec2 p, float u, float k, vec4 area) {
  if (p.x < area.x || p.y < area.y || p.x > area.z || p.y > area.w) return sky;
  vec2 size = vec2(1.6, 2.2) * u;
  vec2 c = floor((p - area.xy) / size);
  if (box(p - area.xy - (c + 0.5) * size, vec2(0.45, 0.6) * u) > 0.0) return sky;
  bool isLit = rand(int(c.x) * 131 + int(c.y) * 17 + 5) < 0.1 + 0.6 * night();
  return mix(sky, isLit ? lift(INK_YELLOW, k) : keyInk(k), 0.85);
}
```

A row of Clawds, each in a jumper of his own, drawn with the template's `clawdCell` (§15) and a `clawd()` that takes the jumper's ink:

```glsl
// Clawd as the template's clawd() draws him, his arms in a jumper of `jumper`.
vec3 clawdIn(vec3 sky, vec2 p, vec2 feet, float cell, vec3 jumper, float k) {
  vec2 origin = floor(feet - vec2(3.0 * cell, 4.0 * cell) + 0.5);
  if (p.x < origin.x - cell || p.x > origin.x + 7.0 * cell || p.y < origin.y - cell || p.y > origin.y + 5.0 * cell) return sky;
  ivec2 c = ivec2(floor((p - origin) / cell));
  int kind = clawdCell(c);
  if (kind == 1) return mix(sky, nightInk(c.y == 2 ? jumper : CORAL, k), 0.97);
  if (kind == 2) return mix(sky, keyInk(k), 0.97);
  if (kind == 3) return mix(sky, nightInk(mix(CORAL, INK_INDIGO, 0.22), k), 0.97);
  float off = max(1.0, floor(0.4 * cell));
  if (clawdCell(ivec2(floor((p - vec2(off) - origin) / cell))) != 0) sky = mix(sky, keyInk(k), 0.55);
  return sky;
}

// A row of Clawds standing on `ground` from x0 to x1, one in each slot its
// hash fills, each in a jumper of his own: p asks only the slot it is in,
// so a row of fifty costs what one Clawd does.
vec3 crowd(vec3 sky, vec2 p, float u, float k, float x0, float x1, float ground) {
  float cell = max(1.0, floor(0.25 * u));
  float slot = 9.0 * cell;
  if (p.x < x0 || p.x > x1 || p.y < ground - 6.0 * cell || p.y > ground + 2.0 * cell) return sky;
  int i = int(floor((p.x - x0) / slot));
  if (rand(i * 7 + 3) > 0.7) return sky;
  vec3 jumpers[4] = vec3[4](INK_BLUE, INK_GREEN, INK_VIOLET, INK_PINK);
  vec3 jumper = jumpers[int(hashi(i * 13 + 5) % 4u)];
  return clawdIn(sky, p, vec2(x0 + (float(i) + 0.5) * slot, ground), cell, jumper, k);
}
```

Rows further back stand higher and may be smaller; give each row its own salt so that they do not line up.

**The bench.** `tools/preview/run.sh shader --theme themes/<name> --stage <stagePt> --at 2026-10-26T13:00 --bench 200` draws 200 frames with your theme, then with no theme (`none`) and with fyr, each with the same flags (an `--event` or `--waiting` you pass is in all three), and prints what each costs. Your theme's cost is its frame less `none`'s; fyr's is fyr's frame less `none`'s; `ratio to fyr = …` is the first over the second. It must be 1.25 or less, for the command as written above. It runs on the CPU (SwiftShader), takes a minute or two, and is noisy on a busy machine: measure on a quiet one, and when it comes within 0.25 of 1.25 run it three times and take the middle one, since fyr's own cost moves by a quarter between runs and scenes. A theme that costs next to nothing can come out a little below 0, which is the noise. Bench the busiest scene your theme has as well (your crowd at its fullest, your events up with `--event`).

## 11. The waiting light

Claude Code often waits on the person, and the person is often looking at something else. The waiting light is how the sky tells them, from the corner of their eye, and it is the one part of a theme that must work.

- **Asking** (`WAITING` 1): Claude needs an answer before it can go on, a permission or a question. Nothing happens until the person comes. Orange, the colour that says "you are needed", as fyr's lantern turns orange.
- **Done** (`WAITING` 2): Claude has finished its answer, and it is the person's turn when they like. White, calm, steady: news, not an alarm. It goes out once the person is back in Ghostty or sends a prompt.
- **Urgent** (`WAITING_URGENT` 1, only while asking): a question has waited two minutes. The same orange, hurrying: quicker, larger, stronger.
- **Nothing** (`WAITING` 0): the light is out, and the place it lives still shows (a dark lamp, an unlit sign), so that the person learns where to look.

The waits of every session are shown in every tab, the most pressing one, and the light goes out after half an hour. For the first five minutes of a wait the sky animates even with Ghostty in the background; after that it stands still while still showing the wait, so the light must read in a still frame: lit means lit in every frame, and motion (a beam turning, a pulse) only adds to it.

Good: one light, in a place on the stage that never changes, large enough to see at a glance (a lamp of a unit or more across, a beam, a lit sign), orange and white that nothing else in your world is mistaken for, with urgent plainly more in a still frame too (a larger glow, a second light). fyr lights its lantern and turns its beam; the template lights a lamp on a post.

Bad: a light a few pixels across; an orange that your world is full of anyway; a blink that is off half the time, so that a still may show nothing; a light only one character carries about, so that it is behind something or off the stage; asking and done told apart only by speed; a light that also comes on for other reasons.

Characters may answer the light too (fyr's keeper climbs to the lantern while it is lit), but the light comes first and must read on its own.

## 12. Your own events

Your manifest's `events` are scheduled by the engine: in each slot of `slotMinutes`, with the chance `chance`, at a moment its hash picks, for `minutes`, while `when` holds. While one is up, the band names it by its word, the engine animates the sky for it, and `themeEvent` is called for it with `kind` its place in your `events`, its `seed`, and `t` from 0 to 1 through it, looping. `/solar event <word>` plays one for 90 seconds whatever `when` says, and the sheet draws each of them at three moments (§13).

- Keep them rare and short: together no more than 8 % of the time.
- Draw each in the pass its `layer` says. `"front"` is drawn after the clouds, and only where `themeWindow` is above 0: an event in the open. `"behind"` is drawn before the clouds and before your `scenery`, so your ground covers it: something far off in the sky.
- Previews are not events: your theme schedules them itself from `iTime` and the engine only says, through `THEME_FORCE`, when one is being played (§8). Use them for the rare moments of your characters' lives that need the whole stage, as fyr's UFO does.
- Every value of `t` and every `seed` must draw a moment worth seeing. An event starts and ends with a reload, at whatever `t` the clock gives then, so it appears and goes all at once: do not count on its beginning being seen, and make every `t` a fine moment to appear at.

An event inside a room, where `themeWindow` is 0, would show in neither pass. Draw it from `resident` instead, which may ask whether one of your events is up, and have `themeEvent` return `sky` for it, so that it is drawn once:

```glsl
// Whether this theme's event `kind` (its place in the manifest's events,
// from 0) is up now, and then its seed and how far through it is, 0 to 1.
bool eventUp(int kind, out float seed, out float t) {
  for (int i = 0; i < 4; i++) {
    if (i >= EVENT_COUNT) break;
    if (EVENT_KIND[i] != 100 + kind) continue;
    seed = EVENT_SEED[i];
    t = fract(iTime / EVENT_SECONDS[i] + seed * 0.001);
    return true;
  }
  return false;
}
```

## An idiom: indoors at the right, the outdoors at the left

A theme whose stage is the inside of a building: the sky, the sun, the moon and the weather stay outdoors at the left, the room is at the right, and an entrance between them shows where one becomes the other. Both always show, with a clear border that makes sense of itself.

**What you look at** is a cutaway: the stage strip is the inside of the building, and its left edge is the outer wall cut through, so the door in it is a gap you see the lit room through. The sketch's building is tall, its wall and room the whole height of the window. A low one has a roofline under the window's top with the sky above it: there `scenery` leaves `sky` and `themeWindow` is 1, and a hanging lamp's cord starts at the ceiling, not at y = 0.

**Where things are.** The stage strip is the room. Its left edge is the building's outer wall with the entrance in it, and the floor inside is at the horizon's line, where the ground outside meets it, so that you can see someone walk in. Left of the wall the outdoors goes on behind the terminal's text: the sky as the engine draws it, and low on the horizon whatever stands outside, never more than a few units high, hazed into the sky and darker by night, in plain tones, with the ground at its foot fading out. Above it the sky is the text's.

**The entrance** is the one thing that has to read at a glance: a wall, a frame or a front of glass at the strip's left edge, a door or an opening in it on the floor line, its frame in the key plate. At night light from inside spills out of it onto the ground; by day it may stand open. Characters may stand in it, coming and going.

**The room** is lit by its own lamps (§9): its walls keep their light at night while the outdoors darkens, and its windows show the real sky. A window is a part of the wall your `scenery` leaves as `sky`: the sun, the moon and the stars, drawn before you, show through it, and the clouds and the rain follow wherever `themeWindow` lets them.

**`themeWindow`** is 1 outdoors, left of the wall; 0 in the wall, the room and everything in it; and 1 (or less, for glass that dims the view) in a window's panes. The clouds, the events in front and the rain are drawn over everything where it is above 0, so it must be 0 on a window's frame and bars and on anything that stands in front of a window. Put windows high in the walls, above the heads of the people inside, and none of them ever stands in front of one.

**The sun** rides its arc from 0.56 to 0.95 of the window's width, so every afternoon it passes behind your room, the sooner the wider the stage. That is right (the building stands in front of it), and its halo cut off straight at the wall is what a solid wall in front of the sun looks like. If you want more, let it set behind a roofline, or show it through a high window or a glass front where the arc passes.

**Events** in the open (the engine's planes and birds, your own `"front"` ones) fly behind the room and show again through its windows. One of yours that happens inside is drawn from `resident` (§12).

**In front of a character.** `resident` draws over `scenery`, so a counter, a desk or a railing drawn in `scenery` stands behind him, and he stands on top of it. Draw what stands in front of a character in `resident`, after him: `sky = clawd(sky, p, u, k, at); sky = counter(sky, p, u, k, r);`. `scenery` holds only what stands behind him.

**Text** runs over the outdoors, so keep it calm (§9). Look at it with `--prose`, by day and by night.

**The stage's width.** A room wants a wider stage than an island: 320 to 480 points. The terminal loses what the room gains, so take what the room needs to read, and look at the whole frame.

A sketch of it all, without the waiting light (§11) or anyone inside, which `resident` adds:

```glsl
// The room is the stage strip; its left edge is the building's outer wall,
// with the door where the ground outside meets the floor at the horizon's
// line. Sizes in u, so it scales with the window.
struct Room { float left; float floor; float wall; float door; float top; };

Room roomOf(float u) {
  Room r;
  r.left = iResolution.x - (STAGE_PX > 0.0 ? STAGE_PX : 0.3 * iResolution.x);
  r.floor = ARC.w * iResolution.y;
  r.wall = 2.4 * u;
  r.door = 4.5 * u;
  r.top = r.floor - 14.0 * u;
  return r;
}

// The window high in the back wall: its middle and half its size. Nothing
// in the room stands in front of it.
vec4 highWindow(Room r, float u) { return vec4(r.left + 0.55 * (iResolution.x - r.left), r.top + 3.5 * u, 0.3 * (iResolution.x - r.left), 2.0 * u); }

// Whether p is in one of the high window's panes: inside its frame, off
// its bars.
bool isPane(vec2 p, Room r, float u) {
  vec4 w = highWindow(r, u);
  vec2 v = abs(p - w.xy);
  if (v.x > w.z || v.y > w.w) return false;
  float bars = abs(fract((p.x - w.x) / (2.0 * u) + 0.5) - 0.5) * 2.0 * u;
  return bars > 0.12 * u && v.y < w.w - 0.15 * u && v.x < w.z - 0.15 * u;
}

// Outside, left of the wall, behind the terminal's text: a low line of
// something on the horizon, hazed into the sky and darker by night, never
// more than 5 u high, and the ground at its foot fading into the sky's
// own colour. Plain tones, no fine pattern, so that text reads over it.
vec3 outdoors(vec3 sky, vec2 p, float u, float k, Room r) {
  if (p.x > r.left || p.y < r.floor - 5.0 * u || p.y > r.floor + 4.0 * u) return sky;
  float dark = 1.0 - 0.6 * night();
  vec3 far = mix(tone(mix(INK_INDIGO, INK_BLUE, 0.3), k) * dark, sky, 0.45);
  float top = r.floor - (1.5 + 3.5 * noise(p.x / (5.0 * u), 7)) * u;
  if (p.y > top && p.y < r.floor) return mix(sky, far, 0.9);
  vec3 ground = mix(tone(INK_INDIGO, k) * 0.55 * dark, sky, 0.4);
  return mix(sky, ground, 0.85 * smoothstep(r.floor + 4.0 * u, r.floor, p.y));
}

// The building: its outer wall at the room's left edge, solid so that
// nothing of the sun drawn before it shows through, with the door in it,
// its frame in the key plate and its light spilling out onto the ground at
// night; the room lit by its own lamps by day and night alike, its back
// wall and floor, and the high window left clear so the real sky (the sun,
// the moon, the stars) shows through it.
vec3 building(vec3 sky, vec2 p, float u, float k, Room r) {
  // The light from the door reaches 2.5 u ln(60), about 10 u, out.
  if (p.x < r.left - 11.0 * u) return sky;
  vec3 facade = tone(mix(INK_VIOLET, INK_INDIGO, 0.4), k) * (1.0 - 0.5 * night());
  vec2 door = vec2(r.left + 0.5 * r.wall, r.floor);
  bool isDoor = abs(p.x - door.x) < 0.5 * r.wall - 0.2 * u && p.y > r.floor - r.door && p.y < r.floor;
  if (p.x < r.left) {
    if (p.y > r.floor) sky = mix(sky, INK_YELLOW, screen(p, 0.6 * night() * exp(-length(p - door) / (2.5 * u)), pitch(u), 0.0));
    return sky;
  }
  if (p.x < r.left + r.wall && !isDoor) {
    // The door's frame, and its lintel.
    float frame = abs(abs(p.x - door.x) - (0.5 * r.wall - 0.2 * u));
    if (p.y > r.floor - r.door - 0.3 * u && p.y < r.floor && frame < 0.12 * u) return mix(facade, keyInk(k), 0.9);
    return facade;
  }
  if (isPane(p, r, u)) return sky;
  vec3 lit = lift(mix(CREAM, INK_ORANGE, 0.2), k);
  if (p.y < r.floor) {
    vec4 w = highWindow(r, u);
    vec2 v = abs(p - w.xy);
    if (v.x < w.z && v.y < w.w) return mix(sky, keyInk(k), 0.9);
    // The lamps' light falling off down the wall, screened.
    return mix(lit, mix(lit, INK_ORANGE, 0.5), screen(p, 0.15 + 0.25 * smoothstep(r.top, r.floor, p.y), pitch(u), 45.0));
  }
  vec3 floorInk = tone(mix(INK_ORANGE, INK_INDIGO, 0.4), k);
  return mix(floorInk, keyInk(k), screen(p, 0.2 + 0.4 * (p.y - r.floor) / (iResolution.y - r.floor), pitch(u), 60.0));
}

vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  Room r = roomOf(u);
  return building(outdoors(sky, p, u, k, r), p, u, k, r);
}

// 1 outside, 0 in the walls and the room, 1 in the high window's panes.
float themeWindow(vec2 p, float u) {
  Room r = roomOf(u);
  if (p.x < r.left) return 1.0;
  return isPane(p, r, u) ? 1.0 : 0.0;
}
```

## 13. Previewing, and what goes wrong

### The tools

Run them from the repository's root, one at a time: they bundle the engine into `.preview/` as they start, and every preview drives headless Chrome with one profile, so a second one started while another draws fails, and rewrites the bundle under it. If a run fails with `Command failed: … Google Chrome` (Chrome exiting with status 2 or 21) and no `FAIL`, Chrome was busy: wait and run it again. Two people or agents in one checkout should not preview at the same time, since they share `.preview/`. A sheet clears its folder as it starts, so a sheet run again draws every frame again.

- `tools/theme/run.sh lint themes/<name>` reads the manifest as the engine would, lints the GLSL (§3) and weighs it. It prints `<name>: GLSL … of 80000 characters, the long night's shader … of 224000`, the stage's width, each problem, and `clean` or how many there are to put right. A manifest that does not pass stops it with what is wrong.
- `tools/preview/run.sh shader --theme themes/<name> --stage <stagePt>` compiles the whole shader in headless Chrome's WebGL and draws one frame at 1512 × 982 over a stand-in terminal, printing the PNG's path (`.preview/shader.png`, or `--out <name>` for `.preview/<name>.png`). A shader that does not compile prints `FAIL` and the compiler's errors, and draws nothing. Always pass `--stage` with your `stagePt`: without it `STAGE_PX` is 0 and the stand-in text runs to the window's right edge. Its flags:
  - `--at 2026-10-26T13:00`: the moment, in Stockholm's time and place. In late October 13:00 is day, 16:30 dusk, 22:00 night and 04:00 the small hours, when Clawd sleeps.
  - `--time 20`: `iTime`, in seconds (20 when left out).
  - `--weather 61,8,4,90`: a weather code, °C, the wind in m/s and cloud cover in %: code 0 clear, 2 partly cloudy, 3 cloudy, 45 fog, 51 drizzle, 61 rain, 71 snow, 95 thunder.
  - `--waiting asking` or `--waiting done`, and `--urgent`.
  - `--fish 7`, `--fish 7,catch`, `--fish 9,grill`, `--fish 0,embers`: the context window seven tenths full, a tenth just filled, the conversation compacting, just compacted.
  - `--tool command` (or `edit`, `read`, `web`, `other`) and `--agents 3`: what Claude is doing.
  - `--market up` or `--market down`: sample prices, every symbol's day up or down.
  - `--event <kind>`: one of your events or previews played, or one of the engine's.
  - `--aurora`, `--iss`, `--demo`, `--light`, `--prose` (paragraphs of text below the window's top third), `--diff` (Claude Code's coloured fields).
  - `--zoom x,y,w,h`: that part of the frame three times as large, beside it as `…-zoom.png`.
  - `--stage <px>` is the stage in device pixels. The sheets and a plain run are at a scale of 1, a point a pixel, so there it is your `stagePt`.
  - `--width 3024 --height 1964 --stage <twice your stagePt>`: a Retina screen.
  - `--bench 200`: what it costs (§10).
- `tools/preview/sheet.sh theme themes/<name>` draws the sheet in `.preview/theme-<folder>/`, named after the folder you give it: your theme at your stage's width in 37 scenes, then each of your events and previews at three moments (by day at `--time` 24.8, by night at 88 and 126), and every frame small in `contact.png`. It takes several minutes. The scenes:

| Frames | Scene |
|---|---|
| 01 to 04 | A day in late October at 13:00, `iTime` 20, 45, 60 and 75 |
| 05, 06, 07 | Claude asking at dusk; asking and urgent at night; done by day |
| 08, 09, 10 | Night with an aurora; with the ISS; under the moon |
| 11 | 04:00, Clawd asleep |
| 12, 13, 14 | Rain; snow in January; a storm with a kite in it |
| 15 to 18 | The context window: 6 tenths full; 9 and compacting; just compacted; 7 and a tenth just filled |
| 19 to 25 | A comet and the Clawd constellation; a rainbow; a balloon, a plane and birds; Christmas Eve; Sweden's national day; New Year's Eve; confetti after long work |
| 26 to 31 | A demo; Linux's coordinates; Claude Code's coloured fields; the lighter sky; a tab without Claude (the terminal alone, no sky at all); the band |
| 32 to 34 | A command running by day; an edit with three subagents; a read at night with one |
| 35, 36, 37 | The market open with prices up; open and down, with a command and two agents; closed, at night |
| 38 on | Each of your events and previews, three frames each |

The stand-in terminal is seven lines of text at the top left, a dark status bar near the bottom and a line of green under it. The status bar runs across the stage, and so do Claude Code's coloured rows (frame 28) and Clawd's band (frame 31), which Ghostty's would not: in Ghostty they are the terminal's cells and stop where the stage begins. They are the stand-in's, not yours; leave no room for them.

A played event ignores its `when`, in the sheet (frames 38 on draw each of yours by day and by night) as in `/solar event`, so the person can see a day-only event at night: make it look right there too, or at least not wrong.

**Reading an error.** The compiler names a line of the whole shader, which the preview leaves in `.preview/sky.glsl`, your text near its end: the line it names, less 12, is that file's line. To find your own file's line, look up in `.preview/sky.glsl` the line where your `theme.glsl`'s first line sits (`grep -n` for it): your line is that file's line, less that one, plus 1. The lint and the compiler check different things: run both.

### What goes wrong

The preview compiles GLSL ES 3.00, stricter than the GLSL 4.30 Ghostty compiles, so what compiles in the preview compiles in Ghostty, apart from the three words in §3. What does not compile:

- **Ints and floats do not mix.** `float x = 1;`, `2 * u`, `pow(x, 2)`, `x > 0` with a float `x`, `smoothstep(0, 1, x)`, and `b ? 1 : 0.5` all fail. Write `1.0`, `2.0 * u`, `float(i)`, `int(x)`.
- **A `uint` needs its `u`.** `uint x = 5;` fails; `5u` and `0x11110u` do not. A sprite's rows and anything you `>>` or `&` are `uint`.
- **`%` is for ints, and undefined below 0.** Keep both sides at 0 or above (`max(i, 0) % 3`), or use `mod()` on floats.
- **Arrays name their type and size.** `vec3 inks[3] = vec3[3](INK_PINK, INK_YELLOW, INK_ORANGE);`. A parameter that is an array has its size (`int text[16]`). There are no arrays of arrays, and an index outside an array is an error where the compiler can see it and garbage where it cannot: guard a loop with `if (i >= count) break;`.
- **A struct is built with all its fields, in order.** `Stage(left, width, ground)`, or declare it and set the fields, as the template does.
- **Nothing is called before it is defined,** or declared with a prototype, and nothing calls itself.
- **A `const` takes only constants.** `const vec3 CORAL = mix(INK_ORANGE, CREAM, 0.15);` is fine; `const vec3 C = lift(INK_PINK, 1.0);` (a function of yours or the engine's) and `const float T = iTime;` are not. Work those out in the function that needs them.
- **The four signatures exactly.** `Function scenery() called by mainImage() is undefined` means yours has other parameters.
- **Names** that are GLSL's own, or hidden by a local, or the engine's (§3).

What compiles and still goes wrong:

- **A wall that is not solid.** A wall mixed in at 0.9 lets a tenth of the sun, the moon and the stars through it. Mix at 1.0.
- **Clouds over the furniture.** Where `themeWindow` is above 0 the clouds and the rain are drawn over what you drew there (§2).
- **An event that never shows.** A `"front"` event drawn where `themeWindow` is 0, or a `"behind"` one where `scenery` covers it (§12).
- **A glow cut off square.** The box test smaller than the glow reaches (§9).
- **A night as bright as the day.** `k` does not make it night; `night()` does (§9).
- **A frozen demo.** Light read from `ELEVATION` or `IS_DAY` instead of `night()` and `sceneNow()` (§8).
- **No prices in Ghostty.** `"market": true` left out of the manifest: the preview's `--market` shows them anyway (§4).
- **Text across your world in the preview.** `--stage` left out: `STAGE_PX` is 0, and the stand-in text runs to the window's right edge.
- **A character that shimmers.** Cells of a fraction of a pixel, or an origin not floored to a pixel (§7).
- **A slow theme.** A loop over every window or every person, or a big function with no box test (§10).

## 14. The checklist

A theme is done when every line below holds. The first six are hard: one that fails fails the theme. The judge who looks at your theme goes down this list with your sheet, your lint and your bench.

1. **It compiles.** `tools/preview/run.sh shader --theme themes/<name> --stage <stagePt>` draws a frame, and the sheet draws every frame.
2. **It lints clean.** `tools/theme/run.sh lint themes/<name>` ends in `clean`, within both caps.
3. **It costs no more than 1.25 times fyr.** `--bench 200` prints `ratio to fyr` of 1.25 or less (§10).
4. **It keeps the text readable.** Nothing left of the stage is lighter than the sky beside it, and the light and grey paragraphs of `--prose` read over your world by day and by night (§9).
5. **Its waiting light reads.** In frames 05, 06 and 07, and in any still, someone who knows the theme sees at a glance that Claude is asking (orange), done (white), or asking urgently (more), and in frames 01 to 04 that nothing waits (§11).
6. **It defines nothing of the engine's**, which the lint sees to, and draws nothing outside its own business: not the sky, not the text.
7. **Clawd lives there, recognisably,** in the band's shape and coral (§6), and the theme reads in five seconds as the paragraph it was written from, at 1512 × 982.
8. **Its places read.** Where the theme has an outdoors and an indoors, both show in every frame, with the entrance between them clear in five seconds (the idiom after §12).
9. **It answers what it reads.** What it takes from the engine shows in the frames made for it: what Claude is doing (32 to 34), the context window (15 to 18, or the engine's wastebasket there for a theme that leaves it to the engine), the market for a theme that shows it (35 to 37), and its own events and previews (38 on).
10. **It is printed.** The house style (§6): the inks, halftone tones, the key plate, no black, the night an indigo plate, the far hazy.
11. **Every moment is a still.** Ten frames at random `--time` values look like moments, not like glitches (§8).
12. **Day, night and weather agree.** Day and night, dusk, rain and snow (frames 01, 05, 08, 10, 12, 13) look like the same place at another time; nothing indoors gets wet.
13. **It is the size it needs.** Its GLSL is well inside 80,000 characters, and its stage no wider than its world needs.

## 15. The template

Two files that lint clean and compile as they are: the stage's geometry, the waiting light as a lamp on a post, the ground, and Clawd standing on it. `node tools/theme/guide.mjs template themes/<name>` writes them; its manifest has the folder's name, which must stay the folder's (the lint says so if it is not); give it your title and words. Change everything else as your world needs.

`manifest.json`:

```json-template
{
  "engine": 1,
  "name": "my-theme",
  "title": "My theme",
  "description": "One or two sentences: what stands at the right, who lives there, and what they do.",
  "author": "Your name",
  "version": "0.1.0",
  "license": "GPL-3.0",
  "stage": "wanted",
  "stagePt": 240,
  "waits": "A lamp on a post on the stage: orange while Claude asks, white once it is done, quicker and larger once a question has waited.",
  "context": "engine",
  "market": false,
  "events": [],
  "previews": [],
  "aliases": {}
}
```

`theme.glsl`:

```glsl-template
// my-theme: what it is, in a sentence or two.

// --- Where things are --------------------------------------------------------

// The stage strip at the right, where the theme stands: its left edge and
// width in pixels, and the ground line, the horizon the sun sets on. Where
// the width is not known (STAGE_PX 0), the last quarter of the window.
struct Stage { float left; float width; float ground; };

Stage stageOf() {
  Stage s;
  s.width = STAGE_PX > 0.0 ? STAGE_PX : 0.25 * iResolution.x;
  s.left = iResolution.x - s.width;
  s.ground = ARC.w * iResolution.y;
  return s;
}

// Clawd's coral: the orange ink printed thin on the paper, with a breath of
// indigo under it.
const vec3 CORAL = mix(mix(INK_ORANGE, CREAM, 0.15), INK_INDIGO, 0.1);

// --- The waiting light ---------------------------------------------------------

// A lamp on a post on the stage: dark while nothing waits, orange while
// Claude asks, white once it is done, larger and quicker once a question
// has waited. Lit in every frame it is on, so a still shows it too.
vec3 waitingLamp(vec3 sky, vec2 p, float u, float k, Stage s) {
  vec2 at = vec2(s.left + 0.3 * s.width, s.ground - 7.0 * u);
  float r = 0.9 * u;
  float d = length(p - at);
  if (d > 8.0 * u && (abs(p.x - at.x) > u || p.y < at.y || p.y > s.ground)) return sky;
  // The post down to the ground, in the key plate's indigo.
  if (p.y > at.y && p.y < s.ground) sky = ink(sky, keyInk(k), abs(p.x - at.x) - 0.15 * u, 1.0);
  if (WAITING == 0) return ink(sky, keyInk(k), d - r, 1.0);
  vec3 light = WAITING == 1 ? INK_ORANGE : vec3(1.0, 0.97, 0.9);
  bool isUrgent = WAITING_URGENT > 0.5;
  float pulse = 0.8 + 0.2 * sin(iTime * (isUrgent ? 7.0 : 2.5));
  float reach = (isUrgent ? 1.5 : 1.0) * u;
  // Its glow screened round it, gone by 4.6 reaches out (screen draws
  // nothing under a tone of 0.01), inside the box above.
  sky = mix(sky, light, screen(p, pulse * exp(-max(0.0, d - r) / reach), pitch(u), 15.0));
  return ink(sky, light, d - r, 1.0);
}

// --- What the engine calls -------------------------------------------------------

// The ground on the stage, and the lamp.
vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  Stage s = stageOf();
  if (p.x < s.left - 8.0 * u) return sky;
  // The ground, in green over indigo, darker by night, its dots thinning
  // out to the left of the stage.
  if (p.y > s.ground) {
    vec3 earth = tone(mix(INK_GREEN, INK_INDIGO, 0.55), k) * (1.0 - 0.6 * night());
    sky = mix(sky, earth, screen(p, smoothstep(s.left - 8.0 * u, s.left + 2.0 * u, p.x), pitch(u), 45.0));
  }
  return waitingLamp(sky, p, u, k, s);
}

// Clawd's cell c, six across and four down from his top left, as the band
// draws him standing: his head, his face with two eyes, his arms the whole
// width, and two legs. 0 is nothing, 1 his body, 2 an eye, 3 a leg.
int clawdCell(ivec2 c) {
  if (c.x < 0 || c.x > 5 || c.y < 0 || c.y > 3) return 0;
  if (c.y == 0) return c.x >= 1 && c.x <= 4 ? 1 : 0;
  if (c.y == 1) return c.x == 1 || c.x == 4 ? 2 : c.x >= 2 && c.x <= 3 ? 1 : 0;
  if (c.y == 2) return 1;
  return c.x == 1 || c.x == 4 ? 3 : 0;
}

// Clawd with his feet at `feet`, `cell` whole pixels a cell: coral, his
// eyes indigo, his legs a deeper coral, under the indigo plate at night,
// and the key plate a pixel or so off register down and to the right.
vec3 clawd(vec3 sky, vec2 p, vec2 feet, float cell, float k) {
  vec2 origin = floor(feet - vec2(3.0 * cell, 4.0 * cell) + 0.5);
  if (p.x < origin.x - cell || p.x > origin.x + 7.0 * cell || p.y < origin.y - cell || p.y > origin.y + 5.0 * cell) return sky;
  int kind = clawdCell(ivec2(floor((p - origin) / cell)));
  vec3 body = nightInk(CORAL, k);
  if (kind == 1) return mix(sky, body, 0.97);
  if (kind == 2) return mix(sky, keyInk(k), 0.97);
  if (kind == 3) return mix(sky, nightInk(mix(CORAL, INK_INDIGO, 0.22), k), 0.97);
  float off = max(1.0, floor(0.4 * cell));
  if (clawdCell(ivec2(floor((p - vec2(off) - origin) / cell))) != 0) sky = mix(sky, keyInk(k), 0.55);
  return sky;
}

// Clawd standing on the ground in the stage's middle.
vec3 resident(vec3 sky, vec2 p, float u, float k) {
  Stage s = stageOf();
  return clawd(sky, p, vec2(s.left + 0.6 * s.width, s.ground), max(1.0, floor(0.25 * u)), k);
}

// No events of its own yet.
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) { return sky; }

// All of it outdoors: the clouds, the events in front and the rain over it.
float themeWindow(vec2 p, float u) { return 1.0; }
```

## 16. Sharing a theme

A theme is its folder, `themes/<name>/` with its `manifest.json` and `theme.glsl`, and is shared as those two files. There is no switching between themes in a session yet: `/solar theme` and a repository of community themes are planned, not built. Until then a theme is seen through the preview tools, and becomes one the sky can show by being built in: wrapped in TypeScript under `hooks/themes/<name>/`, as fyr is, once the mod's author has looked at it.

The repository of themes is planned with a folder for each theme (the two files, a `preview.png` and a `README.md`) and, on every pull request, the checks of §14 run by machine: the lint, compiling it in headless WebGL and drawing its sheet, compiling it again with `glslangValidator` as GLSL 4.30, its bench against fyr, its brightness and its size. A theme written to this guide is written to pass them.
