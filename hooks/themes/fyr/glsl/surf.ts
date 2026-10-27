// The sky shader's GLSL, part of the theme fyr: the keeper's surf,
// now and then, on a wave of his own.
export const SURF = `
// --- His surf ----------------------------------------------------------------

// Now and then, about one round in ten and never in rain or snow, his
// fishing gives way to a surf; forced (/solar event surf), every round is
// one, and with a UFO forced none, as he waits for it on the rocks.
// The salt gives none in the first eight rounds, so a Ghostty just started
// doesn't open on him surfing round after round.
bool isSurfLoop(float n) {
  if (THEME_FORCE != 0) return THEME_FORCE == 2;
  return PRECIPITATION == 0 && rand(int(n) * 19 + 41) < 0.1;
}

// The surf takes the fishing's 40 seconds; forced, it is all there is.
const float SURF_LOOP = 40.0;

// Seconds into his surf at \`time\`, or -1 when he isn't surfing: never with
// the lantern lit, and not asleep or at night unless it is forced.
float surfTime(float time) {
  if (BEACON != 0) return -1.0;
  if (THEME_FORCE == 2) return mod(time, SURF_LOOP);
  if (KEEPER_ASLEEP > 0.5 || night() > 0.6) return -1.0;
  float n = floor(time / DAY_LOOP);
  float t = time - n * DAY_LOOP;
  return t < SURF_LOOP && isSurfLoop(n) ? t : -1.0;
}

// The water he surfs on: in front of the rocks, nearer than they are.
float surfLevel(Lighthouse l) { return l.foot + 0.55 * l.s; }

// The wave \`t\` seconds into his surf: where its crest is, and how tall it
// stands. It rises out past the rocks' end (12 to 15 s), rolls in toward
// them and sinks back by 32.
vec2 surfCrest(float t, Lighthouse l) {
  float x = mix(l.x - 3.22 * l.s, l.x - 2.42 * l.s, smoothstep(15.0, 30.0, t));
  return vec2(x, 1.2 * l.s * smoothstep(12.0, 15.0, t) * (1.0 - smoothstep(26.0, 32.0, t)));
}

// How far ahead of its crest the wave's face is, in units of s, \`v\` of the
// way up it: hollow in the middle, its lip thrown forward at the top.
float surfFace(float v) { return 0.6 * (1.0 - v) * (1.0 - v) + 0.5 * v * v * v * v; }

// The wave's edge from p in pixels, below 0 inside: a rounded back, the
// hollow face, and the lip drooping toward the rocks.
float surfShape(vec2 p, float t, Lighthouse l) {
  vec2 crest = surfCrest(t, l);
  float v = (surfLevel(l) - p.y) / max(crest.y, 1.0);
  float x = (p.x - crest.x) / l.s;
  float top = (v - 1.0 + 0.8 * max(0.0, x) * max(0.0, x)) * crest.y;
  return max(max(-0.8 * sqrt(max(0.0, 1.0 - v)) - x, x - surfFace(clamp(v, 0.0, 1.0))) * l.s, top);
}

// How much of p the wave covers: down under the water line it fades into
// the sea, and out to the left, where the swell runs out.
float surfWave(vec2 p, float time, Lighthouse l) {
  float t = surfTime(time);
  if (t < 12.0 || t > 32.0) return 0.0;
  float height = surfCrest(t, l).y;
  float level = surfLevel(l);
  return clamp(0.5 - surfShape(p, t, l), 0.0, 1.0) * smoothstep(level + 0.4 * height + 1.0, level, p.y) * smoothstep(0.5, 2.0, height) * smoothstep(l.x - 4.0 * l.s, l.x - 3.5 * l.s, p.x);
}

// Where his feet are on the board, from paddling out to stepping off (2 to
// 30 s): out past the rocks' end, bobbing, then on the wave's face below
// its lip, carving slowly up and down it.
vec2 surfRider(float t, Lighthouse l) {
  float s = l.s;
  float c = keeperCell(s);
  vec2 crest = surfCrest(t, l);
  if (t < 12.0) return vec2(mix(l.x - 2.35 * s, crest.x + surfFace(0.35) * s, smoothstep(2.0, 12.0, t)), surfLevel(l) - 0.5 * c + 0.25 * c * sin(PI * (t - 2.0) / 2.5));
  float v = 0.35 + 0.1 * sin(PI * max(0.0, t - 15.0) / 2.5);
  return vec2(crest.x + surfFace(v) * s, surfLevel(l) - v * crest.y - 0.5 * c);
}

// His surf, \`t\` seconds in, in place of the fishing: down off the rocks
// onto his board, paddling out, turning as the wave rises behind him, up on
// it riding in toward the rocks, and off onto them to stand by his rod.
Keeper keeperSurf(float t, Lighthouse l) {
  vec2 spot = fishingSpot(l);
  Keeper kp = Keeper(spot, POSE_STAND, 1.0, 0.0, true, true, 0.0);
  if (t < 2.0) {
    kp.at = mix(spot, surfRider(2.0, l), t / 2.0);
    kp.pose = POSE_WALK;
    kp.facing = -1.0;
  } else if (t < 30.0) {
    kp.at = surfRider(t, l);
    kp.pose = t < 14.0 ? POSE_PADDLE : POSE_SURF;
    kp.facing = t < 12.0 ? -1.0 : 1.0;
  } else if (t < 31.5) {
    kp.at = mix(surfRider(30.0, l), spot, (t - 30.0) / 1.5);
    kp.pose = POSE_WALK;
  }
  return kp;
}

// His board \`t\` seconds into his surf: its middle, its slope, and how much
// of it shows. It waits in the water by the rocks as he steps down to it,
// is under him, nose down the face, until he steps off, and sinks away
// with the wave.
vec4 surfBoard(float t, Lighthouse l) {
  vec2 crest = surfCrest(t, l);
  vec2 at = surfRider(clamp(t, 2.0, 30.0), l) + vec2(0.0, 0.5 * keeperCell(l.s));
  if (t > 30.0) at.y = surfLevel(l) - 0.35 * crest.y;
  return vec4(at, 0.1 * crest.y / (1.2 * l.s), smoothstep(0.0, 1.0, t) * (1.0 - smoothstep(30.5, 32.0, t)));
}

// The wave and his board while he surfs. The wave's water in blue ink,
// deeper up it and in its hollow, white foam screened over its top and
// down its face as it breaks, and the key plate along it off register; his
// board yellow.
vec3 surf(vec3 sky, vec2 p, Lighthouse l, float u, float k) {
  float t = surfTime(iTime);
  if (t < 0.0) return sky;
  float s = l.s;
  float c = keeperCell(s);
  float off = max(1.0, floor(0.4 * c));
  float dark = 1.0 - 0.6 * night();
  float wave = surfWave(p, iTime, l);
  vec2 crest = surfCrest(t, l);
  if (wave > 0.0) {
    float dots = pitch(u);
    float v = clamp((surfLevel(l) - p.y) / crest.y, 0.0, 1.0);
    bool isFace = p.x > crest.x;
    sky = mix(sky, lift(INK_BLUE, k) * dark, screen(p, 0.3 + 0.4 * v + (isFace ? 0.15 : 0.0), dots, 75.0) * wave);
    float froth = max(smoothstep(0.55, 0.9, v), isFace ? 0.6 * smoothstep(22.0, 30.0, t) * smoothstep(-0.1, 0.3, v) : 0.0);
    sky = mix(sky, lift(vec3(0.94, 0.97, 1.0), k) * dark, screen(p, froth, dots, 15.0) * wave);
  }
  if (surfWave(p - vec2(off), iTime, l) > 0.0 && p.y - off < surfLevel(l)) sky = keyPlate(sky, surfShape(p - vec2(off), t, l), 0.5, 0.5, k);
  vec4 board = surfBoard(t, l);
  if (board.w <= 0.0) return sky;
  vec2 along = 0.4 * s * normalize(vec2(1.0, board.z));
  float show = screen(p, board.w, max(2.0, 0.5 * c), 45.0);
  sky = ink(sky, keyInk(k), segment(p - vec2(off), board.xy - along, board.xy + along) - 0.5 * c, 0.55 * show);
  return ink(sky, keeperInk(INK_YELLOW, k), segment(p, board.xy - along, board.xy + along) - 0.5 * c, show);
}
`
