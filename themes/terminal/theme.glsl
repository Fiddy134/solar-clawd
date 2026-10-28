// terminal: gate B4 of an airport, the terminal in Claude Code's terminal.
// Outside at the left, as before, the runway on the horizon with planes
// landing and lifting off, the control tower, and a plane at the gate on its
// jet bridge. At the right the gate itself, seen from above as a room in a
// game is: the truss and skylights of its ceiling at the top, its glass wall
// onto the apron with a plane parked nose in, the split-flap board and the
// gate's sign hung in front of the glass, and the carpet with the gate desk
// and its queue, rows of seats, Viktor's corner, the coffee kiosk, a garden,
// and the baggage carousel at the front carrying the context window as
// suitcases. Viktor, a Clawd, lives at gate B4 as the man
// in The Terminal (2004) did. The west wall is cut through where the jet
// bridge comes in.

// --- Where things are ----------------------------------------------------------

// The gate in pixels: the stage's left edge (the west wall's outer face) and
// its width, the horizon where the jet bridge meets the wall, the top of the
// floor (the glass wall's foot), the ceiling's underside, the apron's far
// edge seen through the glass, and the cells of the crowd and of Viktor.
// Where the width is not known (STAGE_PX 0), the last 29 % of the window.
// Below, things on the floor are placed in units from the top left corner of
// the floor, x across and y down it: the floor plan.
struct Gate { float left; float width; float floorY; float top; float ceil; float apron; float cell; float big; };

Gate gateOf(float u) {
  Gate g;
  g.width = STAGE_PX > 0.0 ? STAGE_PX : 0.29 * iResolution.x;
  g.left = iResolution.x - g.width;
  g.floorY = floor(ARC.w * iResolution.y + 0.5);
  g.top = floor(g.floorY - 10.5 * u);
  g.ceil = floor(max(2.0 * u, g.top - 22.0 * u));
  g.apron = g.top - 7.0 * u;
  g.cell = max(1.0, floor(0.35 * u));
  g.big = max(2.0, floor(0.5 * u));
  return g;
}

// Clawd's coral, and the deeper coral of his legs.
const vec3 CORAL = mix(mix(INK_ORANGE, CREAM, 0.15), INK_INDIGO, 0.1);
const vec3 CORAL_DEEP = mix(mix(mix(INK_ORANGE, CREAM, 0.15), INK_INDIGO, 0.1), INK_INDIGO, 0.22);
// Steel, for frames, the bridge and the tower: blue and indigo on the paper.
const vec3 STEEL = mix(mix(INK_BLUE, INK_INDIGO, 0.5), CREAM, 0.4);
// The seats' blue.
const vec3 SEAT_INK = mix(INK_BLUE, INK_INDIGO, 0.3);
// Concrete: indigo printed thin on the paper.
const vec3 CONCRETE = mix(CREAM, INK_INDIGO, 0.38);
// Red, pink printed over orange.
const vec3 RED_INK = mix(INK_PINK, INK_ORANGE, 0.45);
// A lit lamp's white.
const vec3 WARM_WHITE = vec3(1.0, 0.97, 0.9);
// The key plate's indigo, raw, for things laid on a layer and lifted with it.
const vec3 KEY = mix(INK_INDIGO, CREAM, 0.05);
// The carpet: green and blue under indigo, as Portland's is.
const vec3 CARPET = mix(mix(INK_GREEN, INK_BLUE, 0.45), INK_INDIGO, 0.42);

// A box standing on the floor plan: `foot` the middle of its front edge
// where it meets the floor, `size` its width, its depth and its height, all
// in units. 1 on its top, seen from above; 2 on its front; 0 off it.
int face(vec2 q, vec2 foot, vec3 size) {
  if (abs(q.x - foot.x) > 0.5 * size.x || q.y > foot.y) return 0;
  if (q.y > foot.y - size.z) return 2;
  return q.y > foot.y - size.z - size.y ? 1 : 0;
}

// --- Outside ---------------------------------------------------------------------

// An airliner seen from the side, its nose to +x, `s` pixels a unit of it
// and about ten units long: the distance to its fuselage (x), to its fin
// (y), and to its wing with the engine under it (z). With `decks` 2 it is
// the double-decked A380, taller.
vec3 jetParts(vec2 q, float s, float decks) {
  float h = (0.5 + 0.22 * decks) * s;
  float body = min(limb(q, vec2(-2.9 * s, 0.0), vec2(4.3 * s, 0.0), h, h), limb(q, vec2(-4.7 * s, -0.55 * h), vec2(-2.9 * s, 0.0), 0.25 * h, h));
  float fin = limb(q, vec2(-3.4 * s, -0.6 * h), vec2(-4.6 * s, -h - 1.45 * s), 0.42 * s, 0.14 * s);
  float wing = limb(q, vec2(1.2 * s, h + 0.22 * s), vec2(-1.4 * s, 0.8 * h), 0.3 * s, 0.09 * s);
  return vec3(body, fin, wing);
}

// The airfield left of the gate, behind the terminal's text: the runway on
// the horizon with its dashed centre line and, from dusk, its edge lights
// (red at the far end, green near the gate); the grass and the apron
// nearer, white under snow and mirroring the sky in streaks when wet; all
// fading into the sky toward the bottom, darker by night, never lighter
// than the sky.
vec3 airfield(vec3 sky, vec2 p, float u, float k, Gate g, float dark, float dusk) {
  float y = p.y - g.floorY;
  if (y < 0.0 || y > 4.6 * u) return sky;
  vec3 c = y < 0.45 * u ? mix(INK_INDIGO, INK_BLUE, 0.25) : y < 0.75 * u ? mix(INK_GREEN, INK_INDIGO, 0.55) : mix(mix(INK_INDIGO, INK_BLUE, 0.35), CREAM, 0.25);
  if (PRECIPITATION == 4 && y > 0.45 * u) c = mix(c, CREAM, 0.55);
  c = mix(tone(c, k) * dark, sky, y < 0.75 * u ? 0.3 : 0.45);
  if (abs(y - 0.22 * u) < 0.05 * u && fract(p.x / (1.6 * u)) < 0.5) c = mix(c, tone(CREAM, k) * dark, 0.45);
  if (PRECIPITATION > 0 && PRECIPITATION < 4 && y > 0.75 * u) c = mix(c, sky, 0.25 + 0.3 * step(0.62, fract(y / (0.32 * u) + 0.5 * sin(p.x / (2.7 * u)))));
  c = mix(sky, sky_under(c, sky), 0.92 * smoothstep(4.6 * u, 1.6 * u, y));
  if (dusk > 0.0 && y < 0.65 * u) {
    float gap = 1.4 * u;
    vec2 q = vec2(mod(p.x, gap) - 0.5 * gap, y - 0.45 * u);
    vec3 light = p.x < 2.0 * gap ? RED_INK : p.x > g.left - 21.0 * u ? INK_GREEN : vec3(1.0, 0.88, 0.6);
    c = mix(c, light, dusk * smoothstep(0.15 * u, 0.05 * u, length(q)));
  }
  return c;
}

// The jet bridge's corridor: pale steel by day, dim by night, its lights
// warm while someone walks out to the plane. Raw, for the caller to print.
vec3 corridor(float n, int agents) {
  vec3 c = mix(mix(STEEL, CREAM, 0.35), mix(INK_INDIGO, STEEL, 0.3), 0.75 * n);
  return agents > 0 ? mix(c, INK_YELLOW, 0.2) : c;
}

// Whether p is on the control tower standing on the horizon at `foot`: its
// shaft, its cab of glass flaring out to the top, and the cab's roof.
bool isTower(vec2 p, float u, vec2 foot) {
  float x = abs(p.x - foot.x);
  float y = foot.y - p.y;
  if (y < 0.0 || y > 8.6 * u) return false;
  if (y < 5.8 * u) return x < 0.6 * u;
  if (y < 8.1 * u) return x < 1.4 * u + 0.4 * (y - 5.8 * u) / 2.3;
  return x < 1.95 * u;
}

// The control tower on the airfield beyond the plane at the gate: its
// concrete shaft, its cab's green glass lit low by night, so as to stay
// quiet behind the text, and bright while Claude is on the web; the mast
// with its red light, and radio rings from the mast while Claude is on the
// web. Behind the text, so hazed and, but for the web's cab, never lighter
// than the sky.
vec3 tower(vec3 sky, vec2 p, float u, float k, vec2 foot, float n, bool isWeb) {
  float y = foot.y - p.y;
  if (y < 0.0 || y > 12.5 * u || abs(p.x - foot.x) > (isWeb ? 9.0 : 3.6) * u) return sky;
  vec2 mast = vec2(foot.x, foot.y - 10.0 * u);
  if (isWeb) {
    float d = length(p - mast);
    float ring = abs(fract(d / (1.6 * u) - fract(iTime)) - 0.5) * 1.6 * u;
    if (d > 0.5 * u && d < 7.5 * u && y > 5.0 * u) sky = ink(sky, INK_GREEN, ring - 0.1 * u, 1.0 - d / (7.5 * u));
  }
  float x = abs(p.x - foot.x);
  vec3 steel = sky_under(mix(tone(STEEL, k) * (1.0 - 0.5 * n), sky, 0.2), sky);
  if (y > 8.6 * u) {
    if (x < 0.07 * u && y < 10.0 * u) return mix(sky, keyInk(k), 0.9);
    return ink(sky, RED_INK, length(p - mast) - 0.14 * u, 1.0);
  }
  if (!isTower(p, u, foot)) return isTower(p - keyShift(u), u, foot) ? mix(sky, keyInk(k), 0.4) : sky;
  if (y > 5.8 * u && y < 8.1 * u) {
    float lit = max(0.45 * n, isWeb ? 1.0 : 0.0);
    vec3 pane = mix(sky, lift(mix(mix(INK_GREEN, INK_BLUE, 0.5), mix(INK_GREEN, CREAM, 0.45), lit), k), 0.4 + 0.5 * lit);
    if (!isWeb) pane = sky_under(pane, sky);
    return fract((p.x - foot.x) / (0.75 * u) + 0.5) < 0.12 || y < 6.05 * u || y > 7.85 * u ? steel : pane;
  }
  vec3 c = y > 8.1 * u ? steel : sky_under(mix(tone(mix(CONCRETE, CREAM, 0.25), k) * (1.0 - 0.5 * n), sky, 0.2), sky);
  return p.x > foot.x + 0.15 * u ? mix(c, INK_INDIGO, 0.12) : c;
}

// Outside the gate, behind the terminal's text: the airfield and the tower,
// then one plane, whichever p is near, the one at the gate or the one far
// off on the runway. The one at the gate stands nose in under the jet
// bridge on its gear. While subagents are at work the far one lifts off
// every 18 seconds, rolling left from the runway's near end faster and
// faster and climbing away; otherwise, in about one 40 seconds in two by
// day and one in four by night, one lands from the left and rolls toward
// the gate. Then, below freezing in the wet, the de-icing truck at the near
// plane's wing, spraying it green; and the bridge out to it from the west
// wall, cut open as the gate is, so that whoever walks out to the plane
// shows in it. In plain tones never lighter than the sky: by day the near
// plane in its livery and the far one hazed, by night dark shapes with
// their cabins and their lights lit.
vec3 outside(vec3 sky, vec2 p, float u, float k, Gate g, float n, int agents, bool isWeb) {
  if (p.y < g.floorY - 12.6 * u || p.y > g.floorY + 4.7 * u) return sky;
  float dark = 1.0 - 0.6 * n;
  vec3 bg = airfield(sky, p, u, k, g, dark, 1.0 - smoothstep(-1.0, 5.0, sceneNow().elevation));
  bg = tower(bg, p, u, k, vec2(g.left - 21.0 * u, g.floorY), n, isWeb);
  sky = bg;
  vec3 dk = tone(INK_INDIGO, k) * 0.55;
  float apron = g.floorY + 0.85 * u;
  bool isNear = p.x > g.left - 18.4 * u;
  float s = isNear ? 1.25 * u : 0.38 * u;
  vec2 at = vec2(g.left - 9.8 * u, g.floorY - 1.0 * u);
  float lean = 0.0;
  bool isLeft = false;
  bool isShown = true;
  if (!isNear) {
    float x1 = g.left - 21.5 * u;
    float run = x1 - 0.04 * iResolution.x;
    float ground = g.floorY - 0.42 * u;
    isLeft = agents > 0;
    float f = fract(iTime / (isLeft ? 18.0 : 40.0));
    if (isLeft) {
      float roll = min(f, 0.45) / 0.45;
      float air = max(f - 0.45, 0.0) / 0.55;
      at = vec2(x1 - run * (0.42 * roll * roll + 0.75 * air), ground - (0.4 * air + 0.6 * air * air) * 8.0 * u);
      lean = 0.18 * smoothstep(0.0, 0.2, air);
    } else {
      isShown = rand(int(mod(floor(iTime / 40.0), 100000.0)) * 3 + 17) < (n > 0.6 ? 0.25 : 0.5);
      float app = min(f, 0.55) / 0.55;
      float roll = max(f - 0.55, 0.0) / 0.45;
      at = vec2(x1 - run + run * (0.5 * app + 0.4 * (1.0 - (1.0 - roll) * (1.0 - roll))), ground - (1.0 - app) * (1.0 - app) * 7.0 * u);
      lean = 0.12 * (1.0 - app);
    }
  }
  vec2 d = p - at;
  if (isLeft) d.x = -d.x;
  vec2 q = vec2(d.x - lean * d.y, d.y + lean * d.x);
  if (isShown && abs(q.x) < 6.8 * s && q.y > -3.2 * s && q.y < (isNear ? 2.0 * u : 1.5 * s)) {
    vec3 parts = jetParts(q, s, 1.0);
    float hull = min(parts.x, min(parts.y, parts.z));
    float gear = isNear ? min(box(q - vec2(-0.6 * s, apron - at.y - 0.4 * u), vec2(0.45 * u, 0.4 * u)) - 0.05 * u, box(q - vec2(3.6 * s, apron - at.y - 0.35 * u), vec2(0.2 * u, 0.35 * u))) : 1.0e4;
    float shape = min(hull, gear);
    if (shape < 1.0) {
      bool isTail = parts.y < min(parts.x, parts.z) && hull < gear;
      vec3 c = STEEL;
      if (n > 0.55) c = isNear && isTail ? mix(mix(dk, bg, 0.2), CORAL, 0.35) : mix(dk, bg, 0.2);
      else if (!isNear) c = sky_under(mix(mix(CREAM, STEEL, 0.45), bg, 0.35), bg);
      else {
        // The livery: Clawd's coral on the tail with his two eyes, a blue
        // line under the windows, the belly deeper.
        if (gear < hull) c = INK_INDIGO;
        else if (isTail) c = abs(q.y + 1.5 * s) < 0.1 * s && (abs(q.x + 4.32 * s) < 0.09 * s || abs(q.x + 3.96 * s) < 0.09 * s) ? INK_INDIGO : CORAL;
        else if (parts.x < parts.z) {
          c = abs(q.y - 0.05 * s) < 0.06 * s ? INK_BLUE : q.y > 0.35 * s ? mix(CREAM, STEEL, 0.55) : mix(CREAM, INK_BLUE, 0.08);
        }
        c = sky_under(mix(tone(c, k) * dark, bg, 0.12), bg);
      }
      if (isNear && parts.x < 0.0 && abs(q.y + 0.2 * s) < 0.09 * s && q.x > -2.6 * s && abs(mod(q.x, 0.42 * s) - 0.21 * s) < 0.09 * s) c = n > 0.3 ? lift(INK_YELLOW, k) : dk;
      sky = ink(sky, c, shape, 1.0);
      if (n > 0.3) {
        if (!isNear) sky = ink(sky, WARM_WHITE, length(q - vec2(4.5 * s, 0.25 * s)) - 0.11 * u, 1.0);
        sky = ink(sky, RED_INK, length(q - (isNear ? vec2(0.6, -0.78) : vec2(-0.4, -0.75)) * s) - 0.08 * u, step(0.5, fract(iTime * 0.9)));
      }
    }
  }
  if (!isNear) return sky;
  if (PRECIPITATION == 4 || (PRECIPITATION > 0 && TEMPERATURE < 0.0)) {
    vec2 tb = vec2(at.x - 2.5 * u, apron - 0.6 * u);
    vec2 bk = vec2(at.x - 0.9 * u, at.y - 1.7 * u);
    float truck = min(box(p - tb, vec2(1.5 * u, 0.45 * u)) - 0.05 * u, min(segment(p, tb + vec2(0.6 * u, -0.4 * u), bk + vec2(0.0, 0.3 * u)) - 0.1 * u, box(p - bk, vec2(0.32 * u, 0.25 * u))));
    sky = ink(sky, sky_under(mix(tone(mix(INK_YELLOW, INK_GREEN, 0.15), k) * dark, bg, 0.1), bg), truck, 1.0);
    vec2 v = p - bk - vec2(0.0, 0.3 * u);
    if (v.y > 0.0 && v.y < 1.4 * u && abs(v.x - 0.35 * v.y) < 0.1 * u + 0.4 * v.y && fract(v.y / (0.28 * u) - fract(iTime * 2.0)) < 0.4 && fract(v.x / (0.22 * u)) < 0.5) sky = mix(sky, lift(mix(INK_GREEN, CREAM, 0.3), k), 0.85);
  }
  float bx0 = g.left - 6.6 * u;
  float top = g.floorY - 2.8 * u;
  float walk = g.floorY - 0.3 * u;
  if (p.x < bx0) return sky;
  vec3 shell = sky_under(tone(mix(STEEL, INK_INDIGO, 0.3), k) * dark, bg);
  if (p.y > top && p.y < walk + 0.45 * u) {
    vec3 c = sky_under(tone(corridor(n, agents), k), bg);
    if (p.y < top + 0.35 * u || p.y > walk) c = fract((p.x - bx0) / (1.6 * u)) < 0.06 ? mix(shell, dk, 0.6) : shell;
    if (p.x < bx0 + 0.55 * u) c = shell * (0.75 + 0.15 * step(0.5, fract((p.x - bx0) / (0.18 * u))));
    return c;
  }
  float leg = min(box(p - vec2(g.left - 4.2 * u, g.floorY + 0.6 * u), vec2(0.18 * u, 0.5 * u)), box(p - vec2(g.left - 4.2 * u, g.floorY + 1.15 * u), vec2(0.6 * u, 0.18 * u)));
  leg = min(leg, length(vec2(abs(p.x - g.left + 4.2 * u) - 0.4 * u, p.y - g.floorY - 1.4 * u)) - 0.2 * u);
  return ink(sky, shell, leg, 1.0);
}

// --- The gate ------------------------------------------------------------------------

// The split-flap board hung in front of the glass: its text's top left (xy)
// and its cell (z); 106 cells across (thirteen narrow columns of 4, then
// nine wide ones of 6), five rows of 6.
vec3 boardOf(Gate g, float u) {
  float c = max(2.0, floor(0.19 * u));
  return vec3(floor(g.left + g.width - 0.9 * u - 106.0 * c), floor(g.ceil + 1.3 * u), c);
}

// The gate's sign, hung over the desk: its middle and half its size.
vec4 signOf(Gate g, float u) { return vec4(g.left + 5.2 * u, g.top - 8.6 * u, 3.7 * u, 1.3 * u); }

// Whether p is in a pane of the glass wall or of a skylight, and which: 0
// not (a frame, the wall, or something hung in front of it), 1 the sky
// through the glass wall, 2 the apron through it, 3 a skylight.
int paneAt(vec2 p, float u, Gate g) {
  vec2 q = (p - vec2(g.left, g.top)) / u;
  float S = g.width / u;
  if (q.x < 1.2 || q.y > -0.45) return 0;
  if (p.y < g.ceil) {
    float sx = mod(q.x - 1.2, 5.4);
    float cy = p.y / g.ceil;
    return sx > 0.7 && sx < 4.7 && cy > 0.14 && cy < 0.51 && (FLAG_DAY < 0.5 || q.x < S - 5.2) ? 3 : 0;
  }
  float gy = (p.y - g.ceil) / u;
  float P = (S - 1.2) / 7.0;
  if (fract((q.x - 1.2) / P) < 0.22 / P || abs(gy - 8.0) < 0.12) return 0;
  if (q.x > S - 6.2 && q.y > -1.7) return 0;
  vec3 b = boardOf(g, u);
  vec2 bq = p - b.xy;
  if (bq.x > -0.5 * u && bq.x < 106.0 * b.z + 0.4 * u && bq.y > -0.5 * u && bq.y < 30.0 * b.z + 0.2 * u) return 0;
  vec4 s = signOf(g, u);
  if (abs(p.x - s.x) < s.z + 0.1 * u && abs(p.y - s.y) < s.w + 0.1 * u) return 0;
  return p.y > g.apron ? 2 : 1;
}

// What shows through the glass wall: the sky, and from the apron's far edge
// down the apron, with the plane parked nose in at gate B4 (Clawd's coral
// on its fin), and its yellow lead-in line. Far, so hazed into the sky and darker by night, the plane's
// cockpit and lights lit.
vec3 apronView(vec3 sky, vec2 p, float u, float k, Gate g, float n) {
  float S = g.width / u;
  vec2 a = vec2((p.x - g.left) / u, (p.y - g.apron) / u);
  float time = mod(iTime, 3600.0);
  float cx = 0.53 * S;
  // Each part gives its raw ink and how far p is inside it; the nearest
  // part wins, and one print at the end.
  vec3 c = a.y < 0.3 ? mix(INK_GREEN, INK_INDIGO, 0.5) : PRECIPITATION == 4 ? mix(CONCRETE, CREAM, 0.5) : mix(CONCRETE, INK_INDIGO, 0.3);
  if ((abs(a.x - cx) < 0.09 && a.y > 2.2) || (abs(a.y - 3.3) < 0.08 && abs(a.x - cx) < 2.4)) c = INK_YELLOW;
  float d = a.y > 0.0 ? -1.0 : 1.0;
  float haze = 0.3 - 0.04 * a.y;
  if (PRECIPITATION > 0 && PRECIPITATION < 4) haze += 0.3 * step(0.62, fract(a.y * 1.4 + 0.4 * a.x));
  // The plane, nose on: its fuselage a circle, its wings, its engines, its
  // fin and tailplane, and its gear.
  vec2 q = vec2(a.x - cx, a.y + 1.5);
  vec2 m = vec2(abs(q.x), q.y);
  float body = length(q) - 2.0;
  float engine = length(m - vec2(4.4, 1.15)) - 0.8;
  float plane = min(min(body, limb(m, vec2(1.6, 0.4), vec2(9.4, -0.5), 0.3, 0.1)), min(engine, box(q - vec2(0.0, -4.5), vec2(0.17, 2.6))));
  float gear = min(box(q - vec2(0.0, 2.7), vec2(0.09, 0.8)), box(m - vec2(1.5, 2.6), vec2(0.28, 0.55)));
  plane = min(plane, min(gear, box(q - vec2(0.0, -3.1), vec2(2.6, 0.12))));
  if (plane < 0.1) {
    c = q.y < -2.1 ? CORAL : gear < 0.0 ? INK_INDIGO : engine < 0.0 ? (engine < -0.25 ? mix(INK_INDIGO, STEEL, 0.3) : mix(CREAM, STEEL, 0.3)) : q.y > 0.7 ? mix(CREAM, STEEL, 0.4) : mix(CREAM, INK_BLUE, 0.1);
    if (body < 0.0 && abs(q.y + 0.55) < 0.17 && abs(q.x) < 1.3 && fract(q.x / 0.62 + 0.5) < 0.72) c = INK_INDIGO;
    d = plane;
    haze = 0.18;
  }
  vec3 o = ink(sky, mix(tone(c, k) * (1.0 - 0.55 * n), sky, max(haze, 0.0)), d * u, 1.0);
  // What is lit by night: the cockpit's windows and the plane's lights.
  if (n > 0.3) {
    if (body < 0.0 && abs(q.y + 0.55) < 0.17 && abs(q.x) < 1.3 && fract(q.x / 0.62 + 0.5) < 0.72) o = lift(INK_YELLOW, k);
    o = ink(o, q.x < 0.0 ? RED_INK : INK_GREEN, (length(m - vec2(9.4, -0.5)) - 0.16) * u, 1.0);
  }
  return o;
}

// One seat of a row, seen from above and the front: `x0` the row's left end
// and `sw` a seat's width, `n` seats, `foot` the front of its seats or, for
// a row turned away, of its backs, all in units. 0 off it, 1 the backrest's
// face, 2 its top, 3 the seat's top, 4 the seat's front, 5 its legs and beam.
int seatPart(vec2 q, float x0, float sw, float n, float foot, bool isBack) {
  float lx = q.x - x0;
  float dy = foot - q.y;
  if (lx < 0.0 || lx > sw * n || dy < 0.0) return 0;
  float sx = mod(lx, sw);
  bool isIn = sx > 0.12 && sx < sw - 0.12;
  if (dy < 0.25) return dy > 0.15 && isIn ? 5 : 0;
  if (!isIn) return 0;
  if (isBack) return dy < 1.15 ? 1 : dy < 1.4 ? 2 : 0;
  if (dy < 0.45) return 4;
  if (dy < 1.0) return 3;
  if (sx < 0.25 || sx > sw - 0.25) return 0;
  return dy < 1.85 ? 1 : dy < 2.05 ? 2 : 0;
}

// The gate, everything in it that does not move about on its own. The west
// wall in section with the jet bridge's door in it, and the service door
// the tug drives out through; the coffee kiosk; the ceiling's truss with its
// skylights and lamps; the glass wall with the apron through it, and the
// board and the gate's sign hung in front of it; and the carpet with all
// that stands on it: the gate desk and its queue's lanes, Viktor's rug,
// bench and lamp, rows of seats with charging posts, the garden, the
// baggage carousel with the context window's bags on it, the tug and its
// carts, and the scrubber with its wet trail and sign. Each part
// gives its raw ink, the deeper ink screened over it, how much and at what
// angle, and whether the night dims it; the one lamp whose light p is in
// gives its ink and its strength there. One print at the end.
vec3 hall(vec3 sky, vec2 p, float u, float k, Gate g, float n, int tool, int agents, bool isOpen, int cs) {
  vec2 q = (p - vec2(g.left, g.top)) / u;
  if (q.x < 0.0) return sky;
  float S = g.width / u;
  float time = mod(iTime, 3600.0);
  vec3 dk = INK_INDIGO * 0.55;
  vec3 key = mix(INK_INDIGO, CREAM, 0.1);
  vec3 c = dk;
  vec3 deep = dk;
  float shade = 0.0;
  float angle = 45.0;
  vec3 light = mix(INK_YELLOW, CREAM, 0.35);
  float glow = 0.0;
  vec2 lamp3 = vec2(1.0e3, 1.0);
  float dim = 1.0;
  float kx = q.x - S + 6.0;
  int pane = paneAt(p, u, g);
  if (q.x < 1.2) {
    // The west wall, cut: concrete edged in the key plate, with the jet
    // bridge's door at the horizon and the service door further down.
    bool isDoor = q.y > 7.7 && q.y < 10.2;
    bool isService = q.y > 18.2 && q.y < 20.6 && (cs == CONTEXT_CLEARING || cs == CONTEXT_CLEARED);
    c = CONCRETE;
    if (q.x > 1.05 || q.x < 0.12) c = key;
    if (isDoor) c = q.y > 9.9 ? STEEL : corridor(n, agents);
    if (isService) c = mix(CARPET, dk, 0.4);
    if (abs(q.y - 7.7) < 0.12 || abs(q.y - 10.2) < 0.1) c = key;
  } else if (kx > 0.0 && kx < 5.8 && q.y > -1.7 && q.y < 6.6) {
    // The coffee kiosk: its fascia with its name, its striped green awning, the back wall with its shelves of cups and its
    // espresso machine, lit up warm while Claude is busy with anything
    // else, or its shutter down while it is closed; its counter in front.
    int f = face(q, vec2(S - 3.1, 6.6), vec3(5.8, 1.0, 1.3));
    bool isBusy = tool == sky_TOOL_OTHER && isOpen;
    if (f == 1) c = mix(INK_ORANGE, CREAM, 0.6);
    else if (f == 2) {
      c = mix(INK_GREEN, INK_INDIGO, 0.3);
      if (abs(q.y - 5.85) < 0.12) c = mix(INK_ORANGE, INK_INDIGO, 0.3);
    } else if (q.y < -0.6) c = mix(INK_GREEN, INK_INDIGO, 0.45);
    else if (q.y < 0.45) c = fract(kx / 0.6) < 0.5 ? mix(INK_GREEN, CREAM, 0.1) : CREAM;
    else if (kx < 0.25 || kx > 5.55) c = STEEL;
    else if (q.y > 3.6) c = dk;
    else if (!isOpen) c = mix(STEEL, dk, step(0.75, fract(q.y / 0.3)));
    else {
      c = isBusy ? mix(INK_YELLOW, CREAM, 0.45) : mix(INK_GREEN, INK_INDIGO, 0.6);
      dim = 0.0;
      if (abs(q.y - 1.5) < 0.07 || abs(q.y - 2.5) < 0.07) c = STEEL;
      vec2 mq = q - vec2(S - 1.9, 2.6);
      if (box(mq, vec2(0.7, 0.9)) < 0.0) c = length(mq + vec2(0.2, 0.3)) < 0.14 ? RED_INK : STEEL;
    }
    if (f == 0 && abs(q.y + 0.6) < 0.08) c = key;
  } else if (p.y < g.ceil) {
    // The ceiling: a steel truss under a row of skylights, a lamp hung in
    // each bay, lit by night; on Sweden's national day a flag hangs there.
    float cy = p.y / g.ceil;
    c = mix(STEEL, CREAM, 0.25);
    deep = mix(STEEL, INK_INDIGO, 0.45);
    shade = 0.15 + 0.35 * cy;
    angle = 15.0;
    if (pane == 3) return mix(sky, lift(mix(INK_BLUE, CREAM, 0.7), k), 0.12);
    float sx = mod(q.x - 1.2, 5.4);
    if (cy > 0.1 && cy < 0.55 && sx > 0.5 && sx < 4.9) {
      c = STEEL;
      shade = 0.0;
    }
    float y0 = 0.62 * g.ceil;
    float y1 = g.ceil - 0.25 * u;
    float tri = abs(2.0 * fract((q.x - 1.2) / 2.7) - 1.0);
    float tt = (p.y - y0) / (y1 - y0);
    if (abs(p.y - y0) < 0.13 * u || p.y > y1 - 0.2 * u || (tt > 0.0 && tt < 1.0 && abs(tt - tri) * (y1 - y0) < 0.24 * u)) {
      c = mix(STEEL, INK_INDIGO, 0.3);
      shade = 0.3;
    }
    vec2 lq = vec2((mod(q.x - 1.2, 5.4) - 2.7) * u, p.y - y0 - 0.45 * u);
    if (box(lq, vec2(0.45 * u, 0.18 * u)) < 0.0) {
      c = n > 0.3 ? WARM_WHITE : mix(STEEL, CREAM, 0.4);
      shade = 0.0;
    }
    glow = 0.6 * n;
    lamp3 = vec2(length(lq) / u, 0.45);
    if (FLAG_DAY > 0.5 && q.x > S - 5.0 && q.x < S - 1.4 && p.y > g.ceil - 3.6 * u && p.y < g.ceil - 0.9 * u) {
      c = abs(q.x - S + 3.9) < 0.3 || abs(p.y - g.ceil + 2.25 * u) < 0.3 * u ? INK_YELLOW : INK_BLUE;
      shade = 0.0;
    }
  } else if (q.y < 0.0) {
    // The glass wall, and what hangs in front of it.
    if (pane > 0) {
      vec3 v = q.y > -16.0 ? apronView(sky, p, u, k, g, n) : sky;
      return mix(v, lift(mix(INK_BLUE, CREAM, 0.7), k), 0.1);
    }
    float gy = (p.y - g.ceil) / u;
    vec3 b = boardOf(g, u);
    vec2 bq = p - b.xy;
    vec4 s = signOf(g, u);
    vec2 sq = abs(p - s.xy);
    c = STEEL;
    if (bq.x > -0.5 * u && bq.x < 106.0 * b.z + 0.4 * u && bq.y > -0.5 * u && bq.y < 30.0 * b.z + 0.2 * u) {
      // The board: its frame, its dark face, each row a strip of flaps
      // with their seam across the middle, the gate's own row warm while
      // Claude asks.
      dim = 0.0;
      if (bq.x > -0.3 * u && bq.x < 106.0 * b.z + 0.2 * u && bq.y > -0.3 * u && bq.y < 30.0 * b.z) {
        float fy = mod(bq.y + 0.5 * b.z, 6.0 * b.z);
        c = bq.y > 5.5 * b.z && fy > 0.3 * b.z && fy < 5.7 * b.z ? mix(dk, STEEL, abs(fy - 3.0 * b.z) < 0.5 ? 0.05 : 0.2) : dk;
        if (WAITING == 1 && bq.y > 5.5 * b.z && bq.y < 11.5 * b.z) c = mix(c, INK_ORANGE, 0.15);
      }
    } else if (sq.x < s.z && sq.y < s.w) {
      // The gate's sign, its letters and its lamps put on it later.
      c = sq.x > s.z - 0.2 * u || sq.y > s.w - 0.2 * u ? STEEL : mix(INK_INDIGO, INK_BLUE, 0.2) * 0.7;
      dim = 0.0;
    } else if (q.y > -0.45) c = q.y > -0.15 ? key : mix(STEEL, CREAM, 0.2);
    else c = mix(STEEL, CREAM, 0.15);
  } else {
    // The carpet, Portland's, quiet under the people: a tile every two
    // units edged in a lighter teal, its lines crossing like runways, and
    // in about every other tile by its hash a small bar or dot of indigo
    // or coral, printed thin.
    vec2 ft = fract(q / 2.0) - 0.5;
    uint h = hashi(int(floor(q.x / 2.0)) * 131 + int(floor(q.y / 2.0)) * 977 + 7);
    c = CARPET;
    deep = mix(CARPET, INK_INDIGO, 0.5);
    shade = 0.2 + 0.1 * float((h >> 4) & 1u);
    angle = 60.0;
    vec2 fa = abs(ft);
    if (max(fa.x, fa.y) > 0.475) c = mix(CARPET, mix(INK_GREEN, CREAM, 0.5), 0.15);
    else if ((h & 1u) == 0u && ((h & 2u) == 0u ? fa.x < 0.125 && fa.y < 0.075 : length(ft) < 0.08)) {
      c = mix(CARPET, (h & 4u) == 0u ? INK_INDIGO : CORAL, 0.2);
      shade = 0.0;
    }
    bool isRunning = tool == sky_TOOL_COMMAND;
    bool isEdit = tool == sky_TOOL_EDIT;
    bool isAway = cs == CONTEXT_CLEARING || cs == CONTEXT_CLEARED;
    float xs = 2.0 + (S - 9.0) * abs(2.0 * fract(time / 40.0) - 1.0);
    if (isEdit) if (q.y > 16.9 && q.y < 19.3) {
      // Wet behind the scrubber for a few units, a sheen in streaks fading
      // toward its tail; and the yellow wet-floor sign at the aisle's end.
      float back = fract(time / 40.0) < 0.5 ? xs - q.x : q.x - xs;
      if (q.y < 18.3 && back > 0.9 && back < 6.9 && fract(q.x / 0.6 + 0.5 * q.y) < 0.35) {
        c = mix(c, mix(INK_BLUE, CREAM, 0.6), 0.65 * (6.9 - back) / 6.0);
        shade = 0.0;
      }
      vec2 tq = q - vec2(1.75, 18.95);
      if (abs(tq.y) < 0.3 && abs(tq.x) < 0.5 * (tq.y + 0.3)) {
        c = abs(tq.x) < 0.06 && tq.y > -0.05 && tq.y < 0.2 ? dk : INK_YELLOW;
        shade = 0.0;
      }
    }
    // A shadow on the carpet just in front of what stands on it.
    float sy = q.y > 20.0 ? 26.2 : q.y > 17.0 ? 18.0 : q.y > 9.0 ? 14.6 : q.y > 4.0 ? (q.x > S - 6.2 ? 6.6 : 7.6) : 2.6;
    if (q.y > sy && q.y < sy + 0.32) c = mix(c, dk, 0.4);
    if ((q.y > 20.2 || (q.y > 19.35 && q.x > S - 4.5)) && q.y < 26.2 && q.x > 1.9) {
      // The carousel and the hopper at its end, over the belt's east turn.
      vec2 bd = q - vec2(0.5 * (S - 2.6), 23.2);
      float L = 0.5 * (S - 6.6) - 2.4;
      float outer = length(vec2(max(abs(bd.x) - L, 0.0), bd.y)) - 2.4;
      int hop = face(q, vec2(S - 3.6, 24.2), vec3(3.4, 1.1, 3.0));
      vec2 beacon = q - vec2(S - 3.6, 19.85);
      shade = 0.0;
      if (length(beacon) < 0.45) {
        // Its beacon, flashing while the belt runs.
        c = isRunning && fract(iTime * 1.2) < 0.6 ? WARM_WHITE : mix(INK_YELLOW, INK_ORANGE, 0.25);
        dim = 0.0;
      } else if (hop > 0) {
        // The hopper the bags come out of, its rubber flaps parted while
        // the belt runs.
        c = hop == 1 ? mix(STEEL, CREAM, 0.3) : mix(STEEL, INK_INDIGO, 0.25);
        vec2 fq = q - vec2(S - 4.5, 23.2);
        if (hop == 2 && abs(fq.x) < 0.7 && abs(fq.y) < 1.0) c = isRunning ? dk : mix(INK_INDIGO, INK_GREEN, 0.3);
      } else if (outer < -1.25) {
        // The island in the middle, steel, its name on it.
        c = outer > -1.4 ? key : mix(STEEL, CREAM, 0.25);
        shade = 0.12;
      } else if (outer < 0.0) {
        // The carousel's plates, running while a command does, and on them
        // a bag for each tenth of the context window that is full, the
        // newest tagged yellow while a tenth has just filled.
        float rm = 1.78;
        float sp = abs(bd.x) <= L ? (bd.y < 0.0 ? bd.x + L : 2.0 * L + PI * rm + L - bd.x) : 2.0 * L + (0.5 + 0.5 * clamp(bd.y / 2.4, -1.0, 1.0)) * PI * rm;
        if (bd.x < -L) sp = 6.0 * L + 2.0 * PI * rm - sp;
        float slot = (4.0 * L + 2.0 * PI * rm) / 12.0;
        float ss = sp - (isRunning ? time * 1.4 : 0.0);
        int j = int(mod(floor(ss / slot), 12.0));
        vec2 bq = vec2(mod(ss, slot) - 0.5 * slot, outer + 0.625);
        c = fract(ss / 0.55) < 0.1 ? dk : mix(STEEL, INK_INDIGO, 0.2);
        int fish = contextFish();
        if (!isAway && j < fish) {
          int bi = int(hashu(uint(j) * 19u + 3u) % 6u);
          vec3 bag = bi == 0 ? INK_BLUE : bi == 1 ? INK_GREEN : bi == 2 ? INK_VIOLET : bi == 3 ? INK_PINK : bi == 4 ? INK_YELLOW : mix(INK_INDIGO, INK_BLUE, 0.4);
          float bb = box(bq, vec2(0.52, 0.36)) - 0.12;
          if (bb < 0.07) c = key;
          if (bb < 0.0) c = bq.y > 0.28 && abs(bq.x) < 0.22 ? key : bq.y < -0.2 ? mix(bag, CREAM, 0.3) : bag;
          if (cs == CONTEXT_GAINED && j == fish - 1 && length(bq - vec2(0.38, 0.0)) < 0.17) c = INK_YELLOW;
        }
      } else if (length(vec2(max(abs(bd.x) - L, 0.0), bd.y - 0.6)) < 2.4 && bd.y > 0.0) {
        // The carousel's side, its lights chasing round while it runs.
        c = mix(STEEL, INK_INDIGO, 0.4);
        if (abs(bd.y - 2.75) < 0.07 && fract((q.x + (isRunning ? time * 2.0 : 0.0)) / 0.7) < 0.35) {
          c = isRunning ? mix(INK_GREEN, CREAM, 0.3) : dk;
          dim = isRunning ? 0.0 : 1.0;
        }
      } else shade = 0.2;
      if (isRunning) {
        light = INK_YELLOW;
        glow = (fract(iTime * 1.2) < 0.6 ? 0.75 : 0.35) * smoothstep(20.2, 21.2, q.y) * (1.0 - smoothstep(25.4, 26.2, q.y));
        lamp3 = vec2(length(q - vec2(S - 5.0, 23.2)), 2.5);
      }
    } else if (q.x > S - 6.1 && q.y > 6.6 && q.y < 18.4) {
      // The garden: a palm seen from above, seven fronds from its crown
      // with a lighter midrib each, reaching out over the rim of its cream
      // planter, an oval soft-cornered as the sixties made them, and the
      // crown's shadow on the carpet.
      vec2 gq = q - vec2(S - 3.1, 14.2);
      float pot = box(gq, vec2(0.9, 0.5)) - 0.8;
      float potFront = box(gq - vec2(0.0, 0.8), vec2(0.9, 0.5)) - 0.8;
      vec2 cq = q - vec2(S - 3.1, 12.4);
      float r = length(cq);
      float fr = r < 2.6 ? abs(fract(atan(cq.y, cq.x) / (2.0 * PI) * 7.0 + 0.1 * r) - 0.5) : 1.0;
      if (fr < 0.3 * sqrt(1.0 - r / 2.6)) {
        c = fr < 0.035 ? mix(INK_GREEN, CREAM, 0.35) : mix(INK_GREEN, INK_INDIGO, 0.35);
        shade = 0.0;
      } else if (pot < 0.0) {
        c = pot > -0.25 ? mix(CREAM, INK_ORANGE, 0.12) : mix(mix(INK_ORANGE, INK_GREEN, 0.4), INK_INDIGO, 0.55);
        shade = 0.0;
      } else if (potFront < 0.0 && gq.y > 0.0) {
        c = potFront > -0.12 ? key : mix(CREAM, INK_ORANGE, 0.2);
        deep = mix(c, INK_ORANGE, 0.5);
        shade = 0.25;
      } else if (length(cq - vec2(0.6, 0.7)) < 2.1) c = mix(c, dk, 0.35);
    } else if (q.y < 14.7) {
      // The seats: rows A, C and B, and Viktor's bench, one call for the
      // row p is in; the charging posts; the desk; the queue's lanes;
      // Viktor's rug.
      float x0 = q.x < 12.0 ? 1.9 : 12.4;
      vec4 row = q.y > 12.55 ? vec4(x0, x0 < 12.0 ? 4.0 : 3.0, 14.6, 0.0) : q.y > 11.3 ? vec4(x0, x0 < 12.0 ? 4.0 : 3.0, 12.8, 1.0) : q.y > 5.4 && q.y < 7.7 ? vec4(9.8, 4.0, 7.6, 0.0) : q.y < 2.7 && q.x > 12.4 ? vec4(12.6, 3.0, 2.6, 0.0) : vec4(0.0);
      int seat = row.y > 0.0 ? seatPart(q, row.x, row.z < 3.0 ? 2.5 : 2.4, row.y, row.z, row.w > 0.5) : 0;
      vec3 seatInk = row.z < 3.0 ? mix(INK_VIOLET, INK_INDIGO, 0.25) : SEAT_INK;
      int post = face(q, q.y < 9.0 ? vec2(19.95, 7.6) : vec2(12.0, 14.6), vec3(0.6, 0.4, 1.6));
      int desk = face(q, vec2(5.2, 2.6), vec3(6.8, 0.9, 1.1));
      vec2 rug = q - vec2(16.2, 2.85);
      if (seat > 0) {
        c = seat == 2 ? mix(seatInk, CREAM, 0.35) : seat == 3 ? mix(seatInk, CREAM, 0.2) : seat == 4 ? mix(seatInk, INK_INDIGO, 0.4) : seat == 5 ? STEEL : seatInk;
        shade = 0.0;
      } else if (post > 0) {
        // A charging post: its screen lit, blue and bright while Claude is
        // on the web.
        c = post == 1 ? mix(STEEL, CREAM, 0.3) : STEEL;
        if (post == 2 && fract(q.y / 1.6) > 0.3 && fract(q.y / 1.6) < 0.6) {
          c = tool == sky_TOOL_WEB ? mix(INK_BLUE, CREAM, 0.5) : mix(INK_GREEN, INK_INDIGO, 0.3);
          dim = 0.0;
        }
        shade = 0.0;
      } else if (desk > 0) {
        // The gate desk: its top with two screens' backs on it, its front
        // blue with a stripe and its name.
        c = desk == 1 ? mix(CREAM, STEEL, 0.25) : mix(INK_BLUE, INK_INDIGO, 0.35);
        if (desk == 1 && abs(abs(q.x - 5.2) - 2.9) < 0.35 && q.y > 0.8 && q.y < 1.3) c = mix(STEEL, INK_INDIGO, 0.5);
        if (desk == 2 && abs(q.y - 1.75) < 0.07) c = mix(INK_YELLOW, CREAM, 0.3);
        shade = 0.0;
      } else if (q.x < 9.4 && q.y > 2.8 && q.y < 10.6) {
        // The queue's lanes: posts with belts between them, three lines of
        // them, and at their heads the two GROUP signs, lit while boarding.
        float lx = 1.6 + 3.8 * floor((q.x - 1.6) / 3.8 + 0.5);
        float py = 4.4 + 3.0 * clamp(ceil((q.y - 4.4) / 3.0), 0.0, 2.0);
        if (abs(q.x - lx) < 0.13 && q.y < py && q.y > py - 0.95) c = STEEL;
        else if (abs(q.x - lx) < 0.07 && q.y > 3.6 && q.y < 9.6) c = mix(INK_BLUE, INK_INDIGO, 0.5);
        if (abs(fract((q.x - 1.6) / 3.8) - 0.5) < 0.47 && q.y > 2.85 && q.y < 3.45) c = agents > 0 ? mix(INK_INDIGO, INK_BLUE, 0.4) : mix(INK_INDIGO, CARPET, 0.3);
        if (q.y < 3.5) shade = 0.0;
      } else if (abs(rug.x) < 4.2 && abs(rug.y) < 2.55) {
        // Viktor's rug, his own colour: red with a yellow border and a row
        // of diamonds, from the place he comes from.
        c = abs(rug.x) > 3.85 || abs(rug.y) > 2.2 ? INK_YELLOW : mix(INK_PINK, INK_ORANGE, 0.45);
        if (abs(rug.x) < 3.6 && abs(rug.y) < 1.95 && abs(fract(rug.x / 1.2) - 0.5) + abs(rug.y - 0.8) < 0.45) c = mix(INK_VIOLET, INK_INDIGO, 0.2);
        deep = mix(c, INK_INDIGO, 0.4);
        shade = 0.15;
      }
      if (q.y < 3.0 && q.x > 11.4) {
        // Viktor's things on his bench: his suitcase and his can of
        // Planters on the last seat (unless the can is in his hand), and
        // over coffee the packets of ketchup and mustard on the first; his
        // floor lamp at the bench's end, seen from above, its round shade
        // always lit and its shadow on the rug.
        vec2 vs = q - vec2(18.8, 1.05);
        if (box(vs, vec2(0.75, 0.5)) < 0.0) c = abs(vs.x - 0.2) < 0.07 ? mix(INK_VIOLET, INK_INDIGO, 0.6) : mix(INK_VIOLET, INK_INDIGO, 0.3);
        if (CLAWD_ACTIVITY != 3 && box(vs - vec2(-0.1, -0.85), vec2(0.25, 0.35)) < 0.0) c = abs(vs.y + 1.1) < 0.1 ? INK_YELLOW : INK_BLUE;
        if (CLAWD_ACTIVITY == 1 && abs(q.x - 13.4) < 0.5 && abs(q.y - 1.95) < 0.12) c = q.x < 13.4 ? RED_INK : INK_YELLOW;
        float shadeR = length(q - vec2(12.05, 1.0));
        if (shadeR < 0.55) {
          c = shadeR > 0.43 ? mix(INK_YELLOW, INK_ORANGE, 0.3) : shadeR < 0.24 ? mix(mix(INK_YELLOW, CREAM, 0.4), WARM_WHITE, n) : mix(CREAM, INK_YELLOW, 0.25);
          dim = 0.0;
          shade = 0.0;
        } else if (length(q - vec2(12.4, 1.35)) < 0.55) c = mix(c, dk, 0.4);
      }
      glow = 0.12 + 0.35 * n;
      lamp3 = vec2(length(rug - vec2(-0.7, 0.35)), 1.5);
    }
    if (isEdit || isAway) if (q.y > 16.5 && q.y < 20.2 && q.x < S - 6.4) {
      // The scrubber, yellow and green, its brush dark in front; or the
      // tug and its two carts with the carousel's bags stacked on them.
      float tx = cs == CONTEXT_CLEARED ? 0.6 : 2.6;
      int tug = isAway ? face(q, vec2(tx + 0.9, 20.1), vec3(1.8, 1.0, 0.8)) : face(q, vec2(xs, 18.3), vec3(1.8, 0.9, 0.8));
      int cart = isAway && q.x - tx < 6.2 ? face(q, vec2(tx + 2.9 + 2.2 * step(4.0, q.x - tx), 20.1), vec3(1.9, 1.1, 0.4)) : 0;
      if (tug > 0) {
        c = isAway ? (tug == 1 ? mix(INK_YELLOW, CREAM, 0.2) : mix(INK_YELLOW, INK_ORANGE, 0.3)) : tug == 1 ? mix(INK_YELLOW, CREAM, 0.3) : q.y > 17.95 ? dk : mix(INK_YELLOW, INK_GREEN, 0.35);
        shade = 0.0;
      } else if (cart > 0) {
        c = cart == 1 ? STEEL : mix(STEEL, INK_INDIGO, 0.4);
        shade = 0.0;
        float cx = q.x - tx - 2.0;
        int i = int(floor(cx / 2.2)) * 6 + int(floor(mod(cx, 2.2) / 0.62)) + 3 * int(q.y > 19.15);
        if (cart == 1 && mod(cx, 2.2) < 1.86 && fract(mod(cx, 2.2) / 0.62) > 0.12 && i < (cs == CONTEXT_CLEARED ? 10 : contextFish())) {
          int bi = int(hashu(uint(i) * 19u + 3u) % 6u);
          c = bi == 0 ? INK_BLUE : bi == 1 ? INK_GREEN : bi == 2 ? INK_VIOLET : bi == 3 ? INK_PINK : bi == 4 ? INK_YELLOW : mix(INK_INDIGO, INK_BLUE, 0.4);
        }
      }
    }
  }
  c = mix(c, mix(mix(c, INK_ORANGE, 0.1), INK_INDIGO, 0.3), n * dim);
  // The floor's light: by night the ceiling's lamps reach it warm, most
  // under each bay and less toward the front; by day the daylight through
  // the glass lifts it a little near the glass's foot.
  if (q.y > 0.0) c = n > 0.5 ? mix(c, mix(INK_ORANGE, INK_YELLOW, 0.3), 0.3 * n * (1.0 - 0.65 * smoothstep(0.15, 0.5, abs(fract((q.x - 1.2) / 5.4) - 0.5))) * (1.0 - 0.5 * smoothstep(0.0, 24.0, q.y))) : mix(c, CREAM, 0.07 * (1.0 - n) * (1.0 - smoothstep(0.0, 8.0, q.y)));
  c = mix(c, deep, screen(p, shade, pitch(u), angle));
  return lift(mix(c, light, screen(p, glow * exp(-lamp3.x / lamp3.y), pitch(u), 0.0)), k);
}

// --- Letters -------------------------------------------------------------------------

// The code of character i, 0 to 19, of a line packed six bits a character.
int codeIn(uvec4 line, int i) {
  uint word = i < 5 ? line.x : i < 10 ? line.y : i < 15 ? line.z : line.w;
  return int((word >> uint(6 * (i % 5))) & 63u);
}

// Where character i of a line starts, in cells, when the characters whose
// bits are set in `wide` (two at most) take six cells and the rest four.
float slotX(uint wide, int i) {
  uint m = wide & ((1u << uint(max(i, 0))) - 1u);
  return 4.0 * float(i) + 2.0 * (float(m != 0u) + float((m & (m - 1u)) != 0u));
}

// Every line of text in the gate, packed six bits a character, 63 for a
// blank: 0 DEPARTURES; 1 to 9 the flights, a name and a gate each
// (CLAUDE B4, KRAKOZHIA B6, PARIS C3, TOKYO A2, OSLO B2, REYKJAVIK C1,
// CHICAGO A5, LISBOA D2, SEATTLE C5); 10 to 17 the remarks (ON TIME,
// BOARDING, LAST CALL, LANDED, DELAYED, CANCELED, GATE OPEN, DEPARTED);
// 18 B4; 19 COFFEE; 20 nothing.
const uvec4 LINES[21] = uvec4[21](
  uvec4(0x1B29938Du, 0x1C39B79Du, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0xD78A54Cu, 0x3FFFFFCEu, 0x3FFFF10Bu, 0x3FFFFFFFu),
  uvec4(0x1850A6D4u, 0x3F292463u, 0x3FFFF18Bu, 0x3FFFFFFFu),
  uvec4(0x1C49B299u, 0x3FFFFFFFu, 0x3FFFF0CCu, 0x3FFFFFFFu),
  uvec4(0x1889461Du, 0x3FFFFFFFu, 0x3FFFF08Au, 0x3FFFFFFFu),
  uvec4(0x3F615718u, 0x3FFFFFFFu, 0x3FFFF08Bu, 0x3FFFFFFFu),
  uvec4(0x1352239Bu, 0x3F5127CAu, 0x3FFFF04Cu, 0x3FFFFFFFu),
  uvec4(0xA31244Cu, 0x3FFFF610u, 0x3FFFF14Au, 0x3FFFFFFFu),
  uvec4(0x182DC495u, 0x3FFFFFCAu, 0x3FFFF08Du, 0x3FFFFFFFu),
  uvec4(0x1D74A39Cu, 0x3FFFF395u, 0x3FFFF14Cu, 0x3FFFFFFFu),
  uvec4(0x1277F5D8u, 0x3FFFF396u, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0xD6CA60Bu, 0x3FFD05D2u, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0x3F75C295u, 0x3F55528Cu, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0xE357295u, 0x3FFFFFCDu, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0x2229538Du, 0x3FFFF34Eu, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0xE31728Cu, 0x3FFCD395u, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0x3F39D290u, 0x3F5CE658u, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0x1B29938Du, 0x3FFCD39Du, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0x3FFFF10Bu, 0x3FFFFFFFu, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0xE3CF60Cu, 0x3FFFFFCEu, 0x3FFFFFFFu, 0x3FFFFFFFu),
  uvec4(0x3FFFFFFFu, 0x3FFFFFFFu, 0x3FFFFFFFu, 0x3FFFFFFFu)
);

// Every letter of the gate, printed by one sky_glyphWide: the board, the B4
// on the gate's sign and the kiosk's name. Each sign only says where its line starts, its cell, its
// ink and which line it is; then the column p is in picks the one
// character. A character takes four cells, or six for an M, an N or a W,
// which only the remarks and the carousel's name have; a narrow letter sits
// a cell into its five-cell box, so that it prints as sky_glyph would.
//
// The board: DEPARTURES and the clock; the gate's own flight, CLAUDE from
// B4, ON TIME while nothing waits, BOARDING in orange while Claude asks,
// LAST CALL once a question has waited, LANDED in white once Claude is
// done; Krakozhia, delayed and now and then cancelled; and two more flights
// turning over each minute, or at night the red-eye still open and
// Reykjavik gone.
vec3 letters(vec3 sky, vec2 p, float u, float k, Gate g, float n, int agents, bool isOpen) {
  if (p.x < g.left) return sky;
  float S = g.width / u;
  vec3 b = boardOf(g, u);
  vec2 bq = p - b.xy;
  float c3 = b.z;
  float c6 = max(3.0, floor(0.4 * u));
  vec2 gate = floor(signOf(g, u).xy - vec2(3.5, 2.5) * c6);
  vec2 cafe = floor(vec2(g.left + (S - 3.1) * u - 11.5 * c3, g.top - 1.15 * u - 2.5 * c3));
  vec2 at = vec2(0.0);
  float cell = c3;
  vec3 color = CREAM;
  int line = 20;
  int row = 0;
  if (bq.x >= 0.0 && bq.y >= 0.0 && bq.x < 106.0 * c3 && bq.y < 30.0 * c3) {
    row = int(floor(bq.y / (6.0 * c3)));
    bool isRemark = row > 0 && bq.x >= 52.0 * c3;
    at = b.xy + vec2(isRemark ? 52.0 * c3 : 0.0, 6.0 * c3 * float(row));
    cell = c3;
    int name = 0;
    int remark = 20;
    vec3 ink2 = INK_GREEN;
    if (row == 1) {
      bool isUrgent = WAITING_URGENT > 0.5;
      name = 1;
      remark = WAITING == 1 ? (isUrgent ? 12 : 11) : WAITING == 2 ? 13 : 10;
      ink2 = WAITING == 1 ? INK_ORANGE : WAITING == 2 ? WARM_WHITE : INK_GREEN;
    } else if (row == 2) {
      bool isCancelled = fract(floor((iTime + 23.0) / 600.0) * 0.618 + 0.5) < 0.3;
      name = 2;
      remark = isCancelled ? 15 : 14;
      ink2 = isCancelled ? RED_INK : INK_YELLOW;
    } else if (row > 2) {
      float clock = iTime + 23.0 * float(row);
      int v = n > 0.6 ? (row == 3 ? 6 : 7) : int(mod(floor(clock / 60.0) + 3.0 * float(row - 3), 6.0));
      name = v < 6 ? 3 + v : v == 6 ? 9 : 6;
      remark = v == 0 || v == 3 || v == 5 ? 10 : v == 1 || v == 6 ? 16 : v == 2 ? 14 : 17;
      ink2 = v == 2 ? INK_YELLOW : v == 1 || v >= 4 && v != 5 ? mix(CREAM, INK_BLUE, 0.2) : INK_GREEN;
    }
    line = isRemark ? remark : name;
    color = row == 0 ? INK_YELLOW : isRemark ? ink2 : bq.x >= 40.0 * c3 ? INK_YELLOW : CREAM;
  } else if (p.x >= gate.x && p.y >= gate.y && p.x < gate.x + 7.0 * c6 && p.y < gate.y + 5.0 * c6) {
    at = gate;
    cell = c6;
    color = INK_YELLOW;
    line = 18;
  } else if (p.x >= cafe.x && p.y >= cafe.y && p.x < cafe.x + 24.0 * c3 && p.y < cafe.y + 5.0 * c3) {
    at = cafe;
    cell = c3;
    color = isOpen ? CREAM : mix(CREAM, INK_GREEN, 0.6);
    line = 19;
  } else return sky;
  uint wide = line == 10 ? 34u : line == 11 ? 64u : line == 13 || line == 15 ? 4u : line == 16 ? 256u : 0u;
  float x = (p.x - at.x) / cell;
  int i = int(floor(x / 4.0));
  float sx = slotX(wide, i);
  if (sx > x) {
    i -= 1;
    sx -= (((wide >> uint(i)) & 1u) == 1u ? 6.0 : 4.0);
  }
  bool isNarrow = ((wide >> uint(i)) & 1u) == 0u;
  int code = codeIn(LINES[line], i);
  if (line == 0 && i >= 21) {
    // The clock, HH:MM, from the place's own time.
    float hm = i < 23 ? floor(LOCAL_HOUR) : floor(fract(LOCAL_HOUR) * 60.0 + 0.01);
    code = i > 25 ? sky_GLYPH_SPACE : i == 23 ? sky_GLYPH_COLON : int(i == 21 || i == 24 ? floor(hm / 10.0) : mod(hm, 10.0));
  }
  return mix(sky, lift(color, k), sky_glyphWide(p, at + vec2((sx - (isNarrow ? 1.0 : 0.0)) * cell, 0.0), cell, code));
}

// --- The waiting light -------------------------------------------------------------

// Two lamps on the gate's sign, either side of its B4: both dark while
// nothing waits, the place still showing; the right one orange while Claude
// asks, white once it is done; both orange, their glow wider and quicker,
// once a question has waited. Lit in every frame they are on, so a still
// shows them too.
vec3 waitLamp(vec3 sky, vec2 p, float u, float k, Gate g) {
  vec2 c = signOf(g, u).xy;
  float r = 0.8 * u;
  bool isUrgent = WAITING == 1 && WAITING_URGENT > 0.5;
  float reach = (isUrgent ? 1.9 : 1.3) * u;
  float da = length(p - c - vec2(2.6 * u, 0.0));
  float db = length(p - c + vec2(2.6 * u, 0.0));
  if (min(da, db) > r + 4.7 * reach) return sky;
  vec3 off = mix(keyInk(k), tone(STEEL, k), 0.25);
  if (WAITING == 0) {
    float d = min(da, db) - r;
    sky = ink(sky, off, d, 1.0);
    return ink(sky, tone(STEEL, k), abs(d + 0.1 * u) - 0.06 * u, 1.0);
  }
  vec3 light = WAITING == 1 ? INK_ORANGE : WARM_WHITE;
  float pulse = WAITING == 2 ? 1.0 : 0.85 + 0.15 * sin(mod(iTime, 3600.0) * (isUrgent ? 7.0 : 2.5));
  float d = isUrgent ? min(da, db) : da;
  sky = mix(sky, light, screen(p, pulse * exp(-max(0.0, d - r) / reach), pitch(u), 15.0));
  if (!isUrgent) sky = ink(sky, off, db - r, 1.0);
  sky = ink(sky, light, d - r, 1.0);
  return ink(sky, mix(light, WARM_WHITE, 0.6), d - 0.45 * r, 1.0);
}

// --- What the engine calls: the scenery and the window ------------------------------

// Outside: the airfield, the tower, the planes and the bridge. On the stage:
// the gate, the waiting light, and over its glow the letters.
vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  Gate g = gateOf(u);
  float n = night();
  int agents = sky_agents();
  int tool = sky_tool();
  if (p.x < g.left) return outside(sky, p, u, k, g, n, agents, tool == sky_TOOL_WEB);
  bool isOpen = LOCAL_HOUR > 5.5 && LOCAL_HOUR < 22.0;
  sky = hall(sky, p, u, k, g, n, tool, agents, isOpen, contextState());
  sky = waitLamp(sky, p, u, k, g);
  return letters(sky, p, u, k, g, n, agents, isOpen);
}

// Outside, 1, but under the bridge's roof; on the stage, 1 in the
// skylights, 0.85 through the glass wall onto the sky and 0.5 onto the
// apron, and 0 everywhere else: in the walls, the ceiling, the floor and on
// the board, the sign and the kiosk hung or standing before the glass. No
// rain falls in the gate.
float themeWindow(vec2 p, float u) {
  Gate g = gateOf(u);
  if (p.x < g.left) return p.x > g.left - 6.6 * u && p.y > g.floorY - 2.45 * u && p.y < g.floorY - 0.3 * u ? 0.0 : 1.0;
  if (p.y > g.top - 0.45 * u || p.x < g.left + 1.2 * u) return 0.0;
  if (p.y < g.ceil) return p.y > 0.14 * g.ceil && p.y < 0.51 * g.ceil && abs(mod((p.x - g.left) / u - 1.2, 5.4) - 2.7) < 2.0 ? 1.0 : 0.0;
  vec3 b = boardOf(g, u);
  vec4 s = signOf(g, u);
  if ((p.x > b.x - 0.5 * u && p.y < b.y + 30.0 * b.z + 0.2 * u) || (abs(p.x - s.x) < s.z && abs(p.y - s.y) < s.w) || (p.x > g.left + g.width - 6.2 * u && p.y > g.top - 1.7 * u)) return 0.0;
  return p.y > g.apron ? 0.5 : 0.85;
}

// --- People ----------------------------------------------------------------------------

// A figure's cell c, six across and four down from the top left of his
// body, two rows above it for his hands and his hat: 0 nothing, 1 body,
// 2 eye, 3 leg, 4 his arms (his jumper), 5 hat, 6 a shut eye. `pose` 0
// stands, 1 walks (`stride` 0 or 1), 2 has his arms up, 3 sits behind
// something with his legs hidden; `eyes` 0 to the front, 1 the way he
// faces, 2 shut, 3 none, his back to us; `hat` 0 none, 1 a cap, 2 a beanie,
// 3 headphones.
int figCell(ivec2 c, int pose, int stride, int eyes, int hat) {
  if (c.x < 0 || c.x > 5 || c.y < -2 || c.y > 3) return 0;
  if (c.y < 0) {
    if (pose == 2 && c.y == -1 && (c.x == 0 || c.x == 5)) return 1;
    if (hat == 2 && c.y == -2) return c.x == 2 || c.x == 3 ? 5 : 0;
    if (c.y == -1 && hat != 0) return c.x >= 1 && (c.x <= 4 || hat == 1) ? 5 : 0;
    return 0;
  }
  if (c.y == 0) return c.x >= 1 && c.x <= 4 ? 1 : 0;
  if (c.y == 1) {
    if (hat == 3 && (c.x == 0 || c.x == 5)) return 5;
    if (c.x < 1 || c.x > 4) return 0;
    if (eyes == 3 || (c.x != 4 && c.x != (eyes == 1 ? 2 : 1))) return 1;
    return eyes == 2 ? 6 : 2;
  }
  if (c.y == 2) return pose != 2 || (c.x >= 1 && c.x <= 4) ? 4 : 0;
  if (pose == 3) return 0;
  if (pose == 1) return c.x == stride || c.x == stride + 4 ? 3 : 0;
  return c.x == 1 || c.x == 4 ? 3 : 0;
}

// One figure: where his feet are, his cell in whole pixels, his pose, his
// eyes, whether he faces left, his jumper, his hat's ink and his hat, and
// his thing: 0 none, 1 a bag on wheels behind him, 2 an open newspaper in
// his hands, 3 a laptop on his lap, its screen lit.
struct Fig { vec2 feet; float cell; int pose; int eyes; bool flip; vec3 jumper; vec3 hatInk; int hat; int thing; };

// A figure drawn in the band's shape: coral, his eyes indigo, his legs a
// deeper coral, his arms in his jumper, his bag behind him; lit by the
// gate's lamps, so lifted rather than under the night's plate; his key
// plate a pixel or so off register down and to the right.
vec3 figure(vec3 sky, vec2 p, Fig f, float k) {
  float c = f.cell;
  vec2 origin = floor(f.feet - vec2(3.0 * c, 4.0 * c) + 0.5);
  if (p.x < origin.x - 3.0 * c || p.x > origin.x + 9.0 * c || p.y < origin.y - 2.0 * c || p.y > origin.y + 5.0 * c) return sky;
  int stride = int(mod(floor(iTime * 3.0), 2.0));
  ivec2 cc = ivec2(floor((p - origin) / c));
  if (f.flip) cc.x = 5 - cc.x;
  int kind = figCell(cc, f.pose, stride, f.eyes, f.hat);
  vec2 v = (p - origin) / c;
  int tool = sky_tool();
  if (tool == sky_TOOL_READ || tool == sky_TOOL_WEB) {
    vec2 tv = abs(v - vec2(3.0, 2.7));
    if (f.thing > 1 && tv.y < 1.0 && tv.x < (f.thing == 2 ? 3.8 : 2.4)) {
    vec3 sheet = f.thing == 3 ? (v.y < 2.6 ? mix(INK_BLUE, CREAM, 0.75) : STEEL) : tv.x < 0.15 ? mix(CREAM, INK_INDIGO, 0.25) : CREAM;
    return mix(sky, f.thing == 3 && v.y < 2.6 ? sheet : lift(sheet, k), 0.97);
    }
  }
  if (kind == 2) return mix(sky, keyInk(k), 0.97);
  if (kind != 0) return mix(sky, lift(kind == 1 ? CORAL : kind == 4 ? f.jumper : kind == 5 ? f.hatInk : CORAL_DEEP, k), 0.97);
  if (f.thing == 1) {
    vec2 bq = vec2(float(cc.x) + 1.5, float(cc.y) - 2.5);
    if (abs(bq.x) < 1.0 && abs(bq.y) < 1.5) return mix(sky, lift(bq.y < -1.0 ? KEY : mix(f.hatInk, INK_INDIGO, 0.25), k), bq.y < -1.0 && abs(bq.x) > 0.5 ? 0.0 : 0.97);
  }
  // His key plate: his head and arms again, off register.
  vec2 kv = v - max(1.0, floor(0.4 * c)) / c;
  if (kv.y >= 0.0 && kv.y < 3.0 && kv.x >= (kv.y < 2.0 ? 1.0 : 0.0) && kv.x < (kv.y < 2.0 ? 5.0 : 6.0)) sky = mix(sky, keyInk(k), 0.55);
  return sky;
}

// A traveller, his looks from his hash: one of four jumpers, a cap, a
// beanie, headphones or nothing on his head, and which way he looks.
Fig traveller(vec2 feet, float cell, uint h) {
  uint j = h & 3u;
  vec3 jumper = j == 0u ? INK_BLUE : j == 1u ? INK_GREEN : j == 2u ? INK_VIOLET : INK_PINK;
  uint hc = (h >> 4u) & 3u;
  vec3 hatInk = hc == 0u ? INK_INDIGO : hc == 1u ? RED_INK : INK_YELLOW;
  return Fig(feet, cell, 0, int((h >> 8u) % 2u), ((h >> 9u) & 1u) == 1u, jumper, hatInk, int((h >> 12u) % 4u), 0);
}

// When the moment of slot `slot` begins, `period` seconds a slot: one in a
// slot with a chance of `chance`, at a time that leaves it `lasts` seconds;
// -1 for a slot without one. The slots' numbers go by the golden ratio, a
// sequence as even as a hash and cheaper.
float momentStart(float slot, float period, float lasts, float chance, int salt) {
  float r = fract(mod(slot, 1000.0) * 0.6180339 + float(salt) * 0.137);
  if (r >= chance) return -1.0;
  return slot * period + fract(r * 7.31) * (period - lasts);
}

// Seconds into the moment at `time`, -1 when none is on. `preview` is its
// place in the manifest's previews, from 1: while /solar event plays it,
// one every minute from the minute's start; while another plays, or in a
// demo's time-lapse, none.
float momentAge(float time, float period, float lasts, float chance, int salt, int preview) {
  if (preview > 0 && THEME_FORCE == preview) return mod(time, 60.0) < lasts ? mod(time, 60.0) : -1.0;
  if (THEME_FORCE != 0 || DEMO_COUNT > 0) return -1.0;
  float slot = floor(time / period);
  float start = momentStart(slot, period, lasts, chance, salt);
  return start >= 0.0 && start <= time && time < start + lasts ? time - start : -1.0;
}

// What Viktor is about.
const int V_BENCH = 0;
const int V_WAIT = 1;
const int V_SLEEP = 2;
const int V_WALK = 3;
const int V_FOUNTAIN = 4;
const int V_CARTS = 5;
const int V_STRETCH = 6;

// Viktor: where his feet are, his pose, his eyes, whether he faces left,
// what he is about, and how many seconds into a moment he is.
struct Viktor { vec2 feet; int pose; int eyes; bool flip; int mode; float age; };

// Viktor, decided once by precedence, and everything else asks it. Up at
// the front of his rug while Claude waits, his back to us as he faces the
// gate's sign, his arms up once it is done; at his fountain on his rug (once
// in three hours, about) or pushing a line of carts back for their quarters
// along the aisle (about once in two); asleep on his bench from three to
// six; walking the empty gate as a night owl; stretching at dawn; else on
// his bench with what the hour brings him.
Viktor viktorOf(Gate g, float u) {
  vec2 o = vec2(g.left, g.top);
  Viktor v = Viktor(floor(o + vec2(16.35, 2.55) * u), 0, 0, false, V_BENCH, -1.0);
  float fountain = momentAge(iTime, 5400.0, 40.0, 0.5, 11, 1);
  float carts = fountain >= 0.0 ? -1.0 : momentAge(iTime, 3600.0, 45.0, 0.5, 23, 2);
  if (WAITING != 0) {
    v = Viktor(floor(o + vec2(14.2, 5.0) * u), WAITING == 2 ? 2 : 0, 3, true, V_WAIT, -1.0);
  } else if (fountain >= 0.0) {
    v = Viktor(floor(o + vec2(12.3, 5.2) * u), 2, 1, false, V_FOUNTAIN, fountain);
  } else if (carts >= 0.0) {
    v = Viktor(floor(o + vec2(mix(g.width / u - 6.0, 13.0, smoothstep(2.0, 32.0, carts)), 9.9) * u), carts < 32.0 ? 1 : 2, 1, true, V_CARTS, carts);
  } else if (CLAWD_ASLEEP > 0.5) {
    v.mode = V_SLEEP;
    v.eyes = 2;
  } else if (CLAWD_ACTIVITY == 4) {
    float f = fract(iTime / 26.0);
    v = Viktor(floor(o + vec2(mix(10.0, 19.5, abs(2.0 * f - 1.0)), 9.8) * u), 1, 1, f > 0.5, V_WALK, -1.0);
  } else if (CLAWD_ACTIVITY == 0) {
    v.mode = V_STRETCH;
    v.pose = 2;
  } else v.eyes = CLAWD_ACTIVITY == 2 ? 0 : 1;
  return v;
}

// Who is in the band of the floor plan that q is in, seats and aisles
// alike: the band by q's height, the lot by its place across, one hash for
// the lot. Row A faces us; B turns its back to us; C, back to back with it,
// faces us; most seats are taken by day, a few at night. In the aisles the
// walkers cross the hall: each aisle's lots slide along it at a walking
// pace, the back one to the right from the jet bridge's door, the middle
// one to the left and the front one to the right, faster, so that a walker
// keeps his looks as he goes. He comes in out of the west wall, or the
// bridge's door, and goes out into it, and at the aisle's east end he goes
// or comes all at once rather than cut in two; he sways a little up and down as he goes, more
// of them by day. The result: his feet in units, his lot's number, and his
// way, 0 seated, 1 going right, 2 going left; a negative x for nobody.
vec4 crowdAt(vec2 q, float n, float S) {
  int band = q.y < 5.4 ? -1 : q.y < 7.6 ? 0 : q.y < 9.9 ? 3 : q.y < 11.5 ? 1 : q.y < 14.7 ? 2 : q.y < 17.05 ? 4 : q.y < 21.1 ? 5 : -1;
  bool isSeat = band < 3;
  float t = mod(iTime, 3600.0);
  float x0 = band == 0 ? 9.8 : isSeat ? (q.x < 12.0 ? 1.9 : 12.4) : 1.2;
  float lot = isSeat ? 2.4 : 3.2;
  float lots = band == 0 || (isSeat && q.x < 12.0) ? 4.0 : isSeat ? 3.0 : floor((S - 6.4 - x0) / 3.2);
  float dir = band == 4 ? -1.0 : 1.0;
  float s = q.x - x0;
  float m = isSeat ? s : mod(s - dir * (band == 5 ? 0.44 : 0.33) * t, lots * lot);
  float i = floor(m / lot);
  int id = int(i) + 16 * band;
  uint h = hashi(id * 17 + 5);
  if (band < 0 || s < 0.0 || s >= lots * lot || float(h & 255u) / 255.0 > (isSeat ? (n > 0.6 ? 0.25 : 0.85) : (n > 0.6 ? 0.2 : 0.65))) return vec4(-1.0);
  if (isSeat) return vec4(x0 + (i + 0.5) * lot, band == 0 ? 7.55 : band == 1 ? 11.55 : 14.55, float(id), 0.0);
  if (s - m + (i + 0.5) * lot > lots * lot - 1.1) return vec4(-1.0);
  float sway = 2.0 * abs(2.0 * fract(0.036 * t + float((h >> 8) & 255u) * 0.032) - 1.0);
  return vec4(q.x - m + (i + 0.5) * lot, (band == 3 ? 9.5 : band == 4 ? 16.0 : 19.2) + (band == 3 ? 0.2 : 0.3) * sway, float(id), dir > 0.0 ? 1.0 : 2.0);
}

// Who stands at p, if anyone: Viktor first; else whoever the place p is in
// holds, each place asking only its own slot, so that the whole crowd is one
// figure drawn. Along the bridge and through its door, one traveller for
// each subagent at work, and in the GROUP lanes the rest of them queueing to
// board; behind the desk the gate's two agents by day; the barista while
// the kiosk is open, and a queue at it while Claude is busy with anything
// else; travellers in the seats and walking the aisles both ways with their
// bags, the back aisle's coming in through the bridge's door, and none
// in it while Viktor walks it or brings his carts along it; the cleaner on
// his scrubber while Claude edits, everyone else kept off his aisle; the
// tug's driver as the conversation compacts; travellers waiting at the
// carousel while a command runs it.
Fig whoAt(vec2 p, float u, Gate g, Viktor v, int tool, int agents, float n, bool isOpen, int cs) {
  Fig none = Fig(vec2(-1.0e4), 1.0, 0, 0, false, CORAL, CORAL, 0, 0);
  vec2 o = vec2(g.left, g.top);
  vec2 q = (p - o) / u;
  float S = g.width / u;
  float c = g.cell;
  float time = mod(iTime, 3600.0);
  if (abs(p.x - v.feet.x) < 4.5 * g.big && p.y > v.feet.y - 6.5 * g.big && p.y < v.feet.y + 1.5 * g.big) return Fig(v.feet, g.big, v.pose, v.eyes, v.flip, CORAL, CORAL, 0, 0);
  bool isDay = n < 0.6;
  vec2 f = vec2(0.0);
  bool found = false;
  uint h = 0u;
  int pose = 0;
  int eyes = -1;
  int flip = -1;
  int thing = 0;
  float cell = c;
  vec3 jumper = vec3(-1.0);
  // Who is there whatever Claude does: the barista, the desk's agents, and
  // the travellers in the seats and the aisles.
  if (q.x > S - 6.2 && q.y < 5.0) {
    if (isOpen) {
      f = vec2(S - 2.6, 4.3 + c / u);
      found = true;
      pose = 3;
      jumper = INK_GREEN;
      h = 6u | 1u << 31;
    }
  } else if (q.y < 2.9 && q.x < 12.0) {
    if (q.x < 9.0 && (isDay || agents > 0)) {
      int i = q.x < 5.2 ? 0 : 1;
      f = vec2(3.5 + 3.4 * float(i), 0.6 + c / u);
      found = true;
      pose = agents > 0 && fract(time / 3.0 + 0.5 * float(i)) < 0.3 ? 2 : 3;
      jumper = mix(INK_BLUE, INK_INDIGO, 0.4);
      h = 1u << 12 | 1u << 31;
    }
  } else if (!(q.x < 9.0 && q.y < 7.6) && !((v.mode == V_CARTS || v.mode == V_WALK) && q.y > 7.6 && q.y < 9.9)) {
    vec4 w = crowdAt(q, n, S);
    if (w.x > 0.0) {
      f = w.xy;
      found = true;
      h = uint(w.z) * 13u + 7u;
      if (w.w > 0.5) {
        pose = 1;
        flip = w.w > 1.5 ? 1 : 0;
        eyes = w.w > 2.5 ? 3 : 1;
        thing = int(h & 1u);
      } else if (q.y > 9.9 && q.y < 11.5) {
        pose = 3;
        eyes = 3;
        f.y = 11.4 + c / u;
      } else thing = tool == sky_TOOL_READ ? 2 : tool == sky_TOOL_WEB ? 3 : 0;
    }
  }
  // Then what Claude does, each under its own constant, so that a scene
  // without it has nothing of it to work out: travellers boarding, the
  // kiosk's queue, the cleaner on his scrubber with everyone else kept off
  // his aisle, the tug's driver, and travellers waiting at the carousel.
  if (agents > 0) {
    if (q.x < 1.6 && q.y > 7.6 && q.y < 10.4) {
      float len = 9.8;
      float N = float(min(agents, 4));
      float T = fract(time * 0.085);
      float j = mod(floor(fract((3.0 - q.x) / len - T) * N + 0.5), N);
      f = vec2(3.0 - fract(T + j / N) * len, 10.2);
      found = true;
      h = uint(j) * 7u + 3u;
      pose = 1;
      eyes = 1;
      flip = 1;
      thing = 1;
    } else if (q.x < 9.0 && q.y > 3.4 && q.y < 10.0) {
      int lane = q.x < 5.4 ? 0 : 1;
      int d = int(clamp(ceil((q.y - 6.1) / 1.7), 0.0, 2.0));
      found = d * 2 + lane < agents;
      f = vec2(3.5 + 3.8 * float(lane), 6.1 + 1.7 * float(d));
      h = uint(d * 2 + lane) * 7u + 3u;
      eyes = 3;
      thing = int((h >> 5) & 1u);
    }
  }
  if (tool == sky_TOOL_OTHER && isOpen) if (q.x > S - 6.2 && q.y > 5.0 && q.y < 8.6) {
    int i = int(clamp(floor((q.x - S + 5.8) / 1.6), 0.0, 2.0));
    f = vec2(S - 5.0 + 1.6 * float(i), 8.4);
    found = true;
    h = uint(i) * 5u + 41u;
    eyes = 3;
  }
  if (tool == sky_TOOL_EDIT) if (q.y > 14.7 && q.y < 21.1) {
    f = vec2(2.0 + (S - 9.0) * abs(2.0 * fract(time / 40.0) - 1.0), 17.3 + c / u);
    found = true;
    pose = 3;
    eyes = 1;
    flip = fract(time / 40.0) < 0.5 ? 0 : 1;
    jumper = INK_GREEN;
    h = 2u << 12 | 2u << 4 | 1u << 31;
    thing = 0;
  }
  if (cs == CONTEXT_CLEARING || cs == CONTEXT_CLEARED) if (q.y > 17.5 && q.y < 21.1 && q.x < 10.0) {
    f = vec2((cs == CONTEXT_CLEARED ? 0.6 : 2.6) + 0.6, 19.0 + c / u);
    found = true;
    pose = 3;
    eyes = 1;
    flip = 1;
    jumper = INK_BLUE;
    h = 1u << 12 | 2u << 4 | 1u << 31;
    thing = 0;
  }
  if (tool == sky_TOOL_COMMAND) if (q.y > 18.9 && q.y < 21.1) {
    int i = int(floor(q.x / 2.6));
    found = q.x > 2.0 && q.x < S - 5.0 && fract(float(i) * 0.618) < 0.75;
    f = vec2(2.6 * float(i) + 1.3, 20.95);
    h = uint(i) * 9u + 13u;
    pose = 0;
    eyes = 3;
    flip = -1;
    thing = 0;
  }
  if (!found) return none;
  // A fixed look (the top bit set) as it is, anyone else by his hash.
  Fig t = traveller(floor(o + f * u), cell, h >= 1u << 31 ? h : hashu(h));
  t.pose = pose;
  if (eyes >= 0) t.eyes = eyes;
  if (flip >= 0) t.flip = flip == 1;
  if (jumper.x >= 0.0) {
    t.jumper = jumper;
    t.hatInk = jumper;
  }
  t.thing = thing;
  return t;
}

// --- Things ----------------------------------------------------------------------------

// The things in the people's hands are laid in raw inks on a layer, its
// colour and how much of p it covers, and printed over the sky once,
// lifted, rather than each ink lifted on its own: lay() lays one where the
// distance d is below 0, its edge antialiased.
vec4 lay(vec4 ly, vec3 c, float d, float alpha) {
  float a = clamp(0.5 - d, 0.0, 1.0) * alpha;
  return vec4(mix(ly.a > 0.0 ? ly.rgb : c, c, a), max(ly.a, a));
}

// Things in front of the people: Viktor's things, what he holds (a cracker with ketchup over coffee, his
// guidebook at work, his can of Planters of an evening), his blanket and a
// Z rising asleep, his fountain, and his line of carts and the quarter they
// earn him.
vec4 props(vec4 ly, vec2 p, float u, float k, Gate g, Viktor v, int tool, bool isOpen, float n) {
  vec2 q = (p - vec2(g.left, g.top)) / u;
  float S = g.width / u;
  float c = g.cell;
  float bc = g.big;
  float time = mod(iTime, 3600.0);
  vec2 vq = p - v.feet;
  if (abs(vq.x) > 9.0 * u || abs(vq.y) > 7.0 * u) return ly;
  // One of Viktor's things at a time, as a shape, a mark on it and a
  // stroke, each chosen by what he is about, and three layers laid: what he
  // holds on his bench (a cracker with ketchup over coffee, his guidebook
  // at work, his can of Planters of an evening); his blanket asleep, and a
  // Z rising; his fountain at the front of his rug, its bowl on a stem and
  // its water arching into the basin; his line of carts, and the quarter
  // they earn him.
  int a = CLAWD_ACTIVITY;
  vec2 at = vec2(1.0e4);
  vec2 size = vec2(1.0);
  vec2 mk = vec2(1.0e4);
  vec2 mkSize = vec2(1.0);
  vec3 ink1 = KEY;
  vec3 ink2 = KEY;
  vec3 ink3 = KEY;
  float stroke = 1.0e4;
  float fade = 1.0;
  if (v.mode == V_BENCH && a >= 1 && a <= 3) {
    at = a == 1 ? vec2(-3.3, -1.6) * bc : a == 2 ? vec2(0.0, -1.3 * bc) : vec2(3.3, -1.5) * bc;
    size = a == 1 ? vec2(0.22 * u) : a == 2 ? vec2(1.0, 0.6) * bc : vec2(0.17, 0.25) * u;
    mk = vec2(0.0, -0.1 * size.y);
    mkSize = vec2(0.75, 0.22) * size;
    ink1 = a == 1 ? mix(INK_YELLOW, CREAM, 0.5) : INK_BLUE;
    ink2 = a == 1 ? RED_INK : INK_YELLOW;
  } else if (v.mode == V_SLEEP) {
    at = vec2(0.0, -0.9 * bc);
    size = vec2(3.4, 1.1) * bc;
    ink1 = fract(vq.x / (0.9 * bc)) > 0.82 ? mix(INK_VIOLET, INK_YELLOW, 0.7) : INK_VIOLET;
    float rise = fract(time / 3.0);
    vec2 zq = (vq - vec2(3.6 * bc + (0.3 + 0.6 * rise) * u, -3.2 * bc - rise * 1.5 * u)) / u;
    float h = 0.28 + 0.14 * rise;
    stroke = (abs(abs(zq.y) - h) < 0.09 && abs(zq.x) < h) || (abs(zq.x + zq.y) < 0.12 && abs(zq.y) < h) ? -1.0 : 1.0;
    ink3 = CREAM;
    fade = 1.0 - rise * rise;
  } else if (v.mode == V_FOUNTAIN) {
    vec2 fo = floor(vec2(g.left, g.top) + vec2(16.6, 5.3) * u) - v.feet;
    vec2 fq = (vq - fo) / (2.0 * u);
    at = fo - vec2(0.0, 0.7 * u);
    size = vec2(3.0, 0.7) * u;
    mk = vec2(0.0, -2.0 * u);
    mkSize = vec2(0.32, 1.2) * u;
    ink1 = mix(CREAM, INK_INDIGO, 0.2);
    ink2 = ink1;
    ink3 = mix(INK_BLUE, CREAM, 0.15);
    float s = clamp((abs(fq.x) - 0.55) / 0.8, 0.0, 1.0);
    stroke = (s > 0.0 && s < 1.0 ? abs(fq.y + 1.95 - 1.4 * s * s) - 0.14 : max(abs(fq.x) - 0.1, abs(fq.y + 2.1) - 0.25)) * 2.0 * u;
  } else if (v.mode == V_CARTS) {
    at = vec2(-3.5 * bc - 4.0 * u, -1.25 * u);
    size = vec2(4.0, 0.5) * u;
    mk = vec2(0.0, 0.75 * u);
    mkSize = vec2(4.0, 0.06) * u;
    ink1 = mix(STEEL, INK_INDIGO, 0.45);
    ink2 = ink1;
    ink3 = mix(INK_YELLOW, INK_ORANGE, 0.15);
    stroke = v.age > 32.0 ? length(vq - vec2(0.0, -5.6 * bc - 0.5 * u * fract(time))) - 0.3 * u : 1.0e4;
  }
  float shape = box(vq - at, size);
  // The carts are wire: their outline and a bar each, seen through.
  if (v.mode == V_CARTS) shape = min(abs(shape) - 0.05 * u, shape < 0.0 && abs(mod(vq.x - at.x, 0.55 * u) - 0.04 * u) < 0.06 * u ? -1.0 : 1.0e4);
  ly = lay(ly, ink1, shape, 1.0);
  ly = lay(ly, ink2, box(vq - at - mk, mkSize), 1.0);
  return lay(ly, ink3, stroke, fade);
}

// --- What the engine calls: the people ---------------------------------------------------

// Everyone, as one figure for the place p is in, then the things in front
// of them.
vec3 resident(vec3 sky, vec2 p, float u, float k) {
  Gate g = gateOf(u);
  if (p.x < g.left - 7.0 * u || p.y < g.top - 1.0 * u || (p.x < g.left && (p.y < g.floorY - 3.0 * u || p.y > g.floorY))) return sky;
  float n = night();
  int tool = sky_tool();
  bool isOpen = LOCAL_HOUR > 5.5 && LOCAL_HOUR < 22.0;
  Viktor v = viktorOf(g, u);
  sky = figure(sky, p, whoAt(p, u, g, v, tool, sky_agents(), n, isOpen, contextState()), k);
  vec4 ly = props(vec4(0.0), p, u, k, g, v, tool, isOpen, n);
  return mix(sky, lift(ly.rgb, k), ly.a);
}

// --- Events ------------------------------------------------------------------------------

// The theme's two events, both in front of the clouds and drawn as one
// airliner: the Concorde (0), a rare sight now, slender and white with her
// nose drooped, passing high from right to left, three passes in a showing
// so that every moment has her in the sky; and an A380 (1), the
// double-decker, coming in low from the left over the airfield, flaring,
// touching down on the far runway and rolling out, twice in a showing, well
// left of the plane at the gate, hazed a little and never lighter than the
// sky behind it. By night either is a dark shape with its lights.
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind) {
  if (isBehind || kind > 1) return sky;
  Gate g = gateOf(u);
  bool isConcorde = kind == 0;
  float s = isConcorde ? 0.55 * u : 0.7 * u;
  vec2 at;
  float lean = 0.0;
  if (isConcorde) {
    at = vec2(mix(g.left - 1.0 * u, 7.0 * u, fract(t * 3.0 + seeded(seed, 1))), iResolution.y * (0.16 + 0.12 * seeded(seed, 2)) + 0.2 * u * sin(t * 60.0));
  } else {
    float f = fract(t * 2.0 + 0.5 * seeded(seed, 3));
    float x0 = 0.03 * iResolution.x;
    float run = g.left - 21.0 * u - x0;
    float app = min(f, 0.6) / 0.6;
    float roll = max(f - 0.6, 0.0) / 0.4;
    at = vec2(x0 + run * (0.55 * app + 0.3 * (1.0 - (1.0 - roll) * (1.0 - roll))), g.floorY - 0.4 * u - 1.2 * s - (1.0 - app) * (1.0 - app) * 9.0 * u);
    lean = 0.06 * (1.0 - app) * (1.0 - app) - 0.07 * smoothstep(0.85, 1.0, app) * (1.0 - roll);
  }
  vec2 d = p - at;
  if (isConcorde) d.x = -d.x;
  if (abs(d.x) > 7.5 * s || abs(d.y) > 4.0 * s) return sky;
  vec2 q = vec2(d.x - lean * d.y, d.y + lean * d.x);
  if (isConcorde) q.y -= 0.2 * max(q.x - 3.0 * s, 0.0);
  vec3 parts = jetParts(q, s, isConcorde ? -0.9 : 2.0);
  float shape = min(min(parts.x, parts.y), parts.z);
  if (!isConcorde) shape = min(shape, box(q - vec2(-0.8 * s, 1.15 * s), vec2(0.5 * s, 0.25 * s)));
  bool isNight = night() > 0.5;
  vec3 c = isNight ? tone(INK_INDIGO, k) * 0.55 : mix(lift(parts.y < min(parts.x, parts.z) && !isConcorde ? INK_BLUE : q.y > 0.3 * s ? mix(CREAM, STEEL, 0.5) : mix(CREAM, INK_BLUE, 0.06), k), sky, isConcorde ? 0.0 : 0.2);
  if (!isConcorde && !isNight) c = sky_under(c, sky);
  sky = ink(sky, c, shape, 1.0);
  if (!isNight) return sky;
  sky = ink(sky, RED_INK, length(q - vec2(0.2 * s, -0.9 * s)) - 0.09 * u, step(0.5, fract(iTime)));
  return mix(sky, WARM_WHITE, screen(p, 0.55 * exp(-length(q - vec2(4.6 * s, 0.3 * s)) / (0.35 * u)), pitch(u), 15.0));
}
