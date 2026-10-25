// The sky shader's GLSL, part of hooks/shader.ts's BODY: mainImage: the sky
// put together behind the terminal.
export const MAIN = `
// --- The sky behind the terminal -------------------------------------------

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 term = texture(iChannel0, fragCoord / iResolution.xy);
  // Wherever the terminal shows anything but its background (as Ghostty
  // says it, theme and all), the terminal. With linear alpha blending (the
  // default on Linux) the terminal's image is in linear light while
  // iBackgroundColor is sRGB: compared with both.
  vec3 linearBackground = pow(iBackgroundColor, vec3(2.2));
  float mask = smoothstep(0.02, 0.12, min(distance(term.rgb, iBackgroundColor), distance(term.rgb, linearBackground)));
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
  sky = clouds(sky, p, s, unit, k);
  sky = events(sky, p, unit, k, false);
  sky = weather(sky, p, unit);
  sky = basket(sky, p, unit, k);

  fragColor = vec4(mix(sky, term.rgb, mask), 1.0);
}
`
