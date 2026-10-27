# F3b mockup M1: the line and the grill

The plan's recommendation, ideas 2 and 4: the context window as fish the keeper has hung on a line from the tower to his hammock's post, and the grill on the rocks under it as the conversation compacts. GLSL only, on branch `fisk-m1` from `fisk` (`a2eb410`), driven by the tab's mark that `fisk` plumbs: `--fish N[,catch|grill|embers]` sets palette 16 to `[state, N, 1]`. No TS beyond `shader.ts`'s `BODY` and its import; the `BASKET` constant still gates it (its rename to `CONTEXT` is I2's).

The sheet: `tools/preview/sheet.sh fisk m1` writes `.preview/m-m1/` (20 frames at 1512x982 `--stage 480`, each with a 3x zoom on the island, then six at a Retina window's 3024x1964 `--stage 960`, and `contact.png` with every zoom). `BUNDLE=.preview/b/before.bundle.mjs tools/preview/sheet.sh fisk before` draws the same sheet as `fisk` has it.

## What is drawn

- **The post** (`post()` in `night.ts`, `hammockPost()` for where it stands) is always there; `hammock()` only ties its rope to it. Moving it out changed no pixel of the hammock: `--at 2026-10-24T04:00` without the context is byte-identical before and after.
- **The line** (`fishLine()`): cream, a pixel wide, from an indigo ring in the tower's wall at (x+0.47s, foot-2.2s) to the post's top at (x+2.0s, foot-1.03s), sagging 0.03s plus 0.008s a fish at its middle. Drawn only where the sky shows the context (`BASKET == 1`).
- **The fish** (`fish(q, s)` the SDF, `fishInk()`, `hungFish()`): 0.2s long (6 px in a 1512x982 window, 13 px at Retina), a `limb()` body tapering from the head and one mirrored `limb()` for the forked tail, joined with `smin()`; one ink `lift(mix(INK_BLUE, CREAM, 0.7))`, the key plate a solid copy `max(1, floor(0.4c))` px off register at alpha 0.45, an indigo eye of a pixel, a cream glint down the flank. Each hangs head up from a short cream loop and swings `0.15 sin(1.3t + i)(0.5 + WIND/10)` radians round it. Ten slots 0.144s apart along x (0.18s along the line), x+0.53s to x+1.83s; the fish slide down the line to the post end, so the oldest hangs by the post, the newest nearest the tower, and ten fill it.
- **The catch** (`r = 3`): if he is fishing (`POSE_FISH`: the first 40 s of each 90 s day, or a full moon's night) he takes `POSE_LAND`: his rod bent (a quadratic in six segments), the line taut, the new fish on it wriggling `0.45 sin(20t)`; the line shows one fewer until the mark goes back to 0. Anywhere else (gallery, inside, surf, asleep, lantern, taken) the newest fish on the line flashes cream at 3 Hz, drawn a pixel or two fatter. Both are a phase-free loop.
- **The grill** (`r = 1`, `grill()` and `grillSmoke()`): at x+1.15s on the rocks, seven stones on a flattened ring (a cream-indigo, screened in indigo at 60° toward their feet, each with a key plate), a dark pit with a heap of embers, the basket's three-ink fire through a grate with bars, and up to three of the oldest fish flat on the grate, blackening as the fire flickers (the basket's `burnt` rhythm), the bars burnt across them. The rest of the fish stay on the line, smoked toward indigo by half. The smoke is one screened column of four puffs drifting off to the right with `WIND` up past the gallery. He stands at x+0.5s facing it, a hand out over it (`POSE_GRILL`, one more cell in his arm row).
- **The embers** (`r = 2`): the heap glowing, pink and yellow sparks winking at 4 Hz, a thinner column of smoke, the grate bare, the line as the mark says (0 or 1 fish). He stays by the grill for its 3 s.
- `flame()`, a new `fire()` and `smoke()` moved out of `basket.ts` into `common.ts`, shared, so F5's fallback basket can still call them; `basket.ts` stays in the repo out of `BODY` and is no longer drawn in the corner. `CATCH` stands just before `UFO` in `BODY`, not where `BASKET` stood after it: `keeper()` calls it, and GLSL wants a function before its caller.

## Where it leaves the brief, and why

1. **The fish's ink is `mix(INK_BLUE, CREAM, 0.7)`, not 0.5.** At 0.5 its lightness is the day sky's at the island's height (luminance 0.66 against 0.64), so by day a fish was only its indigo plate. The plate's alpha is 0.45 rather than the keeper's 0.55: at Retina it is 3 px off on a 4 px wide body and read as a second fish. A contour plate instead of a solid one was tried and turned the fish into scribbles.
2. **He grills at x+0.5s, not 0.7s; the grill is at x+1.15s, not 1.1s.** He is six cells wide (0.77s); at 0.7s his right side reached 1.085s and hid the grill's left half and a tongue of its fire. At 0.5s he stands before the shut door's right half and just touches the ring's leftmost stone.
3. **The slots stop at x+1.83s, short of the post.** At x+1.91s the oldest fish's tail touched the hammock's rope, which runs from the post at foot-0.9s down to the bed.
4. **The blink is a fatter cream fish, not a cream tint.** On the lighter fish a tint did not show at 1x.
5. **He stays at the grill through the embers too.** Otherwise, from 03 to 06, he would be back in a hammock that is not hung (below).
6. **Smoke**: the basket's four separate discs read as bubbles at night. Here the puffs start small, grow taller than wide, sway more as they rise and are screened once as one tone (the most any puff gives), so they make a column; it is inked with `keeperInk` so it dims at night as his things do. `basket.ts`'s smoke is the same function, so its look changed with it.
7. **On the grate: the oldest three, larger (0.24s) and less burnt than the basket's paper,** so they read as fish in the fire at Retina; the rest stay on the line, smoked.

## Conflicts found

- **Hammock and grill.** The grill at x+1.1s stands under the hammock's bed (x+0.86s to 1.7s, its underside at foot-0.3s there) and the fire reaches the bed. The plan saw this for the drying rack (idea 1) but not for the grill. Here, while the grill burns or glows, the hammock is down and he is at the grill (`18-grill-asleep`); he is back in it once the mark is 0. A UFO visit still finds him in his hammock, over the grill, as rare as three rare things at once.
- **Hammock rope and the line's last fish**: see 3 above. The snore's z drifts up through the post-end fish, in front of them.
- **Door**: at the grill he stands before the shut door; the grill's pose replaces his routine's door too (a shut door), so a grill starting as he steps out cuts to it shut. His walk to the door is left of the tower, never under the line.
- **UFO**: the grill's pose yields to a whole visit, so the saucer hovers where `keeperAt` has him; the saucer's path and beam stay left of the tower or far above the line (`13-abduction`). The smoke can pass behind the saucer, which is drawn last.
- **Lantern and beam**: the beam turns at the lantern's height, foot-5.4s, far above the line's top at foot-2.2s (`12-beacon`). With the lantern lit and the grill burning he leaves the gallery for the grill (the plan: unless taken or inside). The fishing lantern at a full moon stays on the rocks.
- **Surf**: while he grills, the wave and his board are left off; drawn, they were a board riding in without him.
- **Smoke** passes over the line's fish (they are smoked) and past the gallery's right end; in a gale (`19-grill-gale`) it leans far right, drift capped at 1.6s so it never meets the keeper's box edge at x+4s.
- The first slot's fish (ten on the line) touches the tower's edge.

## What reads and what does not

Reads:
- **The count as a gauge**, by day and by night: 0, 3, 7 and 10 (`01` to `05`) read at a glance as how full the line is. At night the pale fish stand out best (`05-night7`, `r6-asleep`).
- **At Retina each fish is a fish** (`r1-day7`, `r6-asleep`): head up, forked tail, the plate off register. At 1x a fish is 6 px, a hanging tick: the fraction reads, the species barely.
- **The catch** (`06`, `07`, `r2-catch`): the bent rod and the fish on its line read even at 1x. **The blink** (`16`, `r3-blink`) is unmistakable.
- **The grill by night** (`17`, `18`): three-ink fire, him at it, the column of smoke. **Asleep under the line** (`14`, `r6-asleep`): the composition the plan hoped for, nothing touching.

Weak:
- **The fish on the grate**: invisible at 1x; at Retina, striped shapes in the flames (`r4-grill`), "something on the grill" more than fish.
- **The stones and the grate** are a smudge at 1x; they read at Retina.
- **The embers by day at 1x** are a few orange pixels (`11-embers`); by night they read (`20-embers-1`, `r5-embers`).
- **His hand out** reads as a long arm, a plank, at 1x.
- **The smoke by day** is a soft light grey on a light sky, visible but quiet; by night its puffs still show as lumps.
- **Exact counts at 1x**: fish 4.5 px apart; 3 counts, 7 against 8 does not. The cream loop and the eye are under a pixel at 1x.

## Proofs

- **Parity** (`tools/preview/parity.sh check .preview/parity-fisk`, recorded before any change): every scene differs, and only where it should. In the ten scenes without the context, 115 px in x 1391..1393, y 576..614: the post, now always standing (at `--stage 0` the lighthouse is at 0.88 of the width and the post at x+2.0s). In `dolphin` (`--basket 6`) the island changes in x 1343..1394, y 539..614 (the line, six fish, the post) and the corner in x 1465..1499, y 940..978 (the wastebasket gone); the dolphin, the lit lantern and everything else are byte-identical.
- **Cost**: interleaved before/after pairs, `--bench 20`, `--stage 480 --time 20`, `fisk`'s bundle against this one, on a machine shared with another workflow's benches. SwiftShader, ten pairs a scene, median ratio after/before: `--fish 7` by day **1.06**, `--fish 7,grill` **1.03**, `--at 22:00 --fish 7` **1.08**, every pair between 0.57 and 1.56, the middle half of the thirty between 0.96 and 1.19. On the Mac's GPU (`--gpu`), five pairs a scene: **0.94**, **0.96**, **0.99** (2.2 to 3.7 ms a frame). The lean above 1 on SwiftShader is the neighbour's load, not the code: at state 0 nothing new is drawn but the line's band, and the grill's fire and smoke stand in for the corner basket's, which `fisk` drew burning.
- **Tests**: `claude plugin test .` 99 pass (the same 99 as `fisk`; no test file changed). A first run, during the sheet's renders, timed out once in `sky.test.tsx`'s statistical events test (5.46 s against 5 s), which this change does not touch; the rerun passed.
- **Types**: `npx -y -p typescript@5.6.3 tsc -p . --noEmit` clean.

## For the judges and I1

- The mark's states have engine-neutral names in the shader (`CONTEXT_IDLE`, `CONTEXT_CLEARING`, `CONTEXT_CLEARED`, `CONTEXT_GAINED`); `contextFish()` and `contextState()` read it as `basket()` did.
- Box tests first: `keeper()`'s own box, then `post()`, `fishLine()` (a rectangle, then a band under the line), `grill()` and `grillSmoke()` (the state, then a rectangle), `landing()` only while landing. Away from the island nothing new is computed.
- Lively: the sway and the blink are phase-free and need no frame loop; the grill's fire and embers animate as the basket's did, and I2's `livelyAt` should count grill and embers but not the catch.
- `keeperMode` is untouched; the grill's pose and the landing are set in `keeper()` only.
