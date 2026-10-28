// Themes that are not themes to live in: fixtures the tests and the tools
// draw (`--theme glyph-board`), never built in.

import { ENGINE_CONTRACT } from './theme'
import type { Theme } from './theme'

// A departures board of 40 characters on the stage, three lines of the
// font, and under it the tape: BTC's and the Nasdaq-100's prices and their
// changes from the market's signals, and what Claude is doing. It uses
// every field a manifest gained for the two themes (a wider stage, the
// market) and measures what letters cost (--bench).
export const GLYPH_BOARD: Theme = {
  manifest: {
    engine: ENGINE_CONTRACT,
    name: 'glyph-board',
    title: 'Glyph board',
    description: 'A board of letters on the stage, to see and measure the font.',
    author: 'Solar Clawd',
    version: '1.0.0',
    license: 'GPL-3.0',
    stage: 'wanted',
    stagePt: 400,
    waits: 'The board lights orange for a question and white when work is done.',
    context: 'engine',
    market: true,
    events: [],
    previews: [],
    aliases: {},
  },
  glsl: `
// The board's panel, its top left and its cell, in the stage strip.
vec2 boardAt(float u) { return vec2(iResolution.x - STAGE_PX + 2.0 * u, ARC.w * iResolution.y - 9.0 * u); }
float boardCell(float u) { return max(2.0, floor((STAGE_PX - 4.0 * u) / 66.0)); }

// Three lines: 16, 16 and 8 characters.
float boardText(vec2 p, vec2 at, float cell) {
  float line = 6.0 * cell;
  // GATE 67 KRAKOZHI
  float ink = sky_line16(p, at, cell, int[16](16, 10, 29, 14, 36, 6, 7, 36, 20, 27, 10, 20, 24, 35, 17, 18));
  // DELAYED 12:45 +3
  ink = max(ink, sky_line16(p, at + vec2(0.0, line), cell, int[16](13, 14, 21, 10, 34, 14, 13, 36, 1, 2, 39, 4, 5, 36, 41, 3)));
  // NOW BOAR, and the rest blank
  ink = max(ink, sky_line16(p, at + vec2(0.0, 2.0 * line), cell, int[16](23, 24, 32, 36, 11, 24, 10, 27, -1, -1, -1, -1, -1, -1, -1, -1)));
  return ink;
}

// The tape: BTC whole, the Nasdaq-100 whole, each with its change.
float tape(vec2 p, vec2 at, float cell) {
  float line = 6.0 * cell;
  float ink = sky_number(p, at, cell, sky_QUOTE_PRICE[sky_BTC], 7, 0);
  ink = max(ink, sky_number(p, at + vec2(32.0 * cell, 0.0), cell, sky_QUOTE_CHANGE[sky_BTC], 6, 2));
  ink = max(ink, sky_number(p, at + vec2(0.0, line), cell, sky_QUOTE_PRICE[sky_NDX], 7, 0));
  ink = max(ink, sky_number(p, at + vec2(32.0 * cell, line), cell, sky_QUOTE_CHANGE[sky_NDX], 6, 2));
  ink = max(ink, sky_number(p, at + vec2(0.0, 2.0 * line), cell, float(sky_tool()), 1, 0));
  ink = max(ink, sky_number(p, at + vec2(8.0 * cell, 2.0 * line), cell, float(sky_agents()), 1, 0));
  return ink;
}

vec3 scenery(vec3 sky, vec2 p, float u, float k) {
  if (STAGE_PX <= 0.0 || p.x < iResolution.x - STAGE_PX) return sky;
  vec2 at = boardAt(u);
  float cell = boardCell(u);
  vec2 size = vec2(66.0 * cell, 37.0 * cell);
  if (p.x < at.x - cell || p.y < at.y - cell || p.x > at.x + size.x || p.y > at.y + size.y) return sky;
  sky = mix(sky, tone(INK_INDIGO, k) * 0.6, 0.85);
  vec3 lit = WAITING == 1 ? INK_ORANGE : WAITING == 2 ? vec3(0.95) : INK_YELLOW;
  sky = mix(sky, lift(lit, k), boardText(p, at, cell));
  vec3 up = sky_QUOTE_CHANGE[sky_NDX] < 0.0 ? INK_PINK : INK_GREEN;
  return mix(sky, lift(up, k), tape(p, at + vec2(0.0, 19.0 * cell), cell));
}
`,
}
