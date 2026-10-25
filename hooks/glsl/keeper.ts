// The sky shader's GLSL, part of hooks/shader.ts's BODY: the keeper, a small
// Clawd who lives at the lighthouse, his day, and the door in the tower.
export const KEEPER = `
// --- The keeper --------------------------------------------------------------

// What he is doing, which says how he is drawn.
const int POSE_STAND = 0;
const int POSE_WALK = 1;
const int POSE_FISH = 2;
const int POSE_SURF = 3;
const int POSE_LOOK = 4;
const int POSE_POINT = 5;
const int POSE_WAVE = 6;
const int POSE_LIE = 7;
const int POSE_SLEEP = 8;
const int POSE_LANTERN = 9;

// The paper under the inks, and Clawd's coral: the orange drum printed thin
// on cream, with a breath of indigo under it (hooks/clawd.ts). Wood is
// orange printed over indigo.
const vec3 CREAM = vec3(0.9608, 0.9373, 0.8784);
const vec3 CORAL = mix(mix(INK_ORANGE, CREAM, 0.15), INK_INDIGO, 0.1);
const vec3 WOOD = mix(INK_ORANGE, INK_INDIGO, 0.35);

// One of his inks, half dimmed as the sun is so that he stays visible, and
// under the indigo plate at night as the band's Clawd is.
vec3 keeperInk(vec3 c, float k) {
  return mix(lift(c, k), tone(INK_INDIGO, k) * 0.55, 0.45 * nightness(sceneNow().elevation));
}

// The keeper at one moment: \`at\` his feet in pixels, \`facing\` 1 right and
// -1 left, \`door\` the tower's door from 0 shut to 1 open. \`isOutside\` says
// a UFO may take him; \`isShown\` is false while he is inside the tower.
struct Keeper { vec2 at; int pose; float facing; float door; bool isOutside; bool isShown; };

// His day goes round in this many seconds.
const float DAY_LOOP = 90.0;

// Where he fishes: on the rocks left of the tower, the sea beyond them.
vec2 fishingSpot(Lighthouse l) { return vec2(l.x - 1.6 * l.s, l.foot); }

// Where he stands on the gallery, \`a\` radians round the lantern from the
// front. On the far half he stands a little higher, as far things do, and
// the lantern hides him.
vec2 galleryAt(Lighthouse l, float a) {
  return vec2(l.x + 0.4 * l.s * sin(a), l.deck - 0.12 * l.s - 0.06 * l.s * (1.0 - cos(a)) * 0.5);
}

// The day: fishing on the rocks, in through the door, a lap of the gallery
// looking out, and back down to the rocks.
Keeper keeperDay(float time, Lighthouse l) {
  float t = time - floor(time / DAY_LOOP) * DAY_LOOP;
  vec2 spot = fishingSpot(l);
  vec2 door = vec2(l.x, l.foot);
  Keeper kp = Keeper(spot, POSE_FISH, -1.0, 0.0, true, true);
  if (t < 40.0) return kp;
  // Over to the door.
  if (t < 44.0) {
    kp.at = mix(spot, door, (t - 40.0) / 4.0);
    kp.pose = POSE_WALK;
    kp.facing = 1.0;
    return kp;
  }
  // The door opens, he steps in, and it shuts behind him.
  if (t < 46.0) {
    kp.at = door;
    kp.pose = POSE_STAND;
    kp.door = smoothstep(44.0, 44.6, t) * (1.0 - smoothstep(45.4, 46.0, t));
    kp.isOutside = false;
    kp.isShown = t < 45.3;
    return kp;
  }
  // Up the stairs inside, and again on the way down.
  if (t < 52.0 || (t >= 68.0 && t < 74.0)) {
    kp.at = door;
    kp.pose = POSE_STAND;
    kp.isOutside = false;
    kp.isShown = false;
    return kp;
  }
  // Out from behind the lantern, round to the front, a look out to sea one
  // way and the other, and on round behind it again.
  if (t < 68.0) {
    float lap = t - 52.0;
    float a = lap < 4.0 ? PI * (1.0 + lap / 4.0) : lap < 8.0 ? 2.0 * PI : PI * (2.0 + min(1.0, (lap - 8.0) / 5.0));
    kp.at = galleryAt(l, a);
    kp.pose = lap >= 4.0 && lap < 8.0 ? POSE_LOOK : lap < 13.0 ? POSE_WALK : POSE_STAND;
    kp.facing = lap >= 4.0 && lap < 8.0 ? (lap < 6.0 ? -1.0 : 1.0) : cos(a) >= 0.0 ? 1.0 : -1.0;
    return kp;
  }
  // Out of the door, the door shutting behind him.
  if (t < 76.0) {
    kp.at = door - vec2(0.3 * l.s * smoothstep(74.6, 76.0, t), 0.0);
    kp.pose = t < 75.2 ? POSE_STAND : POSE_WALK;
    kp.facing = -1.0;
    kp.door = smoothstep(74.0, 74.6, t) * (1.0 - smoothstep(75.4, 76.0, t));
    kp.isOutside = t >= 75.2;
    kp.isShown = t >= 74.6;
    return kp;
  }
  // A slow trudge back to his rod, and a look out to sea before he fishes.
  kp.at = mix(door - vec2(0.3 * l.s, 0.0), spot, min(1.0, (t - 76.0) / 10.0));
  kp.pose = t < 86.0 ? POSE_WALK : POSE_LOOK;
  return kp;
}

// The keeper by precedence: at the lantern while it is lit, then asleep,
// then the night, else his day. For now he stands beside the lit lantern,
// and asleep and the night take the day.
Keeper keeperAt(float time, Lighthouse l) {
  if (BEACON != 0) return Keeper(galleryAt(l, -0.5 * PI), POSE_STAND, 1.0, 0.0, true, true);
  if (KEEPER_ASLEEP > 0.5) return keeperDay(time, l);
  if (nightness(sceneNow().elevation) > 0.6) return keeperDay(time, l);
  return keeperDay(time, l);
}

// His cell \`c\` of the band's grid, counted facing right from his top left
// (clawdRows in hooks/clawd.ts: head, face, arms, legs): 0 nothing, 1 his
// body, 2 an eye, 3 a leg.
int keeperCell(ivec2 c, int pose, int stride) {
  if (c.x < 0 || c.x > 5 || c.y < 0 || c.y > 3) return 0;
  bool isLooking = pose == POSE_LOOK;
  // Head, and a hand up to his brow as he looks out.
  if (c.y == 0) return (c.x >= 1 && c.x <= 4) || (isLooking && c.x == 5) ? 1 : 0;
  // Face: eyes to the front standing, else the way he faces.
  if (c.y == 1) {
    if (c.x < 1 || c.x > 4) return 0;
    bool isFront = pose == POSE_STAND || pose == POSE_LANTERN;
    return c.x == 4 || c.x == (isFront ? 1 : 2) ? 2 : 1;
  }
  // Arms, one of them up when he looks out.
  if (c.y == 2) return isLooking && c.x == 5 ? 0 : 1;
  // Legs, apart as he walks, one step and then the other.
  if (pose == POSE_WALK) return c.x == (stride == 0 ? 0 : 1) || c.x == (stride == 0 ? 4 : 5) ? 3 : 0;
  return c.x == 1 || c.x == 4 ? 3 : 0;
}

// Him at p: the cell's kind, the grid's origin at his top left, mirrored
// when he faces left.
int keeperCellAt(vec2 p, vec2 origin, float c, Keeper kp, int stride) {
  ivec2 cell = ivec2(floor((p - origin) / c));
  if (kp.facing < 0.0) cell.x = 5 - cell.x;
  return keeperCell(cell, kp.pose, stride);
}

// A coloured line \`w\` wide from a to b.
vec3 keeperLine(vec3 sky, vec2 p, vec2 a, vec2 b, vec3 color, float w, float alpha) {
  return ink(sky, color, segment(p, a, b) - 0.5 * w, alpha);
}

// The keeper drawn, \`rise\` above where he stands (a UFO's beam lifts him),
// in Clawd's coral with indigo eyes and deeper legs, the key plate a pixel
// off register past his right side; fishing, his rod and line and the bob.
vec3 keeperSprite(vec3 sky, vec2 p, Keeper kp, vec2 rise, float k) {
  Lighthouse l = lighthouse(max(4.0, floor(iResolution.y / 60.0 + 0.5)));
  float s = l.s;
  float c = max(1.0, floor(0.09 * s));
  // Behind the lantern on the gallery's far half.
  if (kp.at.y < l.deck - 0.155 * s && abs(p.x - l.x) < 0.36 * s && p.y > l.deck - 0.63 * s) return sky;
  vec2 at = kp.at + rise;
  vec3 body = keeperInk(CORAL, k);
  vec3 legs = keeperInk(mix(CORAL, INK_INDIGO, 0.22), k);
  vec3 eye = lift(INK_INDIGO, k);

  if (kp.pose == POSE_FISH) {
    // Every few seconds, now and then, a fish tugs the bob under.
    float slot = floor(iTime / 6.0);
    float since = iTime - slot * 6.0;
    float tug = rand(int(mod(slot, 100000.0)) * 13 + 5) < 0.5 ? smoothstep(0.0, 0.15, since) * smoothstep(1.2, 0.7, since) : 0.0;
    vec2 hand = at + vec2(kp.facing * 2.5 * c, -1.5 * c);
    vec2 tip = hand + vec2(kp.facing * 1.0 * s, -0.85 * s + 0.08 * s * tug);
    vec2 bob = vec2(tip.x + kp.facing * 0.1 * s, at.y + 0.3 * s + 0.1 * s * tug);
    if (abs(p.x - tip.x) < 1.3 * s && p.y > tip.y - 2.0 && p.y < bob.y + 0.2 * s) {
      sky = keeperLine(sky, p, tip, bob, keeperInk(CREAM, k), 1.0, 0.55);
      sky = keeperLine(sky, p, hand, tip, keeperInk(WOOD, k), max(1.5, 0.3 * c), 1.0);
      vec3 red = keeperInk(mix(INK_PINK, INK_ORANGE, 0.45), k);
      float r = max(1.5, 0.5 * c);
      sky = ink(sky, p.y < bob.y ? red : keeperInk(CREAM, k), length(p - bob) - r, 1.0 - 0.6 * tug);
    }
  }

  vec2 origin = floor(at - vec2(3.0 * c, 4.0 * c) + 0.5);
  if (p.x < origin.x - 2.0 * c || p.x > origin.x + 8.0 * c || p.y < origin.y - c || p.y > origin.y + 5.0 * c) return sky;
  int stride = int(floor(iTime * 3.0)) % 2;
  int cell = keeperCellAt(p, origin, c, kp, stride);
  if (cell != 0) return mix(sky, cell == 2 ? eye : cell == 3 ? legs : body, 0.97);
  // The key plate, off register.
  float off = max(1.0, floor(0.4 * c));
  if (keeperCellAt(p - vec2(off), origin, c, kp, stride) != 0) sky = mix(sky, lift(INK_INDIGO, k), 0.55);
  return sky;
}

// The door in the tower's foot, arched: shut in the tower's indigo, and
// open the dark inside, its leaf swung out toward you on hinges at the left.
vec3 keeperDoor(vec3 sky, vec2 p, Lighthouse l, float open, float k) {
  float s = l.s;
  float w = 0.3 * s;
  vec2 v = p - vec2(l.x, l.foot);
  float spring = 0.9 * s - w;
  float d = max(v.y < -spring ? length(v + vec2(0.0, spring)) - w : abs(v.x) - w, v.y);
  if (d > 2.0) return sky;
  float dark = 1.0 - 0.6 * nightness(sceneNow().elevation);
  vec3 indigo = mix(tone(INK_INDIGO, k) * dark, sky, 0.3);
  // The leaf, narrower as it swings open, and the dark inside beside it.
  float edge = 2.0 * w * cos(open * 0.5 * PI) - w;
  sky = ink(sky, v.x < edge ? mix(sky, indigo, 0.85) : tone(INK_INDIGO, k) * 0.55, d, 1.0);
  // The leaf's edge against the dark, in the key plate.
  if (open > 0.0) sky = ink(sky, lift(INK_INDIGO, k), max(d, abs(v.x - edge) - 0.5), 0.5);
  return sky;
}

// The keeper and his door, near the lighthouse only: his rod propped on the
// rocks while he is away from it.
vec3 keeper(vec3 sky, vec2 p, float u, float k) {
  Lighthouse l = lighthouse(u);
  float s = l.s;
  if (abs(p.x - l.x) > 4.0 * s || p.y < l.deck - 3.0 * s || p.y > l.foot + 1.0 * s) return sky;
  Keeper kp = keeperAt(iTime, l);
  sky = keeperDoor(sky, p, l, kp.door, k);
  if (kp.pose != POSE_FISH) {
    vec2 spot = fishingSpot(l);
    sky = keeperLine(sky, p, spot - vec2(0.45 * s, 0.0), spot - vec2(1.0 * s, 0.95 * s), keeperInk(WOOD, k), max(1.5, 0.3 * floor(0.09 * s)), 1.0);
  }
  if (kp.isShown) sky = keeperSprite(sky, p, kp, vec2(0.0), k);
  return sky;
}
`
