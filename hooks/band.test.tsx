// The band above the prompt: Clawd, his reactions and his things.

import { expect, test } from 'claude-code/testing'

import { localTime, STOCKHOLM, swedishOffsetMs } from './astro'
import { swedish } from './test-kit'
import { chaseAt, clawdRows, drawFrame, nextPassing, ROWS, skyGained, toolKind, workKind } from './clawd'
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

test('a soft hyphen is no printable character', () => {
  expect(isPrintable(0xad)).toBe(false)
  expect(isPrintable(0xe5)).toBe(true)
})

test("looking up, Clawd's eyes sit in the top row of his head", () => {
  expect(clawdRows('up', 'right-up', 'stand')[0]).toContain('K')
  expect(clawdRows('up', 'right-up', 'stand')[1]).not.toContain('K')
  expect(clawdRows('open', 'down', 'stand')[0]).not.toContain('K')
  expect(clawdRows('open', 'down', 'stand')[1]).toContain('K')
})

test('Clawd looks up when something new comes into the sky, once', () => {
  const view = { columns: 80, ms: Date.UTC(2026, 9, 24, 10), t: 3, mode: 'live' as const, place: STOCKHOLM }
  expect(drawFrame({ ...view, reaction: { kind: 'lookUp', age: 1 } })).not.toBe(drawFrame({ ...view, reaction: null }))
  expect(skyGained([], ['comet'])).toBe(true)
  expect(skyGained(['comet'], ['comet'])).toBe(false)
  expect(skyGained(['comet', 'iss'], ['comet'])).toBe(false)
  expect(skyGained(['comet'], ['comet', 'waiting'])).toBe(true)
})

test('Clawd reads while every open call reads, and works otherwise', () => {
  expect(toolKind('Read')).toBe('read')
  expect(toolKind('Grep')).toBe('read')
  expect(toolKind('Edit')).toBe('write')
  expect(toolKind('Bash')).toBe('write')
  expect(toolKind('Agent')).toBeNull()
  expect(workKind([])).toBe('working')
  expect(workKind(['read', 'read'])).toBe('reading')
  expect(workKind(['read', 'write'])).toBe('working')
  const view = { columns: 80, ms: Date.UTC(2026, 9, 24, 12), t: 3, mode: 'live' as const, place: STOCKHOLM }
  expect(drawFrame({ ...view, reaction: { kind: 'reading', age: 0 } })).not.toBe(drawFrame({ ...view, reaction: { kind: 'working', age: 0 } }))
})

test('the wastebasket fills with the context window, a ball at a time, and burns when compacted', () => {
  const view = { columns: 80, ms: Date.UTC(2026, 9, 24, 12), t: 3, mode: 'live' as const, place: STOCKHOLM }
  const none = drawFrame({ ...view, paper: null })
  expect(drawFrame({ ...view, paper: 0 })).toBe(none)
  const half = drawFrame({ ...view, paper: 50 })
  const full = drawFrame({ ...view, paper: 100 })
  expect(half).not.toBe(none)
  expect(full).not.toBe(half)
  expect(drawFrame({ ...view, paper: 50, reaction: { kind: 'toss', age: 0.4 } })).not.toBe(half)
  expect(drawFrame({ ...view, paper: 90, reaction: { kind: 'burn', age: 2 } })).not.toBe(drawFrame({ ...view, paper: 90 }))
  expect(drawFrame({ ...view, paper: 90, reaction: { kind: 'embers', age: 1 } })).not.toBe(drawFrame({ ...view, paper: 90 }))
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
  const view = { columns: 80, ms: Date.UTC(2026, 9, 24, 12), t: 3, mode: 'live' as const, place: STOCKHOLM, paper: 60 }
  // The band keeps no wastebasket of its own then.
  expect(drawFrame({ ...view, isContextInSky: true })).not.toBe(drawFrame(view))
  expect(drawFrame({ ...view, isContextInSky: true })).toBe(drawFrame({ ...view, paper: 10, isContextInSky: true }))
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

test("with the keeper's line in the sky Clawd looks round at the catch and smells the grill, and throws nothing", () => {
  // Over his coffee, his eyes on the room: at his screen he looks right anyway.
  const view = { columns: 80, ms: Date.UTC(2026, 9, 24, 8), t: 3, mode: 'live' as const, place: STOCKHOLM, paper: 60, isContextInSky: true }
  // The cells' characters: each cell is three words, its character first.
  const chars = (frame: string) => {
    const bytes = fromBase64(frame)
    const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)

    return [...words.filter((_, i) => i % 3 === 0)].map(code => String.fromCharCode(code)).join('')
  }
  const still = drawFrame(view)
  // A tenth filled: a look to the right for as long as the catch, the same
  // the whole while (no ball in the air); without the sky, a throw.
  const glance = drawFrame({ ...view, reaction: { kind: 'toss', age: 0.2 } })
  expect(glance).not.toBe(still)
  expect(drawFrame({ ...view, reaction: { kind: 'toss', age: 1.2 } })).toBe(glance)
  expect(drawFrame({ ...view, isContextInSky: false, reaction: { kind: 'toss', age: 0.2 } })).not.toBe(drawFrame({ ...view, isContextInSky: false, reaction: { kind: 'toss', age: 1.2 } }))
  // Compacting: two wisps drift in from the band's right edge; no match.
  const smells = [0.2, 0.9, 1.6].map(age => chars(drawFrame({ ...view, reaction: { kind: 'burn', age } })))
  for (const cells of smells) expect(cells.split('~').length - 1).toBe(2)
  expect(new Set(smells).size).toBe(3)
  expect(chars(drawFrame({ ...view, isContextInSky: false, reaction: { kind: 'burn', age: 0.9 } }))).not.toContain('~')
  expect(chars(still)).not.toContain('~')
})

test('a throw at the wastebasket stops a chase after his hat', () => {
  const windy = { temperature: 8, code: 3, cloudCover: 60, wind: 12 }
  const view = { columns: 80, ms: Date.UTC(2026, 9, 24, 12), mode: 'live' as const, place: STOCKHOLM, weather: windy, paper: 50 }
  // A moment he is off chasing it.
  const t = [...Array(400).keys()].map(i => i * 0.25).find(at => chaseAt(at) !== null)!
  expect(drawFrame({ ...view, t, reaction: { kind: 'toss', age: 0.4 } })).not.toBe(drawFrame({ ...view, t, reaction: null }))
})

test('a reaction under way is not cut short by looking up', () => {
  const cheer = { kind: 'cheer' as const, at: 1000 }
  expect(nextPassing(cheer, 2000, true)).toBe(cheer)
  expect(nextPassing(cheer, 5000, true)).toEqual({ kind: 'lookUp', at: 5000 })
  expect(nextPassing(null, 2000, true)).toEqual({ kind: 'lookUp', at: 2000 })
  expect(nextPassing(cheer, 2000, false)).toBe(cheer)
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
