// The sky shader's GLSL, part of hooks/shader.ts's BODY: the lighthouse on
// the horizon, its sea, and the dolphins in it.
export const SEA = `
// --- The lighthouse --------------------------------------------------------

// Where the lighthouse stands: in the middle of the stage strip at the
// right when its width is known, else near the right edge. Its own unit
// \`s\`, three times what it was, as it stands close; the tower is five of
// them tall, from \`foot\` on the horizon up to \`deck\`.
struct Lighthouse { float x; float s; float foot; float deck; float h; };

Lighthouse lighthouse(float u) {
  Lighthouse l;
  l.x = STAGE_PX > 0.0 ? iResolution.x - 0.5 * STAGE_PX : 0.88 * iResolution.x;
  l.s = 3.0 * 0.65 * u;
  l.foot = ARC.w * iResolution.y;
  l.h = 5.0 * l.s;
  l.deck = l.foot - l.h;
  return l;
}

// Which of the sea's rows of ripples p is on, counting down from the
// horizon, where they crowd together; its fraction says how near the
// middle of one.
float seaRow(vec2 p, float u) { return sqrt((p.y - ARC.w * iResolution.y + 1.0) / (0.05 * u)); }

// The lantern room: its middle, and half its width and height.
vec4 lanternRoom(Lighthouse l) { return vec4(l.x, l.deck - 0.35 * l.s, 0.36 * l.s, 0.28 * l.s); }

// Whether p is on the lighthouse's head, as beacon() prints it: the lantern
// room, its dome and the finial on top, a pixel round them too.
bool isLanternHead(vec2 p, Lighthouse l) {
  vec4 room = lanternRoom(l);
  vec2 v = p - room.xy;
  vec2 dome = (v + vec2(0.0, room.w)) / vec2(0.44 * l.s + 1.0, 0.34 * l.s + 1.0);
  bool isFinial = abs(v.x) < 0.04 * l.s + 1.0 && v.y < -0.6 * l.s + 1.0 && v.y > -0.85 * l.s - 1.0;
  return (abs(v.x) < room.z + 1.0 && abs(v.y) < room.w + 1.0) || (v.y < -room.w && dot(dome, dome) < 1.0) || isFinial;
}

// The sea on the horizon at the right, fading out toward the middle and
// down into the sky: halftone ripples drifting, the low sun or the moon
// glittering in it and a lit lighthouse's lantern too. \`glow\` is the
// lantern's light.
vec3 sea(vec3 sky, vec2 p, float u, float k, vec3 glow, float glowStrength) {
  float level = ARC.w * iResolution.y;
  if (p.y < level) return sky;
  float depth = (p.y - level) / iResolution.y;
  float cover = smoothstep(0.62, 0.78, p.x / iResolution.x) * smoothstep(0.08, 0.025, depth);
  if (cover <= 0.0) return sky;
  float pitch = max(3.0, u * 0.24);
  vec3 water = mix(sky * 0.8, tone(mix(INK_BLUE, INK_INDIGO, 0.5), k) * (1.0 - 0.7 * nightness(sceneNow().elevation)), 0.45);
  // Ripples: short dashes on rows that crowd together toward the horizon.
  float row = seaRow(p, u);
  float onRow = smoothstep(0.2, 0.0, abs(fract(row) - 0.5));
  float dash = smoothstep(0.35, 0.9, sin(p.x / (0.7 * u) + floor(row) * 2.3 + iTime * 0.7) * sin(p.x / (2.9 * u) - floor(row) * 1.1 + iTime * 0.3));
  water = mix(water, mix(water, sky * 1.25 + 0.05, 0.6), screen(p, onRow * dash * 0.8, pitch, 0.0));
  // The sun low over it glitters in a broken column beneath it.
  Scene sc = sceneNow();
  if (sc.isDay > 0.5 && sc.elevation < 25.0) {
    vec2 sun = arcPoint(sc.progress);
    float column = exp(-abs(p.x - sun.x) / (0.8 * u * (1.0 + depth * 12.0)));
    float glint = column * onRow * smoothstep(0.2, 0.7, sin(p.x / (0.6 * u) + floor(row) * 1.7 - iTime * 1.3));
    vec3 gold = mix(INK_YELLOW, INK_ORANGE, smoothstep(12.0, 2.0, sc.elevation));
    water = mix(water, gold, screen(p, glint, pitch, 0.0) * 0.9);
  }
  // The moon glitters in it too, pale cream, as brightly as it is full.
  if (sc.isDay < 0.5 && MOON_UP > 0.5) {
    float column = exp(-abs(p.x - domeToPixel(MOON_AT).x) / (0.8 * u * (1.0 + depth * 12.0)));
    float glint = column * onRow * smoothstep(0.2, 0.7, sin(p.x / (0.6 * u) + floor(row) * 1.7 - iTime * 1.3));
    water = mix(water, CREAM, screen(p, glint, pitch, 0.0) * 0.9 * MOON_ILLUMINATION);
  }
  // A lit lantern's light on the water below it.
  if (glowStrength > 0.0) {
    float column = exp(-abs(p.x - lighthouse(u).x) / (0.5 * u * (1.0 + depth * 10.0)));
    water = mix(water, glow, screen(p, column * onRow * glowStrength, pitch, 15.0) * 0.9);
  }
  return mix(sky, water, cover);
}

// The striped lighthouse on its rocks in the sea, standing on the stage
// strip at the right (or near the right edge where there is none), large
// enough for the keeper to live in: always there, its lantern dark until Claude waits, then
// lit (orange asking, white done) and hurrying once a question has waited.
// Its beam turns as a real one does: seen from the side it reaches out
// left or right as long as it points across, and flashes in the lantern
// as it comes round toward you. Any moment of the turn looks right, so
// iTime's unknown start never shows.
vec3 beacon(vec3 sky, vec2 p, float u, float k) {
  Lighthouse tower = lighthouse(u);
  float s = tower.s;
  float foot = tower.foot;
  float x = tower.x;
  float h = tower.h;
  float deck = tower.deck;
  vec4 room = lanternRoom(tower);
  vec2 lantern = room.xy;
  vec2 v = p - lantern;
  vec3 light = BEACON == 1 ? INK_ORANGE : vec3(1.0, 0.97, 0.9);
  float speed = BEACON_URGENT > 0.5 ? 1.2 : 0.6;
  float strength = BEACON_URGENT > 0.5 ? 1.0 : 0.75;
  float phase = iTime * speed;
  float toward = max(0.0, sin(phase));

  sky = sea(sky, p, u, k, light, BEACON != 0 ? 0.35 + 0.45 * toward : 0.0);
  if (BEACON != 0) {
    // The beam, behind the tower.
    float across = cos(phase);
    vec2 dir = normalize(vec2(across >= 0.0 ? 1.0 : -1.0, -0.05));
    float along = dot(v, dir);
    float reach = 0.45 * iResolution.y * abs(across);
    if (along > 0.0 && along < reach && p.y < foot) {
      float off = abs(dot(v, vec2(-dir.y, dir.x)));
      float spread = along * 0.105 + 0.15 * s;
      float cover = pow(1.0 - along / reach, 1.5) * smoothstep(spread, spread * 0.35, off);
      sky = mix(sky, light, clamp(cover * 0.5 * strength, 0.0, 1.0));
    }
    // The flash as the beam comes round toward you.
    float glow = exp(-length(v) / (s * (0.5 + 1.4 * toward * toward)));
    sky = mix(sky, light, clamp(glow * (0.35 + 0.55 * toward) * (0.6 + 0.4 * strength), 0.0, 1.0));
  }
  if (abs(p.x - x) > 3.0 * s || p.y < deck - 2.0 * s || p.y > foot + 1.0 * s) return sky;

  // Far off, everything takes some of the sky's colour, and the night's dark.
  float haze = 0.3;
  float dark = 1.0 - 0.6 * nightness(sceneNow().elevation);
  vec3 indigo = mix(tone(INK_INDIGO, k) * dark, sky, haze);
  // The rocks it stands on, lighter on top, the water lapping at them.
  float rocks = min(min(length((p - vec2(x - 0.7 * s, foot - 0.05 * s)) / vec2(1.5, 0.6)), length((p - vec2(x + 0.9 * s, foot + 0.05 * s)) / vec2(1.2, 0.45))),
                    length((p - vec2(x + 0.1 * s, foot - 0.25 * s)) / vec2(1.1, 0.55))) - s;
  if (rocks < 0.0 && p.y < foot + 0.35 * s) {
    float top = smoothstep(foot - 0.6 * s, foot + 0.2 * s, p.y);
    sky = mix(sky, mix(mix(tone(vec3(0.42, 0.4, 0.55), k) * dark, sky, haze), indigo, top), 0.95);
  }
  // The tower: narrowing as it rises, banded coral and white, shaded to
  // one side, with a window in each white band.
  float t = (foot - p.y) / h;
  float halfWidth = mix(0.6, 0.38, clamp(t, 0.0, 1.0)) * s;
  if (t >= 0.0 && t <= 1.0 && abs(p.x - x) < halfWidth) {
    bool coral = int(floor(t * 4.0)) % 2 == 0;
    vec3 tower = coral ? vec3(0.96, 0.36, 0.32) : vec3(0.97, 0.95, 0.9);
    tower = tone(tower * (0.7 + 0.3 * smoothstep(halfWidth, -0.3 * halfWidth, p.x - x)), k) * dark;
    sky = mix(sky, mix(tower, sky, haze), 0.92);
    float band = fract(t * 4.0);
    if (!coral && abs(p.x - x) < 0.09 * s && abs(band - 0.5) < 0.22) sky = mix(sky, indigo, 0.85);
  }
  // The gallery: a deck wider than the tower, and its railing.
  if (abs(p.x - x) < 0.62 * s && p.y > deck - 0.12 * s && p.y < deck + 0.05 * s) sky = mix(sky, indigo, 0.9);
  float rail = min(abs(p.y - (deck - 0.38 * s)), abs(p.x - x) < 0.62 * s ? 1e9 : 1e9);
  if (abs(p.x - x) < 0.6 * s && p.y < deck && p.y > deck - 0.42 * s) {
    float posts = abs(fract((p.x - x) / (0.3 * s) + 0.5) - 0.5) * 0.3 * s;
    rail = min(abs(p.y - (deck - 0.38 * s)), posts);
    sky = ink(sky, indigo, rail - 0.04 * s, 0.75);
  }
  // The lantern room, lit or dark, its glazing bars, the dome and its finial.
  vec2 r = abs(v);
  vec3 glass = BEACON == 1 ? INK_ORANGE : BEACON == 2 ? vec3(1.0, 0.97, 0.9) : indigo;
  if (r.x < room.z && r.y < room.w) {
    sky = mix(sky, glass, 0.95);
    if (abs(abs(p.x - x) - 0.12 * s) < 0.035 * s) sky = mix(sky, indigo, 0.7);
  }
  vec2 dome = (p - vec2(x, lantern.y - room.w)) / vec2(0.44 * s, 0.34 * s);
  if (p.y < lantern.y - room.w && dot(dome, dome) < 1.0) sky = mix(sky, indigo, 0.92);
  if (abs(p.x - x) < 0.04 * s && p.y < lantern.y - 0.6 * s && p.y > lantern.y - 0.85 * s) sky = mix(sky, indigo, 0.9);
  return sky;
}

// Water thrown up where the dolphin breaks the surface at \`at\`, \`age\`
// seconds after, and a ring spreading flat on the water.
vec3 splash(vec3 sky, vec2 p, vec2 at, float age, float s, float u, float k) {
  if (age < 0.0 || age > 1.6) return sky;
  float fade = 1.0 - age / 1.6;
  vec3 foam = lift(vec3(0.94, 0.97, 1.0), k);
  vec2 ring = (p - at) / vec2(1.0, 0.25);
  if (p.y > at.y - 0.4 * s) sky = ink(sky, foam, abs(length(ring) - (0.3 + 1.1 * age) * s) - 0.05 * u, 0.6 * fade);
  for (int i = 0; i < 8; i++) {
    float a = rand(i * 13 + int(at.x));
    float b = rand(i * 7 + 5 + int(at.x));
    vec2 drop = at + vec2((a - 0.5) * 3.0, -(2.0 + 2.5 * b)) * s * age + vec2(0.0, 7.0 * s) * age * age;
    if (drop.y > at.y) continue;
    sky = ink(sky, foam, length(p - drop) - 0.13 * u, fade);
  }
  return sky;
}

// A dolphin in the lighthouse's sea, leaping now and then: an arc out of
// the water and back, a splash where it leaves and where it goes in.
// Sometimes a pink one.
vec3 dolphin(vec3 sky, vec2 p, float u, float seed, float k, bool isPink) {
  // A little way out from the horizon, nearer than the lighthouse.
  float level = (ARC.w + 0.03) * iResolution.y;
  float period = 7.0;
  float air = 1.3;
  float clock = iTime + seed;
  int n = int(floor(clock / period));
  float local = mod(clock, period);
  float s = 0.7 * u;
  float span = 3.4 * s;
  float side = rand(n * 17 + 3) < 0.5 ? 1.0 : -1.0;
  float x0 = iResolution.x * (0.72 + 0.09 * rand(n * 31 + int(seed))) + (side < 0.0 ? span : 0.0);
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
  vec2 q = vec2(dot(d, vel), dot(d, back));
  float body = min(limb(q, vec2(0.85, 0.0) * s, vec2(-0.85, 0.0) * s, 0.24 * s, 0.07 * s), limb(q, vec2(1.25, -0.02) * s, vec2(0.8, 0.0) * s, 0.06 * s, 0.15 * s));
  float fin = limb(q, vec2(0.1, 0.18) * s, vec2(-0.25, 0.52) * s, 0.1 * s, 0.02 * s);
  float fluke = limb(vec2(q.x, abs(q.y)), vec2(-0.8, 0.0) * s, vec2(-1.15, 0.3) * s, 0.08 * s, 0.04 * s);
  float shape = min(body, min(fin, fluke));
  // Blue-grey (or pink), its belly paler, screened.
  vec3 skin = isPink ? lift(mix(INK_PINK, vec3(1.0, 0.88, 0.92), 0.35), k) : tone(mix(INK_BLUE, vec3(0.55, 0.6, 0.7), 0.45), k);
  vec3 color = mix(skin, mix(skin, vec3(0.95), 0.6), screen(p, smoothstep(0.0, -0.2 * s, q.y), max(3.0, u * 0.24), 45.0));
  sky = ink(sky, color, shape, 1.0);
  vec2 off = d - vec2(0.1, 0.08) * u;
  vec2 q2 = vec2(dot(off, vel), dot(off, back));
  float key = min(limb(q2, vec2(0.85, 0.0) * s, vec2(-0.85, 0.0) * s, 0.24 * s, 0.07 * s), limb(q2, vec2(0.1, 0.18) * s, vec2(-0.25, 0.52) * s, 0.1 * s, 0.02 * s));
  return ink(sky, lift(INK_INDIGO, k), abs(key) - 0.05 * u, 0.6);
}
`
