// The sky shader's GLSL, part of hooks/shader.ts's BODY: mainImage: the sky
// put together behind the terminal.
export const MAIN = `
// --- The sky behind the terminal -------------------------------------------

// How much sky shows through Claude Code's own fields: a diff's red and
// green rows, the prompt's and the shell's rows.
const float GLASS = 0.55;
// The colour a diff's red and green rows tint the sky with: their own hue
// made lighter, its brightest channel at GLASS_LIGHT, so the sky shows
// through them as through light coloured glass. Grey fields (the prompt's
// and the shell's rows) keep their own colour: lightened, they would wash
// out the light text on them.
const float GLASS_LIGHT = 0.85;
// The least lightness of text on that lighter glass.
const float GLASS_TEXT = 0.75;

float chroma(vec3 c) { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }

vec3 glassTint(vec3 field) {
  float top = max(field.r, max(field.g, field.b));
  return mix(field, field * (GLASS_LIGHT / max(top, 0.001)), smoothstep(0.05, 0.15, chroma(field)));
}

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
// there, and on a Mac in Display P3 as well, as Ghostty converts them
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

// Lighter than any of the field colours, the lightest being diffAddedWord
// in Display P3 at 0.56: anything lighter, as most text is, is not a field
// and needs none of the compares.
const float FIELD_LIGHTEST = 0.6;

// How much of the sky shows through a terminal pixel that is not its
// background: GLASS where it is in one of Claude Code's own fields, of
// their colour and of their shape; none anywhere else. Text on a field,
// the band's pixel art and every colour not Claude Code's stay solid, as
// they would without glass. A coloured field (a diff's red and green) is
// glass by its colour alone, no text or art being drawn in it: the shape
// left the gaps between letters and their counters solid, dark spots in
// the light glass. Only on a dark background: on a light one, dark pixels
// are the text.
float glass(vec3 term, vec2 uv) {
  if (luminance(iBackgroundColor) > 0.5) return 0.0;
  if (luminance(term) > FIELD_LIGHTEST || !isFieldColour(term)) return 0.0;
  if (chroma(term) < 0.05 && !isField(term, uv)) return 0.0;
  return GLASS;
}

// The places a coloured field and the core of a letter are looked for
// round a pixel of text, in pixels: the ring of 8 next to it, and 2 and 4
// away either side and above and below, the middle of a stroke being up
// to 4 from the field.
const vec2 TEXT_NEAR[16] = vec2[16](vec2(-1.0, -1.0), vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 0.0),
                                    vec2(1.0, 0.0), vec2(-1.0, 1.0), vec2(0.0, 1.0), vec2(1.0, 1.0),
                                    vec2(-2.0, 0.0), vec2(2.0, 0.0), vec2(0.0, -2.0), vec2(0.0, 2.0),
                                    vec2(-4.0, 0.0), vec2(4.0, 0.0), vec2(0.0, -4.0), vec2(0.0, 4.0));

// Whether term is text on a coloured field, answering the field's colour,
// the text's (the place near that is furthest from the field's) and how
// much of term is text: the soft edge of a letter is part text, part
// field, and drawn as it is it stays a dark rim round every letter on the
// lighter glass. Only on a dark background, as glass.
bool isTextOnGlass(vec3 term, vec2 uv, out vec3 field, out vec3 text, out float cover) {
  if (luminance(iBackgroundColor) > 0.5) return false;
  // The darkest place near, a field being darker than the text on it; then
  // whether it is a coloured field's colour, asked once, out of the loop,
  // which otherwise unrolls into hundreds of compares.
  field = term;
  for (int i = 0; i < 16; i++) {
    vec3 c = textureLod(iChannel0, uv + TEXT_NEAR[i] / iResolution.xy, 0.0).rgb;
    if (luminance(c) < luminance(field)) field = c;
  }
  if (chroma(field) < 0.05 || !isFieldColour(field)) return false;
  text = term;
  for (int i = 0; i < 16; i++) {
    vec3 c = textureLod(iChannel0, uv + TEXT_NEAR[i] / iResolution.xy, 0.0).rgb;
    if (distance(c, field) > distance(text, field)) text = c;
  }
  vec3 span = text - field;
  cover = clamp(dot(term - field, span) / max(dot(span, span), 1e-5), 0.0, 1.0);
  // Text dimmer than GLASS_TEXT, as a comment or a line number is, made
  // that light towards white: lighter than its dark field, it would be
  // darker than the light glass and muddy on it.
  float lightness = luminance(text);
  if (lightness < GLASS_TEXT) text = mix(text, vec3(1.0), (GLASS_TEXT - lightness) / (1.0 - lightness));
  return true;
}

// A thin dark rim round the terminal's text, as subtitles have, so light
// text stays readable on a bright sky: the sky darkens towards SHADE_TINT
// within SHADE_RADIUS of a glyph, dark only right by its strokes and
// fading out over the rest, and stays bright everywhere else. Next to the
// strokes, even the brightest sky LUMINANCE allows leaves light text about
// 4.9 to 1, past AA's 4.5; a wider or darker rim made the text look bold.
// Light text near the sky's own lightness, as Claude Code's grey is by day
// or white is on a bright cloud, gets a stronger rim, up to SHADE_NEAR;
// the text's lightness is its brightest pixel in reach, as the soft edge
// of light text is dim too. Text darker than the sky keeps SHADE: a light
// rim round it washed it out. Claude Code's fields are not text: rimmed,
// the sky under their glass went dark. Every pixel of the disc is looked
// at: a few places only drew dotted copies of each glyph. Only on a dark
// background: on a light one, dark pixels are the text.
const float SHADE = 0.6;
const float SHADE_NEAR = 0.85;
// How much lighter than the sky text is for SHADE_NEAR, and for SHADE.
const vec2 SHADE_GAP = vec2(0.1, 0.35);
const vec3 SHADE_TINT = vec3(0.03, 0.06, 0.16);
// The rim's width, in units, at most 1.75 pixels: it fades out by half a
// pixel past that, inside SHADE_DISC.
const float SHADE_RADIUS = 0.05;
// The disc looked at round a pixel, as a fixed list (x, y, distance) rather
// than a square with the corners skipped: a loop the compiler can lay out
// whole. The pixel itself is not in it, being the terminal's own texel,
// read already. Nothing past 2 pixels: at 2.24, the next places out, the
// rim has faded to nothing by 1.65 pixels wide (a Retina window) and to a
// four-thousandth at its widest. They did count towards the brightest
// neighbour, which sets the rim's strength, so on the soft edges of glyphs
// the rim is a little different without them, and a pixel away from text
// by a few 255ths at most.
const vec3 SHADE_DISC[12] = vec3[12](
  vec3(-1.0, 0.0, 1.0), vec3(1.0, 0.0, 1.0), vec3(0.0, -1.0, 1.0), vec3(0.0, 1.0, 1.0),
  vec3(-1.0, -1.0, 1.4142), vec3(1.0, -1.0, 1.4142), vec3(-1.0, 1.0, 1.4142), vec3(1.0, 1.0, 1.4142),
  vec3(-2.0, 0.0, 2.0), vec3(2.0, 0.0, 2.0), vec3(0.0, -2.0, 2.0), vec3(0.0, 2.0, 2.0));

// term and mask are the pixel's own: the terminal's colour there and how
// much of it is not the background, as mainImage has them.
float shade(vec2 fragCoord, vec3 linearBackground, float unit, vec3 sky, vec3 term, float mask) {
  if (luminance(iBackgroundColor) > 0.5) return 0.0;
  float radius = clamp(unit * SHADE_RADIUS, 1.5, 1.75);
  float near = mask;
  float brightest = mask > 0.5 ? luminance(term) : 0.0;
  for (int i = 0; i < 12; i++) {
    float weight = 1.0 - smoothstep(radius - 1.0, radius + 0.5, SHADE_DISC[i].z);
    vec3 c = textureLod(iChannel0, (fragCoord + SHADE_DISC[i].xy) / iResolution.xy, 0.0).rgb;
    float text = smoothstep(0.02, 0.12, min(distance(c, iBackgroundColor), distance(c, linearBackground)));
    near = max(near, text * weight);
    if (text > 0.5) brightest = max(brightest, luminance(c));
  }
  float gap = brightest - luminance(sky);
  return near * (gap < 0.0 ? SHADE : mix(SHADE_NEAR, SHADE, smoothstep(SHADE_GAP.x, SHADE_GAP.y, gap)));
}

// How dark a sky needs no rim, and how light one has all of it. Below
// 0.2, Claude Code's grey (153) is 4.5 to 1 on the sky without one, and
// the rim, darkening the sky towards SHADE_TINT, moves it little; below
// 0.1 its lightness by 9/255 at most (a night's blue by up to 30), so
// there the disc is not looked at. Most of a
// night sky is under 0.12, a dusk sky over 0.2 until the sun is well down.
const vec2 SHADE_DARK = vec2(0.1, 0.2);

// The sky with the rim laid over it, a stage like the others so the
// preview's --without shaded can leave it out.
vec3 shaded(vec3 sky, vec2 fragCoord, vec3 linearBackground, float unit, vec3 term, float mask) {
  float lit = smoothstep(SHADE_DARK.x, SHADE_DARK.y, luminance(sky));
  if (lit == 0.0) return sky;
  return mix(sky, SHADE_TINT, lit * shade(fragCoord, linearBackground, unit, sky, term, mask));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec4 term = texture(iChannel0, uv);
  // Only in a tab where Claude runs: its session marks palette colour 16,
  // blue one step off black (tabMark). Asked first, so any other tab the
  // shader is drawn in costs no more than the terminal itself.
  if (abs(iPalette[16].b - 1.0 / 255.0) > 0.5 / 255.0 || iPalette[16].r > 3.5 / 255.0 || iPalette[16].g > 10.5 / 255.0) {
    fragColor = vec4(term.rgb, 1.0);
    return;
  }
  // Wherever the terminal shows anything but its background (as Ghostty
  // says it, theme and all), the terminal. With linear alpha blending (the
  // default on Linux) the terminal's image is in linear light while
  // iBackgroundColor is sRGB: compared with both.
  vec3 linearBackground = pow(iBackgroundColor, vec3(2.2));
  float mask = smoothstep(0.02, 0.12, min(distance(term.rgb, iBackgroundColor), distance(term.rgb, linearBackground)));
  // Dark fields let some sky through: less of the terminal, and the
  // coloured ones lighter.
  vec3 ink = term.rgb;
  float pane = 0.0;
  if (mask > 0.0) {
    pane = glass(term.rgb, uv);
    mask *= 1.0 - pane;
    if (pane > 0.0) ink = glassTint(term.rgb);
  }
  // Text on a coloured field: laid over the glass as it was over the field,
  // put as an ink and a mask straight away (what the sky's long work keeps
  // at hand costs every pixel). Its soft edges too where they come near the
  // terminal's background, part field and part text as they are: taken
  // for background, they let the dark rim through as dots along every
  // stroke.
  if (mask > 0.0 && pane == 0.0) {
    vec3 field, text;
    float cover;
    if (isTextOnGlass(term.rgb, uv, field, text, cover)) {
      pane = GLASS * (1.0 - cover);
      mask = 1.0 - pane;
      ink = ((1.0 - cover) * (1.0 - GLASS) * glassTint(field) + cover * text) / mask;
    }
  }
  if (mask >= 1.0) {
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
  if (s.isDay > 0.5) sky = sunAt(sky, p, body, unit * 1.9, 1.0 - CLOUDINESS * 0.85, pitch(unit), k, s.elevation);
  sky = events(sky, p, unit, k, true);
  if (ISS_UP > 0.5) sky = iss(sky, p, unit);
  // The theme's ground and props, and who lives there.
  sky = scenery(sky, p, unit, k);
  sky = resident(sky, p, unit, k);
  // The clouds, the events in front and the weather, wherever the theme
  // shows the outdoors: everywhere outside, through a window partly, and
  // not at all behind its walls.
  float window = themeWindow(p, unit);
  if (window > 0.0) {
    vec3 indoor = sky;
    // The lighter sky has no clouds, a third or more of what the sky costs.
    if (LIGHT < 0.5) sky = clouds(sky, p, s, unit, k);
    sky = events(sky, p, unit, k, false);
    sky = weather(sky, p, unit);
    if (window < 1.0) sky = mix(indoor, sky, window);
  }
  // No rim under glass. Without glass, mask is still the terminal's own,
  // text on a coloured field being glass or else done with above.
  if (pane == 0.0) sky = shaded(sky, fragCoord, linearBackground, unit, term.rgb, mask);

  fragColor = vec4(mix(sky, ink, mask), 1.0);
}
`
