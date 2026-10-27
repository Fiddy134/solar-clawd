// The sky shader's GLSL, part of hooks/shader.ts's BODY: clouds (and now and
// then a saucer), and rain and snow.
export const CLOUDS = `
// --- Clouds ----------------------------------------------------------------

uint shapeRow(int kind, int row) {
  if (kind == 1) return row < 5 ? CLAWD[row] : 0u;
  if (kind == 2) return row < 6 ? HEART[row] : 0u;
  if (kind == 3) return row < 5 ? WHALE[row] : 0u;
  return row < 6 ? RABBIT[row] : 0u;
}

// Clouds drift west to east and come back as new ones, lit from the sky
// behind them; printed, the lit tops take pink (violet by night, orange at
// sunset) and the undersides blue, two plates a little off register.
// kind: 0 cumulus, 1–4 a shape, 5 golden, 6 a ufo.
vec3 clouds(vec3 sky, vec2 p, Scene s, float unit, float k) {
  float w = iResolution.x;
  float h = iResolution.y;
  int count = int(floor(5.0 + COVER * 4.0 + 0.5));
  float baseSize = unit * 3.2;
  float dots = pitch(unit);
  float speed = (w / 1400.0) * (1.0 + WIND / 5.0);
  // Clouds keep to the upper half: below the lowest a cloud could reach,
  // none of them is worth asking about.
  if (p.y > h * 0.5 + baseSize * 1.3 * 3.0) return sky;
  float opacity = 0.55 + COVER * 0.3;
  float day = smoothstep(-8.0, 6.0, s.elevation);
  float golden = clamp(1.0 - abs(s.elevation - 2.0) / 9.0, 0.0, 1.0);
  vec3 topInk = tone(mix(mix(INK_VIOLET, INK_PINK, day), INK_ORANGE, golden * 0.6), k);
  vec3 underInk = tone(mix(INK_INDIGO, INK_BLUE, day), k);
  float inkStrength = 0.45 + 0.35 * day;
  vec2 shift = vec2(dots * 0.45, dots * 0.3);

  float margin = baseSize * 6.0;
  float span = w + margin * 2.0;

  // Each cloud is placed before it is chosen: where it is, then how large,
  // and only a pixel that could be under it asks what it is.
  for (int slot = 0; slot < 9; slot++) {
    if (slot >= count) break;
    float travelled = rand(slot * 977 + 5) * span + iTime * speed * (0.6 + rand(slot * 31 + 2) * 0.8);
    float x = mod(travelled, span) - margin;
    // Quick out before the cloud has a seed: sideways of the widest any
    // cloud gets (1.3 base sizes, with room to spare).
    if (p.x - x < -baseSize * 2.8 || p.x - x > baseSize * 9.8) continue;
    int lap = int(floor(travelled / span));
    int seed = int(hashi(slot * 7919 + lap * 104729 + 11) >> 1u);
    float size = baseSize * (0.7 + rand(seed + 9) * 0.6);
    vec2 o = vec2(x, floor(h * (0.06 + 0.44 * rand(seed + 1))));
    vec2 q = p - o;
    // Quick out: outside the widest a cloud of this size gets. A saucer
    // keeps well inside it (its px is size / 6, size never under 8.96).
    if (q.x < -size * 2.0 || q.x > size * 7.0 || q.y < -size * 2.0 || q.y > size * 3.0) continue;
    int kind = 0;
    if (rand(seed + 3) < 0.08) kind = 1 + int(hashi(seed) % 6u);

    if (kind == 6) {
      // Now and then not a cloud at all: a saucer, printed as the balloon
      // is, rocking a little, its lights running round its rim.
      float px = max(1.0, size / 6.0);
      vec2 v = q - vec2(3.5, 2.3) * px;
      if (abs(v.x) > 5.0 * px || abs(v.y) > 4.0 * px) continue;
      float tilt = sin(iTime * 1.3 + float(seed % 97)) * 0.08;
      v = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * v;
      v.y += sin(iTime * 1.7 + float(seed % 89)) * 0.25 * px;
      float hull = (length(v / vec2(3.6, 0.95)) - px) * 0.95;
      float dome = v.y < -0.3 * px ? length(v - vec2(0.0, -0.55 * px)) - 1.55 * px : 1e9;
      vec3 steel = mix(vec3(0.82, 0.84, 0.9), INK_BLUE, 0.15);
      vec3 body = mix(steel, mix(steel, INK_INDIGO, 0.45), screen(p, clamp(0.15 + v.y / px * 0.45, 0.0, 1.0), dots, 45.0));
      vec3 glass = mix(mix(INK_BLUE, vec3(1.0), 0.35), vec3(1.0), screen(p, clamp(0.5 - (v.x + v.y) / px * 0.3, 0.0, 1.0), dots, 15.0) * 0.6);
      sky = ink(sky, lift(glass, k), dome, 1.0);
      sky = ink(sky, lift(body, k), hull, 1.0);
      for (int j = 0; j < 5; j++) {
        bool isLit = int(floor(iTime * 3.0)) % 5 == j;
        sky = ink(sky, isLit ? INK_YELLOW : lift(INK_PINK, k), length(v - vec2(float(j - 2) * 1.25 * px, 0.25 * px)) - 0.3 * px, 1.0);
      }
      // The key plate, a little off register.
      vec2 w = v - keyShift(px);
      float key = min(abs((length(w / vec2(3.6, 0.95)) - px) * 0.95), w.y < -0.3 * px ? abs(length(w - vec2(0.0, -0.55 * px)) - 1.55 * px) : 1e9);
      sky = ink(sky, keyInk(k), key - 0.06 * px, 0.6);
      continue;
    }

    float cover = 0.0;
    float minY = 1e9;
    float maxY = -1e9;
    float bottom = 0.0;
    if (kind == 0 || kind == 5) {
      // A cumulus: a row of puffs, the middle ones tallest, flat below.
      int puffs = 3 + int(uint(seed) % 4u);
      for (int i = 0; i < 6; i++) {
        if (i >= puffs) break;
        float middle = 1.0 - abs(float(i) / float(puffs - 1) - 0.5) * 1.2;
        float r = size * (0.35 + 0.35 * middle) * (0.8 + rand(seed + i) * 0.4);
        vec2 c = vec2(float(i) * size * 0.55, -r * 0.45);
        minY = min(minY, c.y - r * 1.6);
        maxY = max(maxY, c.y + r * 1.6);
        cover = max(cover, smoothstep(r, r - max(1.0, r * 0.35), length(q - c)));
      }
      bottom = maxY - (maxY - minY) * 0.35;
    } else {
      // A shape: puffs melted together, the cloud where r² / d² sums past 1.
      float cell = size * 0.42;
      float r = cell * 0.62;
      float sum = 0.0;
      for (int row = 0; row < 6; row++) {
        uint bits = shapeRow(kind, row);
        if (bits == 0u) continue;
        minY = min(minY, float(row) * cell - r * 1.6);
        maxY = max(maxY, float(row) * cell + r * 1.6);
        for (int col = 0; col < 14; col++) {
          if ((bits & (1u << uint(col))) == 0u) continue;
          vec2 d = q - vec2(float(col), float(row)) * cell;
          sum += r * r / (dot(d, d) + 0.5);
        }
      }
      cover = smoothstep(0.85, 1.6, sum);
      bottom = maxY;
    }
    if (cover <= 0.0 || q.y > bottom) continue;

    vec3 behind = sky;
    float lower = clamp((q.y - minY) / max(1.0, bottom - minY), 0.0, 1.0);
    vec3 lit = mix(mix(behind, tone(vec3(0.604, 0.639, 0.769), k), 0.22), mix(behind, tone(vec3(1.0), k), 0.6), day);
    vec3 shade = mix(lit, tone(vec3(1.0, 0.478, 0.541), k), golden * 0.55);
    vec3 color = mix(lit, mix(shade, grey(behind), 0.25), lower);
    if (kind == 5) color = mix(color, tone(vec3(1.0, 0.827, 0.42), k), 0.55 * (1.0 - lower * 0.5));

    // Printed: a pale body, then the two plates in halftone.
    sky = mix(sky, color, clamp(cover * opacity * 0.55, 0.0, 1.0));
    float topDots = screen(p, cover * (1.0 - lower) * 0.65, dots, 75.0);
    sky = mix(sky, topInk, clamp(topDots * inkStrength * opacity, 0.0, 1.0));
    float underDots = screen(p - shift, cover * lower * 0.6, dots, 15.0);
    sky = mix(sky, underInk, clamp(underDots * inkStrength * opacity, 0.0, 1.0));
  }
  return sky;
}

// --- Rain and snow ------------------------------------------------------

vec3 weather(vec3 sky, vec2 p, float unit) {
  if (PRECIPITATION == 0) return sky;
  bool isSnow = PRECIPITATION == 4;
  int every = PRECIPITATION == 1 ? 9 : PRECIPITATION == 2 ? 4 : PRECIPITATION == 3 ? 3 : 6;
  float fall = (isSnow ? 3.0 : PRECIPITATION == 1 ? 10.0 : PRECIPITATION == 2 ? 18.0 : 22.0) * unit * 0.6;
  float slant = min(2.0, WIND / 6.0);
  float h = iResolution.y;
  float gap = unit * 0.5;
  // Rain leans with the wind; each column carries one drop or flake.
  float x = isSnow ? p.x : p.x + p.y * slant * 0.15;
  int column = int(floor(x / gap));
  uint n = hashi(column * 4099 + 3);
  if (n % uint(every) != 0u) return sky;
  float streak = isSnow ? unit * 0.3 : unit * 1.4;
  float y = mod(float((n >> 5u) % 997u) + iTime * fall * (0.8 + float(n % 5u) * 0.1), h + streak * 2.0) - streak;
  float dx = isSnow ? x - (float(column) + 0.5) * gap - sin(iTime * 1.5 + float(n % 100u)) * unit * 0.3 * (1.0 + slant) : x - (float(column) + 0.5) * gap;
  float dy = p.y - y;
  float a = isSnow
    ? smoothstep(streak + 0.8, streak - 0.8, sqrt(dx * dx + dy * dy)) * 0.7
    : (abs(dx) < 1.0 && dy > 0.0 && dy < streak ? 0.3 * dy / streak : 0.0);
  vec3 color = isSnow ? vec3(1.0) : vec3(0.612, 0.769, 1.0);
  sky = mix(sky, color, a);
  // Now and then, lightning: the whole sky lights up for a moment.
  if (PRECIPITATION == 3 && mod(iTime, 6.0) < 0.12) sky = mix(sky, vec3(1.0, 0.953, 0.627), 0.25);
  return sky;
}
`
