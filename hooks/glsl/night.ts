// The sky shader's GLSL, part of hooks/shader.ts's BODY: the keeper's
// nights, his hammock, and his watch at the lit lantern.
export const NIGHT = `
// --- His night ---------------------------------------------------------------

// On lantern duty: on the gallery beside the lit lantern, his outer foot
// at the deck's end, looking out to sea. He stands at the deck's front
// edge, a little lower than on his lap round it, so the lantern's light
// shows over his head and past his side.
Keeper keeperLantern(Lighthouse l) {
  float c = keeperCell(l.s);
  return Keeper(vec2(l.x - 0.62 * l.s + 2.0 * c, l.deck), POSE_LANTERN, -1.0, 0.0, true, true, 0.0);
}

// His hammock's bed: where it hangs lowest, and half its span. It is slung
// between the tower and a post on the rocks, 2 s out from the tower's
// middle.
vec3 hammockBed(Lighthouse l) { return vec3(l.x + 1.28 * l.s, l.foot - 0.25 * l.s, 0.42 * l.s); }

// Asleep, on his back in his hammock.
Keeper keeperHammock(Lighthouse l) {
  vec3 bed = hammockBed(l);
  return Keeper(vec2(bed.x, bed.y - 0.05 * l.s), POSE_SLEEP, 1.0, 0.0, true, true, 0.0);
}

// The night, by its sky: on his back on the rocks under an aurora, fishing
// by a lantern under a full moon, else sitting on the gallery's edge with
// his binoculars. Whichever, he waves at the ISS going over, and as a star
// falls he jumps a cell and points to where it fell from.
Keeper keeperNight(float time, Lighthouse l, int mode) {
  vec2 spot = fishingSpot(l);
  Keeper kp = Keeper(galleryAt(l, 2.0 * PI), POSE_GAZE, -1.0, 0.0, true, true, 0.0);
  if (mode == MODE_AURORA) kp = Keeper(spot + vec2(0.15 * l.s, 0.0), POSE_LIE, 1.0, 0.0, true, true, 0.0);
  if (mode == MODE_MOON) kp = Keeper(spot, POSE_FISH, -1.0, 0.0, true, true, 0.0);
  vec2 from = vec2(0.0);
  float age = SHOOTING_RATE > 0.0 ? shootingStarAge(time, from) : -1.0;
  if (age >= 0.0 && age < 1.5) {
    kp.pose = POSE_POINT;
    kp.facing = from.x < kp.at.x ? -1.0 : 1.0;
    if (age < 0.5) kp.at.y -= keeperCell(l.s);
  } else if (ISS_UP > 0.5) {
    kp.pose = POSE_WAVE;
    kp.facing = domeToPixel(ISS_AT).x < kp.at.x ? -1.0 : 1.0;
  }
  return kp;
}

// His binoculars, at his eyes as he sits on the gallery, sweeping slowly up
// the sky and down again in 20 seconds: two short barrels, the far one in
// the key plate's indigo, the near one paler.
vec3 binoculars(vec3 sky, vec2 p, Keeper kp, Lighthouse l, float k) {
  float c = keeperCell(l.s);
  vec2 eye = kp.at + vec2(1.5 * c * kp.facing, -1.5 * c);
  if (length(p - eye) > 3.0 * c) return sky;
  float e = radians(42.0 + 16.0 * sin(2.0 * PI * iTime / 20.0));
  vec2 dir = vec2(kp.facing * cos(e), -sin(e));
  vec2 across = vec2(-dir.y, dir.x) * 0.3 * c;
  sky = ink(sky, lift(INK_INDIGO, k), limb(p, eye + across, eye + across + 1.8 * c * dir, 0.3 * c, 0.4 * c), 1.0);
  return ink(sky, keeperInk(mix(INK_INDIGO, CREAM, 0.4), k), limb(p, eye - across, eye - across + 1.8 * c * dir, 0.3 * c, 0.4 * c), 1.0);
}

// His lantern on the rocks beside him as he fishes by night: yellow glass
// in an indigo frame with a handle, its glow screened round it, and its
// light on the water below the rocks in a broken column, as the
// lighthouse's lantern's.
vec3 fishingLantern(vec3 sky, vec2 p, Lighthouse l, float u, float k) {
  float s = l.s;
  float c = keeperCell(s);
  vec2 at = fishingSpot(l) + vec2(4.5 * c, -0.75 * c);
  if (p.y > l.foot + 0.4 * s) {
    float row = seaRow(p, u);
    float onRow = smoothstep(0.2, 0.0, abs(fract(row) - 0.5));
    float column = exp(-abs(p.x - at.x) / (0.2 * s)) * smoothstep(l.foot + 0.4 * s, l.foot + 0.5 * s, p.y);
    float glint = column * onRow * smoothstep(0.2, 0.7, sin(p.x / (0.4 * u) + floor(row) * 1.7 - iTime * 1.1));
    return mix(sky, lift(INK_YELLOW, k), screen(p, glint, max(3.0, u * 0.24), 0.0) * 0.85);
  }
  vec2 v = p - at;
  if (abs(v.x) > 3.0 * c || abs(v.y) > 3.0 * c) return sky;
  sky = mix(sky, lift(INK_YELLOW, k), screen(p, 0.6 * exp(-length(v) / (0.8 * c)), max(2.0, 0.4 * c), 15.0));
  vec3 frame = lift(INK_INDIGO, k);
  sky = ink(sky, frame, abs(length(v + vec2(0.0, 0.8 * c)) - 0.3 * c) - 0.5, v.y < -0.8 * c ? 1.0 : 0.0);
  sky = ink(sky, frame, box(v, vec2(0.5 * c, 0.75 * c)), 1.0);
  return ink(sky, INK_YELLOW, box(v, vec2(0.3 * c, 0.5 * c)), 1.0);
}

// His hammock, drawn over him: its post on the rocks and a ring in the
// tower, ropes from them to its ends, and its bed, striped blue and
// cream, sagging under him and wrapping his back, the key plate along its
// underside.
vec3 hammock(vec3 sky, vec2 p, Lighthouse l, float k) {
  float s = l.s;
  float c = keeperCell(s);
  vec3 bed = hammockBed(l);
  vec2 ring = vec2(l.x + 0.56 * s, l.foot - 0.9 * s);
  vec2 post = vec2(l.x + 2.0 * s, l.foot - 0.9 * s);
  float end = l.foot - 0.6 * s;
  sky = keeperLine(sky, p, post - vec2(0.0, 0.12 * s), vec2(post.x, l.foot + 0.15 * s), keeperInk(WOOD, k), max(2.0, 0.4 * c), 1.0);
  sky = keeperLine(sky, p, ring, vec2(bed.x - bed.z, end), keeperInk(CREAM, k), 1.0, 0.7);
  sky = keeperLine(sky, p, post, vec2(bed.x + bed.z, end), keeperInk(CREAM, k), 1.0, 0.7);
  sky = ink(sky, lift(INK_INDIGO, k), length(p - ring) - max(1.0, 0.2 * c), 1.0);
  float q = (p.x - bed.x) / bed.z;
  if (abs(q) >= 1.0) return sky;
  float sag = 1.0 - q * q;
  float under = mix(end, bed.y, sag);
  float lip = under - mix(0.05 * s, 0.13 * s, sag);
  float off = max(1.0, floor(0.4 * c));
  if (p.y > under && p.y < under + off) sky = mix(sky, lift(INK_INDIGO, k), 0.55);
  if (p.y < lip || p.y > under) return sky;
  bool isBlue = fract((p.x - bed.x) / (0.16 * s)) < 0.5;
  return mix(sky, keeperInk(isBlue ? INK_BLUE : CREAM, k), 0.95);
}

// A z drifting up from him asleep in his hammock now and then, growing as
// it rises, and fading.
vec3 snore(vec3 sky, vec2 p, Lighthouse l, float k) {
  float s = l.s;
  float c = keeperCell(s);
  float slot = floor(iTime / 4.0);
  float t = iTime / 4.0 - slot;
  if (rand(int(mod(slot, 100000.0)) * 11 + 7) > 0.6) return sky;
  vec3 bed = hammockBed(l);
  vec2 z = vec2(bed.x + 2.5 * c + 0.4 * s * t + 0.08 * s * sin(6.0 * t), bed.y - 0.05 * s - 2.5 * c - 1.1 * s * t);
  float size = (0.6 + 0.5 * t) * c;
  vec2 v = (p - z) / size;
  if (abs(v.x) > 1.0 || abs(v.y) > 1.0) return sky;
  float d = min(min(segment(v, vec2(-0.5), vec2(0.5, -0.5)), segment(v, vec2(0.5, -0.5), vec2(-0.5, 0.5))), segment(v, vec2(-0.5, 0.5), vec2(0.5)));
  return ink(sky, keeperInk(CREAM, k), d * size - max(0.5, 0.12 * c), smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.6, t));
}
`
