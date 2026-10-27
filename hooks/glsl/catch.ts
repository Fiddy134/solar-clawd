// The sky shader's GLSL, part of hooks/shader.ts's BODY: the context window
// as the keeper's catch, the fish he hangs on a line from the tower to his
// hammock's post, and the grill he cooks them on as the conversation
// compacts.
export const CATCH = `
// --- His catch ---------------------------------------------------------------

// What this tab's mark (tabMark) says its context window is doing: nothing
// new, clearing as the conversation compacts, just cleared, and a tenth
// just gained. The keeper's words for them: his grill, its embers, a catch.
const int CONTEXT_IDLE = 0;
const int CONTEXT_CLEARING = 1;
const int CONTEXT_CLEARED = 2;
const int CONTEXT_GAINED = 3;

// The fish he has caught, a tenth of the context window each, and what the
// window is doing, from the tab's mark; none where the band shows the
// context itself.
int contextFish() { return BASKET == 1 ? clamp(int(iPalette[16].g * 255.0 + 0.5), 0, 10) : 0; }
int contextState() { return BASKET == 1 ? int(iPalette[16].r * 255.0 + 0.5) : CONTEXT_IDLE; }

// A fish as a cartoon draws one, \`q\` from its mouth down its length along
// y, in pixels for a fish \`s\` long: a plump body tapering to the tail and
// the tail forked in two, both halves of it one limb.
float fish(vec2 q, float s) {
  q /= s;
  float body = limb(q, vec2(0.0, 0.19), vec2(0.0, 0.7), 0.17, 0.05);
  float tail = limb(vec2(abs(q.x), q.y), vec2(0.02, 0.68), vec2(0.17, 0.97), 0.065, 0.035);
  return smin(body, tail, 0.08) * s;
}

// One of his fish, \`q\` from its mouth as fish() has it, \`s\` long: one ink,
// a pale blue (two plates do not fit on a dozen pixels), \`smoked\` toward
// indigo and \`burnt\` toward the dark; an indigo eye, a glint of the paper
// down its flank, and under it the key plate a whole pixel off register as
// his is (\`key\` is p there, q in the same frame). \`blink\` flashes it
// cream, a little larger.
vec3 fishInk(vec3 sky, vec2 q, vec2 key, float s, float smoked, float burnt, float blink, float k) {
  float off = fish(key, s);
  float d = fish(q, s);
  if (min(off, d) > 1.0 + blink * 0.04 * s) return sky;
  sky = ink(sky, lift(INK_INDIGO, k), off, 0.45);
  vec3 body = mix(lift(mix(mix(INK_BLUE, CREAM, 0.7), INK_INDIGO, 0.5 * smoked), k), tone(INK_INDIGO, k) * 0.55, burnt);
  if (blink > 0.0) return ink(sky, CREAM, d - max(1.0, 0.04 * s), 1.0);
  sky = ink(sky, body, d, 1.0);
  if (d > 0.0) return sky;
  sky = ink(sky, mix(CREAM, body, 0.3), segment(q, vec2(-0.08, 0.3) * s, vec2(-0.08, 0.48) * s) - 0.35, 0.9);
  return ink(sky, lift(INK_INDIGO, k), length(q - vec2(0.05, 0.17) * s) - 0.5, 1.0 - 0.6 * burnt);
}

// A fish hung by the mouth from a short cream loop at \`from\`, \`hang\`
// below it, swung \`angle\` off straight down; \`off\` is how far off
// register its key plate is.
vec3 hungFish(vec3 sky, vec2 p, vec2 from, float hang, float angle, float s, float off, float smoked, float blink, float k) {
  mat2 turn = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  vec2 q = turn * (p - from) - vec2(0.0, hang);
  vec2 key = turn * (p - vec2(off) - from) - vec2(0.0, hang);
  if (hang > 0.0) sky = ink(sky, keeperInk(CREAM, k), segment(q, vec2(0.0, -hang), vec2(0.0, 0.04 * s)) - 0.5, 0.85);
  return fishInk(sky, q, key, s, smoked, 0.0, blink, k);
}

// His line: from a ring in the tower's wall to the top of his hammock's
// post, sagging a little more with every fish hung on it.
vec2 lineFrom(Lighthouse l) { return vec2(l.x + 0.47 * l.s, l.foot - 2.2 * l.s); }
vec2 lineTo(Lighthouse l) { return hammockPost(l) - vec2(0.0, 0.13 * l.s); }
float lineY(float x, Lighthouse l, int fish) {
  vec2 a = lineFrom(l);
  vec2 b = lineTo(l);
  float f = clamp((x - a.x) / (b.x - a.x), 0.0, 1.0);
  return mix(a.y, b.y, f) + 4.0 * (0.03 + 0.008 * float(fish)) * l.s * f * (1.0 - f);
}

// Where along it the fish hang, ten of them filling it, from a little
// out from the tower, so that the tenth swings clear of its wall, to short
// of the post (the hammock's rope is tied a little below its top).
const float SLOT_FIRST = 0.6;
const float SLOT_GAP = 0.137;
float slotX(int i, Lighthouse l) { return l.x + (SLOT_FIRST + SLOT_GAP * float(i)) * l.s; }

// His catch on the line: \`fish\` of them, slid down it to the post end, the
// newest nearest the tower, each swaying with the wind; smoked while the
// grill burns, and the newest blinking cream as it is landed while he is
// not there to land it. A bead of the paper's cream on the line halfway,
// where the fifth fish hangs up to, says at a glance whether it is half
// full.
vec3 fishLine(vec3 sky, vec2 p, Lighthouse l, int fish, int state, float k) {
  if (BASKET == 0) return sky;
  float s = l.s;
  float c = keeperCell(s);
  vec2 a = lineFrom(l);
  vec2 b = lineTo(l);
  float bead = max(1.2, 0.3 * c);
  float margin = bead + 2.0;
  if (p.x < a.x - 2.0 || p.x > b.x + 2.0 || p.y < a.y - margin || p.y > b.y + 0.4 * s) return sky;
  float y = lineY(p.x, l, fish);
  if (p.y < y - margin || p.y > y + 0.32 * s) return sky;
  // The line, the ring it is tied to in the tower, and the bead, the key
  // plate under it off register.
  float slope = (lineY(p.x + 1.0, l, fish) - lineY(p.x - 1.0, l, fish)) * 0.5;
  sky = ink(sky, keeperInk(CREAM, k), abs(p.y - y) / sqrt(1.0 + slope * slope) - 0.5, 0.7);
  sky = ink(sky, lift(INK_INDIGO, k), length(p - a) - max(1.0, 0.2 * c), 1.0);
  float off = max(1.0, floor(0.4 * c));
  float mid = 0.5 * (slotX(4, l) + slotX(5, l));
  vec2 knot = vec2(mid, lineY(mid, l, fish));
  sky = ink(sky, lift(INK_INDIGO, k), length(p - vec2(off) - knot) - bead, 0.55);
  sky = ink(sky, keeperInk(CREAM, k), length(p - knot) - bead, 1.0);
  // The two slots either side of p: a fish swings less than half the way
  // to the next.
  int first = 10 - fish;
  int right = int(floor((p.x - slotX(0, l)) / (SLOT_GAP * s))) + 1;
  for (int i = right - 1; i <= right; i++) {
    if (i < first || i > 9) continue;
    float x = slotX(i, l);
    float angle = 0.15 * sin(iTime * 1.3 + float(i)) * (0.5 + WIND / 10.0);
    float blink = state == CONTEXT_GAINED && i == first ? step(0.5, fract(iTime * 3.0)) : 0.0;
    sky = hungFish(sky, p, vec2(x, lineY(x, l, fish)), 0.05 * s, angle, 0.2 * s, off, state == CONTEXT_CLEARING ? 1.0 : 0.0, blink, k);
  }
  return sky;
}

// Landing a fish, a tenth of the context just filled, while he fishes:
// his rod bent over the water, the line taut, the fish on it wriggling,
// drops shaken off its tail falling back to the sea. No phase to it: any
// moment of it is a sound still.
vec3 landing(vec3 sky, vec2 p, Keeper kp, float k) {
  Lighthouse l = lighthouse(max(4.0, floor(iResolution.y / 60.0 + 0.5)));
  float s = l.s;
  float c = keeperCell(s);
  float jerk = sin(iTime * 20.0);
  vec2 hand = kp.at + vec2(kp.facing * 2.5 * c, -1.5 * c);
  vec2 bend = hand + vec2(kp.facing * 0.35 * s, -0.85 * s);
  vec2 tip = hand + vec2(kp.facing * 0.8 * s, -0.5 * s + 0.03 * s * jerk);
  vec2 mouth = vec2(tip.x, kp.at.y - 0.45 * s);
  if (abs(p.x - mix(hand.x, tip.x, 0.5)) > 0.7 * s || p.y < hand.y - 0.9 * s || p.y > kp.at.y + 0.1 * s) return sky;
  sky = keeperLine(sky, p, tip, mouth, keeperInk(CREAM, k), 1.0, 0.7);
  // The rod, curved from his hand up and over to its tip.
  float d = 1e9;
  vec2 last = hand;
  for (int i = 1; i <= 6; i++) {
    float t = float(i) / 6.0;
    vec2 next = mix(mix(hand, bend, t), mix(bend, tip, t), t);
    d = min(d, segment(p, last, next));
    last = next;
  }
  sky = ink(sky, keeperInk(WOOD, k), d - 0.5 * max(1.5, 0.3 * c), 1.0);
  float angle = 0.45 * jerk;
  sky = hungFish(sky, p, mouth, 0.0, angle, 0.2 * s, max(1.0, floor(0.4 * c)), 0.0, 0.0, k);
  // Three drops, each falling from its tail and fading as it goes.
  vec2 tail = mouth + vec2(sin(angle), cos(angle)) * 0.2 * s;
  for (int i = 0; i < 3; i++) {
    float f = fract(iTime * 2.5 + float(i) / 3.0);
    vec2 drop = tail + vec2((rand(i * 7 + 3) - 0.5) * 0.18 * s, (0.02 + 0.3 * f) * s);
    sky = ink(sky, lift(mix(INK_BLUE, CREAM, 0.85), k), length(p - drop) - max(0.7, 0.04 * s), 0.9 * (1.0 - f));
  }
  return sky;
}

// His grill: on the rocks under the line, 1.15 s out from the tower.
vec2 grillAt(Lighthouse l) { return vec2(l.x + 1.15 * l.s, l.foot - 0.04 * l.s); }

// Him at it, between it and the door, facing it, his tongs raised.
Keeper keeperGrill(Lighthouse l) {
  return Keeper(vec2(l.x + 0.5 * l.s, l.foot), POSE_GRILL, 1.0, 0.0, true, true, 0.0);
}

// His tongs, from his raised hand down to the fish on the grate, iron as
// dark as the pit so that they show against the rocks and the fire alike.
// Drawn under him, so his hand holds them.
vec3 grillTongs(vec3 sky, vec2 p, Keeper kp, Lighthouse l, float k) {
  float c = keeperCell(l.s);
  vec2 hand = kp.at + vec2(kp.facing * 2.6 * c, -2.8 * c);
  vec2 end = grillAt(l) + vec2(-0.02, -0.2) * l.s;
  if (length(p - mix(hand, end, 0.5)) > length(end - hand) * 0.5 + 3.0) return sky;
  // Their two arms, parted toward the end.
  vec2 across = normalize(vec2(end.y - hand.y, hand.x - end.x)) * max(1.0, 0.2 * c);
  vec2 hinge = mix(hand, end, 0.45);
  vec3 iron = tone(INK_INDIGO, k) * 0.55;
  float w = max(1.5, 0.3 * c);
  sky = keeperLine(sky, p, hand, hinge, iron, w, 1.0);
  sky = keeperLine(sky, p, hinge, end + across, iron, w, 1.0);
  return keeperLine(sky, p, hinge, end - across, iron, w, 1.0);
}

// One stone of the ring, \`i\` of 5 round it: 0 and 4 behind the pit, the
// rest before it, the nearer larger; each with its key plate.
vec3 grillStone(vec3 sky, vec2 p, vec2 at, int i, float s, float fine, float off, float k) {
  float a = PI * (1.5 + 2.0 * (float(i) + 0.5) / 5.0);
  vec2 c = at + vec2(0.27 * cos(a), 0.07 * sin(a)) * s;
  float r = (0.085 + 0.015 * sin(a)) * s;
  vec2 v = (p - c) / vec2(1.0, 0.75);
  float d = (length(v) - r) * 0.75;
  if (d > off + 1.0) return sky;
  sky = ink(sky, lift(INK_INDIGO, k), (length((p - vec2(off) - c) / vec2(1.0, 0.75)) - r) * 0.75, 0.6);
  vec3 stone = mix(lift(mix(INK_INDIGO, CREAM, 0.62), k), lift(INK_INDIGO, k), screen(p, clamp(0.25 + 0.7 * v.y / r, 0.0, 1.0), fine, 60.0));
  return ink(sky, stone, d, 1.0);
}

// The grill while the conversation compacts, and its embers just after: a
// ring of five stones round a pit, in indigo screened, the fire in three
// inks licking up past a grate with two of his fish lying on it,
// blackening from the tail and the edges in; then the pit glowing orange
// under two of their skeletons. Its smoke is grillSmoke(), over him.
vec3 grill(vec3 sky, vec2 p, Lighthouse l, int grilled, int state, float k) {
  if (state != CONTEXT_CLEARING && state != CONTEXT_CLEARED) return sky;
  float s = l.s;
  vec2 at = grillAt(l);
  vec2 v = p - at;
  if (abs(v.x) > 0.4 * s || v.y < -0.9 * s || v.y > 0.16 * s) return sky;
  float c = keeperCell(s);
  float fine = max(2.0, 0.5 * c);
  float off = max(1.0, floor(0.4 * c));
  sky = grillStone(sky, p, at, 0, s, fine, off, k);
  sky = grillStone(sky, p, at, 4, s, fine, off, k);
  // The pit, dark, a bed of embers heaped in it glowing in orange, pink
  // and yellow sparks winking on it, under the fire and after it.
  if (length(v / vec2(0.21, 0.05)) < s) sky = mix(sky, tone(INK_INDIGO, k) * 0.55, 0.9);
  vec2 heap = (v + vec2(0.0, 0.03 * s)) / vec2(0.19, 0.075);
  if (length(heap) < s && heap.y > -0.85 * s) {
    sky = mix(sky, INK_ORANGE, screen(p, 0.55 + 0.25 * sin(iTime * 3.0 + v.x / s * 9.0), fine, 45.0));
    float spark = rand(int(floor(p.x / fine)) * 31 + int(floor(p.y / fine)) * 17 + int(floor(iTime * 4.0)));
    sky = mix(sky, spark > 0.9 ? INK_YELLOW : INK_PINK, step(0.8, spark) * 0.9);
  }
  // Their glow over the pit, after the fire, screened orange.
  if (state == CONTEXT_CLEARED) sky = mix(sky, INK_ORANGE, screen(p, 0.55 * exp(-length(v / (vec2(0.3, 0.12) * s))), fine, 45.0) * 0.8);
  if (state == CONTEXT_CLEARING) sky = fire(sky, p, at, 0.12 * s, 0.3 * s, 0.13 * s, fine);
  for (int i = 1; i < 4; i++) sky = grillStone(sky, p, at, i, s, fine, off, k);
  // The grate over it, one clear bar of iron.
  float top = at.y - 0.12 * s;
  if (abs(v.x) < 0.28 * s) sky = ink(sky, keeperInk(mix(INK_INDIGO, CREAM, 0.35), k), abs(p.y - top) - 0.5 * max(1.0, 0.25 * c), 1.0);
  if (state == CONTEXT_CLEARING) {
    // Two fish lying on it a pixel clear of the bar, heads out: the tail
    // and the edges char first, the flesh last, as the fire flickers.
    float len = 0.28 * s;
    float heat = 0.25 + 0.1 * sin(iTime * 2.0);
    for (int i = 0; i < 2; i++) {
      if (i >= grilled) continue;
      float dir = i == 1 ? -1.0 : 1.0;
      vec2 mouth = vec2(at.x - 0.29 * dir * s, top - 1.0 - 0.055 * s);
      vec2 q = vec2(mouth.y - p.y, (p.x - mouth.x) * dir);
      vec2 key = vec2(mouth.y + off - p.y, (p.x - off - mouth.x) * dir);
      float d = fish(q, len);
      float edge = clamp(1.0 + d / (0.03 * s), 0.0, 1.0);
      float burnt = clamp(heat * (0.5 + 1.2 * max(edge, smoothstep(0.45, 1.0, q.y / len))), 0.0, 1.0);
      sky = fishInk(sky, q, key, len, 0.0, burnt, 0.0, k);
    }
  } else {
    // What is left of two of them: a head, a spine with two ribs across,
    // and a tail, in the paper's cream.
    float w = max(0.5, 0.1 * c);
    for (int n = 0; n < 2; n++) {
      float dir = n == 0 ? 1.0 : -1.0;
      vec2 mouth = vec2(at.x - dir * 0.27 * s, top - 0.05 * s);
      vec2 along = vec2(dir * 0.24 * s, 0.0);
      float bones = min(abs(length(p - mouth - 0.12 * along) - 0.04 * s), segment(p, mouth + 0.22 * along, mouth + 0.8 * along));
      for (int r = 0; r < 2; r++) {
        vec2 rib = mouth + (0.42 + 0.2 * float(r)) * along;
        bones = min(bones, segment(p, rib - vec2(0.0, 0.05 * s), rib + vec2(0.0, 0.05 * s)));
      }
      bones = min(bones, min(segment(p, mouth + 0.8 * along, mouth + along - vec2(0.0, 0.06 * s)), segment(p, mouth + 0.8 * along, mouth + along + vec2(0.0, 0.06 * s))));
      if (bones < w) sky = mix(sky, keeperInk(CREAM, k), 0.9);
    }
  }
  return sky;
}

// The grill's smoke, one column rising from it and blown off by the wind
// up past the gallery, the further the harder it blows: thick while the
// fire burns, thin over the embers. It leaves the fish on the grate
// clear, and a gale lays it over until it fades out short of the edge of
// keeper()'s box.
vec3 grillSmoke(vec3 sky, vec2 p, Lighthouse l, int state, float u, float k) {
  if (state != CONTEXT_CLEARING && state != CONTEXT_CLEARED) return sky;
  float s = l.s;
  vec2 from = grillAt(l) - vec2(0.0, 0.7 * s);
  float drift = min(2.0, 0.3 + 0.2 * WIND) * s;
  float edge = l.x + 4.0 * s;
  if (p.x < from.x - 1.7 * s || p.x > min(edge, from.x + drift + 1.9 * s) || p.y < from.y - 7.0 * s || p.y > from.y + 0.5 * s) return sky;
  vec3 color = keeperInk(mix(CREAM, INK_INDIGO, 0.2), k);
  vec3 smoked = smoke(sky, p, from, 5.4 * s, drift, 0.36 * s, 0.15, state == CONTEXT_CLEARING ? 0.9 : 0.45, color, max(3.0, u * 0.24));
  return mix(sky, smoked, smoothstep(edge, edge - 0.6 * s, p.x) * smoothstep(from.y + 0.5 * s, from.y + 0.2 * s, p.y));
}
`
