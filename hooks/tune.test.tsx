// The tune settings: their limits, what a settings file may say, how a
// saved tune and a saved pace keep each other, the parts of the day they
// follow, the colour they make of the sky, and the pane's keys and words.

import { expect, test } from 'claude-code/testing'

import { STOCKHOLM, sunAt } from './astro'
import { withSettings } from './ghostty'
import { luminance, mix, saturate } from './paint'
import { sceneAt } from './shader'
import { STOPS } from './sky'
import {
  activeTune,
  asSettings,
  barOf,
  clampTune,
  DEFAULT_TEXT,
  DEFAULT_TUNE,
  fontsOf,
  LIMITS,
  NEUTRAL,
  onPaneKey,
  onTuneKey,
  ownTextOf,
  tabOf,
  PHASES,
  phaseWeights,
  PREVIEW_LIFE_MS,
  previewMoment,
  TEXT_LIMITS,
  TEXT_ROWS,
  TEXT_WORDS,
  textLines,
  textValueText,
  TUNE_ROWS,
  TUNE_WORDS,
  tuneAt,
  tunedColour,
  valueText,
} from './tune'
import type { OwnText, PaneLocal, PaneState, Phase, TextValues, TuneSettings, TuneValues } from './tune'

test('settings from an older Solar, broken or out of range give defaults and limits', () => {
  const old = asSettings('{"pace":"full"}')
  expect(old.pace).toBe('full')
  expect(old.tune).toEqual(DEFAULT_TUNE)
  expect(old.preview).toBeNull()
  const broken = asSettings('{"pace":"ful')
  expect(broken.pace).toBe('spar')
  expect(broken.tune).toEqual(DEFAULT_TUNE)
  expect(asSettings('{"tune":{"day":{"brightness":0.1,"shade":"x","warmth":7}}}').tune.day).toEqual({
    brightness: 0.5,
    shade: 1,
    colour: 1,
    warmth: 1
  })
  expect(clampTune({ brightness: 0.73 }).brightness).toBe(0.75)
  for (const text of ['', 'null', '[]', '"x"', '{"tune":5}', '{"preview":{"tune":{},"phase":"noon","until":1}}']) {
    expect(asSettings(text).preview).toBeNull()
  }
  const good = asSettings('{"preview":{"tune":{"dusk":{"colour":0.8}},"phase":"dusk","until":5}}').preview
  expect(good?.phase).toBe('dusk')
  expect(good?.until).toBe(5)
  expect(good?.tune.dusk.colour).toBe(0.8)
  expect(good?.tune.dawn).toEqual(DEFAULT_TUNE.dawn)
  // A gap draft counts only as true itself.
  expect([asSettings('{"isGapDrafted":true}'), asSettings('{"isGapDrafted":"yes"}'), old].map(settings => settings.isGapDrafted)).toEqual([true, false, false])
})

test('a tune saved keeps the pace and the pace kept keeps the tune', () => {
  const T: TuneSettings = { ...DEFAULT_TUNE, day: { ...DEFAULT_TUNE.day, brightness: 0.8 } }
  const saved = asSettings(withSettings(withSettings('{"pace":"full"}', { tune: T }), { pace: 'spar' }))
  expect(saved.pace).toBe('spar')
  expect(saved.tune).toEqual(T)
  expect(JSON.parse(withSettings('{"other":1}', { pace: 'full' }))).toEqual({ other: 1, pace: 'full' })
})

// A scene as sceneAt gives one: the sun's height, its way along the arc,
// and whether it is the sun's arc or the moon's.
const scene = (elevation: number, isDay: boolean, progress: number) => ({ elevation, isDay, progress })

test('the phases follow the sun and blend without a jump', () => {
  expect(phaseWeights(scene(30, true, 0.5)).day).toBe(1)
  expect(phaseWeights(scene(-20, false, 0.5)).night).toBe(1)
  expect(phaseWeights(scene(-2, false, 0.9)).dawn).toBe(1)
  expect(phaseWeights(scene(-2, false, 0.1)).dusk).toBe(1)
  // A whole Stockholm day, minute by minute, in autumn and at midwinter,
  // when the sun stays below 12° at noon.
  for (const day of [Date.UTC(2026, 9, 23, 22), Date.UTC(2026, 11, 20, 23)]) {
    let before: Record<Phase, number> | null = null
    for (let minute = 0; minute <= 24 * 60; minute++) {
      const weights = phaseWeights(sceneAt(day + minute * 60_000, STOCKHOLM))
      expect(Math.abs(PHASES.reduce((sum, phase) => sum + weights[phase], 0) - 1)).toBeLessThan(1e-9)
      // Day and night each come in over 8° of the sun's height, and the
      // scene has it to a tenth of a degree, so a minute may move a weight
      // by up to 0.04: over brightness's range of 0.5, under 0.02 of
      // brightness a minute. A jump would be most of 1.
      if (before) for (const phase of PHASES) expect(Math.abs(weights[phase] - before[phase])).toBeLessThanOrEqual(0.04)
      before = weights
    }
  }
})

test('a phase tuned leaves the others as they were', () => {
  const settings: TuneSettings = { ...DEFAULT_TUNE, day: { ...NEUTRAL, brightness: 0.7 } }
  expect(tuneAt(settings, scene(30, true, 0.5)).brightness).toBe(0.7)
  expect(tuneAt(settings, scene(-20, false, 0.5)).brightness).toBe(1)
})

// Every stop colour of the sky's gradient: top, middle and horizon.
const STOP_COLOURS = STOPS.flatMap(([, top, middle, horizon]) => [top, middle, horizon])

test('no setting makes the sky lighter than today', () => {
  const corners: TuneValues[] = []
  for (const brightness of [LIMITS.brightness.min, LIMITS.brightness.max])
    for (const shade of [LIMITS.shade.min, LIMITS.shade.max])
      for (const colour of [LIMITS.colour.min, LIMITS.colour.max])
        for (const warmth of [LIMITS.warmth.min, LIMITS.warmth.max]) corners.push({ brightness, shade, colour, warmth })
  expect(corners.length).toBe(16)
  for (const c of STOP_COLOURS)
    for (const k of [1, 0.85])
      for (const values of corners) {
        expect(luminance(tunedColour(c, k, values))).toBeLessThanOrEqual(luminance(tunedColour(c, k, NEUTRAL)) + 0.005)
      }
})

test("today's settings draw today's sky", () => {
  for (const c of STOP_COLOURS)
    for (const k of [1, 0.85]) expect(tunedColour(c, k, NEUTRAL)).toBe(saturate(mix(0, c, k), 1.35))
})

test('a preview counts until its time, and only a time at most a minute ahead', () => {
  const saved = { ...DEFAULT_TUNE, day: { ...NEUTRAL, brightness: 0.7 } }
  const tune = { ...DEFAULT_TUNE, dusk: { ...NEUTRAL, warmth: 0.5 } }
  const settings = (until: number) => ({ pace: 'spar' as const, tune: saved, preview: { tune, phase: 'dusk' as Phase, until }, text: DEFAULT_TEXT, textDraftUntil: null, isGapDrafted: false })
  expect(activeTune(settings(100_000), 50_000)).toEqual({ tune, phase: 'dusk' })
  expect(activeTune(settings(100_000), 100_000)).toEqual({ tune: saved, phase: null })
  // A minute ahead and the second its write took count; anything further is
  // a dead session's or a clock gone wrong, and counts not at all.
  expect(activeTune(settings(50_000 + PREVIEW_LIFE_MS + 1_000), 50_000)).toEqual({ tune, phase: 'dusk' })
  expect(activeTune(settings(50_000 + PREVIEW_LIFE_MS + 1_001), 50_000)).toEqual({ tune: saved, phase: null })
  expect(activeTune(settings(50_000 + 3_600_000), 50_000)).toEqual({ tune: saved, phase: null })
  expect(activeTune({ ...settings(100_000), preview: null }, 50_000)).toEqual({ tune: saved, phase: null })
})

test("a preview's moment is today's sunrise, noon, sunset or midnight, and now where the sun neither rises nor sets", () => {
  const now = Date.UTC(2026, 9, 21, 7, 0)
  const at = (phase: Phase) => previewMoment(phase, now, STOCKHOLM)
  const sun = (ms: number) => sunAt(ms, STOCKHOLM.lat, STOCKHOLM.lon).elevation
  // Sunrise and sunset where dayArc counts them, within a minute.
  expect(Math.abs(sun(at('dawn')) + 0.83)).toBeLessThan(0.2)
  expect(sun(at('dawn') + 600_000)).toBeGreaterThan(sun(at('dawn')))
  expect(Math.abs(sun(at('dusk')) + 0.83)).toBeLessThan(0.2)
  expect(sun(at('dusk') + 600_000)).toBeLessThan(sun(at('dusk')))
  // The sun at its highest at noon, its lowest twelve hours on.
  expect(sun(at('day'))).toBeGreaterThan(sun(at('day') - 600_000))
  expect(sun(at('day'))).toBeGreaterThan(sun(at('day') + 600_000))
  expect(sun(at('night'))).toBeLessThan(-30)
  expect(at('night') - at('day')).toBe(12 * 3_600_000)
  expect(at('dawn')).toBeLessThan(at('day'))
  expect(at('day')).toBeLessThan(at('dusk'))
  // The whole day gives one moment for each phase.
  expect(previewMoment('dawn', now + 3 * 3_600_000, STOCKHOLM)).toBe(at('dawn'))
  // Svalbard in December and in June.
  const svalbard = { name: 'Longyearbyen', lat: 78.22, lon: 15.65 }
  for (const ms of [Date.UTC(2026, 11, 21, 12), Date.UTC(2026, 5, 21, 12)]) {
    for (const phase of PHASES) expect(previewMoment(phase, ms, svalbard)).toBe(ms)
  }
})

// The pane opened on the day with brightness chosen, the saved tune as it
// opened; keys pressed in turn.
const OPENED: TuneSettings = { ...DEFAULT_TUNE, dusk: { ...NEUTRAL, warmth: 0.5 } }
// The text tab as the pane opened it: nothing touched.
const TEXT_TAB = { isOnText: false, textRow: 'size' as const, text: DEFAULT_TEXT, textOpened: DEFAULT_TEXT }
const press = (keys: string[], from: PaneState = { phase: 'day', row: 'brightness', tune: OPENED, opened: OPENED, ...TEXT_TAB }) =>
  keys.reduce<{ state: PaneState; action: string }>(({ state }, key) => onTuneKey(state, key), { state: from, action: 'none' })

test('keys move, clamp, reset, undo and keep', () => {
  // Right at today's brightness stays there: it only lowers the sky.
  expect(press(['right']).state.tune.day.brightness).toBe(1)
  const left = press(['left'])
  expect(left.state.tune.day.brightness).toBe(0.95)
  expect(left.action).toBe('preview')
  expect(left.state.tune.dusk).toEqual(OPENED.dusk)
  // Far down it stops at the limit.
  expect(press(Array(20).fill('left')).state.tune.day.brightness).toBe(LIMITS.brightness.min)
  // r puts the chosen row back to the default.
  expect(press(['left', 'left', 'r']).state.tune.day.brightness).toBe(DEFAULT_TUNE.day.brightness)
  // The rows, wrapping; each moves by its own step.
  expect(press(['down']).state.row).toBe('shade')
  expect(press(['up']).state.row).toBe('warmth')
  expect(press(['down', 'down', 'down', 'down']).state.row).toBe('brightness')
  expect(press(['down', 'right']).state.tune.day.shade).toBe(1.05)
  expect(press(['up', 'left']).state.tune.day.warmth).toBe(-0.25)
  // u takes every phase back to how the pane opened.
  const moved = press(['left', 'tab', 'down', 'right', 'tab', 'up', 'left'])
  expect(moved.state.tune).not.toEqual(OPENED)
  expect(onTuneKey(moved.state, 'u').state.tune).toEqual(OPENED)
  expect(onTuneKey(moved.state, 'u').action).toBe('preview')
  // The phases, both ways and wrapping.
  expect(press(['tab']).state.phase).toBe('dusk')
  expect(press([']']).state.phase).toBe('dusk')
  expect(press(['[']).state.phase).toBe('dawn')
  expect(press(['tab']).action).toBe('preview')
  // After night comes the text tab, which leaves the sky on the part of
  // the day it showed, and then dawn again.
  const night = { phase: 'night' as Phase, row: 'brightness' as const, tune: OPENED, opened: OPENED, ...TEXT_TAB }
  expect(press(['tab'], night).state).toMatchObject({ phase: 'night', isOnText: true })
  expect(press(['tab'], night).action).toBe('none')
  expect(press(['tab', 'tab'], night).state).toMatchObject({ phase: 'dawn', isOnText: false })
  expect(press(['tab', 'tab'], night).action).toBe('preview')
  expect(press(['['], { ...night, phase: 'dawn' }).state).toMatchObject({ phase: 'dawn', isOnText: true })
  expect(press(['[', '['], { ...night, phase: 'dawn' }).state).toMatchObject({ phase: 'night', isOnText: false })
  // Enter keeps; u still goes back to the tune the pane opened with, and
  // Enter again would keep that.
  const kept = press(['left', 'return'])
  expect(kept.action).toBe('keep')
  expect(kept.state.tune.day.brightness).toBe(0.95)
  expect(kept.state.opened).toEqual(OPENED)
  const undone = press(['left', 'return', 'u', 'return'])
  expect(undone.action).toBe('keep')
  expect(undone.state.tune).toEqual(OPENED)
  // s keeps as Enter does, should the band not hand Enter on.
  expect(press(['left', 's']).action).toBe('keep')
  // q closes, from any tab, and changes nothing.
  expect(press(['left', 'q'])).toEqual({ state: press(['left']).state, action: 'close' })
  expect(press(['tab', 'q'], night)).toEqual({ state: press(['tab'], night).state, action: 'close' })
  // The digits go straight to a tab: a part of the day previews, the text
  // tab leaves the sky as it was, and the tab already shown does nothing.
  expect(press(['3'])).toMatchObject({ state: { phase: 'dusk', isOnText: false }, action: 'preview' })
  expect(press(['5'])).toMatchObject({ state: { phase: 'day', isOnText: true }, action: 'none' })
  expect(press(['2'])).toEqual({ state: press([]).state, action: 'none' })
  expect(press(['5', '1'])).toMatchObject({ state: { phase: 'dawn', isOnText: false }, action: 'preview' })
  expect(press(['5', '2'])).toMatchObject({ state: { phase: 'day', isOnText: false }, action: 'preview' })
  expect([press([]).state, press(['5']).state, press(['4']).state].map(tabOf)).toEqual(['day', 'text', 'night'])
  // Anything else does nothing.
  expect(press(['x'])).toEqual({ state: press([]).state, action: 'none' })
})

test('the pane shows each value as the mock-up does, and no number in it reads as a meme', () => {
  expect(valueText('brightness', 0.85)).toBe('85 %')
  expect(valueText('shade', 1)).toBe('normal')
  expect(valueText('shade', 1.1)).toBe('+2')
  expect(valueText('colour', 0.95)).toBe('\u22121')
  expect(valueText('warmth', 0)).toBe('normal')
  expect(valueText('warmth', -1)).toBe('\u22124')
  expect(barOf('brightness', 0.85)).toBe('\u2593'.repeat(13) + '\u25cf' + '\u2591'.repeat(6))
  expect(barOf('brightness', 1)).toBe('\u2593'.repeat(19) + '\u25cf')
  expect(barOf('brightness', 0.5)).toBe('\u25cf' + '\u2591'.repeat(19))
  expect(TUNE_ROWS).toEqual(['brightness', 'shade', 'colour', 'warmth'])
  // Every value each row can take, on its steps.
  for (const key of TUNE_ROWS) {
    const { min, max, step } = LIMITS[key]
    for (let i = 0; min + i * step <= max + 1e-9; i++) {
      const shown = valueText(key, clampTune({ [key]: min + i * step })[key])
      for (const meme of ['67', '42', '69', '420']) expect(shown.includes(meme)).toBe(false)
    }
  }
  expect(TUNE_WORDS.notGhostty).toBe('Solar: tune is for the sky in Ghostty on a Mac.')
  expect(TUNE_WORDS.kept).toBe('kept')
  expect(TUNE_WORDS.hint).toBe('click   \u2191\u2193 pick   \u2190\u2192 move   tab phase   \u23ce keep   r reset   u undo   q close')
  expect(TUNE_WORDS.closed).toBe('Solar: tune closed.')
})

test('each key starts from the last, and a keep travels in every post after it', () => {
  const start: PaneLocal = { pane: { phase: 'day', row: 'brightness', tune: OPENED, opened: OPENED, ...TEXT_TAB }, keeps: 0, keptTune: null, keptText: null, isKeptLast: false }
  const keys = (list: string[]) => list.reduce(({ local }, key) => onPaneKey(local, key), { local: start, post: null as ReturnType<typeof onPaneKey>['post'] })
  // Two lefts in a row are two steps.
  expect(keys(['left', 'left']).local.pane.tune.day.brightness).toBe(0.9)
  // A key that changes nothing the sky shows posts nothing.
  expect(keys(['down']).post).toBeNull()
  expect(keys(['left', 'down']).local.pane.row).toBe('shade')
  // Enter counts a keep and carries what it kept; a move after it, posted
  // in the same frame in its place, still carries the keep.
  const kept = keys(['left', 'return'])
  expect(kept.post).toEqual({ state: kept.local.pane, action: 'keep', keeps: 1, keptTune: kept.local.pane.tune, keptText: DEFAULT_TEXT })
  expect(kept.local.isKeptLast).toBe(true)
  const after = keys(['left', 'return', 'left'])
  expect(after.post).toMatchObject({ action: 'preview', keeps: 1, keptTune: kept.local.pane.tune })
  expect(after.post?.state.tune.day.brightness).toBe(0.9)
  expect(after.local.isKeptLast).toBe(false)
  // q posts a close, the keeps made so far with it.
  expect(keys(['left', 'return', 'q']).post).toMatchObject({ action: 'close', keeps: 1, keptTune: kept.local.pane.tune })
})

test('text values clamp, snap and stay untouched as null', () => {
  // An older sky.json says nothing of the text: every row untouched, no gap.
  expect(asSettings('{"pace":"full"}').text).toEqual({ size: null, weight: null, lineHeight: null, font: null, faint: null, gap: 0 })
  expect(DEFAULT_TEXT).toEqual({ size: null, weight: null, lineHeight: null, font: null, faint: null, gap: 0 })
  expect(asSettings('{"text":{"size":40}}').text.size).toBe(28)
  expect(asSettings('{"text":{"lineHeight":-5}}').text.lineHeight).toBe(0)
  // A font the list does not know is kept as the text it is.
  expect(asSettings('{"text":{"font":"Iosevka"}}').text.font).toBe('Iosevka')
  const text = asSettings('{"text":{"size":14.3,"weight":100,"faint":0.73,"gap":13,"lineHeight":12}}').text
  expect(text).toEqual({ size: 14.5, weight: 96, lineHeight: 10, font: null, faint: 0.7, gap: 16 })
  // The top of a range is reachable even off its steps; nothing goes past it.
  expect(asSettings('{"text":{"weight":255}}').text.weight).toBe(255)
  expect(asSettings('{"text":{"weight":250}}').text.weight).toBe(255)
  expect(asSettings('{"text":{"faint":0.2,"gap":500}}').text).toMatchObject({ faint: 0.5, gap: 120 })
  // What is no number, or no font name that fits on one line, is untouched.
  for (const value of ['"x"', 'null', 'true', '[]']) expect(asSettings(`{"text":{"size":${value}}}`).text).toEqual(DEFAULT_TEXT)
  for (const value of ['5', 'null', 'true', '[]']) expect(asSettings(`{"text":{"font":${value}}}`).text).toEqual(DEFAULT_TEXT)
  expect(asSettings('{"text":{"font":"   "}}').text.font).toBeNull()
  expect(asSettings('{"text":{"font":"Menlo\\nfont-size = 99"}}').text.font).toBeNull()
  expect(asSettings('{"text":{"gap":null}}').text.gap).toBe(0)
  expect(asSettings('{"text":5}').text).toEqual(DEFAULT_TEXT)
})

test('textLines writes only what was touched, the font list cleared first', () => {
  expect(textLines(DEFAULT_TEXT)).toEqual([])
  expect(textLines({ ...DEFAULT_TEXT, font: 'Iosevka' })).toEqual(['font-family = ""', 'font-family = Iosevka'])
  // The gap is the padding line's, never the include's.
  expect(textLines({ ...DEFAULT_TEXT, gap: 16 })).toEqual([])
  expect(textLines({ size: 14.5, weight: 128, lineHeight: 10, font: 'JetBrains Mono', faint: 0.8, gap: 16 })).toEqual([
    'font-size = 14.5',
    'font-thicken = true',
    'font-thicken-strength = 128',
    'adjust-cell-height = 10%',
    'font-family = ""',
    'font-family = JetBrains Mono',
    'faint-opacity = 0.8',
  ])
  // A weight of 0 still thickens, at its least.
  expect(textLines({ ...DEFAULT_TEXT, weight: 0 })).toEqual(['font-thicken = true', 'font-thicken-strength = 0'])
})

// Ghostty's +show-config as it prints the text keys, and +list-fonts.
const SHOW_CONFIG = 'font-family = \nfont-size = 13\nfont-thicken = false\nfont-thicken-strength = 255\nadjust-cell-height = \nwindow-padding-x = 2,240\nfaint-opacity = 1\n'
const LIST_FONTS = 'Andale Mono\n  Andale Mono\n\nMenlo\n  Menlo Bold\n  Menlo Regular\n\nPT Mono\n  PT Mono\n  PT Mono Bold\n'

test("the person's own text comes from Ghostty's +show-config, and the fonts from +list-fonts", () => {
  expect(fontsOf(LIST_FONTS)).toEqual(['Andale Mono', 'Menlo', 'PT Mono'])
  expect(fontsOf('')).toEqual([])
  expect(ownTextOf(SHOW_CONFIG, DEFAULT_TEXT)).toEqual({ size: 13, weight: 'off', lineHeight: 0, font: '', faint: 1 })
  const theirs = 'font-family = Iosevka\nfont-family = Symbols Nerd Font\nfont-size = 15\nfont-thicken = true\nfont-thicken-strength = 200\nadjust-cell-height = 12%\nfaint-opacity = 0.5\n'
  expect(ownTextOf(theirs, DEFAULT_TEXT)).toEqual({ size: 15, weight: 200, lineHeight: 12, font: 'Iosevka', faint: 0.5 })
  // A line height in pixels, or a key it does not print, is not known.
  expect(ownTextOf('adjust-cell-height = 2\n', DEFAULT_TEXT)).toEqual({ size: null, weight: null, lineHeight: null, font: null, faint: null })
  // Where the mod's own include sets a row, +show-config says the mod's
  // value, not the person's: theirs is not known.
  expect(ownTextOf(theirs, { ...DEFAULT_TEXT, size: 14.5, font: 'Menlo' })).toMatchObject({ size: null, font: null, weight: 200 })
})

test('the text tab moves its rows, the font through the list, r leaves a row untouched and u goes back to how the pane opened', () => {
  const own: OwnText = { size: 13, weight: 'off', lineHeight: 0, font: '', faint: 0.5 }
  const world = { own, fonts: ['Andale Mono', 'Menlo', 'PT Mono'] }
  const opened: TextValues = { ...DEFAULT_TEXT, faint: 0.8 }
  const at: PaneState = { phase: 'day', row: 'brightness', tune: OPENED, opened: OPENED, isOnText: true, textRow: 'size', text: opened, textOpened: opened }
  const keys = (list: string[], from = at) =>
    list.reduce<{ state: PaneState; action: string }>(({ state }, key) => onTuneKey(state, key, world), { state: from, action: 'none' })
  // Size from the person's own 13, half a point a step; the sky's tune untouched.
  expect(keys(['right']).state.text.size).toBe(13.5)
  expect(keys(['right']).action).toBe('text')
  expect(keys(['right']).state.tune).toEqual(OPENED)
  expect(keys(['left', 'left']).state.text.size).toBe(12)
  expect(keys(Array(60).fill('left')).state.text.size).toBe(TEXT_LIMITS.size.min)
  // The rows, wrapping.
  expect(keys(['down']).state.textRow).toBe('weight')
  expect(keys(['up']).state.textRow).toBe('gap')
  expect(TEXT_ROWS).toEqual(['size', 'weight', 'lineHeight', 'font', 'faint', 'gap'])
  // Weight from off: right thickens at the least, left leaves it off.
  expect(keys(['down', 'right']).state.text.weight).toBe(0)
  expect(keys(['down', 'right', 'right']).state.text.weight).toBe(32)
  expect(keys(['down', 'left'])).toMatchObject({ action: 'none' })
  expect(keys(['down', 'left']).state.text.weight).toBeNull()
  expect(keys(['down', ...Array(12).fill('right')]).state.text.weight).toBe(255)
  // Line height and faint text only go up from today's.
  expect(keys(['down', 'down', 'left']).state.text.lineHeight).toBe(0)
  expect(keys(['down', 'down', 'right']).state.text.lineHeight).toBe(5)
  expect(keys(['up', 'up', 'right']).state.text.faint).toBe(0.9)
  expect(keys(['up', 'up', 'left', 'left', 'left', 'left']).state.text.faint).toBe(0.5)
  // The font: from the built-in one into the list, round it both ways.
  expect(keys(['down', 'down', 'down', 'right']).state.text.font).toBe('Andale Mono')
  expect(keys(['down', 'down', 'down', 'left']).state.text.font).toBe('PT Mono')
  expect(keys(['down', 'down', 'down', 'right', 'right', 'right', 'right']).state.text.font).toBe('Andale Mono')
  expect(onTuneKey({ ...at, textRow: 'font' }, 'right', { ...world, fonts: [] }).action).toBe('none')
  // The gap in steps of eight points.
  expect(keys(['up', 'right', 'right']).state.text.gap).toBe(16)
  // r leaves the row untouched again; the gap back at none.
  expect(keys(['right', 'r']).state.text.size).toBeNull()
  expect(keys(['up', 'right', 'r']).state.text.gap).toBe(0)
  expect(keys(['up', 'up', 'r']).state.text.faint).toBeNull()
  // u takes every row back to how the pane opened, the sky's tune as it is.
  const moved = keys(['right', 'down', 'right', 'up', 'up', 'r', 'tab', 'left', 'tab', 'tab', 'tab', 'tab'])
  expect(moved.state.isOnText).toBe(true)
  expect(moved.state.text).not.toEqual(opened)
  const undone = onTuneKey(moved.state, 'u', world)
  expect(undone).toMatchObject({ action: 'text', state: { text: opened } })
  expect(undone.state.tune).toEqual(moved.state.tune)
  expect(undone.state.tune).not.toEqual(OPENED)
  // Enter keeps from the text tab too.
  expect(keys(['right', 'return']).action).toBe('keep')
})

test('the text tab shows each value, and no value a row can reach reads as a meme', () => {
  expect(textValueText('size', 14.5)).toBe('14.5 pt')
  expect(textValueText('size', 13)).toBe('13 pt')
  expect(textValueText('weight', 128)).toBe('128')
  expect(textValueText('weight', 'off')).toBe(TEXT_WORDS.off)
  expect(textValueText('lineHeight', 0)).toBe('0 %')
  expect(textValueText('lineHeight', 10)).toBe('+10 %')
  expect(textValueText('font', 'Menlo')).toBe('Menlo')
  expect(textValueText('font', '')).toBe(TEXT_WORDS.builtIn)
  expect(textValueText('faint', 0.8)).toBe('0.8')
  expect(textValueText('faint', 1)).toBe('1.0')
  expect(textValueText('gap', 16)).toBe('16 pt')
  expect(TEXT_WORDS.own).toBe('own')
  expect(TEXT_WORDS.newWindows).toBe('new windows')
  // Every value each numeric row can take, on its steps, and its top.
  const seen: Record<string, string[]> = {}
  for (const row of ['size', 'weight', 'lineHeight', 'faint', 'gap'] as const) {
    const { min, max, step } = TEXT_LIMITS[row]
    const values = new Set<number>()
    for (let i = 0; min + i * step <= max + step; i++) {
      const value = asSettings(JSON.stringify({ text: { [row]: min + i * step } })).text[row]
      if (typeof value === 'number') values.add(value)
    }
    seen[row] = [...values].map(value => textValueText(row, value))
    for (const shown of seen[row]!) for (const meme of ['67', '42', '69', '420']) expect(shown.includes(meme)).toBe(false)
  }
  expect(seen.weight).toEqual(['0', '32', '64', '96', '128', '160', '192', '224', '255'])
  expect(seen.gap).toContain('64 pt')
  expect(seen.gap).toContain('72 pt')
  expect(seen.size).toHaveLength(41)
  expect(seen.faint).toEqual(['0.5', '0.6', '0.7', '0.8', '0.9', '1.0'])
})
