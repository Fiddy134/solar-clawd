// The sky shader's GLSL, part of hooks/shader.ts's BODY: the UFO that comes
// for the keeper now and then, and him drawn at the lighthouse.
export const UFO = `
// --- The UFO -----------------------------------------------------------------

// A visit, \`age\` seconds in: where the saucer's middle is, how strong its
// beam, how far up he is from where he stands toward it (0 to 1; a little
// over 0 as he bounces back), and whether he is inside it.
struct Abduction { bool isOn; float age; vec2 saucer; float beam; float lift; bool isInside; };

// A visit lasts this many seconds, from the saucer gliding in to it gone.
const float ABDUCTION = 31.5;
// How high over his feet the saucer hovers, in units of s.
const float HOVER = 2.6;

// When the UFO of slot \`slot\` comes, or -1 when it doesn't. Seven slots in
// ten, at a random moment, or the first after it when he is outside for
// the whole visit: in his day, two seconds into the fishing of the first
// round after it that isn't a surf (the fishing lasts 40), and anywhere
// else at once, since the lantern, the hammock and the night keep him
// where he is. Forced (/solar event abduction), every slot, from its start.
// Never in a demo's time-lapse, which has no time for one.
float abductionStart(float slot, float period) {
  if (KEEPER_FORCE == 1) return slot * period;
  int n = int(mod(slot, 100000.0));
  if (DEMO_COUNT > 0 || rand(n * 5 + 3) >= 0.7) return -1.0;
  float earliest = slot * period + rand(n * 5 + 4) * (period - 40.0);
  int mode = keeperMode(earliest);
  if (mode != MODE_DAY && mode != MODE_SURF) return earliest;
  float lap = ceil((earliest - 2.0) / DAY_LOOP);
  for (int i = 0; i < 4; i++) {
    if (!isSurfLoop(lap)) return lap * DAY_LOOP + 2.0;
    lap += 1.0;
  }
  return -1.0;
}

// The UFO at \`time\`, scheduled by the shader itself as the shooting stars
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
  float period = KEEPER_FORCE == 1 ? 60.0 : (night() > 0.6 ? 1800.0 : 5400.0);
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
  vec2 hover = vec2(at.x, at.y - HOVER * s + 0.06 * s * sin(1.7 * time));
  a.isOn = true;
  a.age = age;
  a.saucer = hover;
  if (age < 4.0) {
    // Down first, then easing sideways to a stop over him.
    float t = age / 4.0;
    a.saucer = mix(vec2(l.x + 2.1 * s, -s), hover, vec2(smoothstep(0.0, 1.0, t), 1.0 - (1.0 - t) * (1.0 - t)));
  } else if (age > 27.5) {
    // Up first, then off to the side, quicker and quicker.
    float t = (age - 27.5) / 4.0;
    a.saucer = mix(hover, vec2(l.x - 2.1 * s, -s), vec2(t * t * t, t * t));
  }
  a.beam = smoothstep(4.0, 5.0, age) * (1.0 - smoothstep(10.0, 11.0, age));
  a.isInside = age >= 10.0 && age < 25.0;
  if (age >= 5.0 && age < 10.0) a.lift = smoothstep(5.0, 10.0, age);
  if (a.isInside) a.lift = 1.0;
  if (age >= 25.0 && age < 26.1) a.lift = 1.0 - (age - 25.0) * (age - 25.0) / 1.21;
  if (age >= 26.1 && age < 26.5) a.lift = 0.06 * sin(PI * (age - 26.1) / 0.4);
  return a;
}

// The UFO's beam: green screened, narrow at the saucer and wider below,
// fading out at his feet, its sides in the key plate off register. Drawn
// before him, so he shows in it, and behind the lighthouse's head, which
// stands dark against it over the gallery.
vec3 ufoBeam(vec3 sky, vec2 p, Abduction a, float u, float k) {
  if (a.beam <= 0.0) return sky;
  Lighthouse l = lighthouse(u);
  if (isLanternHead(p, l)) return sky;
  float s = l.s;
  float off = max(1.0, floor(0.4 * keeperCell(s)));
  float top = a.saucer.y + 0.3 * s;
  float bottom = a.saucer.y + (HOVER + 0.2) * s;
  for (int i = 0; i < 2; i++) {
    vec2 q = p - (i == 0 ? vec2(off) : vec2(0.0));
    if (q.y < top || q.y > bottom) continue;
    float h = (q.y - top) / (bottom - top);
    float w = mix(0.3, 0.75, h) * s;
    float side = abs(q.x - a.saucer.x) - w;
    float fade = a.beam * smoothstep(1.0, 0.85, h);
    if (i == 0) sky = ink(sky, keyInk(k), abs(side) - 0.5, 0.5 * fade);
    else if (side < 0.0) sky = mix(sky, lift(INK_GREEN, k), screen(p, fade * (0.3 - 0.35 * side / w), pitch(u), 75.0) * 0.9);
  }
  return sky;
}

// The saucer, printed as the clouds' one is (clouds()): steel with a
// cream-blue dome, pink and yellow lights on its rim, running round while
// he is inside and a wobble now and then, a hatch in its underside as he
// drops out. Drawn after him, so he vanishes into it.
vec3 ufo(vec3 sky, vec2 p, Abduction a, float u, float k) {
  if (!a.isOn) return sky;
  float px = 0.5 * lighthouse(u).s;
  float dots = pitch(u);
  vec2 v = p - a.saucer;
  if (abs(v.x) > 4.5 * px || abs(v.y) > 4.0 * px) return sky;
  float shake = a.isInside ? pow(max(0.0, sin(1.3 * a.age)), 12.0) : 0.0;
  float tilt = 0.03 * sin(1.3 * iTime) + 0.12 * shake * sin(15.0 * a.age);
  v = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * v;
  float hull = (length(v / vec2(3.6, 0.95)) - px) * 0.95;
  float dome = v.y < -0.3 * px ? length(v - vec2(0.0, -0.55 * px)) - 1.55 * px : 1e9;
  vec3 steel = mix(vec3(0.82, 0.84, 0.9), INK_BLUE, 0.15);
  vec3 body = mix(steel, mix(steel, INK_INDIGO, 0.45), screen(p, clamp(0.15 + v.y / px * 0.45, 0.0, 1.0), dots, 45.0));
  vec3 glass = mix(mix(INK_BLUE, CREAM, 0.45), CREAM, screen(p, clamp(0.5 - (v.x + v.y) / px * 0.3, 0.0, 1.0), dots, 15.0) * 0.7);
  sky = ink(sky, lift(glass, k), dome, 1.0);
  sky = ink(sky, lift(body, k), hull, 1.0);
  // The hatch, open in the underside as he drops out.
  float hatch = smoothstep(24.6, 25.0, a.age) * (1.0 - smoothstep(26.3, 26.8, a.age));
  if (hatch > 0.0) sky = ink(sky, tone(INK_INDIGO, k) * 0.55, (length((v - vec2(0.0, 0.62 * px)) / vec2(0.9 * hatch, 0.22 * hatch + 0.01)) - px) * 0.22, 1.0);
  for (int j = 0; j < 5; j++) {
    bool isLit = a.isInside ? int(floor(iTime * 4.0)) % 5 == j : j % 2 == 0;
    sky = ink(sky, isLit ? INK_YELLOW : lift(INK_PINK, k), length(v - vec2(float(j - 2) * 1.25 * px, 0.25 * px)) - 0.3 * px, 1.0);
  }
  // The key plate, a little off register.
  vec2 w = v - keyShift(px);
  float key = min(abs((length(w / vec2(3.6, 0.95)) - px) * 0.95), w.y < -0.3 * px ? abs(length(w - vec2(0.0, -0.55 * px)) - 1.55 * px) : 1e9);
  return ink(sky, keyInk(k), key - 0.06 * px, 0.6);
}

// --- The keeper, drawn -------------------------------------------------------

// The keeper and his door, near the lighthouse only: his rod propped on the
// rocks while he is away from it, his lantern by him fishing at night,
// his binoculars, and his hammock over him asleep; and the UFO when it
// comes, the box reaching up to the window's top for it. Lifted, inside
// and falling out (5 to 26.1 s into a visit) he kicks his legs, his
// binoculars and snoring left off and his hammock empty under him; then he
// bounces back into whatever he was doing, where he was doing it.
// His catch, the tab's context window, hangs on the line from the tower
// to the post. While the conversation compacts and just after, he is at
// his grill under it, the hammock down, the whole time, wherever his day
// would have him (in the tower too: his trips through the door would take
// him to and fro), unless a UFO is visiting or he is on his board;
// keeperMode and keeperAt stay the same for every tab. A fish landed
// while he fishes is on his rod, not yet on the line. His snore rises
// behind the line, so that its z never covers a fish.
vec3 resident(vec3 sky, vec2 p, float u, float k) {
  Lighthouse l = lighthouse(u);
  float s = l.s;
  if (abs(p.x - l.x) > 4.0 * s || p.y > l.foot + 1.0 * s) return sky;
  Abduction a = abductionAt(iTime, l);
  // High over the lighthouse, only the saucer: on its way in or out, or
  // the top of it hovering over the gallery. The beam never reaches up here.
  if (p.y < l.deck - 3.0 * s) return ufo(sky, p, a, u, k);
  int mode = keeperMode(iTime);
  Keeper kp = keeperAt(iTime, l);
  bool isTaken = a.isOn && a.age >= 5.0 && a.age < 26.1;
  vec2 rise = vec2(0.0, a.isOn ? (a.saucer.y + 2.0 * keeperCell(s) - kp.at.y) * a.lift : 0.0);
  if (isTaken) {
    kp.pose = POSE_WALK;
    kp.behind = 0.0;
    kp.isShown = !a.isInside;
  }
  int fish = contextFish();
  int state = contextState();
  bool isAtGrill = (state == CONTEXT_CLEARING || state == CONTEXT_CLEARED) && !a.isOn && mode != MODE_SURF;
  if (isAtGrill) kp = keeperGrill(l);
  bool isLanding = state == CONTEXT_GAINED && kp.pose == POSE_FISH;
  if (isLanding) kp.pose = POSE_LAND;
  bool isHammockUp = mode == MODE_HAMMOCK && !isAtGrill;
  int grilled = state == CONTEXT_CLEARING ? min(fish, 2) : 0;
  sky = keeperDoor(sky, p, l, kp.door, k);
  sky = post(sky, p, l, k);
  if (isHammockUp && !isTaken) sky = snore(sky, p, l, k);
  sky = fishLine(sky, p, l, fish - grilled - (isLanding ? 1 : 0), isLanding ? CONTEXT_IDLE : state, k);
  sky = grill(sky, p, l, grilled, state, k);
  if (kp.pose != POSE_FISH && kp.pose != POSE_LAND) {
    vec2 spot = fishingSpot(l);
    sky = keeperLine(sky, p, spot - vec2(0.45 * s, 0.0), spot - vec2(1.0 * s, 0.95 * s), keeperInk(WOOD, k), max(1.5, 0.3 * keeperCell(s)), 1.0);
  }
  if (!isAtGrill) sky = surf(sky, p, l, u, k);
  if (mode == MODE_MOON) sky = fishingLantern(sky, p, l, u, k);
  if (isHammockUp && isTaken) sky = hammock(sky, p, l, k);
  sky = ufoBeam(sky, p, a, u, k);
  if (isLanding) sky = landing(sky, p, kp, k);
  if (isAtGrill) sky = grillTongs(sky, p, kp, l, k);
  if (kp.isShown && !keeperIsHidden(p, kp, l)) sky = keeperSprite(sky, p, kp, rise, k);
  if (kp.pose == POSE_GAZE && rise.y == 0.0) sky = binoculars(sky, p, kp, l, k);
  if (isHammockUp && !isTaken) sky = hammock(sky, p, l, k);
  sky = grillSmoke(sky, p, l, state, u, k);
  return ufo(sky, p, a, u, k);
}
`
