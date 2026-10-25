// The sky shader's GLSL, part of hooks/shader.ts's BODY: the wastebasket in
// the bottom right corner.
export const BASKET = `
// --- The wastebasket -------------------------------------------------------

// A crumpled ball of paper: a disc with a crease, screened darker away from
// the light, its key plate off register; \`burnt\` blackens it.
vec3 paperBall(vec3 sky, vec2 p, vec2 at, float r, int seed, float k, float burnt) {
  vec2 v = p - at;
  float d = length(v) - r;
  if (d > 3.0) return sky;
  vec3 paper = mix(lift(vec3(0.97, 0.95, 0.9), k), vec3(0.18, 0.1, 0.1), burnt);
  float pitch = max(3.0, r * 0.35);
  vec3 c = mix(paper, mix(paper, INK_INDIGO, 0.35), screen(p, clamp(0.2 + dot(v / r, vec2(0.5, 0.6)) * 0.5, 0.0, 1.0), pitch, 45.0));
  float a = float(seed) * 2.4;
  float crease = abs(dot(v, vec2(cos(a), sin(a)))) - 0.04 * r;
  c = mix(c, mix(c, INK_INDIGO, 0.45), smoothstep(1.0, 0.0, crease) * step(length(v), r * 0.8));
  sky = ink(sky, c, d, 1.0);
  return ink(sky, lift(INK_INDIGO, k), abs(length(v - vec2(0.12, 0.1) * r) - r) - 0.5, 0.6);
}

// A tongue of fire rising from \`foot\`, \`h\` tall and \`w\` wide at its base,
// flickering; how much it covers \`p\`.
float flame(vec2 p, vec2 foot, float h, float w, float phase) {
  float f = (foot.y - p.y) / h;
  if (f < 0.0 || f > 1.0) return 0.0;
  float sway = sin(f * 3.0 + iTime * 6.0 + phase) * 0.18 * w * f;
  float width = w * pow(1.0 - f, 0.7) * smoothstep(0.0, 0.12, f);
  return smoothstep(width, width * 0.6, abs(p.x - foot.x - sway));
}

// The wastebasket in the bottom right corner, wire mesh over a dark inside:
// the context window's paper in balls inside it, the last over the rim.
// While the conversation compacts it burns, the balls blackening, flames
// in three inks and smoke rising; embers and smoke just after.
const vec2 BALL_AT[10] = vec2[10](vec2(-0.45, -0.45), vec2(0.45, -0.45), vec2(-0.5, -1.15), vec2(0.05, -1.1), vec2(0.55, -1.15),
  vec2(-0.55, -1.85), vec2(0.05, -1.8), vec2(0.6, -1.85), vec2(-0.3, -2.55), vec2(0.4, -2.6));
vec3 basket(vec3 sky, vec2 p, float u, float k) {
  if (BASKET == 0) return sky;
  // This tab's own, from its mark (tabMark).
  int balls = int(iPalette[16].g * 255.0 + 0.5);
  int fire = int(iPalette[16].r * 255.0 + 0.5);
  float pitch = max(3.0, u * 0.24);
  // Its own unit, a little smaller than the sky's.
  u *= 0.85;
  float hgt = 2.6 * u;
  vec2 base = vec2(iResolution.x - 2.2 * u, iResolution.y - 0.35 * u);
  vec2 v = p - base;
  if (abs(v.x) > 3.0 * u || v.y > 0.5 * u || v.y < -hgt - 6.0 * u) return sky;
  float rise = clamp(-v.y / hgt, 0.0, 1.0);
  float halfWidth = mix(0.85, 1.15, rise) * u;
  bool isInside = v.y <= 0.0 && v.y >= -hgt && abs(v.x) <= halfWidth;
  bool isBurning = fire == 1;
  float burnt = isBurning ? 0.55 + 0.25 * sin(iTime * 2.0) : 0.0;

  // Smoke, behind it all.
  if (fire != 0) {
    for (int j = 0; j < 4; j++) {
      float age = fract(iTime * 0.22 + float(j) * 0.25);
      vec2 at = base + vec2(sin(float(j) * 2.1 + iTime * 0.5) * 0.5 * u, -hgt - 0.8 * u - age * 4.5 * u);
      float puff = smoothstep(1.0, 0.4, length(p - at) / ((0.35 + 0.7 * age) * u)) * (1.0 - age) * (isBurning ? 0.6 : 0.4);
      sky = mix(sky, lift(vec3(0.62, 0.62, 0.68), k), screen(p, puff, pitch, 45.0) * 0.8);
    }
  }
  if (isInside) sky = mix(sky, tone(INK_INDIGO, k) * 0.55, 0.85);
  for (int i = 0; i < 8; i++) {
    if (i >= balls) break;
    sky = paperBall(sky, p, base + BALL_AT[i] * u, 0.42 * u, i + 3, k, burnt);
  }
  // The mesh, the sides, the rim and the base, in steel.
  vec3 steel = lift(mix(vec3(0.78, 0.8, 0.88), INK_BLUE, 0.2), k);
  if (isInside) {
    float a = abs(fract((v.x + v.y) / (0.42 * u)) - 0.5) * 0.42 * u;
    float b = abs(fract((v.x - v.y) / (0.42 * u)) - 0.5) * 0.42 * u;
    sky = ink(sky, steel, min(a, b) - 0.04 * u, 0.8);
  }
  if (v.y <= 0.0 && v.y >= -hgt) sky = ink(sky, steel, abs(abs(v.x) - halfWidth) - 0.06 * u, 1.0);
  if (abs(v.x) <= 1.25 * u) sky = ink(sky, steel, abs(v.y + hgt) - 0.11 * u, 1.0);
  if (abs(v.x) <= 0.85 * u) sky = ink(sky, steel, abs(v.y) - 0.09 * u, 1.0);
  // The key plate, a little off register.
  vec2 w = v - vec2(0.12, 0.1) * u;
  float wr = clamp(-w.y / hgt, 0.0, 1.0);
  if (w.y <= 0.0 && w.y >= -hgt) sky = ink(sky, lift(INK_INDIGO, k), abs(abs(w.x) - mix(0.85, 1.15, wr) * u) - 0.04 * u, 0.5);
  for (int i = 8; i < 10; i++) {
    if (i >= balls) break;
    sky = paperBall(sky, p, base + BALL_AT[i] * u, 0.42 * u, i + 3, k, burnt);
  }

  // The fire: pink, orange and yellow tongues, each smaller than the last.
  if (isBurning) {
    vec3 inks[3] = vec3[3](INK_PINK, INK_ORANGE, INK_YELLOW);
    float angles[3] = float[3](75.0, 45.0, 0.0);
    for (int layer = 0; layer < 3; layer++) {
      float scale = 1.0 - float(layer) * 0.28;
      float cover = 0.0;
      for (int i = 0; i < 3; i++) {
        float x = (-0.6 + 0.6 * float(i)) * u;
        float h = (1.4 + 0.9 * (0.5 + 0.5 * sin(iTime * (2.3 + float(i) * 0.7) + float(i) * 1.9))) * u * scale;
        cover = max(cover, flame(p, base + vec2(x, -hgt + 0.6 * u), h, 0.55 * u * scale, float(i * 3 + layer)));
      }
      sky = mix(sky, inks[layer], screen(p, cover * 0.95, pitch, angles[layer]));
    }
  }
  // Embers in the bottom of an emptied bin.
  if (fire == 2 && isInside && v.y > -0.6 * u) {
    float glow = step(0.82, rand(int(floor(p.x / pitch)) * 31 + int(floor(p.y / pitch)) * 17 + int(floor(iTime * 4.0))));
    sky = mix(sky, INK_ORANGE, glow * 0.9);
  }
  return sky;
}
`
