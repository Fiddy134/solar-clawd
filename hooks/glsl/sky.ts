// The sky shader's GLSL, part of hooks/shader.ts's BODY: the sky itself: its
// gradient, the aurora, the stars and their charts, the moon and the sun.
export const SKY = `
// --- The gradient ----------------------------------------------------------

void stops(float e, out vec3 top, out vec3 middle, out vec3 horizon) {
  int i = 1;
  for (int k = 1; k < 10; k++) if (e > STOP_AT[k]) i = k + 1;
  float t = clamp((e - STOP_AT[i - 1]) / (STOP_AT[i] - STOP_AT[i - 1]), 0.0, 1.0);
  top = mix(STOP_TOP[i - 1], STOP_TOP[i], t);
  middle = mix(STOP_MIDDLE[i - 1], STOP_MIDDLE[i], t);
  horizon = mix(STOP_HORIZON[i - 1], STOP_HORIZON[i], t);
}

// The gradient at \`p\`, and in \`k\` how far the whole sky is dimmed so its
// brightest point stays at LUMINANCE.
vec3 gradient(vec2 p, Scene s, out float k) {
  vec3 top, middle, horizon;
  stops(s.elevation, top, middle, horizon);
  bool isEvening = s.isDay > 0.5 ? s.progress > 0.5 : s.progress < 0.5;
  // Sunsets run pinker than sunrises, through dusk and no further.
  if (isEvening && s.elevation < 12.0) {
    float pink = 0.22 * clamp((12.0 - s.elevation) / 18.0, 0.0, 1.0) * smoothstep(-14.0, -4.0, s.elevation);
    middle = mix(middle, vec3(1.0, 0.435, 0.569), pink);
    horizon = mix(horizon, vec3(1.0, 0.435, 0.569), pink * 0.8);
  }
  // The glow sits where the sun is, or at the foot it set behind or will rise from.
  float glowAt = s.isDay > 0.5 ? s.progress : isEvening ? 1.0 : 0.0;
  float glowX = ARC.x + (ARC.y - ARC.x) * glowAt;
  float glow = clamp(1.0 - abs(s.elevation - 1.0) / 11.0, 0.0, 1.0) * (1.0 - CLOUDINESS);
  vec3 glowColor = isEvening ? vec3(1.0, 0.478, 0.361) : vec3(1.0, 0.702, 0.478);

  vec3 hottest = mix(horizon, glowColor, glow * 0.55);
  float brightest = max(max(luminance(top), luminance(middle)), luminance(hottest));
  k = min(1.0, LUMINANCE / max(brightest, 0.001));

  float v = p.y / iResolution.y;
  vec3 base = v < 0.55 ? mix(top, middle, v / 0.55) : mix(middle, horizon, (v - 0.55) / 0.45);
  float dx = p.x / iResolution.x - glowX;
  vec3 c = mix(base, glowColor, glow * v * v * exp(-dx * dx * 6.0) * 0.55);
  return mix(c, grey(c), CLOUDINESS);
}

// --- Aurora ----------------------------------------------------------------

vec3 aurora(vec3 sky, vec2 p, float strength) {
  float u = p.x / iResolution.x;
  float h = iResolution.y;
  float t = iTime;
  float base = h * (0.22 + 0.16 * noise(u * 4.0 + t * 0.02, 1));
  float tall = h * (0.12 + 0.22 * noise(u * 9.0 - t * 0.04, 2));
  float reach = tall * 0.25;
  if (p.y < base - tall || p.y > base + reach) return sky;
  float ray = 0.25 + 0.75 * pow(noise(u * 40.0 + t * 0.15, 3), 3.0);
  float fold = smoothstep(0.25, 0.75, noise(u * 3.5 - t * 0.03, 4));
  float rel = (base - p.y) / tall;
  float a = rel >= 0.0 ? exp(-rel * 2.4) : exp(rel * tall / (reach * 0.3)) * 0.6;
  vec3 color = mix(vec3(0.239, 1.0, 0.627), vec3(0.659, 0.42, 1.0), clamp(rel * 1.4, 0.0, 1.0));
  return mix(sky, color, clamp(strength * ray * fold * a * 0.75, 0.0, 1.0));
}

// --- Stars -----------------------------------------------------------------

// One star in some cells of a grid, kept away from the cell's edges so its
// glints stay inside; bright ones are rarer and glint.
vec3 stars(vec3 sky, vec2 p, float strength, float size) {
  float cell = 37.0;
  vec2 c = floor(p / cell);
  int n = int(c.x) * 7919 + int(c.y) * 104729;
  // Sparse: the real stars carry the sky, these only fill it.
  if (rand(n) > 0.35) return sky;
  float margin = size * 3.0 + 1.0;
  vec2 at = c * cell + margin + vec2(rand(n + 1), rand(n + 2)) * (cell - margin * 2.0);
  vec2 d = abs(p - at);
  if (d.x > margin || d.y > margin) return sky;
  uint kind = hashi(n + 3) % 20u;
  vec3 tint = kind == 0u ? vec3(1.0, 0.824, 0.659) : kind == 1u ? vec3(0.722, 0.8, 1.0) : vec3(1.0, 0.973, 0.925);
  float twinkle = 0.75 + 0.25 * sin(iTime * (1.5 + float(hashi(n + 4) % 7u) * 0.4) + float(hashi(n + 6) % 100u));
  // Faint fill: the bright stars are the real ones (realStars).
  float bright = (kind < 3u ? 0.48 : 0.35 + float(hashi(n + 5) % 5u) * 0.1) * twinkle;
  // Fainter near the horizon, where the air is thick.
  float near = glance(at);
  float a = strength * bright * (1.0 - smoothstep(0.45, 0.8, at.y / iResolution.y)) * (1.0 + 1.5 * near);
  float disc = (d.x < size * (0.5 + near) + 0.5 && d.y < size * (0.5 + near) + 0.5) ? 1.0 : 0.0;
  float glint = kind < 3u && size > 1.0 && min(d.x, d.y) < 0.5 ? 0.35 * (1.0 - max(d.x, d.y) / (size * 2.0 + 1.0)) : 0.0;
  return mix(sky, tint, clamp(a * max(disc, glint), 0.0, 1.0));
}

// The dome point under a pixel, and the chart tile it falls in (-1 outside).
vec2 pixelToDome(vec2 p) { return vec2((p.x - iResolution.x * 0.5) / iResolution.y, p.y / iResolution.y); }
int chartTile(int column, int row) {
  if (column < 0 || column >= 80 || row < 0 || row >= 16) return -1;
  return row * 80 + column;
}

// The real stars near \`p\`: as bright as their magnitude, tinted by their
// colour index, the brightest with a soft glint.
vec3 realStars(vec3 sky, vec2 p, float strength, float size) {
  vec2 d = pixelToDome(p);
  int column = int(floor((d.x + 1.6) / 0.04));
  int row = int(floor(d.y / 0.04));
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      int tile = chartTile(column + dx, row + dy);
      if (tile < 0) continue;
      int first = TILE_START[tile];
      for (int k = first; k < first + TILE_COUNT[tile]; k++) {
        int i = TILE_STAR[k];
        vec2 at = domeToPixel(STAR_AT[i]);
        float mag = STAR_LOOK[i].x;
        // Far from it, past the largest its glint could make it: nothing.
        float dist = length(p - at);
        float plain = size * (0.9 + max(0.0, 3.5 - mag) * 0.6);
        if (dist > plain * 6.8) continue;
        float bv = STAR_LOOK[i].y;
        float glint = glance(at);
        float r = plain * (1.0 + 0.7 * glint);
        if (dist > r * 4.0) continue;
        vec3 tint = bv < 0.2 ? vec3(0.78, 0.86, 1.0) : bv > 1.2 ? vec3(1.0, 0.8, 0.62) : vec3(1.0, 0.97, 0.92);
        float twinkle = 0.85 + 0.15 * sin(iTime * (1.1 + mod(float(i), 7.0) * 0.3) + float(i));
        float bright = clamp((4.5 - mag) / 3.5, 0.3, 1.0) * twinkle;
        float core = clamp(r - dist + 0.5, 0.0, 1.0);
        float halo = max(mag < 2.0 ? 0.45 * exp(-dist / (r * 0.8)) : 0.0, 0.7 * glint * exp(-dist / (r * 1.4)));
        float a = strength * bright * (1.0 - smoothstep(0.5, 0.85, at.y / iResolution.y)) * (1.0 + 1.5 * glint);
        sky = mix(sky, tint, clamp(a * max(core, halo), 0.0, 1.0));
      }
    }
  }
  return sky;
}

// The constellations' lines near \`p\`: dashed and faint, as star charts draw them.
vec3 chartLines(vec3 sky, vec2 p, float u, float strength) {
  vec2 d = pixelToDome(p);
  int tile = chartTile(int(floor((d.x + 1.6) / 0.04)), int(floor(d.y / 0.04)));
  if (tile < 0) return sky;
  float line = 1e9;
  vec2 along = vec2(0.0);
  int first = LINE_TILE_START[tile];
  for (int k = first; k < first + LINE_TILE_COUNT[tile]; k++) {
    int i = LINE_TILE_LINE[k];
    vec2 a = domeToPixel(LINE_A[i]);
    vec2 b = domeToPixel(LINE_B[i]);
    float dist = segment(p, a, b);
    if (dist < line) { line = dist; along = a; }
  }
  if (line > 2.0) return sky;
  float dash = step(0.5, fract(length(p - along) / (0.5 * u)));
  return mix(sky, mix(INK_BLUE, vec3(1.0), 0.5), clamp(0.5 - (line - 0.05 * u), 0.0, 1.0) * 0.15 * dash * strength);
}

// --- The moon ----------------------------------------------------------------

// Its seas, in the disc's own units (y down): darker, a little blue.
float seas(vec2 q) {
  float s = 0.0;
  s = max(s, smoothstep(0.32, 0.18, length((q - vec2(-0.32, -0.42)) * vec2(1.0, 1.2))));  // Imbrium
  s = max(s, smoothstep(0.2, 0.1, length(q - vec2(0.14, -0.36))));                          // Serenitatis
  s = max(s, smoothstep(0.24, 0.12, length((q - vec2(0.3, -0.06)) * vec2(1.0, 1.3))));     // Tranquillitatis
  s = max(s, smoothstep(0.13, 0.06, length(q - vec2(0.64, -0.3))));                         // Crisium
  s = max(s, smoothstep(0.42, 0.2, length((q - vec2(-0.58, 0.02)) * vec2(1.4, 0.8))));     // Procellarum
  s = max(s, smoothstep(0.2, 0.08, length(q - vec2(-0.16, 0.42))));                         // Nubium
  s = max(s, smoothstep(0.16, 0.07, length(q - vec2(0.5, 0.16))));                          // Fecunditatis
  return s;
}

vec3 moonAt(vec3 sky, vec2 p, vec2 at, float radius, float strength) {
  if (MOON_ILLUMINATION < 0.02 || strength <= 0.0) return sky;
  vec2 d = p - at;
  float r = length(d) / radius;
  if (r > 3.2) return sky;
  vec3 plain = vec3(0.957, 0.937, 0.863);
  // The halo lies under the disc too, so its edge meets light, not sky.
  sky = mix(sky, plain, 0.16 * exp(-max(0.0, r - 1.0) * 1.6) * MOON_ILLUMINATION * strength);
  if (r > 1.02) return sky;
  vec2 q = d / radius;
  float soft = 1.5 / radius;
  float edge = sqrt(max(0.0, 1.0 - q.y * q.y));
  float terminator = edge * (1.0 - 2.0 * MOON_ILLUMINATION);
  float side = MOON_WAXING > 0.5 ? q.x - terminator : -q.x - terminator;
  float lit = smoothstep(-soft, soft, side);
  // Seas, a speckle of craters, a bright Tycho and a darker limb.
  float speckle = noise(q.x * 23.0 + q.y * 7.0, 5) * noise(q.y * 19.0 - q.x * 5.0, 6);
  vec3 surface = mix(plain, vec3(0.69, 0.68, 0.66), seas(q) * 0.75);
  surface *= 0.92 + 0.12 * speckle;
  surface = mix(surface, vec3(1.0), smoothstep(0.07, 0.0, length(q - vec2(-0.1, 0.74))) * 0.5);
  surface *= 1.0 - 0.18 * pow(r, 4.0);
  float alpha = smoothstep(1.0, 1.0 - soft, r);
  return mix(sky, mix(mix(sky, surface, 0.07), surface, lit), alpha * strength);
}

// --- The sun, printed -----------------------------------------------------

// A solid yellow disc (orange as it sinks), the pink plate a little off
// register, a glow of dots that thin out. Half dimmed: a dull sun looks
// like a mistake.
vec3 sunAt(vec3 sky, vec2 p, vec2 at, float radius, float strength, float pitch, float k, float elevation) {
  if (strength <= 0.0) return sky;
  vec2 d = p - at;
  float dist = length(d);
  float reach = radius * 3.4;
  if (dist > reach) return sky;
  float low = 1.0 - smoothstep(2.0, 22.0, elevation);
  vec3 discInk = mix(INK_YELLOW, INK_ORANGE, low * 0.8);
  vec3 overInk = mix(INK_ORANGE, INK_PINK, low);
  vec3 disc = mix(vivid(discInk * k, SATURATION), discInk, 0.5);
  vec3 over = mix(vivid(overInk * k, SATURATION), overInk, 0.5);
  if (dist > radius) {
    float density = 0.55 * exp(-(dist - radius) / (radius * 0.75)) * smoothstep(reach, reach * 0.6, dist);
    sky = mix(sky, disc, screen(p, density, pitch, 0.0) * strength * 0.8);
  }
  float cover = smoothstep(radius + 0.8, radius - 0.8, dist);
  if (cover > 0.0) {
    float starved = hashi(int(p.x) * 7919 + int(p.y) * 131) % 61u == 0u ? 0.55 : 1.0;
    sky = mix(sky, disc, cover * strength * starved);
  }
  vec2 o = d - radius * vec2(0.09, 0.07);
  float plate = smoothstep(radius * 0.92 + 0.8, radius * 0.92 - 0.8, length(o));
  if (plate > 0.0) {
    float density = 0.25 + 0.45 * clamp((o.x + o.y) / (radius * 1.6) + 0.5, 0.0, 1.0);
    sky = mix(sky, over, plate * screen(p, density, pitch, 75.0) * strength * 0.85);
  }
  return sky;
}
`
