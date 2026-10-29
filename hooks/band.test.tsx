// The band above the prompt: the words, and the sky behind them.

import { expect, test } from 'claude-code/testing'

import { localTime, STOCKHOLM, swedishOffsetMs } from './astro'
import { swedish } from './test-kit'
import { drawFrame, ROWS } from './clawd'
import { activityAt, activityOn } from './hours'
import { tabMark } from './mark'
import { fromBase64, isPrintable } from './paint'
import { CONTEXT_MARK } from './glsl/context'
import { MAIN } from './glsl/main'
import { shaderParams, skyShader } from './shader'
import { wallpaperPng } from './sky'
import { BASE_THEME, THEMES } from './themes/index'

const FYR = THEMES[BASE_THEME]

test('the hours map to what Clawd does, the same every day', () => {
  const day = [2, 3, 5, 6, 7, 8, 11, 12, 15, 16, 21, 22, 23].map(hour => activityAt({ hour }))
  expect(day).toEqual(['nightOwl', 'sleep', 'sleep', 'earlyBird', 'earlyBird', 'coffee', 'coffee', 'work', 'work', 'vibe', 'vibe', 'nightOwl', 'nightOwl'])
})

test('a frame packs one cell per column and row, the wallpaper is a PNG', async () => {
  const view = { columns: 60, ms: Date.UTC(2026, 9, 24, 17, 30), t: 3, mode: 'live' as const, place: STOCKHOLM }
  expect(drawFrame(view).length).toBe(Math.ceil((60 * ROWS * 12) / 3) * 4)
  expect((await wallpaperPng(view, 120, 80)).startsWith('iVBORw0KGgo')).toBe(true)
})

test('control characters never reach a cell', () => {
  expect([0x1b, 0x07, 0x7f, 0x9b].some(isPrintable)).toBe(false)
  expect(['a', 'å', 'é', ' '].every(ch => isPrintable(ch.charCodeAt(0)))).toBe(true)
  const place = { name: 'Evil\u001b]0;pwn\u0007', lat: 59.33, lon: 18.07 }
  const cells = fromBase64(drawFrame({ ms: Date.UTC(2026, 9, 24, 10), t: 0, place, columns: 80, mode: 'live' }))
  const words = new Uint32Array(cells.buffer, cells.byteOffset, cells.length / 4)
  for (let i = 0; i < words.length; i += 3) expect(isPrintable(words[i]!) || words[i] === 0x2580 || words[i] === 0x2584).toBe(true)
})

// The cells' characters, row by row: each cell is three words, its
// character first.
const rowsOf = (frame: string, columns: number) => {
  const bytes = fromBase64(frame)
  const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
  const chars = [...words.filter((_, i) => i % 3 === 0)].map(code => String.fromCharCode(code)).join('')

  return [...Array(ROWS).keys()].map(row => chars.slice(row * columns, (row + 1) * columns))
}

test('the band draws the words and no figure, at any hour', () => {
  // A clear band with no weather paints nothing but its words: any half
  // block would be a pixel of a figure, a hat or a basket.
  for (const hour of [3, 8, 13, 20]) {
    const view = { columns: 80, ms: Date.UTC(2026, 9, 24, hour), t: 3, mode: 'live' as const, place: STOCKHOLM, isClear: true }
    expect(rowsOf(drawFrame(view), 80).join('')).not.toMatch(/[\u2580\u2584]/)
  }
})

test("the words reach the band's right edge", () => {
  const view = { columns: 80, ms: Date.UTC(2026, 9, 24, 12), t: 3, mode: 'live' as const, place: STOCKHOLM, isClear: true }
  const [first = ''] = rowsOf(drawFrame(view), 80)
  expect(first.trimEnd().length).toBeGreaterThanOrEqual(79)
})

test('a soft hyphen is no printable character', () => {
  expect(isPrintable(0xad)).toBe(false)
  expect(isPrintable(0xe5)).toBe(true)
})

test("in Ghostty the context window hangs on the keeper's line, each tab's own carried in its mark", () => {
  const text = (context: object | null) => skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, { context } as never), FYR)
  expect(text(null)).toContain('const int CONTEXT = 0;')
  expect(text({ fish: 7, state: 'idle' })).toContain('const int CONTEXT = 1;')
  // The shader's text is one for every tab: what is on its line is not in it.
  expect(text({ fish: 7, state: 'idle' })).toBe(text({ fish: 2, state: 'grill' }))
  expect(text({ fish: 7, state: 'idle' })).toBe(text({ fish: 8, state: 'catch' }))
  expect(tabMark({ fish: 7, state: 'idle' })).toEqual([0, 7, 1])
  expect(tabMark({ fish: 14, state: 'idle' })).toEqual([0, 10, 1])
  expect(tabMark({ fish: 3, state: 'grill' })).toEqual([1, 3, 1])
  expect(tabMark({ fish: 0, state: 'embers' })).toEqual([2, 0, 1])
  expect(tabMark({ fish: 7, state: 'catch' })).toEqual([3, 7, 1])
  expect(tabMark(null)).toEqual([0, 0, 1])
})

test("the keeper's catch reads the tab's mark, and the shader's tab test lets every state of it through", () => {
  const text = skyShader(shaderParams({ ms: Date.UTC(2026, 9, 24, 20), t: 0, place: STOCKHOLM, weather: null }, { context: { fish: 7, state: 'idle' } }), FYR)
  // The engine reads the mark; the keeper's catch only asks it.
  expect(CONTEXT_MARK).toContain('iPalette[16]')
  expect(text).toContain(CONTEXT_MARK)
  expect(text).toContain(FYR.glsl)
  expect(FYR.glsl).not.toContain('iPalette')
  expect(text).toContain('int fish = contextFish();')
  // Red's low bits up to 3, a tenth just filled, under the agents' count
  // (activity.test.tsx); 32 is no mark of ours.
  expect(MAIN).toContain('iPalette[16].r > 31.5 / 255.0')
  expect(Math.max(...(['idle', 'grill', 'embers', 'catch'] as const).map(state => tabMark({ fish: 10, state })[0]))).toBe(3)
})

test("activityOn keeps the band's own rules", () => {
  const at = (month: number, day: number, hour: number, minute = 0) => {
    const ms = swedish(2026, month, day, hour, minute)
    return activityOn(localTime(ms, swedishOffsetMs(ms)))
  }
  expect(at(10, 25, 4)).toBe('sleep')
  expect(activityOn(localTime(swedish(2027, 1, 1, 1), swedishOffsetMs(swedish(2027, 1, 1, 1))))).toBe('nightOwl')
  expect(at(12, 13, 5, 30)).toBe('earlyBird')
})
