// The font a theme writes its boards in: every glyph packed as drawn, the
// GLSL's table, a number's layout as the GPU works it, and a board that
// lints clean under the caps.

import { expect, test } from 'claude-code/testing'

import { codeOf, GLYPHS, GLYPHS_GLSL, numberCodes, packGlyph, textCodes } from './glsl/glyphs'
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
