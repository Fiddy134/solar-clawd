// The sky shader's GLSL, the end of COMMON: a bitmap font of 3 by 5 cells
// for a theme's boards and tapes (a departures board, a ticker), drawn here
// as text and packed into one uint a glyph as the module loads. Digits are
// codes 0 to 9 and A to Z 10 to 35, as in base 36; then a space and the
// signs a board needs. There is no #: a theme may not write one.

// Each glyph's cells, row 0 at the top, x a cell inked.
export const GLYPHS: readonly (readonly [string, readonly string[]])[] = [
  ['0', ['xxx', 'x.x', 'x.x', 'x.x', 'xxx']],
  ['1', ['.x.', 'xx.', '.x.', '.x.', 'xxx']],
  ['2', ['xxx', '..x', 'xxx', 'x..', 'xxx']],
  ['3', ['xxx', '..x', '.xx', '..x', 'xxx']],
  ['4', ['x.x', 'x.x', 'xxx', '..x', '..x']],
  ['5', ['xxx', 'x..', 'xxx', '..x', 'xxx']],
  ['6', ['xxx', 'x..', 'xxx', 'x.x', 'xxx']],
  ['7', ['xxx', '..x', '..x', '.x.', '.x.']],
  ['8', ['xxx', 'x.x', 'xxx', 'x.x', 'xxx']],
  ['9', ['xxx', 'x.x', 'xxx', '..x', 'xxx']],
  ['A', ['.x.', 'x.x', 'xxx', 'x.x', 'x.x']],
  ['B', ['xx.', 'x.x', 'xx.', 'x.x', 'xx.']],
  ['C', ['.xx', 'x..', 'x..', 'x..', '.xx']],
  ['D', ['xx.', 'x.x', 'x.x', 'x.x', 'xx.']],
  ['E', ['xxx', 'x..', 'xx.', 'x..', 'xxx']],
  ['F', ['xxx', 'x..', 'xx.', 'x..', 'x..']],
  ['G', ['.xx', 'x..', 'x.x', 'x.x', '.xx']],
  ['H', ['x.x', 'x.x', 'xxx', 'x.x', 'x.x']],
  ['I', ['xxx', '.x.', '.x.', '.x.', 'xxx']],
  ['J', ['..x', '..x', '..x', 'x.x', '.x.']],
  ['K', ['x.x', 'x.x', 'xx.', 'x.x', 'x.x']],
  ['L', ['x..', 'x..', 'x..', 'x..', 'xxx']],
  ['M', ['x.x', 'xxx', 'xxx', 'x.x', 'x.x']],
  ['N', ['xx.', 'x.x', 'x.x', 'x.x', 'x.x']],
  ['O', ['.x.', 'x.x', 'x.x', 'x.x', '.x.']],
  ['P', ['xx.', 'x.x', 'xx.', 'x..', 'x..']],
  ['Q', ['.x.', 'x.x', 'x.x', 'xx.', '.xx']],
  ['R', ['xx.', 'x.x', 'xx.', 'x.x', 'x.x']],
  ['S', ['.xx', 'x..', '.x.', '..x', 'xx.']],
  ['T', ['xxx', '.x.', '.x.', '.x.', '.x.']],
  ['U', ['x.x', 'x.x', 'x.x', 'x.x', 'xxx']],
  ['V', ['x.x', 'x.x', 'x.x', 'x.x', '.x.']],
  ['W', ['x.x', 'x.x', 'xxx', 'xxx', 'x.x']],
  ['X', ['x.x', 'x.x', '.x.', 'x.x', 'x.x']],
  ['Y', ['x.x', 'x.x', '.x.', '.x.', '.x.']],
  ['Z', ['xxx', '..x', '.x.', 'x..', 'xxx']],
  [' ', ['...', '...', '...', '...', '...']],
  ['.', ['...', '...', '...', '...', '.x.']],
  [',', ['...', '...', '...', '.x.', 'x..']],
  [':', ['...', '.x.', '...', '.x.', '...']],
  ['-', ['...', '...', 'xxx', '...', '...']],
  ['+', ['...', '.x.', 'xxx', '.x.', '...']],
  ['%', ['x.x', '..x', '.x.', 'x..', 'x.x']],
  ['/', ['..x', '..x', '.x.', 'x..', 'x..']],
  ['$', ['.xx', 'xx.', '.x.', '.xx', 'xx.']],
  ['!', ['.x.', '.x.', '.x.', '...', '.x.']],
  ['?', ['xx.', '..x', '.x.', '...', '.x.']],
  ["'", ['.x.', '.x.', '...', '...', '...']],
  ['▲', ['...', '.x.', 'xxx', '...', '...']],
  ['▼', ['...', 'xxx', '.x.', '...', '...']],
]

// The signs' names, for the codes after Z.
const SIGNS: Record<string, string> = {
  ' ': 'SPACE', '.': 'DOT', ',': 'COMMA', ':': 'COLON', '-': 'MINUS', '+': 'PLUS', '%': 'PERCENT',
  '/': 'SLASH', '$': 'DOLLAR', '!': 'BANG', '?': 'QUESTION', "'": 'QUOTE', '▲': 'UP', '▼': 'DOWN',
}

// A glyph's cells as a uint's bits: bit row * 3 + column.
export function packGlyph(rows: readonly string[]): number {
  return rows.reduce((bits, row, y) => [...row].reduce((sum, ch, x) => (ch === 'x' ? sum + 2 ** (y * 3 + x) : sum), bits), 0)
}

// A character's code, -1 for one the font has not (a blank).
export function codeOf(ch: string): number {
  return GLYPHS.findIndex(([glyph]) => glyph === ch.toUpperCase())
}

// A text as codes, as a theme writes it into an int array.
export function textCodes(text: string): number[] {
  return [...text].map(codeOf)
}

const TEN = [1, 10, 100, 1000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000]
const [ZERO, SPACE, DOT, MINUS] = ['0', ' ', '.', '-'].map(codeOf) as [number, number, number, number]

// A number as sky_number draws it, the code in each of `width` columns:
// right-aligned, `decimals` after a point (each a column of its own), a
// minus before the first digit, blanks to the left; digits that do not fit
// are cut at the left. Worked as the GPU does, in 32-bit floats, up to
// about two thousand million (of its least digits).
export function numberCodes(value: number, width: number, decimals: number): number[] {
  decimals = Math.max(0, Math.min(4, decimals))
  const scaled = Math.fround(Math.fround(Math.abs(value)) * TEN[decimals]!)
  const n = Math.min(Math.floor(Math.fround(scaled + 0.5)), 2_000_000_000)
  const needed = Math.max(decimals + 1, TEN.filter(ten => n >= ten).length)
  const isNegative = value < 0 && n > 0

  return Array.from({ length: width }, (_, column) => {
    const r = width - 1 - column
    if (decimals > 0 && r === decimals) return DOT
    const place = decimals > 0 && r > decimals ? r - 1 : r
    if (place < needed) return ZERO + (Math.floor(n / TEN[place]!) % 10)

    return place === needed && isNegative ? MINUS : SPACE
  })
}

export const GLYPHS_GLSL = `
// --- Letters ---------------------------------------------------------------

// A bitmap font of 3 by 5 cells, a uint a glyph, bit row * 3 + column with
// row 0 at the top (hooks/glsl/glyphs.ts draws them). Codes: the digits 0
// to 9, A to Z 10 to 35, then the signs named here. A glyph advances 4
// cells, a line 6.
const int sky_GLYPH_COUNT = ${GLYPHS.length};
const uint sky_FONT[${GLYPHS.length}] = uint[${GLYPHS.length}](${GLYPHS.map(([, rows]) => `${packGlyph(rows)}u`).join(', ')});
${GLYPHS.slice(36).map(([ch], i) => `const int sky_GLYPH_${SIGNS[ch]} = ${36 + i};`).join('\n')}
const int sky_TEN[10] = int[10](${TEN.join(', ')});

// Whether cell c of glyph \`code\` is inked; any code the font has not is blank.
bool sky_glyphCell(int code, ivec2 c) {
  if (code < 0 || code >= sky_GLYPH_COUNT || c.x < 0 || c.y < 0 || c.x > 2 || c.y > 4) return false;
  return ((sky_FONT[code] >> uint(c.y * 3 + c.x)) & 1u) == 1u;
}

// Glyph \`code\` with its top left at \`origin\`, \`cell\` pixels a cell: 1
// where it is inked, else 0, to ink() or mix() in a colour of the board.
float sky_glyph(vec2 p, vec2 origin, float cell, int code) {
  vec2 v = (p - origin) / cell;
  if (v.x < 0.0 || v.y < 0.0 || v.x >= 3.0 || v.y >= 5.0) return 0.0;
  return sky_glyphCell(code, ivec2(floor(v))) ? 1.0 : 0.0;
}

// A line of up to 16 glyphs from \`origin\`, as sky_glyph; -1 or 36 for a blank.
float sky_line16(vec2 p, vec2 origin, float cell, int text[16]) {
  if (p.y < origin.y || p.y >= origin.y + 5.0 * cell || p.x < origin.x || p.x >= origin.x + 64.0 * cell) return 0.0;
  int i = min(int(floor((p.x - origin.x) / (4.0 * cell))), 15);
  return sky_glyph(p, origin + vec2(4.0 * cell * float(i), 0.0), cell, text[i]);
}

// The code in column \`column\` of a number drawn \`width\` columns wide:
// right-aligned, \`decimals\` (0 to 4) after a point that takes a column, a
// minus before the first digit, blanks to the left; digits that do not fit
// are cut at the left. Whole up to about two thousand million.
int sky_numberCode(float value, int width, int decimals, int column) {
  int d = clamp(decimals, 0, 4);
  int n = int(min(floor(abs(value) * float(sky_TEN[d]) + 0.5), 2.0e9));
  int needed = d + 1;
  for (int k = 1; k < 10; k++) {
    if (n >= sky_TEN[k]) needed = max(needed, k + 1);
  }
  int r = width - 1 - column;
  if (d > 0 && r == d) return sky_GLYPH_DOT;
  int place = d > 0 && r > d ? r - 1 : r;
  if (place < needed) return (n / sky_TEN[place]) % 10;
  return place == needed && value < 0.0 && n > 0 ? sky_GLYPH_MINUS : sky_GLYPH_SPACE;
}

// A number \`width\` columns wide (at most 16) from \`origin\`, as sky_glyph:
// a price on a board, a change in percent with its sign.
float sky_number(vec2 p, vec2 origin, float cell, float value, int width, int decimals) {
  int columns = clamp(width, 1, 16);
  if (p.y < origin.y || p.y >= origin.y + 5.0 * cell || p.x < origin.x || p.x >= origin.x + 4.0 * cell * float(columns)) return 0.0;
  int i = min(int(floor((p.x - origin.x) / (4.0 * cell))), columns - 1);
  return sky_glyph(p, origin + vec2(4.0 * cell * float(i), 0.0), cell, sky_numberCode(value, columns, decimals, i));
}
`
