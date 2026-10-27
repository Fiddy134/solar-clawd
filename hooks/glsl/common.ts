// The sky shader's GLSL, part of hooks/shader.ts's BODY: the constants every
// part shares, numbers, where things are on the window, and drawing in inks.
export const COMMON = `
const float PI = 3.14159265;
// The arc the sun and the moon cross, as fractions of the window.
const vec4 ARC = vec4(0.56, 0.95, 0.12, 0.62); // left, right, top, foot
// The brightest the sky gets, so the terminal's light text stays readable.
const float LUMINANCE = 0.8;
const float SATURATION = 1.35;

// --- Numbers -------------------------------------------------------------

uint hashu(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
uint hashi(int n) { return hashu(uint(n)); }
float rand(int n) { return float(hashi(n) >> 8u) / 16777216.0; }

// Smooth 1D value noise in [0, 1].
float noise(float x, int seed) {
  float i = floor(x);
  float a = rand(int(i) * 374761 + seed * 668265);
  float b = rand((int(i) + 1) * 374761 + seed * 668265);
  return mix(a, b, smoothstep(0.0, 1.0, x - i));
}

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 grey(vec3 c) { return vec3(luminance(c)); }
// Pushes a colour away from its grey (k > 1).
vec3 vivid(vec3 c, float k) { float g = luminance(c); return clamp(g + (c - g) * k, 0.0, 1.0); }

// How much of (x, y) a risograph halftone dot covers: dots on a lattice
// \`pitch\` apart at \`angle\` degrees, as large as \`tone\` asks.
float screen(vec2 at, float tone, float pitch, float angle) {
  if (tone <= 0.01) return 0.0;
  if (tone >= 0.99) return 1.0;
  float a = radians(angle);
  vec2 uv = vec2(at.x * cos(a) + at.y * sin(a), -at.x * sin(a) + at.y * cos(a)) / pitch;
  float d = length(uv - floor(uv + 0.5)) * pitch;
  float r = pitch * sqrt(tone / PI) * 1.1;
  return clamp(r - d + 0.5, 0.0, 1.0);
}

// --- Where things are ----------------------------------------------------

struct Scene { float elevation; float progress; float isDay; };

// The scene now; in a demo, the day played round with iTime.
Scene sceneNow() {
  if (DEMO_COUNT == 0) return Scene(ELEVATION, PROGRESS, IS_DAY);
  float at = fract(iTime / DEMO_SECONDS) * float(DEMO_COUNT);
  int i = int(floor(at)) % DEMO_COUNT;
  int j = (i + 1) % DEMO_COUNT;
  float t = fract(at);
  float elevation = mix(DEMO_ELEVATION[i], DEMO_ELEVATION[j], t);
  // Across sunrise and sunset the arc starts over: no blending there.
  float progress = DEMO_DAY[i] == DEMO_DAY[j] ? mix(DEMO_PROGRESS[i], DEMO_PROGRESS[j], t) : DEMO_PROGRESS[i];
  return Scene(elevation, progress, DEMO_DAY[i]);
}

// A point of the dome (hooks/dome.ts), in window heights from the top
// centre, as a pixel.
vec2 domeToPixel(vec2 d) { return vec2(iResolution.x * 0.5 + d.x * iResolution.y, d.y * iResolution.y); }

// The terminal's cursor. Ghostty gives its bottom-left corner (y down, as
// fragCoord; probed 2026-10-25) and its size in zw.
// With y up (OpenGL) the corner is the top-left one, so the same centre is
// flipped as fragCoord is.
vec2 cursorAt() {
  vec2 c = vec2(iCurrentCursor.x + iCurrentCursor.z * 0.5, iCurrentCursor.y - iCurrentCursor.w * 0.5);
  return Y_UP > 0.5 ? vec2(c.x, iResolution.y - c.y) : c;
}

// How much a star at \`at\` glints for the cursor: near it, just after it
// moved, fading within a second.
float glance(vec2 at) {
  if (iCurrentCursor.z <= 0.0) return 0.0;
  float u = max(4.0, floor(iResolution.y / 60.0 + 0.5));
  float fresh = exp(-max(0.0, iTime - iTimeCursorChange) * 2.5);
  return fresh * smoothstep(6.0 * u, 0.0, length(at - cursorAt()));
}

// A thing at \`at\`, nudged out of the cursor's way.
vec2 shy(vec2 at, float u) {
  if (iCurrentCursor.z <= 0.0) return at;
  vec2 away = at - cursorAt();
  float d = length(away);
  if (d > 8.0 * u || d < 0.001) return at;
  return at + away / d * 3.0 * u * (1.0 - d / (8.0 * u));
}

vec2 arcPoint(float progress) {
  float p = clamp(progress, 0.0, 1.0);
  return iResolution.xy * vec2(ARC.x + (ARC.y - ARC.x) * p, ARC.w - (ARC.w - ARC.z) * sin(p * PI));
}

float nightness(float elevation) { return smoothstep(-5.0, -13.0, elevation); }

// --- Drawing -------------------------------------------------------------

// The paper under the inks.
const vec3 CREAM = vec3(0.9608, 0.9373, 0.8784);

vec3 tone(vec3 c, float k) { return vivid(c * k, SATURATION); }

// An ink laid down by distance: solid inside, antialiased at the edge.
vec3 ink(vec3 sky, vec3 color, float d, float alpha) {
  return mix(sky, color, clamp(0.5 - d, 0.0, 1.0) * alpha);
}

// Half dimmed, as the sun is: small things stay visible on a dimmed sky.
vec3 lift(vec3 c, float k) { return mix(tone(c, k), c, 0.5); }

// A random number for an event's seed and a salt.
float seeded(float seed, int salt) { return rand(int(seed) * 7919 + salt * 104729 + 3); }

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * h);
}

// A capsule from a to b whose radius runs from ra to rb.
float limb(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * h) - mix(ra, rb, h);
}

// Two shapes' union, rounded where they meet, as a cartoon's are.
float smin(float a, float b, float r) {
  float h = max(r - abs(a - b), 0.0) / r;
  return min(a, b) - h * h * r * 0.25;
}

// How much of its width a thing tumbling on the air shows as it turns
// over, for \`turn\` running from -1 to 1: all of it at either end, never
// less than \`least\` of it edge-on in the middle, and signed as turn is,
// for below 0 its back is toward you.
float widthShown(float turn, float least) { return (turn < 0.0 ? -1.0 : 1.0) * mix(least, 1.0, abs(turn)); }

// A thing spun by \`spin\` and turned over to show \`flip\` of its width, as
// widthShown gives it: q in the thing's own frame, x along it and y
// across, the across axis stretched as it goes edge-on and mirrored while
// its back is up. A distance measured across it in that frame is up to
// 1 / abs(flip) times the real one, so a shape's goes back through
// abs(flip) before it is inked, or its edges would sharpen and its outline
// thin as it turns. Along it the distance was right and comes out short,
// so near edge-on the tips soften and their outline thickens a little.
vec2 tumble(vec2 q, float spin, float flip) {
  q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * q;
  return vec2(q.x, q.y / flip);
}
`
