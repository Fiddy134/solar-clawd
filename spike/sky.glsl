// Spike: does a sky behind Claude Code in Ghostty read well? A dusk
// gradient, a few clouds drifting with iTime under a riso halftone, the
// terminal laid over it wherever it is not the plain background.
// The square at the top right is red for the first 20 s of iTime, then
// green: after a reload_config, red again means iTime starts over.

const vec3 BG = vec3(0x28, 0x2c, 0x34) / 255.0;
const float DIM = 0.42;

vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// A puffy cloud: a union of circles along a flat base, `u` a unit of size.
float cloud(vec2 p, vec2 at, float u) {
  float d = 1e9;
  d = min(d, length(p - at - vec2(0.0, 0.0) * u) - 1.0 * u);
  d = min(d, length(p - at - vec2(1.3, 0.5) * u) - 1.3 * u);
  d = min(d, length(p - at - vec2(2.8, 0.2) * u) - 1.1 * u);
  d = min(d, length(p - at - vec2(4.0, -0.1) * u) - 0.8 * u);
  // A flat bottom.
  d = max(d, (at.y - 0.6 * u) - p.y);
  return d;
}

// The risograph screen: a dot grid at 15°, the dot's area the tone.
float screen(vec2 p, float tone, float pitch) {
  float a = radians(15.0);
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p / pitch;
  vec2 cell = fract(q) - 0.5;
  float r = sqrt(clamp(tone, 0.0, 1.0) / 3.14159) ;
  return smoothstep(r + 0.08, r - 0.08, length(cell));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 term = texture(iChannel0, uv);
  // Ghostty's fragCoord starts at the top left (Shadertoy's at the bottom
  // left): the sky is drawn in `p`, y up.
  vec2 p = vec2(fragCoord.x, iResolution.y - fragCoord.y);

  // The gradient: top, middle, horizon at dusk.
  vec3 top = rgb(34.0, 50.0, 118.0);
  vec3 mid = rgb(109.0, 79.0, 149.0);
  vec3 horizon = rgb(217.0, 112.0, 138.0);
  float y = p.y / iResolution.y;
  vec3 sky = y > 0.5 ? mix(mid, top, (y - 0.5) * 2.0) : mix(horizon, mid, y * 2.0);

  // Stars twinkling high up.
  vec2 star = floor(p / 3.0);
  float s = hash(star);
  if (s > 0.9975 && y > 0.45) sky += vec3(0.6) * (0.6 + 0.4 * sin(iTime * 2.0 + s * 100.0));

  // Clouds drifting right, each at its own speed, wrapping round.
  float u = iResolution.y / 40.0;
  float w = iResolution.x + 8.0 * u;
  vec3 ink = rgb(255.0, 72.0, 176.0); // riso fluorescent pink
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float speed = 6.0 + 4.0 * hash(vec2(fi, 1.0));
    float x = mod(hash(vec2(fi, 2.0)) * w + iTime * speed, w) - 5.0 * u;
    float h = iResolution.y * (0.45 + 0.4 * hash(vec2(fi, 3.0)));
    float d = cloud(p, vec2(x, h), u * (0.8 + 0.5 * hash(vec2(fi, 4.0))));
    float inside = smoothstep(1.0, -1.0, d);
    // Shade: lighter at the top of the cloud, halftoned in pink.
    float tone = 0.25 + 0.35 * clamp((p.y - h) / (2.0 * u), 0.0, 1.0);
    vec3 body = mix(sky, vec3(0.95, 0.9, 0.95), 0.55);
    body = mix(body, ink, 0.6 * screen(p, tone, 6.0));
    sky = mix(sky, body, inside);
  }

  sky *= DIM;

  // The iTime probe.
  vec2 corner = iResolution.xy - p;
  if (corner.x < 40.0 && corner.y < 40.0) sky = iTime < 20.0 ? vec3(0.8, 0.1, 0.1) : vec3(0.1, 0.7, 0.2);

  float mask = smoothstep(0.02, 0.12, distance(term.rgb, BG));
  fragColor = vec4(mix(sky, term.rgb, mask), 1.0);
}
