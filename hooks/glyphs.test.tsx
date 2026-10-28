// The font a theme writes its boards in: every glyph packed as drawn, the
// GLSL's table, a number's layout as the GPU works it, and a board that
// lints clean under the caps.

import { expect, test } from 'claude-code/testing'

import { codeOf, GLYPHS, GLYPHS_GLSL, numberCodes, packGlyph, packWide, textCodes, WIDE_GLYPHS, wideCell } from './glsl/glyphs'
import { COMMON } from './glsl/common'
import { checkTheme, engineNames, weightOf } from './themes/check'
import { GLYPH_BOARD } from './themes/fixtures'
import { SHADER_MAX, stagePtOf, themeOf } from './themes/theme'

// The text a row of codes reads as.
const read = (codes: number[]) => codes.map(code => (code < 0 ? ' ' : GLYPHS[code]![0])).join('')

test('fifty glyphs of 3 by 5, digits and A to Z as base 36, each packed into 15 bits and back', () => {
  expect(GLYPHS).toHaveLength(50)
  expect(GLYPHS.map(([ch]) => ch).join('')).toBe("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .,:-+%/$!?'▲▼")
  const packs = new Set<number>()
  for (const [ch, rows] of GLYPHS) {
    expect(rows.length).toBe(5)
    for (const row of rows) expect(row).toMatch(/^[x.]{3}$/)
    const bits = packGlyph(rows)
    expect(bits <= 0x7fff).toBe(true)
    const back = Array.from({ length: 5 }, (_, y) => Array.from({ length: 3 }, (_, x) => ((bits >> (y * 3 + x)) & 1 ? 'x' : '.')).join(''))
    expect(back).toEqual([...rows])
    // No two glyphs alike, the blank aside.
    if (ch !== ' ') expect(packs.has(bits)).toBe(false)
    packs.add(bits)
  }
  expect(packGlyph(GLYPHS[codeOf(' ')]![1])).toBe(0)
  expect(codeOf('a')).toBe(10)
  expect(codeOf('#')).toBe(-1)
  expect(textCodes('Gate 67')).toEqual([16, 10, 29, 14, 36, 6, 7])
})

test("the font is COMMON's last part, its table of uint literals, its names the engine's", () => {
  expect(COMMON.endsWith(GLYPHS_GLSL)).toBe(true)
  const table = /const uint sky_FONT\[50\] = uint\[50\]\(([^)]*)\);/.exec(GLYPHS_GLSL)
  expect(table).not.toBeNull()
  const literals = table![1]!.split(', ')
  expect(literals).toHaveLength(50)
  for (const literal of literals) expect(literal).toMatch(/^\d+u$/)
  expect(GLYPHS_GLSL).toContain('const int sky_GLYPH_COUNT = 50;')
  expect(GLYPHS_GLSL).toContain('const int sky_GLYPH_SPACE = 36;')
  expect(GLYPHS_GLSL).toContain('const int sky_GLYPH_DOWN = 49;')
  expect(GLYPHS_GLSL).not.toContain('#')
  const names = engineNames()
  for (const name of ['sky_FONT', 'sky_glyphCell', 'sky_glyph', 'sky_line16', 'sky_numberCode', 'sky_number']) expect(names).toContain(name)
})

test('a number is laid out right-aligned as the GPU works it: a point, a minus, blanks, and the left cut where it does not fit', () => {
  expect(read(numberCodes(347.28, 7, 2))).toBe(' 347.28')
  expect(read(numberCodes(-1.29, 6, 2))).toBe(' -1.29')
  expect(read(numberCodes(-12.34, 6, 2))).toBe('-12.34')
  expect(read(numberCodes(101234, 7, 0))).toBe(' 101234')
  expect(read(numberCodes(80988.83, 7, 0))).toBe('  80989')
  expect(read(numberCodes(29651.44, 9, 1))).toBe('  29651.4')
  expect(read(numberCodes(1_234_567, 5, 0))).toBe('34567')
  expect(read(numberCodes(5, 5, 2))).toBe(' 5.00')
  expect(read(numberCodes(0.004, 5, 2))).toBe(' 0.00')
  // Rounded to nothing, it has no sign.
  expect(read(numberCodes(-0.001, 5, 2))).toBe(' 0.00')
  expect(read(numberCodes(0, 3, 0))).toBe('  0')
  expect(read(numberCodes(7, 1, 0))).toBe('7')
  expect(read(numberCodes(1.5, 6, 9))).toBe('1.5000')
})

test('a board of 40 characters lints clean and keeps the shader under its cap', () => {
  expect(themeOf(JSON.parse(JSON.stringify(GLYPH_BOARD.manifest)), GLYPH_BOARD.glsl)).toEqual(GLYPH_BOARD)
  expect(checkTheme(GLYPH_BOARD)).toEqual([])
  expect(stagePtOf(GLYPH_BOARD)).toBe(400)
  expect(weightOf(GLYPH_BOARD).night <= SHADER_MAX).toBe(true)
})

// A text as sky_glyphWide prints it, a glyph every 6 cells: five rows of
// x and dots.
const wide = (text: string) =>
  Array.from({ length: 5 }, (_, y) => textCodes(text).map(code => Array.from({ length: 5 }, (_, x) => (wideCell(code, x, y) ? 'x' : '.')).join('')).join('.'))

test('M, N and W five cells wide pack into 25 bits and back, and every other glyph keeps its three columns, centred', () => {
  expect(WIDE_GLYPHS.map(([ch]) => ch)).toEqual(['M', 'N', 'W'])
  for (const [, rows] of WIDE_GLYPHS) {
    expect(rows.length).toBe(5)
    for (const row of rows) expect(row).toMatch(/^[x.]{5}$/)
    const bits = packWide(rows)
    expect(bits < 2 ** 25).toBe(true)
    const back = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => ((bits >> (y * 5 + x)) & 1 ? 'x' : '.')).join(''))
    expect(back).toEqual([...rows])
  }
  // The rest are their 3 by 5 cells with a blank column either side.
  for (const [ch, rows] of GLYPHS) {
    if ('MNW'.includes(ch)) continue
    for (let y = 0; y < 5; y++) expect(Array.from({ length: 5 }, (_, x) => (wideCell(codeOf(ch), x, y) ? 'x' : '.')).join('')).toBe(`.${rows[y]}.`)
  }
  // No two alike in the wide letters, the blank aside: M, N and W are no
  // longer an H and a Π.
  const seen = new Set<string>()
  for (const [ch] of GLYPHS) {
    const cells = wide(ch).join('/')
    if (ch !== ' ') expect(seen.has(cells), ch).toBe(false)
    seen.add(cells)
  }
  expect(wideCell(-1, 2, 2)).toBe(false)
  expect(wideCell(codeOf('M'), 5, 0)).toBe(false)
})

test('the tickers read in the wide letters', () => {
  expect(wide('NDX')).toEqual([
    'x...x..xx....x.x.',
    'xx..x..x.x...x.x.',
    'x.x.x..x.x....x..',
    'x..xx..x.x...x.x.',
    'x...x..xx....x.x.',
  ])
  expect(wide('MSFT')).toEqual([
    'x...x...xx...xxx...xxx.',
    'xx.xx..x.....x......x..',
    'x.x.x...x....xx.....x..',
    'x...x....x...x......x..',
    'x...x..xx....x......x..',
  ])
  expect(wide('AMZN')).toEqual([
    '..x...x...x..xxx..x...x',
    '.x.x..xx.xx....x..xx..x',
    '.xxx..x.x.x...x...x.x.x',
    '.x.x..x...x..x....x..xx',
    '.x.x..x...x..xxx..x...x',
  ])
  expect(wide('W')).toEqual(['x...x', 'x...x', 'x.x.x', 'xx.xx', 'x...x'])
  for (const ticker of ['NVDA', 'META']) expect(wide(ticker)[0]!.length).toBe(4 * 6 - 1)
})

test('the wide letters are COMMON\'s, beside sky_glyph as it was', () => {
  const table = /const uint sky_WIDE_FONT\[3\] = uint\[3\]\(([^)]*)\);/.exec(GLYPHS_GLSL)
  expect(table).not.toBeNull()
  expect(table![1]!.split(', ')).toEqual(WIDE_GLYPHS.map(([, rows]) => `${packWide(rows)}u`))
  // M, N and W by their codes, in the table's order.
  expect(GLYPHS_GLSL).toContain(`int wide = code == ${codeOf('M')} ? 0 : code == ${codeOf('N')} ? 1 : code == ${codeOf('W')} ? 2 : -1;`)
  expect(GLYPHS_GLSL).toContain('float sky_glyphWide(vec2 p, vec2 origin, float cell, int code) {')
  expect(GLYPHS_GLSL).toContain('bool sky_wideCell(int code, ivec2 c) {')
  // sky_glyph and its cell are the 3 by 5 font's, line for line.
  expect(GLYPHS_GLSL).toContain(
    [
      'float sky_glyph(vec2 p, vec2 origin, float cell, int code) {',
      '  vec2 v = (p - origin) / cell;',
      '  if (v.x < 0.0 || v.y < 0.0 || v.x >= 3.0 || v.y >= 5.0) return 0.0;',
      '  return sky_glyphCell(code, ivec2(floor(v))) ? 1.0 : 0.0;',
      '}',
    ].join('\n'),
  )
  expect(GLYPHS_GLSL).toContain('  if (code < 0 || code >= sky_GLYPH_COUNT || c.x < 0 || c.y < 0 || c.x > 2 || c.y > 4) return false;')
  expect(GLYPHS_GLSL).not.toContain('#')
  const names = engineNames()
  for (const name of ['sky_WIDE_FONT', 'sky_wideCell', 'sky_glyphWide']) expect(names).toContain(name)
})
