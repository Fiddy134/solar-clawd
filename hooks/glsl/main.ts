// The sky shader's GLSL, part of hooks/shader.ts's BODY: mainImage: the sky
// put together behind the terminal.
export const MAIN = `
// --- The sky behind the terminal -------------------------------------------

// How much sky shows through Claude Code's own fields: a diff's red and
// green rows, the prompt's and the shell's rows.
const float GLASS = 0.55;

// The places a field is looked for around a pixel, in pixels: 4 either
// side and 2 above and below, then 1 either side and 1 above and below.
const vec2 FIELD_REACH[8] = vec2[8](vec2(-4.0, 0.0), vec2(4.0, 0.0), vec2(0.0, -2.0), vec2(0.0, 2.0),
                                    vec2(-1.0, 0.0), vec2(1.0, 0.0), vec2(0.0, -1.0), vec2(0.0, 1.0));

// Whether the terminal at uv + offset (in pixels) is term's colour.
bool isSame(vec3 term, vec2 uv, vec2 offset) {
  // Level 0 by name: read in a branch, where the derivatives that pick a
  // level are not to be had.
  vec3 off = abs(textureLod(iChannel0, uv + offset / iResolution.xy, 0.0).rgb - term);
  return max(off.r, max(off.g, off.b)) < 1.5 / 255.0;
}

// Whether the terminal at uv is term's colour all round it: inside a
// field. A glyph's stroke or a thin rule of box-drawing never is, being
// thin across one way or the other; the near places keep the strokes of
// small text, spaced as far apart as the far ones look, from passing for
// one.
bool isInsideField(vec3 term, vec2 uv) {
  for (int i = 0; i < 8; i++) {
    if (!isSame(term, uv, FIELD_REACH[i])) return false;
  }
  return true;
}

// Whether the terminal at uv is part of a field: inside one, or of its
// colour and next to a place inside it. The second takes in the field's
// edges and the field around its text, which would otherwise stay solid
// as an outline round every word; a glyph is never next to the inside of a
// field of its own colour, so it stays solid all the same.
bool isField(vec3 term, vec2 uv) {
  if (isInsideField(term, uv)) return true;
  for (int i = 0; i < 4; i++) {
    vec2 near = uv + FIELD_REACH[i] / iResolution.xy;
    if (isSame(term, uv, FIELD_REACH[i]) && isInsideField(term, near)) return true;
  }
  return false;
}

// Whether term is one of the colours Claude Code fills its own fields with
// (FIELD_COLOURS, in linear light on Linux as the terminal's image is
// there; a Mac set to linear blending is not covered). The very colour: the
// band's art comes within a step of them (a grey of 56 at night, by the
// prompt's 55), and the faintest edges of letters on a field do too. The
// cheap test, made first: every other pixel is done with after these
// compares.
bool isFieldColour(vec3 term) {
  for (int i = 0; i < FIELD_COUNT; i++) {
    vec3 off = abs(term - FIELD_COLOURS[i]);
    if (max(off.r, max(off.g, off.b)) < 0.75 / 255.0) return true;
  }
  return false;
}

// How much of the sky shows through a terminal pixel that is not its
// background: GLASS where it is in one of Claude Code's own fields, of
// their colour and of their shape; none anywhere else. Text on a field,
// the band's pixel art and every colour not Claude Code's stay solid, as
// they would without glass. Only on a dark background: on a light one,
// dark pixels are the text.
float glass(vec3 term, vec2 uv) {
  if (luminance(iBackgroundColor) > 0.5) return 0.0;
  if (!isFieldColour(term) || !isField(term, uv)) return 0.0;
  return GLASS;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 term = texture(iChannel0, uv);
  // Wherever the terminal shows anything but its background (as Ghostty
  // says it, theme and all), the terminal. With linear alpha blending (the
  // default on Linux) the terminal's image is in linear light while
  // iBackgroundColor is sRGB: compared with both.
  vec3 linearBackground = pow(iBackgroundColor, vec3(2.2));
  float mask = smoothstep(0.02, 0.12, min(distance(term.rgb, iBackgroundColor), distance(term.rgb, linearBackground)));
  // Dark fields let some sky through: less of the terminal.
  if (mask > 0.0) mask *= 1.0 - glass(term.rgb, uv);
  if (mask >= 1.0) {
    fragColor = vec4(term.rgb, 1.0);
    return;
  }
  // Only in a tab where Claude runs: its session marks palette colour 16,
  // blue one step off black (tabMark).
  if (abs(iPalette[16].b - 1.0 / 255.0) > 0.5 / 255.0 || iPalette[16].r > 2.5 / 255.0 || iPalette[16].g > 10.5 / 255.0) {
    fragColor = vec4(term.rgb, 1.0);
    return;
  }
  float unit = max(4.0, floor(iResolution.y / 60.0 + 0.5));

  // fragCoord with y down from the top left, on every backend.
  vec2 p = Y_UP > 0.5 ? vec2(fragCoord.x, iResolution.y - fragCoord.y) : fragCoord;
  Scene s = sceneNow();
  float k;
  vec3 sky = gradient(p, s, k);

  float night = nightness(s.elevation);
  float auroraStrength = AURORA * max(AURORA_FLOOR, night);
  if (auroraStrength > 0.0) sky = aurora(sky, p, auroraStrength);
  float starStrength = night * (1.0 - CLOUDINESS * 0.9);
  if (starStrength > 0.03) {
    float size = max(1.0, floor(iResolution.y / 700.0 + 0.5));
    sky = stars(sky, p, starStrength, size);
    if (STAR_COUNT > 0) sky = realStars(sky, p, starStrength, size);
    if (LINE_COUNT > 0 && night > 0.6 && CLOUDINESS < 0.5) sky = chartLines(sky, p, unit, (night - 0.6) / 0.4);
  }
  vec2 body = arcPoint(s.progress);
  if (s.isDay < 0.5 && MOON_UP > 0.5) sky = moonAt(sky, p, domeToPixel(MOON_AT), unit * 2.0, (0.35 + 0.65 * night) * (1.0 - CLOUDINESS * 0.8));

  sky = tone(sky, k);
  if (s.isDay > 0.5) sky = sunAt(sky, p, body, unit * 1.9, 1.0 - CLOUDINESS * 0.85, max(3.0, unit * 0.24), k, s.elevation);
  sky = events(sky, p, unit, k, true);
  if (ISS_UP > 0.5) sky = iss(sky, p, unit);
  sky = beacon(sky, p, unit, k);
  sky = keeper(sky, p, unit, k);
  sky = clouds(sky, p, s, unit, k);
  sky = events(sky, p, unit, k, false);
  sky = weather(sky, p, unit);
  sky = basket(sky, p, unit, k);

  fragColor = vec4(mix(sky, term.rgb, mask), 1.0);
}
`
