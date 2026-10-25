# Levande himmel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Solar Clawd's Ghostty sky living and useful: a lighthouse when Claude waits, a living comet, a still sky on battery, the real stars and ISS, Swedish days, Clawd looking up, a sky that notices the cursor, and phase-free confetti.

**Architecture:** Pure TypeScript modules (`hooks/*.ts`) compute everything about a moment (projection, stars, ISS, days, beacon state) and bake it into the GLSL text `hooks/shader.ts` writes; `hooks/register.tsx` gathers the state, shares it between sessions through files in `runtime/`, and decides Ghostty's `custom-shader-animation` mode in the include file. The shader animates only what needs no known phase.

**Tech Stack:** TypeScript (Claude Code mod engine, `claude plugin test`), GLSL (Ghostty 1.3.1 custom shader; preview in WebGL2 via headless Chrome), esbuild for tools.

**Spec:** `docs/superpowers/specs/2026-10-25-levande-himmel-design.md` (Swedish).

## Global Constraints

- Ghostty 1.3.1 uniforms usable: `iBackgroundColor`, `iFocus`, `iCurrentCursor`, `iTimeCursorChange`, plus `iTime`, `iResolution`, `iChannel0`. Never `iDate` (always zero). The shader never declares these; Ghostty's preamble does. The WebGL preview (`tools/preview/shader.mjs`) declares and sets every one the shader uses.
- `iTime` never resets: anything animated with it must look right from any phase.
- Every function that takes `$` is a top-level function in `hooks/register.tsx`, never a closure.
- Files in `runtime/` the shader or include depend on are written with `writeWhole($, path, text, id)`.
- Everything is drawn only where the terminal shows its background (the existing `mask` in `mainImage`).
- Timings: `AWAY_MS = 300_000` (exists), `SCENE_MS = 120_000` (exists), `BEACON_URGENT_MS = 120_000`, `BEACON_SWEEP_MS = 300_000`, `BEACON_MS = 1_800_000`, `BATTERY_MS = 60_000`, `ISS_TICK_MS = 2_000`, `ISS_MS = 86_400_000`, `ELEMENTS_MAX_AGE_MS = 259_200_000`, Clawd's look-up `REACTION_SECONDS.lookUp = 10`.
- The horizon is at `HORIZON = 0.62` of the window's height (the shader's `ARC.w`); things "at the horizon" stand on that line.
- Only notifications with `notification_type` `permission_prompt` or `elicitation_dialog`, and the `AskUserQuestion` tool, mean "asking". `idle_prompt` and anything else never do.
- Include file lines: `custom-shader = <path>` then `custom-shader-animation = <true|false|always>`.
- Nothing in this plan touches iTerm2's wallpaper (`hooks/sky.ts`).
- User-facing words are Swedish; code, comments and identifiers English in the existing voice.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; git identity is the repo's local one.
- Verify each task: `claude plugin test .` (all pass), `npx -y -p typescript@5.6.3 tsc -p .` (clean), and for shader changes `tools/preview/run.sh shader …` compiles (exit 0) and the PNG is looked at.

## Review Focus

1. Several sessions: one asks, another doesn't; a crashed session leaves `waiting-<id>` behind. Expect: the lighthouse lights while any *live* session waits, and a dead one's file is ignored and tidied. (Task 6)
2. A place far from Stockholm (southern hemisphere, above the Arctic Circle). Expect: projection, stars and ISS work or show nothing, never throw or index out of range. (Tasks 2, 3, 8)
3. Very wide or narrow windows. Expect: the star tiles cover x from −1.6 to 1.6 heights; stars outside are simply absent; no GLSL index out of range. (Task 3)
4. ISS data missing, garbage or stale (older than three days). Expect: no ISS at all, no error, the rest of the sky unaffected. (Task 8)
5. Daylight saving changes and midnight. Expect: Easter 2027 (Sunday 28 March, the DST night) and New Year's midnight are judged in local Swedish time. (Task 9)

---

### Task 1: The shader reads the terminal's background itself

**Files:**
- Modify: `hooks/shader.ts` (drop `background` from `ShaderParams` and from `shaderParams` options; drop `const vec3 BACKGROUND`; `mainImage`'s mask uses `iBackgroundColor`)
- Modify: `hooks/register.tsx` (delete `backgroundIn`, `ghosttyBackground`, `GHOSTTY_BACKGROUND` and `Ghostty.background`; `shaderAt` stops passing a background)
- Modify: `tools/preview/shader.mjs` (declare `uniform vec3 iBackgroundColor;` and set it from `--background`), `tools/preview/timing.mjs`
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Produces: `shaderParams(input: SkyInput, options: { demo?; events?; shootingRate? })` with no `background`. Every later task builds on this signature.

- [ ] **Step 1: Replace the test** `'the sky is shown where Ghostty draws your own background, not its default'` with:

```tsx
test('the shader takes the terminal background from Ghostty itself', async ($, on) => {
  const start = Date.UTC(2026, 9, 24, 20, 0)
  const clock = mock.clock(on, { now: start })
  const world = ghosttyWorld(on, { value: 1 })
  world.tick(start)
  const runtime = await startGhostty($, on, clock, world)
  const shader = world.files.get(`${runtime}/sky.glsl`)?.text ?? ''
  expect(shader).toContain('iBackgroundColor')
  expect(shader).not.toContain('const vec3 BACKGROUND')
  expect(world.runs.some(argv => argv.some(a => a.includes('show-config')))).toBe(false)
})
```

Also remove `background` from every `shaderParams` call in the tests.

- [ ] **Step 2:** `claude plugin test .` → the new test FAILS (BACKGROUND still baked).
- [ ] **Step 3:** Make the changes listed under Files.
- [ ] **Step 4:** Tests pass, tsc clean, `tools/preview/run.sh shader --at 2026-10-24T22:00` compiles. Look at the PNG: text still readable, sky only behind it.
- [ ] **Step 5:** Commit `Read the terminal background from iBackgroundColor`.

---

### Task 2: The dome projection, and the moon in it

**Files:**
- Modify: `hooks/astro.ts` (export `horizontalAt`, export `gmstDegrees`)
- Create: `hooks/dome.ts`
- Modify: `hooks/shader.ts` (`ShaderParams.moon` gains `at`; GLSL `domeToPixel`, `MOON_AT`, `MOON_UP`; the moon drawn at `MOON_AT` instead of `arcPoint`)
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Produces in `astro.ts`: `gmstDegrees(ms: number): number`; `horizontalAt(raDeg: number, decDeg: number, ms: number, lat: number, lon: number): Sun` (same maths as `sunAt` uses, through the existing `horizontal`).
- Produces in `dome.ts`:
  - `HORIZON = 0.62`
  - `DOME_SCALE = HORIZON / 130` (heights per degree)
  - `ZENITH_Y = HORIZON - 90 * DOME_SCALE`
  - `type DomePoint = { x: number; y: number }`: x from the window's centre and y from its top, both in window heights.
  - `domePoint(sky: Sun): DomePoint`
- Produces in `shader.ts`: `ShaderParams.moon: { illumination: number; isWaxing: boolean; at: DomePoint | null }` (null while the moon is below the horizon), and the GLSL helper `vec2 domeToPixel(vec2 d)` returning `vec2(iResolution.x * 0.5 + d.x * iResolution.y, d.y * iResolution.y)`.

The projection is azimuthal equidistant around the zenith, as if lying on your back with your feet to the south. With r = (90 − elevation)·`DOME_SCALE`: x = −r·sin(az), y = `ZENITH_Y` − r·cos(az). So south is down, north up, east left and west right.

- [ ] **Step 1: Write the failing tests**

```tsx
test('the dome: south horizon at the horizon line, east left, Polaris high in the north', () => {
  const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)
  near(domePoint({ elevation: 0, azimuth: 180 }).y, HORIZON)
  near(domePoint({ elevation: 0, azimuth: 180 }).x, 0)
  near(domePoint({ elevation: 90, azimuth: 0 }).y, ZENITH_Y)
  expect(domePoint({ elevation: 0, azimuth: 90 }).x).toBeLessThan(0)
  expect(domePoint({ elevation: 0, azimuth: 270 }).x).toBeGreaterThan(0)
  // Polaris (RA 37.95°, Dec 89.26°) from Stockholm: north, about 59° up.
  const polaris = horizontalAt(37.95, 89.26, Date.UTC(2026, 9, 24, 20), STOCKHOLM.lat, STOCKHOLM.lon)
  expect(Math.abs(polaris.elevation - 59.3)).toBeLessThan(1.2)
  const at = domePoint(polaris)
  expect(Math.abs(at.x)).toBeLessThan(0.02)
  expect(at.y).toBeGreaterThan(0)
  expect(at.y).toBeLessThan(ZENITH_Y)
})

test('the moon stands where it is, and is gone below the horizon', () => {
  const up = Date.UTC(2026, 9, 24, 21) // Find a moment the moon is up with moonAt; adjust if not.
  const params = shaderParams({ ms: up, t: 0, place: STOCKHOLM, weather: null }, {})
  const moon = moonAt(up, STOCKHOLM.lat, STOCKHOLM.lon)
  expect(moon.elevation).toBeGreaterThan(5)
  expect(Math.abs(params.moon.at!.x - domePoint(moon).x)).toBeLessThan(0.002)
  const down = /* a moment with moonAt(...).elevation < -5 */ 0
  expect(shaderParams({ ms: down, t: 0, place: STOCKHOLM, weather: null }, {}).moon.at).toBeNull()
  expect(skyShader(params)).toContain('const vec2 MOON_AT')
})
```

Before running the test, pick both moments with `moonAt` and write them in as literals.

- [ ] **Step 2:** The tests FAIL (`domePoint` is not defined).
- [ ] **Step 3:** Implement `dome.ts` and the `astro.ts` exports. Round `moon.at` to 0.0005. In GLSL, draw the moon at `domeToPixel(MOON_AT)` when `MOON_UP == 1.0` and `s.isDay < 0.5`. In a demo it stays where it was at the demo's start.
- [ ] **Step 4:** Tests pass. Then run `tools/preview/run.sh shader --at <the moment you chose>` and check that the moon is drawn.
- [ ] **Step 5:** Commit `Place the moon on the dome: the real sky, lying on your back`.

---

### Task 3: Real stars and constellations

**Files:**
- Create: `tools/stars/build.mjs` (dev tool). It downloads a Yale Bright Star Catalogue JSON (pick a stable public source and record the URL in the file) and keeps stars of magnitude ≤ 3.5 plus every HR number in `CONSTELLATIONS`. It writes `hooks/stars.ts`, and fails if an HR number is missing.
- Create: `hooks/stars.ts` (generated, committed): `STARS: readonly (readonly [hr: number, ra: number, dec: number, mag: number, bv: number])[]`
- Create: `hooks/chart.ts`
- Modify: `hooks/shader.ts`: the constants `STAR_COUNT`, `STAR_AT`, `STAR_LOOK`, `TILE_START`, `TILE_COUNT`, `TILE_STAR`, `LINE_*`, and the GLSL functions `realStars` and `chartLines`. The random `stars()` stays as faint fill, with its bright kinds dimmed by half.
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Consumes: `horizontalAt`, `domePoint`, `HORIZON` (Task 2).
- Produces in `chart.ts`:
  - `CONSTELLATIONS: Record<string, readonly (readonly [number, number])[]>`, lines between HR numbers, exactly:
    - `karlavagnen`: [4301,4295],[4295,4554],[4554,4660],[4660,4301],[4660,4905],[4905,5054],[5054,5191]
    - `kassiopeja`: [21,168],[168,264],[264,403],[403,542]
    - `orion`: [2061,1790],[1790,1852],[2061,1948],[1852,1903],[1903,1948],[1948,2004],[1852,1713]
    - `lyran`: [7001,7056],[7056,7106],[7106,7178],[7178,7139],[7139,7056]
    - `sommartriangeln`: [7001,7924],[7924,7557],[7557,7001]
    - `svanen`: [7924,7796],[7796,7417],[7949,7796],[7796,7528]
  - `type ChartStar = DomePoint & { mag: number; bv: number }`
  - `chartAt(ms: number, place: Place): { stars: ChartStar[]; lines: [DomePoint, DomePoint][] }`. Only stars above the horizon with 0 ≤ y ≤ `HORIZON`; only lines with both ends kept.
  - `TILE = 0.04` (heights). The tiles cover x ∈ [−1.6, 1.6] and y ∈ [0, `HORIZON`], giving 80 × 16 tiles.
  - `tileStars(stars: readonly DomePoint[]): { start: number[]; count: number[]; index: number[] }`. Each star goes in the tile that holds it; `start` and `count` have one entry per tile, in row-major order.
  - `tileLines(lines: readonly [DomePoint, DomePoint][]): { start: number[]; count: number[]; index: number[] }`. Each line goes in every tile its bounding box (plus half a tile) touches.
- The GLSL looks at the pixel's own tile and its 8 neighbours for stars, and only its own tile for lines. Indexes are clamped so an out-of-range tile gives none.

- [ ] **Step 1: Write the failing tests**

```tsx
test('the chart: Orion south on a January night, Vega overhead in August, Polaris always', () => {
  const january = chartAt(Date.UTC(2026, 0, 15, 21), STOCKHOLM) // 22:00 local
  const betelgeuse = january.stars.find(s => s.mag < 0.6 && s.bv > 1.5)!
  expect(Math.abs(betelgeuse.x)).toBeLessThan(0.35)
  expect(betelgeuse.y).toBeGreaterThan(ZENITH_Y)
  const august = chartAt(Date.UTC(2026, 7, 15, 21), STOCKHOLM) // 23:00 local
  const vega = august.stars.find(s => s.mag < 0.1 && s.bv < 0.1)!
  expect(Math.hypot(vega.x, vega.y - ZENITH_Y)).toBeLessThan(0.12)
  expect(january.lines.length).toBeGreaterThan(5)
})

test('a southern sky charts without Polaris, and every star sits in its own tile', () => {
  const cape = chartAt(Date.UTC(2026, 5, 1, 20), { name: 'Kapstaden', lat: -33.9, lon: 18.4 })
  for (const s of cape.stars) expect(s.y >= 0 && s.y <= HORIZON).toBe(true)
  const { stars } = chartAt(Date.UTC(2026, 0, 15, 21), STOCKHOLM)
  const tiles = tileStars(stars)
  stars.forEach((s, i) => {
    if (Math.abs(s.x) > 1.6) return
    const tile = Math.floor(s.y / TILE) * 80 + Math.floor((s.x + 1.6) / TILE)
    const own = tiles.index.slice(tiles.start[tile], tiles.start[tile]! + tiles.count[tile]!)
    expect(own).toContain(i)
  })
})
```

- [ ] **Step 2:** Run `node tools/stars/build.mjs`, which writes `hooks/stars.ts`. Then the tests FAIL (`chartAt` is not defined).
- [ ] **Step 3:** Implement `chart.ts` and the GLSL.
  - **Stars:** brightness from magnitude, a slight tint from B−V (blue below 0.2, orange above 1.2). They are strongest at night and in clear weather, using the existing `starStrength`.
  - **Lines:** dashed like the Clawd constellation, at alpha 0.15. They show only when night is above 0.6 and `CLOUDINESS` below 0.5.
  - **Positions:** rounded to 0.0005.
  - **Demo:** uses the chart from the demo's start.
- [ ] **Step 4:** Tests pass. Look at previews for `--at 2026-01-15T22:00` (Orion) and `--at 2026-08-15T23:00` (the Summer Triangle, Cygnus), both with `--width 1512 --height 982` and `--width 3000 --height 800`.
- [ ] **Step 5: Measure.**
  - Reload Ghostty on today's shader, then run `spike/measure.sh` for 60 s focused.
  - Do the same on the new shader.
  - The new one may be at most about 10 percentage points higher on the GPU. If it is higher, cut the tiles or the stars until it fits.
  - Record both figures in the commit message.
- [ ] **Step 6:** Commit `Real stars and constellations on the dome`.

---

### Task 4: The comet lives

**Files:**
- Modify: `hooks/shader.ts` (`ShaderParams.comet`; GLSL `comet(sky, p, u, seed)` gains `head` and `away` from `COMET_AT`/`COMET_AWAY`, streaming particles, flutter, pulse)
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Consumes: `horizontalAt`, `domePoint`, `sunAt`.
- Produces: `ShaderParams.comet: { at: DomePoint; away: number } | null`. It is present only when a comet event is up.
  - **`away`:** the screen angle (in radians) from the sun's dome point to the comet's.
  - **Sky position:** RA = `rand(seed) * 360`, Dec = 45 + 30·`rand(seed + 1)`, using `rand` from `paint.ts`. That keeps it high on a northern night.
  - **Below the horizon:** if the comet's sky position is not up, `at` is clamped onto the horizon line, so a forced preview always shows it.

- [ ] **Step 1: Write the failing test**

```tsx
test('the comet hangs at its place among the stars and turns with them', () => {
  const ms = Date.UTC(2026, 9, 24, 20)
  const ctx = contextFor(ms)
  const comet = (at: number) => shaderParams({ ms: at, t: 0, place: STOCKHOLM, weather: null }, { events: eventsAt(at, ctx, [{ kind: 'comet', at: ms }]) }).comet
  const now = comet(ms)!, later = comet(ms + 80_000)! // the same preview, a scene later
  expect(now).not.toBeNull()
  expect(Math.hypot(later.at.x - now.at.x, later.at.y - now.at.y)).toBeGreaterThan(0)
  expect(skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, { events: eventsAt(ms, ctx, [{ kind: 'comet', at: ms }]) }))).toContain('const vec2 COMET_AT')
})
```

- [ ] **Step 2:** The test FAILS.
- [ ] **Step 3:** Implement the comet:
  - **Head:** at `domeToPixel(COMET_AT)`.
  - **Tails:** point along `vec2(cos(COMET_AWAY), sin(COMET_AWAY))`.
  - **Stream:** dots move outward with `fract(along / (6u) - iTime * 0.08)`, so the flow is even and has no visible phase.
  - **Ion tail:** sideways flutter with `sin(iTime * 0.7 + along * 0.05)`.
  - **Head pulse:** `0.85 + 0.15 * sin(iTime * 1.6)`.
  - **Layer:** stays in the behind-clouds pass.
- [ ] **Step 4:** Tests pass.
  - Preview `--event comet --at 2026-10-24T22:00` at `--time 10`, `12` and `14`: the tail dots must move between the frames.
  - Then preview `--weather 3,6,3,90` (overcast) and check that the clouds cover the comet. If they don't, find out why and fix it.
- [ ] **Step 5:** Commit `A living comet: streaming tails, a pulsing head, turning with the sky`.

---

### Task 5: The lighthouse, drawn

**Files:**
- Modify: `hooks/shader.ts`: `ShaderParams.beacon` and `ShaderParams.onlyBeacon`; GLSL constants `BEACON` (0 none, 1 asking, 2 done), `BEACON_URGENT`, `ONLY_BEACON`, and the function `beacon(sky, p, u)`. In `mainImage`, `ONLY_BEACON` draws the terminal untouched except for the lighthouse and its beam.
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Produces: `ShaderParams.beacon: { mode: 'asking' | 'done'; isUrgent: boolean } | null` and `ShaderParams.onlyBeacon: boolean`, both passed through `shaderParams` options as `beacon?` and `onlyBeacon?`.

- [ ] **Step 1: Write the failing test**

```tsx
test('the lighthouse: orange when Claude asks, white when done, and alone while you are away', () => {
  const ms = Date.UTC(2026, 9, 24, 20)
  const text = (options: object) => skyShader(shaderParams({ ms, t: 0, place: STOCKHOLM, weather: null }, options))
  expect(text({})).toContain('const int BEACON = 0;')
  expect(text({ beacon: { mode: 'asking', isUrgent: false } })).toContain('const int BEACON = 1;')
  expect(text({ beacon: { mode: 'done', isUrgent: false } })).toContain('const int BEACON = 2;')
  expect(text({ beacon: { mode: 'asking', isUrgent: true } })).toContain('const float BEACON_URGENT = 1.0;')
  expect(text({ beacon: { mode: 'done', isUrgent: false }, onlyBeacon: true })).toContain('const float ONLY_BEACON = 1.0;')
})
```

- [ ] **Step 2:** The test FAILS.
- [ ] **Step 3:** Draw the lighthouse.
  - **Placement:** a small risograph tower at x = 0.9·W, its foot on the horizon line (`HORIZON`·H), about 3 units tall. White and `INK_RED`/coral bands, a lantern room on top.
  - **Lantern:** asking uses `INK_ORANGE`, done uses `vec3(1.0, 0.97, 0.9)`.
  - **Beam:** a soft wedge from the lantern, about 12° wide, fading over 0.6·H. It turns with `angle = iTime * speed`, sweeping the half above the horizon. `speed` is 0.6 rad/s; urgent mode doubles the speed and multiplies the strength by 1.5.
  - **Off:** with `BEACON == 0` neither tower nor beam is drawn.
  - **Readability:** the beam is drawn with the same LUMINANCE care as the sky, so text stays readable.
- [ ] **Step 4:** Tests pass. Previews:
  - `--beacon asking`, `--beacon done` and `--beacon asking --urgent`, each at night and at noon.
  - The same with `--only-beacon`.
  - Add these flags to `shader.mjs`.
  - The beam must read in the corner of the eye without hiding text.
- [ ] **Step 5:** Commit `The lighthouse: a beam that sweeps when Claude waits`.

---

### Task 6: The lighthouse's state, shared, and Ghostty's animation mode

**Files:**
- Create: `hooks/beacon.ts` (pure)
- Modify: `hooks/register.tsx`
  - **Session state:** `waiting: Waiting | null` replaces `claude.isWaiting`. The band's wave shows while `waiting?.mode === 'asking'`.
  - **Shared files:** writes and removes `runtime/waiting-<id>` and reads every live session's.
  - **Updates:** a waiting change updates the sky at once; `updateGhosttySky` takes `beacon` and an animation mode.
  - **End:** `endGhosttySky` removes the waiting file.
- Modify: `hooks/tidy.ts` (`/^waiting-[\w-]+$/` is ours)
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Consumes: Task 5's `beacon` and `onlyBeacon` options.
- Produces in `beacon.ts`:
  - `BEACON_URGENT_MS = 120_000`, `BEACON_SWEEP_MS = 300_000`, `BEACON_MS = 1_800_000`
  - `type Waiting = { mode: 'asking' | 'done'; since: number }`
  - `beaconAt(waits: readonly Waiting[], now: number): (Waiting & { isUrgent: boolean }) | null`: waits older than `BEACON_MS` are dropped; `asking` beats `done`; `since` is the earliest wait of the winning mode; `isUrgent` is true when the mode is asking and at least `BEACON_URGENT_MS` has passed.
  - `animationOf(o: { beacon: Waiting | null; now: number; isAway: boolean; isOnBattery: boolean }): 'true' | 'false' | 'always'`, decided in this order:
    - `'always'` if there is a beacon, the person is not away, and it has waited less than `BEACON_SWEEP_MS`;
    - else `'false'` if there is a beacon;
    - else `'false'` if `isOnBattery`;
    - else `'true'`.
- **When "asking" starts:** `classic.Notification` with `notification_type` `permission_prompt` or `elicitation_dialog`, and `tool.call` with `tool === 'AskUserQuestion'` (set before `await next(e)`, cleared after).
- **When "done" starts:** `turn.complete` with `reason === 'answer'` and no `agentId`.
- **When the wait clears:** `prompt.submit`, `turn.start` without `agentId`, and every other tool call.
- **Waiting file:** the JSON `{"mode":"asking","since":<ms>}`. It counts only while `alive-<id>` is younger than `ALIVE_MS`.
- **While away with a beacon:** the include still points at the shader, which is written with `onlyBeacon: true`.

- [ ] **Step 1: Write the failing tests.**
  - A unit test of `beaconAt` and `animationOf` covering every branch listed above.
  - `ghosttyWorld` tests. Raise classic events through the test kit's `classic` noun; check the kit's typings in `.claude-plugin/types/claude-code/index.d.ts` under `EngineClassic` for the exact call. Name each test as follows, with its assertions:
  - `'a question lights the orange lighthouse at once, an answer puts it out'`: after a `permission_prompt`, `const int BEACON = 1;` and the include has `custom-shader-animation = always` without waiting for the 10 s tick (advance 100 ms). After `prompt.submit` and 100 ms: `BEACON = 0` and `= true`.
  - `'idle_prompt lights nothing'`.
  - `'a finished turn lights the white lighthouse, and it never hurries'`: after `turn.complete` (`reason: 'answer'`), `BEACON = 2`. Three minutes later `BEACON_URGENT = 0.0`.
  - `'the lighthouse sweeps five minutes, then stands still, and is out after thirty'`: at 0 the animation is `always`; at 5 min + 10 s it is `false` with the beacon still lit; at 30 min + 10 s it is `BEACON = 0` and `true`.
  - `'away, the sky goes but the lighthouse stays'`: idle 400 s plus asking gives an include that is not empty, with `ONLY_BEACON = 1.0` and `false`.
  - `'another live session's question lights this sky; a dead session's does not'`: a `waiting-other` file plus a fresh `alive-other` gives `BEACON = 1`; with a stale `alive-other` it gives `BEACON = 0`.
  - The tidy test gains `waiting-old-session`.
- [ ] **Step 2:** They FAIL.
- [ ] **Step 3:** Implement. Keep `refreshSky: (() => void) | null` in `register`'s scope, set in `session.start`, and call it when `waiting` changes.
- [ ] **Step 4:** All tests pass, tsc is clean.
- [ ] **Step 5:** Commit `The lighthouse lights when Claude waits, in every live session's sky`.

---

### Task 7: A still sky on battery

**Files:**
- Modify: `hooks/register.tsx`. Add the top-level `isOnBattery($: EngineInterface): Promise<boolean>`, which runs `['/usr/bin/pmset', '-g', 'batt']` and answers true only when stdout contains `'Battery Power'`. Any failure answers false. A `BATTERY_MS` timer keeps `power.isOnBattery` current, checked once at `session.start` too, and passes it to `animationOf`.
- Test: `hooks/solar.test.tsx` (`ghosttyWorld` answers `pmset` from a settable value)

- [ ] **Step 1: Write the failing tests**
  - `'on battery the sky stands still; a question still sweeps'`: with `Now drawing from 'Battery Power'`, the include ends `custom-shader-animation = false`. A `permission_prompt` then gives `always`.
  - `'a pmset that fails counts as mains power'`: the include gives `true`.
- [ ] **Step 2:** They FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit `A still sky on battery`.

---

### Task 8: Real ISS passes

**Files:**
- Create: `hooks/iss.ts` (pure)
- Create: `tools/iss/check.mjs` (dev tool). It fetches the current elements and compares `issAt` with `satellite.js@5.0.0` (via esbuild, like `run.sh`) at one-minute steps over 24 h, printing the largest error in degrees. It also prints five reference instants (ms, elevation, azimuth) from satellite.js for the test fixture, plus the fixture's OMM JSON.
- Modify: `hooks/events.ts` (remove `satellite` from `EVENTS`; it stays an `EventKind` for previews)
- Modify: `hooks/shader.ts` (`ShaderParams.iss`; GLSL `iss(sky, p, u)`: a bright, faintly yellow point with a short trail pointing back along its path)
- Modify: `hooks/register.tsx`
  - **Fetch:** `ISS_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json'`, at most once per `ISS_MS`, kept in `$.store` under `iss` as `{ fetchedAt, json }`.
  - **During a pass:** an `ISS_TICK_MS` timer refreshes the sky only while a pass is visible.
  - **Band:** shows `* ISS` during a pass.
  - **No ISS:** in a demo or at a pinned time.
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Produces in `iss.ts`:
  - `type Elements = { epochMs: number; meanMotion: number; eccentricity: number; inclination: number; raan: number; argPerigee: number; meanAnomaly: number }` (rev/day and degrees)
  - `elementsOf(json: unknown): Elements | null`. It reads the first OMM object with `NORAD_CAT_ID === 25544` and returns null on anything malformed.
  - `issAt(el: Elements, ms: number, place: Place): { elevation: number; azimuth: number; isSunlit: boolean }`
  - `issVisible(el: Elements | null, ms: number, place: Place): { at: DomePoint; trail: DomePoint } | null`. It returns null when there are no elements, when they are older than `ELEMENTS_MAX_AGE_MS`, when elevation ≤ 10°, when the sun is ≥ −6°, or when the ISS is in Earth's shadow. `trail` is where the ISS was 20 s earlier.
- Produces: `ShaderParams.iss: { at: DomePoint; trail: DomePoint } | null`, passed through the `shaderParams` option `iss?`.
- **Propagator:** Kepler plus J2 secular drift of RAAN, argument of perigee and mean anomaly, then GMST to topocentric coordinates. If `check.mjs` reports more than 1° within 24 h of epoch, port SGP4 instead. Earth's shadow is modelled as a cylinder along the sun's direction.

- [ ] **Step 1:** Run `node tools/iss/check.mjs` (after a stub `iss.ts` that throws) to get the fixture. Paste the OMM JSON and the five reference instants into the test file as constants.
- [ ] **Step 2: Write the failing tests**
  - `'the ISS stands where satellite.js puts it'`: each reference within 1.5° in elevation and in azimuth (scaled by cos elevation).
  - `'the ISS shows only on a visible pass'`: a reference instant that `check.mjs` marked visible gives non-null; noon gives null.
  - `'no ISS from garbage, nothing, or old elements'`: `elementsOf('nope')`, `elementsOf([{}])` and `elementsOf(null)` are null; elements 4 days old give null.
  - A `ghosttyWorld` test: `'during a pass the ISS moves every two seconds; a failed fetch shows none and breaks nothing'`. Answer the `$.http.fetch` hook with the fixture, set the clock at a visible instant, and count shader writes over 10 s: there should be ≥ 4, each with a different `ISS_AT`. A fetch that throws gives no `ISS_AT` with a non-zero flag, and the rest of the sky is still written.
- [ ] **Step 3:** They FAIL.
- [ ] **Step 4:** Implement until `check.mjs` reports ≤ 1° and the tests pass.
- [ ] **Step 5:** Look at a preview with `--iss` (a flag that takes the fixture's visible instant).
- [ ] **Step 6:** Commit `The real ISS, when it passes`.

---

### Task 9: Swedish days

**Files:**
- Modify: `hooks/events.ts`
  - **Kinds:** add the `EventKind`s `witch`, `feathers`, `flag`, `maypole`, `luciaTrain`, `christmasStar`, `sleigh` and `fireworks`, with words `påskkärring`, `påskfjädrar`, `nationaldagen`, `midsommarstång`, `luciatåg`, `julstjärna`, `tomten` and `fyrverkeri`.
  - **Schedule:** a new pure function `dayEventsAt(ms: number, ctx: EventContext): ActiveEvent[]`, merged into `eventsAt` before the forced events.
  - **Fireworks:** a `fireworks` event carries its strength in `progress`, from 0 to 1.
- Modify: `hooks/shader.ts`. Give `EVENT_INDEX` the numbers 13 to 20, add one GLSL function per kind, and add `FIREWORKS` (strength). The balloon becomes blue and yellow while `flag` is up.
- Test: `hooks/solar.test.tsx`

**Interfaces:**
- Consumes: `easter(year)` and `localTime` from `astro.ts`. `occasionAt` stays unchanged.
- Schedule, all in local Swedish time:

| Kind | When | Shape |
|---|---|---|
| `witch` | Maundy Thursday (Easter − 3) 19:00–23:00 | a 3-min pass in each 40-min slot, the slot started as `EVENTS` do |
| `feathers` | Maundy Thursday 00:00 – Easter Monday 23:59 | continuous |
| `flag` | 6 June, all day | continuous |
| `maypole` | Midsummer Eve (the Friday 19–25 June), all day | continuous, with blossom drifting |
| `luciaTrain` | 13 December 05:00–08:00 while the sun is below −3° | continuous, a 3-min procession loop |
| `christmasStar` | 24 December, all day | continuous |
| `sleigh` | 24 December: one pass at 15:00–15:02, then 17:00–22:00 a 2-min pass in each 30-min slot | |
| `fireworks` | 31 Dec 18:00 – 1 Jan 00:30 | strength 0.15 until 23:50, 1.0 from 23:50 to 00:15, then falling linearly to 0 at 00:30 |

- **Layering:** the witch passes in front of the moon (front layer); the christmas star sits behind the clouds; the flag, maypole and Lucia procession stand at the horizon line in the front layer.

- [ ] **Step 1: Write the failing tests**, named `'the Swedish days come on their days, in Swedish time'`:
  - 2026-04-02 (Maundy Thursday; Easter is 5 April): some minute in 19:00–23:00 has `witch`.
  - 2026-04-04 12:00: `feathers`.
  - 2026-06-06 12:00: `flag`; 2026-06-07 12:00: none.
  - 2026-06-19 12:00: `maypole`.
  - 2026-12-13 06:00: `luciaTrain`.
  - 2026-12-24 15:01: `sleigh`; 2026-12-24 12:00: `christmasStar`.
  - 2026-12-31 23:59: `fireworks` with progress 1.0; 2027-01-01 00:40: none.
  - Easter 2027 (28 March, the night the clocks change): `feathers` at 2027-03-28T00:30Z and at 2027-03-28T02:30Z; `witch` on 2027-03-25 at 21:00 local; nothing on 2027-03-29 23:59 + 2 min.
  - Every new kind has a word in `EVENT_WORDS`, and `/solar event påskkärring` previews it.
- [ ] **Step 2:** They FAIL.
- [ ] **Step 3:** Implement the schedule, then the GLSL for each kind in the risograph style:
  - **witch:** a silhouette on a broom crossing the moon's side of the sky.
  - **feathers:** coloured feathers drifting, like `drift`.
  - **flag:** a Swedish flag on a pole at the horizon, waving with `sin(iTime)`.
  - **maypole:** a maypole with two rings.
  - **luciaTrain:** 7–9 small flickering lights walking slowly along the horizon.
  - **christmasStar:** a bright four-pointed star with soft rays.
  - **sleigh:** the tomte, a sleigh and a reindeer in silhouette crossing the sky.
  - **fireworks:** bursts of halftone dots whose count follows `FIREWORKS`.
- [ ] **Step 4:** Tests pass. Look at one preview per kind (`--event <kind>` at a fitting `--at`).
- [ ] **Step 5:** Commit `Swedish days in the sky`.

---

### Task 10: Clawd looks up

**Files:**
- Modify: `hooks/clawd.ts`: add the `Reaction` `'lookUp'` with `REACTION_SECONDS.lookUp = 10`, the `Eyes` value `'up'`, and in `reactionOverrides` eyes `'up'`, arms `'right-up'` and a small `*` glyph above the raised claw.
- Modify: `hooks/register.tsx`: when the set of what is in the sky gains a member it did not have on the previous Ghostty tick, set `claude.passing = { kind: 'lookUp', at: now }`. The set is made of event kinds, `iss` while a pass is up, and `beacon` while lit. A working or asking reaction still wins, as passing reactions do today.
- Test: `hooks/solar.test.tsx`

- [ ] **Step 1: Write the failing tests**
  - `'Clawd looks up when something comes into the sky, once'`: after `/solar event komet` and one tick, the band frame differs from the frame just before. `drawFrame` with `reaction: { kind: 'lookUp', age: 1 }` differs from no reaction. Twenty seconds later, with the comet still up, nothing has changed back to lookUp.
  - A `drawFrame` test that the `lookUp` eyes are in the upper half of Clawd's eye cells.
- [ ] **Step 2:** They FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests pass. Look at `tools/preview/run.sh band --reaction lookUp --frames 4`.
- [ ] **Step 5:** Commit `Clawd looks up when the sky does something`.

---

### Task 11: The sky notices the cursor

**Files:**
- Modify: `hooks/shader.ts`:
  - **Stars:** both random and real stars within 6 units of the cursor's centre brighten by up to ×1.8, fading with `exp(-(iTime - iTimeCursorChange) * 2.5)`.
  - **Birds, leaves and feathers:** pushed away from the cursor by up to 3 units within a radius of 8 units.
- Modify: `tools/preview/shader.mjs`: declare and set `iCurrentCursor`, `iTimeCursorChange` and `iFocus`, with `--cursor x,y` and `--since <seconds>`.
- Test: `hooks/solar.test.tsx`

- [ ] **Step 1: Find Ghostty's cursor coordinates.** Use a probe shader written to `runtime/`, as done on 2026-10-25: include it, reload, take a screenshot, restore. Draw a box from `iCurrentCursor.xy` and `.zw` and confirm the axes (Ghostty's `fragCoord` has y down) before writing the effect. Record the finding in the code's comment.
- [ ] **Step 2: Write the failing test**: `'the shader glances at the cursor'`. The shader text uses `iCurrentCursor` and `iTimeCursorChange`, and contains no `iDate`.
- [ ] **Step 3:** It FAILS. Implement.
- [ ] **Step 4:** Tests pass. Previews with `--cursor 400,300 --since 0.1` and `--since 5`: the glimmer shows only in the first. Also preview with birds (`--event birds`) and a cursor in their path.
- [ ] **Step 5:** Commit `The sky glances at the cursor`.

---

### Task 12: Confetti that has no wrong moment

**Files:**
- Modify: `hooks/shader.ts`: `confetti()` no longer uses `t`. Pieces fall steadily, each on its own `fract(iTime * speed + offset)` column, at an even density throughout.
- Test: `hooks/solar.test.tsx`

- [ ] **Step 1: Write the failing test**: `'confetti is an even rain: it ignores where its loop is'`. In the shader text, the body of `vec3 confetti(` up to the closing `}` at line start does not contain `, t,` / ` t)` / `t *`. Use a regex on the extracted function.
- [ ] **Step 2:** It FAILS. Implement.
- [ ] **Step 3:** Tests pass. Look at `--event milestone` at `--time 1`, `7` and `15`: about the same amount of confetti each time.
- [ ] **Step 4:** Commit `Confetti as an even rain`.

---

### Task 13: Live in Ghostty, measured

**Files:**
- Modify: `spike/RESULTS.md` (an "After the living sky" section with the numbers)

- [ ] **Step 1:** Start a fresh `claude` session in a new Ghostty tab with the mod loaded. In this session, watch `runtime/` and the include file.
- [ ] **Step 2: The lighthouse.**
  - Run `/solar event komet` in that session. Then ask something that needs a permission prompt and switch focus to another app with Ghostty visible.
  - Take a screenshot (`screencapture -x -o`) twice, 2 s apart: the beam must have moved.
  - Answer, and confirm the beam is gone.
- [ ] **Step 3: Measure.** Run `spike/measure.sh` for 60 s in four cases and record the results in `spike/RESULTS.md`:
  - focused on mains power;
  - unfocused with the lighthouse lit;
  - unfocused with the lighthouse still (after 5 min);
  - on battery (ask Vincent to pull the cable, or say so if he is not there).
- [ ] **Step 4:** Commit `Measure the living sky`.
