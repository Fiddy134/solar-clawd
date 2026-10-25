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
const int POSE_PADDLE = 10;

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
// a UFO may take him; \`isShown\` is false while the tower hides him, inside
// it or behind the lantern.
struct Keeper { vec2 at; int pose; float facing; float door; bool isOutside; bool isShown; };

// The size of one cell of him, in whole pixels, for the lighthouse's unit.
float keeperCell(float s) { return max(1.0, floor(0.13 * s)); }

// His day goes round in this many seconds.
const float DAY_LOOP = 90.0;

// Where he fishes: on the rocks left of the tower, the sea beyond them.
vec2 fishingSpot(Lighthouse l) { return vec2(l.x - 1.6 * l.s, l.foot); }

// Where he stands on the gallery, \`a\` radians round the lantern from the
// front: at the sides his outer edge is at the deck's end. Wherever cos(a)
// is below 0 he is on the far half, behind the lantern.
vec2 galleryAt(Lighthouse l, float a) {
  return vec2(l.x + (0.62 * l.s - 3.0 * keeperCell(l.s)) * sin(a), l.deck - 0.12 * l.s);
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
    kp.isShown = cos(a) >= 0.0;
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

// --- His surf ----------------------------------------------------------------

// Now and then, about one round in ten and never in rain or snow, his
// fishing gives way to a surf; forced (/solar event surf), every round is one.
bool isSurfLoop(float n) {
  if (KEEPER_FORCE == 2) return true;
  return PRECIPITATION == 0 && rand(int(n) * 7 + 11) < 0.1;
}

// The surf takes the fishing's 40 seconds; forced, it is all there is.
const float SURF_LOOP = 40.0;

// Seconds into his surf at \`time\`, or -1 when he isn't surfing: never with
// the lantern lit, and not asleep or at night unless it is forced.
float surfTime(float time) {
  if (BEACON != 0) return -1.0;
  if (KEEPER_FORCE == 2) return mod(time, SURF_LOOP);
  if (KEEPER_ASLEEP > 0.5 || nightness(sceneNow().elevation) > 0.6) return -1.0;
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
  Keeper kp = Keeper(spot, POSE_STAND, 1.0, 0.0, true, true);
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

// The keeper by precedence: at the lantern while it is lit, then a surf,
// then asleep, then the night, else his day. For now he stands at the
// deck's end beside the lit lantern, and asleep and the night take the day.
Keeper keeperAt(float time, Lighthouse l) {
  if (BEACON != 0) return Keeper(galleryAt(l, -0.5 * PI), POSE_LANTERN, -1.0, 0.0, true, true);
  float surfing = surfTime(time);
  if (surfing >= 0.0) return keeperSurf(surfing, l);
  if (KEEPER_ASLEEP > 0.5) return keeperDay(time, l);
  if (nightness(sceneNow().elevation) > 0.6) return keeperDay(time, l);
  return keeperDay(time, l);
}

// His cell \`c\` of the band's grid, counted facing right from his top left
// (clawdRows in hooks/clawd.ts: head, face, arms, legs): 0 nothing, 1 his
// body, 2 an eye, 3 a leg.
int keeperGrid(ivec2 c, int pose, int stride) {
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
  // Arms, one of them up when he looks out, or down in the water as he
  // paddles, one stroke and then the other.
  int stroke = stride == 0 ? 0 : 5;
  if (c.y == 2) return (isLooking && c.x == 5) || (pose == POSE_PADDLE && c.x == stroke) ? 0 : 1;
  // Kneeling to paddle, his legs under him and that hand in the water.
  if (pose == POSE_PADDLE) return c.x == stroke ? 1 : 0;
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
  float c = keeperCell(s);
  // On lantern duty he stands half behind the lantern, its light uncovered.
  if (kp.pose == POSE_LANTERN && abs(p.x - l.x) < 0.36 * s && abs(p.y - (l.deck - 0.35 * s)) < 0.28 * s) return sky;
  vec2 at = kp.at + rise;
  // Kneeling on his board, he sits a cell lower.
  if (kp.pose == POSE_PADDLE) at.y += c;
  vec3 body = keeperInk(CORAL, k);
  // His legs in a deeper tone, screened as the band dithers them.
  vec3 legs = mix(body, keeperInk(mix(CORAL, INK_INDIGO, 0.22), k), screen(p, 0.6, max(2.0, 0.5 * c), 45.0));
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
  int stride = int(floor(iTime * (kp.pose == POSE_PADDLE ? 1.5 : 3.0))) % 2;
  int cell = keeperGridAt(p, origin, c, kp, stride);
  if (cell != 0) return mix(sky, cell == 2 ? eye : cell == 3 ? legs : body, 0.97);
  // The key plate, off register.
  float off = max(1.0, floor(0.4 * c));
  if (keeperGridAt(p - vec2(off), origin, c, kp, stride) != 0) sky = mix(sky, lift(INK_INDIGO, k), 0.55);
  return sky;
}

// The door in the tower's foot, arched and wide enough for him: shut in the tower's indigo, and
// open the dark inside, its leaf swung out toward you on hinges at the left.
vec3 keeperDoor(vec3 sky, vec2 p, Lighthouse l, float open, float k) {
  float s = l.s;
  float w = 0.425 * s;
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
  float dark = 1.0 - 0.6 * nightness(sceneNow().elevation);
  float wave = surfWave(p, iTime, l);
  vec2 crest = surfCrest(t, l);
  if (wave > 0.0) {
    float pitch = max(3.0, u * 0.24);
    float v = clamp((surfLevel(l) - p.y) / crest.y, 0.0, 1.0);
    bool isFace = p.x > crest.x;
    sky = mix(sky, lift(INK_BLUE, k) * dark, screen(p, 0.3 + 0.4 * v + (isFace ? 0.15 : 0.0), pitch, 75.0) * wave);
    float froth = max(smoothstep(0.55, 0.9, v), isFace ? 0.6 * smoothstep(22.0, 30.0, t) * smoothstep(-0.1, 0.3, v) : 0.0);
    sky = mix(sky, lift(vec3(0.94, 0.97, 1.0), k) * dark, screen(p, froth, pitch, 15.0) * wave);
  }
  if (surfWave(p - vec2(off), iTime, l) > 0.0 && p.y - off < surfLevel(l)) sky = ink(sky, lift(INK_INDIGO, k), abs(surfShape(p - vec2(off), t, l)) - 0.5, 0.5);
  vec4 board = surfBoard(t, l);
  if (board.w <= 0.0) return sky;
  vec2 along = 0.4 * s * normalize(vec2(1.0, board.z));
  float show = screen(p, board.w, max(2.0, 0.5 * c), 45.0);
  sky = ink(sky, lift(INK_INDIGO, k), segment(p - vec2(off), board.xy - along, board.xy + along) - 0.5 * c, 0.55 * show);
  return ink(sky, keeperInk(INK_YELLOW, k), segment(p, board.xy - along, board.xy + along) - 0.5 * c, show);
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
    sky = keeperLine(sky, p, spot - vec2(0.45 * s, 0.0), spot - vec2(1.0 * s, 0.95 * s), keeperInk(WOOD, k), max(1.5, 0.3 * keeperCell(s)), 1.0);
  }
  sky = surf(sky, p, l, u, k);
  if (kp.isShown) sky = keeperSprite(sky, p, kp, vec2(0.0), k);
  return sky;
}
`
