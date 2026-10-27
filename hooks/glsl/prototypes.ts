// The sky shader's GLSL, part of hooks/shader.ts's BODY: the four functions
// a theme defines, declared here, right after COMMON, so that the engine can
// call them while the theme's own text comes last, after mainImage, and can
// call anything of the engine's.
export const PROTOTYPES = `
// --- What a theme draws ------------------------------------------------------

// The ground, the props and the light that shows Claude waits (WAITING):
// after the sun and the events behind the clouds, before resident() and
// the clouds.
vec3 scenery(vec3 sky, vec2 p, float u, float k);
// The characters and their things.
vec3 resident(vec3 sky, vec2 p, float u, float k);
// One of the theme's own events: \`kind\` counts from 0 in the manifest's
// order; \`isBehind\` is the pass behind the clouds, as events() has it.
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind);
// How much of the outdoor layers (the clouds, the events in front, rain
// and snow) shows at p: 1.0 outside, 0.0 behind a wall, between the two
// through a window.
float themeWindow(vec2 p, float u);
`
