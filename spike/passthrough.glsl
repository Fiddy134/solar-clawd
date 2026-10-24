// The floor: Ghostty's animation loop with a shader that does nothing.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(iChannel0, fragCoord / iResolution.xy);
}
