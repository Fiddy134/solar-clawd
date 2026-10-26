// The measuring probe: no sky, only a count of the frames this surface has
// drawn (Ghostty's iFrame). Sixteen upright bands across the window, the
// leftmost always white and the rightmost always black as guards, and
// between them the count's low fourteen bits, the highest first, white for
// a one. Black and white survive any colour space a screenshot passes
// through. Two screenshots some seconds apart give the frames drawn in
// between, up to 16384 of them (tools/measure/gpu.sh).
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  int band = int(fragCoord.x / iResolution.x * 16.0);
  float on = 0.0;
  if (band <= 0) on = 1.0;
  else if (band < 15) on = float((iFrame >> (14 - band)) & 1);
  fragColor = vec4(vec3(on), 1.0);
}
