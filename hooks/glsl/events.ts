// The sky shader's GLSL, part of hooks/shader.ts's BODY: the sky's events,
// the Swedish days, and the ISS.
export const EVENTS = `
// --- Events ------------------------------------------------------------------

// The shooting stars' own schedule, one in each slot of the period at a
// random moment: how long ago the latest of them started at \`time\`, and
// where it starts from. Before this slot's has started, the one before
// (its 0.9 s long over).
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

vec3 shootingStars(vec3 sky, vec2 p, float u) {
  vec2 from;
  float age = shootingStarAge(iTime, from);
  if (age < 0.0 || age > 0.9) return sky;
  int n = int(mod(floor(iTime / (3600.0 / SHOOTING_RATE)), 100000.0));
  vec2 dir = normalize(vec2(rand(n) < 0.5 ? -1.0 : 1.0, 0.45));
  vec2 head = from + dir * age * 24.0 * u;
  float tail = 9.0 * u * min(1.0, age / 0.15);
  float along = clamp(dot(head - p, dir) / tail, 0.0, 1.0);
  float d = segment(p, head - dir * tail, head);
  float fade = (1.0 - along) * (1.0 - age / 0.9);
  return mix(sky, mix(vec3(1.0, 0.97, 0.9), INK_YELLOW, along), clamp(0.5 - d + 0.6, 0.0, 1.0) * fade);
}

vec3 satellite(vec3 sky, vec2 p, float u, float seed, float t) {
  vec2 a = iResolution.xy * vec2(-0.05, 0.08 + 0.3 * seeded(seed, 1));
  vec2 b = iResolution.xy * vec2(1.05, 0.05 + 0.3 * seeded(seed, 2));
  vec2 at = mix(a, b, t);
  return ink(sky, vec3(1.0, 0.97, 0.9), length(p - at) - 0.14 * u, 0.9);
}

// The Swedish flag's blue and yellow, and the ink of night silhouettes.
const vec3 SWEDISH_BLUE = vec3(0.0, 0.42, 0.66);
const vec3 SWEDISH_YELLOW = vec3(1.0, 0.8, 0.0);
const vec3 NIGHT_INK = vec3(0.09, 0.08, 0.2);

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
  vec2 b = abs(q - vec2(0.0, 1.9 * r)) - vec2(0.28, 0.16) * r;
  float basket = max(b.x, b.y);
  float ropes = min(segment(q, vec2(-0.32, 1.45) * r, vec2(-0.24, 1.75) * r), segment(q, vec2(0.32, 1.45) * r, vec2(0.24, 1.75) * r)) - 0.04 * u;
  // Gores in three inks, the seed choosing their order; shaded to the right.
  // Never below 0: % of a negative int is undefined in GLSL.
  int gore = max(int(floor((q.x / max(across, 0.01) + 2.0) * 3.0)), 0) + int(seed);
  // Blue and yellow on the national day.
  vec3 gores[3] = vec3[3](INK_PINK, INK_YELLOW, INK_ORANGE);
  if (FLAG_DAY > 0.5) {
    gores[0] = SWEDISH_BLUE;
    gores[2] = SWEDISH_BLUE;
  }
  vec3 color = gores[gore % 3];
  color = mix(color, mix(color, INK_INDIGO, 0.35), screen(p, clamp(q.x / r * 0.6 + 0.2, 0.0, 1.0), max(3.0, u * 0.24), 45.0));
  sky = ink(sky, lift(color, k), envelope, 1.0);
  sky = ink(sky, lift(mix(INK_ORANGE, INK_INDIGO, 0.4), k), min(basket, ropes), 1.0);
  // The key plate, a little off register.
  float key = abs(length((q - vec2(0.12, 0.1) * u) / vec2(1.0, 1.15)) - r) - 0.08 * u;
  return ink(sky, lift(INK_INDIGO, k), key, 0.7);
}

// A bird's wing in its frame (x ahead, y down, in units of its size), two
// tapering limbs from the shoulder: the arm swept back at \`f1\` from
// straight behind, turning up, and the hand after it at \`f2\`.
float birdWing(vec2 q, float f1, float f2) {
  vec2 shoulder = vec2(0.0, -0.05);
  vec2 elbow = shoulder + vec2(-cos(f1), -sin(f1)) * 0.4;
  vec2 tip = elbow + vec2(-cos(f2), -sin(f2)) * 0.5;
  return smin(limb(q, shoulder, elbow, 0.13, 0.09), limb(q, elbow, tip, 0.09, 0.035), 0.04);
}

// A goose or a crane flying toward +x, in profile, as a cartoon draws one:
// a plump body tapering to the tail, the neck held out ahead, the head
// running into the bill, and the near wing. A crane's neck is longer and
// thinner, its bill longer, and its legs trail out behind it.
float birdShape(vec2 q, bool isCrane, float f1, float f2) {
  float body = limb(q, vec2(-0.5, 0.02), vec2(0.22, 0.0), 0.04, 0.15);
  float neck = isCrane ? limb(q, vec2(0.22, -0.03), vec2(0.8, -0.2), 0.07, 0.04) : limb(q, vec2(0.22, -0.03), vec2(0.68, -0.16), 0.09, 0.055);
  vec2 head = isCrane ? vec2(0.8, -0.2) : vec2(0.68, -0.16);
  float bill = limb(q, head, head + (isCrane ? vec2(0.34, 0.04) : vec2(0.3, 0.04)), isCrane ? 0.065 : 0.075, isCrane ? 0.012 : 0.015);
  float d = smin(smin(body, neck, 0.06), bill, 0.02);
  if (isCrane) d = min(d, limb(q, vec2(-0.4, 0.03), vec2(-0.98, 0.12), 0.05, 0.04));
  return smin(d, birdWing(q, f1, f2), 0.04);
}

// Bird i of the skein printed, q from its place in the window's pixels, s
// its size, \`back\` the way the ranks trail: its wings beating on its own
// count, and every sixth beat held out a little up in a glide, eased in
// and out, that runs down the V behind the leader. Printed as the dolphin
// is, two plates off register: a blue plate of the whole bird shifted
// down and to the right, and the indigo plate over it. The far wing beats
// with the near one from behind and above it, raised a little more so it
// shows past it, and lighter, so it reads as the one behind.
vec3 birdPrint(vec3 sky, vec2 q, float s, int i, float back, bool isCrane, float u, float k) {
  float rank = float((i + 1) / 2);
  float phase = iTime * 6.0 + 1.3 * float(i) - 0.6 * rank;
  float beat = phase / (2.0 * PI);
  float glide = mod(floor(beat), 6.0) > 4.5 ? smoothstep(0.0, 0.15, fract(beat)) * smoothstep(1.0, 0.85, fract(beat)) : 0.0;
  float a1 = mix(0.55 * sin(phase), 0.15, glide);
  float a2 = mix(0.5 * sin(phase - 0.6), 0.1, glide);
  // Seen from the side the stroke runs from well above the back to below
  // the belly, so the angles are opened out.
  float f1 = 0.2 + 1.6 * a1;
  float f2 = f1 + 1.2 * a2 + 0.3;
  // The plate is shifted the print's way before the bird is turned to face
  // its own.
  vec2 turn = vec2(-back, 1.0) / s;
  vec2 b2 = (q - vec2(0.1, 0.08) * u) * turn;
  vec2 b = q * turn;
  vec2 far = vec2(-0.12, -0.1);
  sky = ink(sky, lift(INK_BLUE, k), min(birdShape(b2, isCrane, f1, f2), birdWing(b2 - far, f1 + 0.2, f2 + 0.2)) * s, 0.45);
  sky = ink(sky, lift(INK_INDIGO, k), birdWing(b - far, f1 + 0.2, f2 + 0.2) * s, 0.6);
  return ink(sky, lift(INK_INDIGO, k), birdShape(b, isCrane, f1, f2) * s, 0.9);
}

// A skein of nine, geese or cranes by the seed, in a V behind its leader,
// the leader largest and each rank behind it a little smaller, no bird
// holding its place exactly and each rank heaving slowly in turn. A pixel
// lies in the box of at most two of them, so the loop only finds which,
// and those are printed after it, as the leaves are.
vec3 birds(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  bool isEast = seeded(seed, 1) < 0.5;
  bool isCrane = seeded(seed, 3) < 0.5;
  vec2 lead = vec2(mix(-0.15, 1.15, isEast ? t : 1.0 - t) * iResolution.x, iResolution.y * (0.12 + 0.25 * seeded(seed, 2)));
  float back = isEast ? -1.0 : 1.0;
  // The last rank is 6.4u back and 3.6u aside and strays 0.35u, its box
  // reaches 1u, and the cursor shoves a bird at most 3u.
  if (abs(p.x - lead.x) > 11.0 * u || abs(p.y - lead.y) > 8.0 * u) return sky;
  int hits = 0;
  int first = 0;
  int second = 0;
  vec2 q1 = vec2(0.0);
  vec2 q2 = vec2(0.0);
  for (int i = 0; i < 9; i++) {
    float rank = float((i + 1) / 2);
    float side = i % 2 == 0 ? 1.0 : -1.0;
    vec2 at = lead + vec2(back * rank * 1.6 * u, side * rank * 0.9 * u);
    at += (vec2(seeded(seed, 10 + i * 2), seeded(seed, 11 + i * 2)) - 0.5) * 0.3 * u;
    at.y += sin(iTime * 0.6 - 0.8 * rank) * 0.2 * u;
    vec2 q = p - shy(at, u);
    // Its box: the bill and a crane's legs ahead and behind, the wing tips
    // above and below, and the plate's shift.
    float s = 0.85 * u * (1.0 - 0.06 * rank);
    if (abs(q.x) > 1.5 * s || abs(q.y) > 1.4 * s) continue;
    if (hits == 0) {
      first = i;
      q1 = q;
    } else if (hits == 1) {
      second = i;
      q2 = q;
    }
    hits++;
  }
  for (int j = 0; j < min(hits, 2); j++) {
    int i = j == 0 ? first : second;
    sky = birdPrint(sky, j == 0 ? q1 : q2, 0.85 * u * (1.0 - 0.06 * float((i + 1) / 2)), i, back, isCrane, u, k);
  }
  return sky;
}

// An airliner seen from below, in its own frame (x towards the nose, y
// across, s its unit): fuselage, swept wings, tailplane.
float airframe(vec2 q, float s) {
  vec2 m = vec2(q.x, abs(q.y));
  float body = min(limb(q, vec2(1.5, 0.0) * s, vec2(1.0, 0.0) * s, 0.1 * s, 0.19 * s), limb(q, vec2(1.0, 0.0) * s, vec2(-1.55, 0.0) * s, 0.19 * s, 0.06 * s));
  float wing = limb(m, vec2(0.2, 0.0) * s, vec2(-0.5, 1.65) * s, 0.3 * s, 0.07 * s);
  float tail = limb(m, vec2(-1.2, 0.0) * s, vec2(-1.5, 0.65) * s, 0.14 * s, 0.05 * s);
  return min(body, min(wing, tail));
}

// An airliner crossing high up, printed as the balloon is; its contrails,
// one from each engine, drift together and widen, lit pink and orange
// when the sun is low. At night only its silhouette and lights.
vec3 plane(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  bool isEast = seeded(seed, 1) < 0.5;
  vec2 a = iResolution.xy * vec2(isEast ? -0.05 : 1.05, 0.1 + 0.25 * seeded(seed, 2));
  vec2 b = iResolution.xy * vec2(isEast ? 1.05 : -0.05, 0.05 + 0.2 * seeded(seed, 3));
  vec2 at = mix(a, b, t);
  vec2 dir = normalize(b - a);
  vec2 n = vec2(-dir.y, dir.x);
  float s = 1.1 * u;
  float elevation = sceneNow().elevation;
  bool isNight = elevation < -4.0;
  float behind = dot(at - p, dir);
  if (behind > 0.0 && !isNight) {
    float across = dot(p - at, n);
    float spread = mix(0.6 * s, 0.22 * s, smoothstep(0.0, 0.3 * iResolution.x, behind));
    float width = 0.08 * u + behind * 0.01;
    float fade = 0.6 * exp(-behind / (0.5 * iResolution.x)) * smoothstep(1.4 * s, 3.5 * s, behind);
    float cover = max(smoothstep(width + 0.8, width - 0.8, abs(across - spread)), smoothstep(width + 0.8, width - 0.8, abs(across + spread))) * fade;
    vec3 trail = mix(vec3(1.0), mix(INK_PINK, INK_ORANGE, 0.45), smoothstep(16.0, 4.0, elevation) * 0.8);
    sky = mix(sky, lift(trail, k), screen(p, cover, max(3.0, u * 0.24), 30.0) * 0.8 + cover * 0.25);
  }
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
  vec3 color = mix(belly, mix(belly, INK_INDIGO, 0.35), screen(p, clamp(0.3 - q.y / s * 0.35, 0.0, 1.0), max(3.0, u * 0.24), 45.0));
  sky = ink(sky, lift(color, k), frame, 1.0);
  vec3 accents[3] = vec3[3](INK_PINK, INK_ORANGE, INK_BLUE);
  sky = ink(sky, lift(accents[int(seeded(seed, 4) * 3.0) % 3], k), engines, 1.0);
  // The key plate, a little off register.
  vec2 off = d - vec2(0.12, 0.1) * u;
  float key = abs(airframe(vec2(dot(off, dir), dot(off, n)), s)) - 0.06 * u;
  return ink(sky, lift(INK_INDIGO, k), key, 0.7);
}

// Three inks screened at their own angles: where they overlap the dots
// mix, orange where pink meets yellow, green where yellow meets blue.
vec3 rainbow(vec3 sky, vec2 p, float k) {
  vec2 c = iResolution.xy * vec2(0.12, 1.2);
  float radius = iResolution.y * 0.78;
  float band = iResolution.y * 0.035;
  float r = length(p - c);
  float pitch = max(3.0, iResolution.y / 60.0 * 0.24);
  // Fading toward the ground and toward the arc's ends.
  float fade = 0.75 * smoothstep(iResolution.y * 1.0, iResolution.y * 0.55, p.y);
  vec3 inks[3] = vec3[3](INK_PINK, INK_YELLOW, INK_BLUE);
  float angles[3] = float[3](75.0, 0.0, 15.0);
  for (int i = 0; i < 3; i++) {
    float centre = radius + (1.0 - float(i)) * band;
    float cover = smoothstep(band * 1.1, band * 0.3, abs(r - centre)) * fade;
    sky = mix(sky, lift(inks[i], k), screen(p, cover * 0.7, pitch, angles[i]) * 0.75);
  }
  return sky;
}

vec3 kite(vec3 sky, vec2 p, float u, float seed, float k) {
  vec2 anchor = vec2(iResolution.x * (0.2 + 0.2 * seeded(seed, 1)), iResolution.y);
  vec2 at = vec2(iResolution.x * (0.35 + 0.2 * seeded(seed, 2)) + sin(iTime * 0.7) * 1.5 * u, iResolution.y * (0.22 + 0.1 * seeded(seed, 3)) + sin(iTime * 1.1) * 0.8 * u);
  float cord = segment(p, at + vec2(0.0, 1.3 * u), anchor) - 0.03 * u;
  // Off the string, the kite and its bows sit within 1.5u across and from
  // 1.5u above to 4.9u below it.
  vec2 off = p - at;
  if (cord > 0.5 && (abs(off.x) > 1.5 * u + 1.0 || off.y < -1.5 * u - 1.0 || off.y > 4.9 * u + 1.0)) return sky;
  float tilt = sin(iTime * 0.9) * 0.25;
  vec2 q = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * off;
  float diamond = (abs(q.x) / (0.9 * u) + abs(q.y) / (1.3 * u) - 1.0) * 0.9 * u;
  vec3 color = (q.x < 0.0) == (q.y < 0.0) ? INK_PINK : INK_YELLOW;
  sky = ink(sky, lift(INK_INDIGO, k), cord, 0.5);
  for (int j = 0; j < 6; j++) {
    vec2 bow = at + vec2(sin(iTime * 2.0 + float(j)) * 0.5 * u, (float(j) + 1.6) * 0.7 * u);
    sky = ink(sky, lift(j % 2 == 0 ? INK_BLUE : INK_PINK, k), length((p - bow) / vec2(1.6, 1.0)) - 0.16 * u, 1.0);
  }
  sky = ink(sky, lift(color, k), diamond, 1.0);
  return ink(sky, lift(INK_INDIGO, k), abs(diamond) - 0.06 * u, 0.6);
}

// What the wind carries, each in its own frame: its midrib along x, the
// stem at -x, in units of its size. A leaf is one shape from a table of
// parts, so no leaf branches on its kind: a midrib capsule, three lobes
// mirrored about it (a lobe with no radius is left out) and a stem, joined
// with smin. A maple's midrib is its middle lobe, and two pairs more fan
// from the base; a birch is the egg alone, drawn out to a point; an oak has
// two pairs of round lobes along its midrib and one at its tip, the bays
// between them cut deep enough to show at a window's scale (three pairs
// there read as a caterpillar). A blossom is a cherry petal, notched between its two
// lobes, or a whole flower, five petals round a heart.
const int LEAF_MAPLE = 0;
const int LEAF_BIRCH = 1;
const int LEAF_OAK = 2;
const int PETAL = 3;
const int FLOWER = 4;
// Per leaf kind: the midrib's ends and radii; three lobes, each a capsule
// from xy to zw, with their radii beside; the stem's ends and the smin
// radius; and the midrib's run as a line in the key plate.
const vec4 LEAF_RIB[3] = vec4[3](vec4(-0.22, 0.24, 0.11, 0.03), vec4(-0.06, 0.36, 0.22, 0.04), vec4(-0.3, 0.34, 0.07, 0.11));
const vec4 LEAF_LOBE[9] = vec4[9](
  vec4(-0.22, 0.0, 0.14, 0.174), vec4(-0.22, 0.0, -0.009, 0.266), vec4(0.0, 0.0, 0.1, 0.0),
  vec4(0.0, 0.0, 0.1, 0.0), vec4(0.0, 0.0, 0.1, 0.0), vec4(0.0, 0.0, 0.1, 0.0),
  vec4(-0.18, 0.0, -0.13, 0.15), vec4(0.06, 0.0, 0.11, 0.15), vec4(0.0, 0.0, 0.1, 0.0));
const vec2 LEAF_LOBE_R[9] = vec2[9](
  vec2(0.1, 0.03), vec2(0.09, 0.03), vec2(-1.0),
  vec2(-1.0), vec2(-1.0), vec2(-1.0),
  vec2(0.08, 0.1), vec2(0.08, 0.1), vec2(-1.0));
const vec3 LEAF_STEM[3] = vec3[3](vec3(-0.22, -0.42, 0.08), vec3(-0.28, -0.48, 0.05), vec3(-0.3, -0.5, 0.05));
const vec2 LEAF_VEIN[3] = vec2[3](vec2(-0.3, 0.22), vec2(-0.36, 0.34), vec2(-0.3, 0.36));

float leafShape(vec2 q, int kind) {
  vec2 m = vec2(q.x, abs(q.y));
  vec4 rib = LEAF_RIB[kind];
  vec3 stem = LEAF_STEM[kind];
  int n = kind * 3;
  float d = limb(q, vec2(rib.x, 0.0), vec2(rib.y, 0.0), rib.z, rib.w);
  d = smin(d, limb(m, LEAF_LOBE[n].xy, LEAF_LOBE[n].zw, LEAF_LOBE_R[n].x, LEAF_LOBE_R[n].y), stem.z);
  d = smin(d, limb(m, LEAF_LOBE[n + 1].xy, LEAF_LOBE[n + 1].zw, LEAF_LOBE_R[n + 1].x, LEAF_LOBE_R[n + 1].y), stem.z);
  d = smin(d, limb(m, LEAF_LOBE[n + 2].xy, LEAF_LOBE[n + 2].zw, LEAF_LOBE_R[n + 2].x, LEAF_LOBE_R[n + 2].y), stem.z);
  return min(d, segment(q, vec2(stem.x, 0.0), vec2(stem.y, 0.0)) - 0.025);
}

float blossomShape(vec2 q, bool isFlower) {
  if (isFlower) {
    // The petal in this fifth of the way round, turned to lie along x.
    float sector = floor(atan(q.y, q.x) / 1.2566 + 0.5) * 1.2566;
    vec2 r = vec2(q.x * cos(sector) + q.y * sin(sector), q.y * cos(sector) - q.x * sin(sector));
    return limb(r, vec2(0.05, 0.0), vec2(0.21, 0.0), 0.05, 0.11);
  }
  vec2 f = q - vec2(-0.24, 0.0);
  return smin(limb(f, vec2(0.0), vec2(0.395, 0.144), 0.05, 0.12), limb(f, vec2(0.0), vec2(0.395, -0.144), 0.05, 0.12), 0.03);
}

float driftShape(vec2 q, int kind) { return kind >= PETAL ? blossomShape(q, kind == FLOWER) : leafShape(q, kind); }

// Which of the eighteen piece i is, and its size: the leaves run through
// their three kinds by threes, so each kind comes in each ink; every
// fourth piece of blossom is a whole flower, 1.4 times a petal's size.
int pieceKind(int i, bool isBlossom) { return isBlossom ? (i % 4 == 0 ? FLOWER : PETAL) : (i / 3) % 3; }
float pieceSize(int i, int kind, float u, float seed) { return u * (1.15 + 0.35 * seeded(seed, i * 4 + 2)) * (kind == FLOWER ? 1.4 : 1.0); }

// Piece i printed at q from its place, as the dolphin is: the body in its
// ink, one more plate screened over one half of it (yellow dots on the lit
// half of an orange leaf, indigo on the shadow half of a yellow one or an
// oak, pink densest at a petal's base or round a flower's heart), and the
// indigo key plate a little off register, the midrib a line in it. It
// turns over as it goes: edge-on, then its back, paler and unscreened. A
// whole flower keeps its face up and never goes quite edge-on.
vec3 driftPrint(vec3 sky, vec2 p, vec2 q, int i, float u, float seed, bool isBlossom, float k) {
  vec3 leaf[3] = vec3[3](INK_ORANGE, INK_YELLOW, mix(INK_ORANGE, INK_PINK, 0.5));
  vec3 petal[3] = vec3[3](mix(INK_PINK, CREAM, 0.55), mix(INK_PINK, CREAM, 0.7), mix(INK_PINK, CREAM, 0.4));
  float a = seeded(seed, i * 4);
  float b = seeded(seed, i * 4 + 1);
  int kind = pieceKind(i, isBlossom);
  float s = pieceSize(i, kind, u, seed);
  float spin = iTime * (1.5 + 2.0 * a) + b * 6.0;
  float turn = cos(iTime * (1.1 + 1.3 * a) + 7.0 * b);
  float flip = kind == FLOWER ? mix(0.6, 1.0, abs(turn)) : widthShown(turn, 0.45);
  vec2 f = tumble(q, spin, flip) / s;
  float scale = s * abs(flip);
  // An oak has gone russet whatever the cycle gives the others.
  vec3 color = isBlossom ? petal[i % 3] : kind == LEAF_OAK ? mix(mix(INK_ORANGE, INK_YELLOW, 0.2), INK_INDIGO, 0.22) : leaf[i % 3];
  if (flip < 0.0) {
    color = mix(color, CREAM, 0.35);
  } else {
    float tone = 0.55 * step(f.y, 0.0);
    float angle = 0.0;
    vec3 over = INK_YELLOW;
    if (isBlossom) {
      tone = 0.8 * (kind == FLOWER ? smoothstep(0.32, 0.05, length(f)) : smoothstep(0.3, -0.2, f.x));
      angle = 75.0;
      over = INK_PINK;
    } else if (kind == LEAF_OAK || i % 3 == 1) {
      tone = 0.35 * step(0.0, f.y);
      angle = 45.0;
      over = mix(color, INK_INDIGO, 0.7);
    }
    color = mix(color, over, screen(p, tone, max(3.0, u * 0.24), angle));
  }
  sky = ink(sky, lift(color, k), driftShape(f, kind) * scale, 0.95);
  if (kind == FLOWER) sky = ink(sky, lift(INK_YELLOW, k), (length(f) - 0.09) * scale, 0.95);
  // The key plate a whole pixel or more off, so it never blurs.
  vec2 f2 = tumble(q - max(vec2(1.0), floor(vec2(0.07, 0.06) * u)), spin, flip) / s;
  float key = abs(driftShape(f2, kind) * scale) - 0.035 * u;
  if (!isBlossom) key = min(key, segment(f2, vec2(LEAF_VEIN[kind].x, 0.0), vec2(LEAF_VEIN[kind].y, 0.0)) * scale - 0.015 * u);
  return ink(sky, lift(INK_INDIGO, k), key, kind == FLOWER ? 0.4 : isBlossom ? 0.3 : 0.55);
}

// Leaves (or blossom) tumbling across on the wind: eighteen pieces, maple,
// birch and oak leaves in three inks, or cherry petals with every fourth
// piece a whole flower, fluttering a little on the way. Their places are
// cheap to find and their prints are not, and a pixel lies in the box of
// at most a couple of them; so the loop only finds which pieces box this
// pixel, and those are printed after it, at most two, in the loop's order.
// A loop body skipped by continue still costs SwiftShader (the preview's
// bench) as if every pixel ran it.
vec3 drift(vec3 sky, vec2 p, float u, float seed, bool isBlossom, float k) {
  int hits = 0;
  int first = 0;
  int second = 0;
  vec2 q1 = vec2(0.0);
  vec2 q2 = vec2(0.0);
  for (int i = 0; i < 18; i++) {
    float a = seeded(seed, i * 4);
    float b = seeded(seed, i * 4 + 1);
    float span = iResolution.x + 4.0 * u;
    float x = mod(a * span + iTime * (2.0 + WIND * 0.6) * u * (0.6 + 0.8 * b), span) - 2.0 * u;
    // A piece is drawn within 1.2u of its place, which flutters 0.15u and
    // the cursor shoves at most 3u.
    if (abs(p.x - x) > 4.5 * u) continue;
    x += sin(iTime * 5.0 + 20.0 * a) * 0.15 * u;
    float y = mod(b * iResolution.y + iTime * 0.9 * u * (0.5 + a), iResolution.y + 4.0 * u) - 2.0 * u + sin(iTime * 1.7 + a * 9.0) * u;
    vec2 q = p - shy(vec2(x, y), u);
    // The box round it before any turning: its reach, the key plate's
    // shift and the outline.
    int kind = pieceKind(i, isBlossom);
    float reach = (isBlossom ? 0.5 : 0.75) * pieceSize(i, kind, u, seed);
    if (abs(q.x) > reach || abs(q.y) > reach) continue;
    if (hits == 0) {
      first = i;
      q1 = q;
    } else if (hits == 1) {
      second = i;
      q2 = q;
    }
    hits++;
  }
  for (int j = 0; j < min(hits, 2); j++) sky = driftPrint(sky, p, j == 0 ? q1 : q2, j == 0 ? first : second, u, seed, isBlossom, k);
  return sky;
}

vec3 comet(vec3 sky, vec2 p, float u, float seed) {
  vec2 head = domeToPixel(COMET_AT);
  // The ion tail points straight away from the sun; the dust tail lags a
  // little behind, curving.
  vec2 ion = vec2(cos(COMET_AWAY), sin(COMET_AWAY));
  vec2 dir = normalize(ion - vec2(-ion.y, ion.x) * 0.18);
  vec2 side = vec2(-dir.y, dir.x);
  float pitch = max(3.0, u * 0.24);
  float pulse = 0.9 + 0.1 * sin(iTime * 1.6);
  vec2 q = p - head;
  float along = dot(q, dir);
  float a = max(along, 0.0);
  float bend = a * a * 0.0006 / u;
  float width = 0.5 * u + a * 0.11;
  float across = (dot(q, side) - bend) / width;
  float ionAlong = dot(q, ion);
  vec2 ionSide = vec2(-ion.y, ion.x);
  float r = length(q);
  // What each part can still touch: the dust tail's grains thin out past
  // 200u and four widths of its spine; the ion tail is screened to nothing
  // past 80u and its flutter keeps it inside a strip; the coma is gone by 12u.
  bool isDust = along > -2.0 * u && along < 200.0 * u && abs(across) < 4.0;
  bool isIon = ionAlong > 0.0 && ionAlong < 80.0 * u && abs(dot(q, ionSide)) < 0.2 * u + 0.026 * ionAlong;
  bool isComa = r < 12.0 * u;
  if (!isDust && !isIon && !isComa) return sky;
  if (isDust) {
    // The dust tail: a broad fan, densest along its spine and fading
    // softly to its edges, yellow printed over pink so the curve's outer
    // edge runs orange.
    float fall = exp(-a / (10.0 * u)) * smoothstep(-2.0 * u, 0.8 * u, along);
    float edge = exp(-pow(across - 0.45, 2.0) * 4.0) * fall * smoothstep(0.0, 4.0 * u, a);
    sky = mix(sky, INK_PINK, screen(p, edge * 0.5, pitch, 75.0) * 0.85);
    float spine = exp(-across * across * 2.2) * fall;
    sky = mix(sky, INK_YELLOW, screen(p, spine * 0.8, pitch, 0.0) * 0.9);
    // Grains carried out down the tail, an even stream with no start.
    vec2 g = vec2(a / (1.6 * u) - iTime * 0.9, across * width / (0.9 * u));
    vec2 cell = floor(g);
    int n = int(cell.x) * 7919 + int(cell.y) * 104729 + int(seed);
    if (rand(n) < 0.3) {
      vec2 f = fract(g) - 0.2 - vec2(rand(n + 1), rand(n + 2)) * 0.6;
      float grain = smoothstep(0.24, 0.0, length(f)) * exp(-a / (14.0 * u)) * exp(-across * across * 1.5);
      sky = mix(sky, vec3(1.0, 0.95, 0.75), grain);
    }
  }
  // The ion tail: straight, narrow, blue, fluttering a little.
  if (isIon) {
    float flutter = sin(iTime * 0.7 + ionAlong * 0.05) * ionAlong * 0.012;
    float ionD = abs(dot(q, ionSide) - flutter);
    float ionCover = exp(-ionAlong / (18.0 * u)) * smoothstep(0.2 * u + ionAlong * 0.012, 0.0, ionD);
    sky = mix(sky, mix(INK_BLUE, vec3(1.0), 0.35), screen(p, ionCover * 0.75, pitch, 15.0) * 0.8);
  }
  // The coma: green, as a comet's is, screened round a bright nucleus
  // that breathes.
  if (!isComa) return sky;
  sky = mix(sky, mix(INK_GREEN, vec3(1.0), 0.35), screen(p, exp(-r / (0.75 * u * pulse)) * smoothstep(3.0 * u, 1.0 * u, r) * 0.9, pitch, 30.0) * 0.85);
  sky = mix(sky, vec3(1.0, 0.98, 0.9), 0.55 * exp(-r / (0.35 * u * pulse)));
  return ink(sky, vec3(1.0, 0.98, 0.92), r - 0.25 * u, 1.0);
}

// Clawd among the stars: his outline joined by faint lines, his eyes the brightest.
const vec2 FIGURE[12] = vec2[12](vec2(1.0, 0.0), vec2(6.0, 0.0), vec2(6.0, 1.4), vec2(7.2, 2.0), vec2(6.0, 2.6), vec2(6.0, 3.2),
  vec2(1.0, 3.2), vec2(1.0, 2.6), vec2(-0.2, 2.0), vec2(1.0, 1.4), vec2(2.0, 4.4), vec2(5.0, 4.4));
vec3 constellation(vec3 sky, vec2 p, float u, float seed) {
  float s = 1.7 * u;
  // Left of the arc and below where a comet would hang.
  vec2 o = iResolution.xy * vec2(0.08 + 0.22 * seeded(seed, 1), 0.34 + 0.12 * seeded(seed, 2));
  // The figure spans -0.2 to 7.2 across and 0 to 4.4 down, in s; its lines,
  // stars and eyes reach less than 0.3u + 1 past it.
  vec2 off = p - o;
  float m = 0.3 * u + 1.0;
  if (off.x < -0.2 * s - m || off.x > 7.2 * s + m || off.y < -m || off.y > 4.4 * s + m) return sky;
  float line = 1e9;
  for (int i = 0; i < 10; i++) line = min(line, segment(p, o + FIGURE[i] * s, o + FIGURE[(i + 1) % 10] * s));
  line = min(line, segment(p, o + vec2(2.0, 3.2) * s, o + FIGURE[10] * s));
  line = min(line, segment(p, o + vec2(5.0, 3.2) * s, o + FIGURE[11] * s));
  // Dashed, as star charts draw them.
  float dash = step(0.5, fract(dot(p - o, vec2(0.7, 0.7)) / (0.5 * u)));
  sky = mix(sky, mix(INK_BLUE, vec3(1.0), 0.5), clamp(0.5 - (line - 0.05 * u), 0.0, 1.0) * 0.22 * dash);
  for (int i = 0; i < 12; i++) {
    float twinkle = 0.75 + 0.25 * sin(iTime * (1.3 + float(i) * 0.37) + float(i));
    sky = ink(sky, vec3(1.0, 0.97, 0.9), length(p - o - FIGURE[i] * s) - 0.13 * u, twinkle);
  }
  vec2 eyes[2] = vec2[2](vec2(2.4, 1.2), vec2(4.6, 1.2));
  for (int i = 0; i < 2; i++) sky = ink(sky, INK_YELLOW, length(p - o - eyes[i] * s) - 0.2 * u, 0.95);
  return sky;
}

// A milestone: risograph confetti raining over the whole window for its
// twenty seconds. Each piece falls down its own column round and round,
// so the rain is as thick at any moment: Ghostty's unknown start of iTime
// never shows as a burst missed or half over.
vec3 confetti(vec3 sky, vec2 p, float u, float seed, float k) {
  vec3 inks[5] = vec3[5](INK_PINK, INK_YELLOW, INK_BLUE, INK_GREEN, INK_ORANGE);
  float fall = iResolution.y + 4.0 * u;
  for (int i = 0; i < 48; i++) {
    float a = seeded(seed, i * 3);
    float b = seeded(seed, i * 3 + 1);
    float x = a * iResolution.x + sin(iTime * (1.0 + b) + a * 7.0) * 1.2 * u;
    // A piece is drawn within u of its column.
    if (abs(p.x - x) > u) continue;
    float y = mod(b * fall + iTime * (2.5 + 3.0 * a) * u, fall) - 2.0 * u;
    vec2 q = p - vec2(x, y);
    if (dot(q, q) > u * u) continue;
    float spin = iTime * (2.0 + 3.0 * b) + a * 6.0;
    q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * q;
    vec2 e = abs(q) - vec2(0.45, 0.2) * u;
    sky = ink(sky, lift(inks[i % 5], k), max(e.x, e.y), 1.0);
  }
  return sky;
}

// --- The Swedish days -------------------------------------------------------

float box(vec2 q, vec2 b) { vec2 d = abs(q) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

// Maundy Thursday night: a påskkärring on her broom, a coffee pot hanging
// from it, on her way past the moon to Blåkulla.
vec3 witch(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  vec2 c = vec2(mix(1.1, -0.1, t) * iResolution.x, iResolution.y * (0.16 + 0.12 * seeded(seed, 1)) + sin(t * 18.0) * 0.4 * u);
  vec2 q = (p - c) / (2.2 * u);
  if (dot(q, q) > 9.0) return sky;
  // The broom, tilted, its bristles fanning out behind.
  float stick = segment(q, vec2(-1.4, -0.15), vec2(1.3, 0.25)) - 0.05;
  vec2 b = q - vec2(1.3, 0.25);
  float bristles = b.x > 0.0 && b.x < 0.9 && abs(b.y) < 0.12 + b.x * 0.35 ? -0.01 : 1.0;
  sky = ink(sky, NIGHT_INK, min(stick, bristles) * 2.2 * u, 0.95);
  // Her skirt, shawl and kerchief.
  // The skirt widens to its hem; corners rounded.
  vec2 hem = q - vec2(0.2, -0.25);
  hem.x /= 1.0 + 0.6 * clamp(hem.y / 0.28, -1.0, 1.0) * 0.5;
  sky = ink(sky, lift(INK_ORANGE, k), (box(hem, vec2(0.36, 0.24)) - 0.06) * 2.2 * u, 0.95);
  sky = ink(sky, lift(INK_PINK, k), (box(q - vec2(0.12, -0.7), vec2(0.24, 0.16)) - 0.08) * 2.2 * u, 0.95);
  sky = ink(sky, lift(INK_YELLOW, k), (length(q - vec2(-0.02, -1.08)) - 0.2) * 2.2 * u, 0.95);
  // The coffee pot, swinging.
  vec2 pot = q - vec2(-0.9 + 0.08 * sin(iTime * 3.0), 0.35);
  return ink(sky, NIGHT_INK, (length(pot / vec2(1.0, 1.2)) - 0.17) * 2.2 * u, 0.95);
}

// A feather in its own frame, its shaft along x with the quill at +x, in
// units of its size: the vane, a capsule broadening from the quill to its
// round tip, and the bare quill.
float featherShape(vec2 q) {
  float vane = limb(q, vec2(0.2, 0.0), vec2(-0.34, 0.0), 0.09, 0.16);
  return min(vane, segment(q, vec2(0.2, 0.0), vec2(0.55, 0.0)) - 0.02);
}

// Feather i printed at q from its place: hanging quill down, swaying, and
// turning over as the leaves do; the vane in its dye with cream dots down
// the shaft, and the key plate's outline a little off register.
vec3 featherPrint(vec3 sky, vec2 p, vec2 q, int i, float u, float seed, float k) {
  vec3 dye[5] = vec3[5](INK_PINK, INK_YELLOW, INK_GREEN, INK_ORANGE, INK_VIOLET);
  float a = seeded(seed, i * 4 + 50);
  float b = seeded(seed, i * 4 + 51);
  float s = 1.3 * u;
  float sway = 0.6 * sin(iTime * (1.1 + a) + b * 5.0);
  float flip = widthShown(cos(iTime * (1.1 + 1.3 * a) + 7.0 * b), 0.3);
  // Its frame turned a quarter from the sway, so the quill hangs down.
  vec2 f = tumble(q, sway + 0.5 * PI, flip) / s;
  float scale = s * abs(flip);
  float shaft = 0.9 * (1.0 - smoothstep(0.0, 0.07 * u, abs(f.y) * scale)) * step(f.x, 0.2);
  vec3 color = mix(dye[i % 5], CREAM, screen(p, shaft, max(3.0, u * 0.24), 0.0));
  sky = ink(sky, lift(color, k), featherShape(f) * scale, 0.95);
  vec2 f2 = tumble(q - vec2(0.12, 0.1) * u, sway + 0.5 * PI, flip) / s;
  return ink(sky, lift(INK_INDIGO, k), abs(featherShape(f2) * scale) - 0.05 * u, 0.45);
}

// Feathers drifting down, dyed as for the påskris, swaying as they fall.
// As with the leaves, the loop only finds which feathers box this pixel,
// and those are printed after it.
vec3 feathers(vec3 sky, vec2 p, float u, float seed, float k) {
  int hits = 0;
  int first = 0;
  int second = 0;
  vec2 q1 = vec2(0.0);
  vec2 q2 = vec2(0.0);
  for (int i = 0; i < 14; i++) {
    float a = seeded(seed, i * 4 + 50);
    float b = seeded(seed, i * 4 + 51);
    float x = a * iResolution.x + sin(iTime * (0.6 + a) + b * 7.0) * 1.5 * u;
    // A feather is drawn within 1.04u of its place, which the cursor shoves
    // at most 3u.
    if (abs(p.x - x) > 4.3 * u) continue;
    float y = mod(b * iResolution.y + iTime * 0.6 * u * (0.6 + a), iResolution.y + 4.0 * u) - 2.0 * u;
    vec2 q = p - shy(vec2(x, y), u);
    // The box round it before any turning: its reach, the key plate's
    // shift and the outline.
    if (abs(q.x) > 1.04 * u || abs(q.y) > 1.04 * u) continue;
    if (hits == 0) {
      first = i;
      q1 = q;
    } else if (hits == 1) {
      second = i;
      q2 = q;
    }
    hits++;
  }
  for (int j = 0; j < min(hits, 2); j++) sky = featherPrint(sky, p, j == 0 ? q1 : q2, j == 0 ? first : second, u, seed, k);
  return sky;
}

// The national day: a Swedish flag on a pole at the horizon, waving.
vec3 flag(vec3 sky, vec2 p, float u) {
  float foot = 0.62 * iResolution.y;
  float x = 0.72 * iResolution.x;
  float h = 5.0 * u;
  sky = ink(sky, vec3(0.95, 0.94, 0.9), box(p - vec2(x, foot - h * 0.5), vec2(0.07 * u, h * 0.5)), 0.95);
  vec2 q = p - vec2(x + 0.07 * u, foot - h + 0.1 * u);
  float w = 2.6 * u;
  float fly = clamp(q.x / w, 0.0, 1.0);
  float wave = sin(fly * 5.0 - iTime * 3.0);
  q.y -= wave * 0.16 * u * fly;
  if (q.x < 0.0 || q.x > w || q.y < 0.0 || q.y > 1.62 * u) return sky;
  // The cross at 5:2:9 across and 4:2:4 down.
  bool isCross = abs(q.x / w - 0.3125) < 0.0625 || abs(q.y / (1.62 * u) - 0.5) < 0.1;
  return mix(sky, (isCross ? SWEDISH_YELLOW : SWEDISH_BLUE) * (0.85 + 0.15 * wave), 0.95);
}

// Midsummer's Eve: a maypole dressed in green with its two rings.
vec3 maypole(vec3 sky, vec2 p, float u, float k) {
  float foot = 0.62 * iResolution.y;
  float x = 0.72 * iResolution.x;
  float h = 5.5 * u;
  // Pole, bar and rings all lie within 1.8u of the pole and between its top
  // and foot, with a pixel's margin.
  if (abs(p.x - x) > 1.8 * u + 1.0 || p.y < foot - h - 1.0 || p.y > foot + 1.0) return sky;
  vec3 green = lift(INK_GREEN, k);
  sky = ink(sky, green, box(p - vec2(x, foot - h * 0.5), vec2(0.12 * u, h * 0.5)), 0.95);
  sky = ink(sky, green, box(p - vec2(x, foot - h * 0.78), vec2(1.3 * u, 0.1 * u)), 0.95);
  for (int side = -1; side <= 1; side += 2) {
    vec2 ring = p - vec2(x + float(side) * 1.1 * u, foot - h * 0.78 + 0.75 * u + sin(iTime * 1.2 + float(side)) * 0.08 * u);
    sky = ink(sky, green, abs(length(ring) - 0.55 * u) - 0.09 * u, 0.95);
    float a = atan(ring.y, ring.x) * 1.6;
    if (fract(a) < 0.3) {
      vec3 flower = mod(floor(a), 2.0) < 1.0 ? INK_PINK : INK_YELLOW;
      sky = ink(sky, lift(flower, k), length(ring - normalize(ring) * 0.55 * u) - 0.12 * u, 0.95);
    }
  }
  return sky;
}

// Lucia morning: a procession in white with candles, walking slowly along
// the horizon, the flames flickering; Lucia first, a crown of light.
vec3 luciaTrain(vec3 sky, vec2 p, float u, float t) {
  float foot = 0.62 * iResolution.y;
  for (int i = 0; i < 9; i++) {
    float x = (mix(-0.15, 1.15, t) - float(i) * 0.022) * iResolution.x;
    vec2 q = p - vec2(x, foot);
    if (abs(q.x) > u || q.y < -2.4 * u || q.y > 0.2 * u) continue;
    sky = ink(sky, vec3(0.96, 0.95, 0.92), box(q - vec2(0.0, -0.6 * u), vec2(0.22 * u, 0.6 * u)), 0.95);
    sky = ink(sky, vec3(0.98, 0.86, 0.72), length(q - vec2(0.0, -1.38 * u)) - 0.18 * u, 0.95);
    float flicker = 0.75 + 0.25 * sin(iTime * (9.0 + float(i)) + float(i) * 2.0);
    vec2 flame = i == 0 ? vec2(0.0, -1.75 * u) : vec2(0.25 * u, -0.95 * u);
    sky = mix(sky, vec3(1.0, 0.82, 0.45), 0.6 * flicker * exp(-length(q - flame) / (0.35 * u)));
    sky = ink(sky, vec3(1.0, 0.93, 0.7), length((q - flame) / vec2(1.0, 1.6)) - 0.08 * u, flicker);
  }
  return sky;
}

// Christmas Eve: a bright star, four long points and a soft glow.
vec3 christmasStar(vec3 sky, vec2 p, float u) {
  vec2 q = p - vec2(0.3 * iResolution.x, 0.14 * iResolution.y);
  float d = length(q);
  if (d > 6.0 * u) return sky;
  float rays = exp(-abs(q.x) / (0.05 * u)) * exp(-abs(q.y) / (2.4 * u)) + exp(-abs(q.y) / (0.05 * u)) * exp(-abs(q.x) / (1.6 * u));
  float glow = exp(-d / (0.5 * u)) * (0.9 + 0.1 * sin(iTime * 1.3));
  return mix(sky, vec3(1.0, 0.97, 0.85), clamp(glow + rays * 0.8, 0.0, 1.0));
}

// Christmas Eve: the tomte in his sleigh behind a reindeer, crossing.
vec3 sleigh(vec3 sky, vec2 p, float u, float seed, float t, float k) {
  vec2 c = vec2(mix(-0.12, 1.12, t) * iResolution.x, iResolution.y * (0.2 + 0.1 * seeded(seed, 2)) - sin(t * 3.14159) * 2.0 * u);
  vec2 q = (p - c) / (1.7 * u);
  if (abs(q.x) > 4.5 || abs(q.y) > 2.0) return sky;
  // The reindeer ahead, legs running, antlers up; the reins.
  float run = sin(iTime * 9.0) * 0.15;
  float deer = min(box(q - vec2(2.6, -0.2), vec2(0.55, 0.22)), length(q - vec2(3.25, -0.55)) - 0.18);
  deer = min(deer, min(segment(q, vec2(2.2, 0.0), vec2(2.1 - run, 0.55)) - 0.06, segment(q, vec2(3.0, 0.0), vec2(3.1 + run, 0.55)) - 0.06));
  deer = min(deer, segment(q, vec2(3.3, -0.7), vec2(3.5, -1.1)) - 0.04);
  vec3 brown = lift(vec3(0.62, 0.42, 0.26), k);
  sky = ink(sky, brown, deer * 1.7 * u, 0.95);
  sky = ink(sky, NIGHT_INK, (segment(q, vec2(0.9, -0.1), vec2(2.1, -0.2)) - 0.03) * 1.7 * u, 0.9);
  // The sleigh, and its runner.
  sky = ink(sky, lift(INK_PINK, k) * 0.9, box(q, vec2(0.85, 0.3)) * 1.7 * u, 0.95);
  sky = ink(sky, NIGHT_INK, (segment(q, vec2(-0.9, 0.45), vec2(0.9, 0.45)) - 0.05) * 1.7 * u, 0.95);
  // The tomte: red coat and cap, white beard.
  vec3 red = vec3(0.95, 0.3, 0.28);
  sky = ink(sky, red, (length(q - vec2(-0.2, -0.55)) - 0.32) * 1.7 * u, 0.95);
  sky = ink(sky, vec3(0.97, 0.95, 0.92), (length(q - vec2(0.0, -0.45)) - 0.16) * 1.7 * u, 0.95);
  float cap = segment(q, vec2(-0.25, -0.8), vec2(-0.55, -1.3)) - 0.12;
  return ink(sky, red, cap * 1.7 * u, 0.95);
}

// New Year: rockets bursting into rings of sparks and falling away, as
// many as the hour calls for. Each burst lives two seconds in a slot of its
// own, so the display has no start to show.
vec3 fireworks(vec3 sky, vec2 p, float u, float k) {
  vec3 colors[4] = vec3[4](INK_PINK, INK_YELLOW, INK_GREEN, INK_BLUE);
  for (int i = 0; i < 8; i++) {
    float clock = iTime / 2.0 + float(i) * 0.37;
    float slot = floor(clock);
    int n = int(slot) * 31 + i * 977;
    if (rand(n) > FIREWORKS) continue;
    float age = fract(clock);
    vec2 c = vec2((0.1 + 0.8 * rand(n + 1)) * iResolution.x, (0.08 + 0.35 * rand(n + 2)) * iResolution.y + age * age * 1.5 * u);
    vec2 q = p - c;
    float reach = (3.0 + 3.0 * rand(n + 3)) * u * sqrt(age);
    float d = length(q);
    if (d > reach + u) continue;
    vec3 color = lift(colors[(i + int(slot)) % 4], k);
    float fade = (1.0 - age) * (1.0 - age);
    // A glow over the burst, then the sparks: an outer ring and a trailing inner one.
    sky = mix(sky, color, 0.18 * fade * exp(-d / reach));
    float a = atan(q.y, q.x) / 6.28318 * 16.0;
    float spark = length(vec2((fract(a) - 0.5) * 6.28318 / 16.0 * d, d - reach));
    float trail = length(vec2((fract(a + 0.5) - 0.5) * 6.28318 / 16.0 * d, d - reach * 0.62));
    sky = ink(sky, color, spark - 0.2 * u, fade);
    sky = ink(sky, color, trail - 0.12 * u, fade * 0.6);
  }
  return sky;
}

// Every event up now; \`isBehind\` draws only what sits behind the clouds.
vec3 events(vec3 sky, vec2 p, float u, float k, bool isBehind) {
  if (isBehind) {
    if (SHOOTING_RATE > 0.0) sky = shootingStars(sky, p, u);
  }
  for (int i = 0; i < EVENT_COUNT; i++) {
    int kind = EVENT_KIND[i];
    float seed = EVENT_SEED[i];
    float t = fract(iTime / EVENT_SECONDS[i] + seed * 0.001);
    if (isBehind) {
      if (kind == 1) sky = satellite(sky, p, u, seed, t);
      if (kind == 5) sky = rainbow(sky, p, k);
      if (kind == 9) sky = comet(sky, p, u, seed);
      if (kind == 10) sky = constellation(sky, p, u, seed);
      if (kind == 18) sky = christmasStar(sky, p, u);
      continue;
    }
    if (kind == 2) sky = balloon(sky, p, u, seed, t, k);
    if (kind == 3) sky = birds(sky, p, u, seed, t, k);
    if (kind == 4) sky = plane(sky, p, u, seed, t, k);
    if (kind == 6) sky = kite(sky, p, u, seed, k);
    if (kind == 7 || kind == 8) sky = drift(sky, p, u, seed, kind == 8, k);
    if (kind == 11) sky = confetti(sky, p, u, seed, k);
    if (kind == 13) sky = witch(sky, p, u, seed, t, k);
    if (kind == 14) sky = feathers(sky, p, u, seed, k);
    if (kind == 15) sky = flag(sky, p, u);
    if (kind == 16) sky = maypole(sky, p, u, k);
    if (kind == 17) sky = luciaTrain(sky, p, u, t);
    if (kind == 19) sky = sleigh(sky, p, u, seed, t, k);
    if (kind == 20) sky = fireworks(sky, p, u, k);
    if (kind == 21 || kind == 22) sky = dolphin(sky, p, u, seed, k, kind == 22);
  }
  return sky;
}

// --- The ISS -----------------------------------------------------------------

// The station on a real pass: a steady, faintly yellow point, brighter than
// the stars, with a short fading trail back along its way. The mod writes
// its place every two seconds while it passes.
vec3 iss(vec3 sky, vec2 p, float u) {
  vec2 at = domeToPixel(ISS_AT);
  vec2 back = domeToPixel(ISS_TRAIL);
  vec2 way = at - back;
  float h = clamp(dot(p - back, way) / max(dot(way, way), 1e-6), 0.0, 1.0);
  float line = length(p - back - way * h);
  sky = mix(sky, vec3(1.0, 0.95, 0.8), clamp(0.6 - line, 0.0, 1.0) * h * h * 0.45);
  float d = length(p - at);
  sky = mix(sky, vec3(1.0, 0.96, 0.82), 0.4 * exp(-d / (0.25 * u)));
  return ink(sky, vec3(1.0, 0.98, 0.9), d - 0.12 * u, 1.0);
}
`
