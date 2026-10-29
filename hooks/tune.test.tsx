// The tune settings: their limits, what a settings file may say, how a
// saved tune and a saved pace keep each other, the parts of the day they
// follow, the colour they make of the sky, and the pane's keys and words.

import { expect, test } from 'claude-code/testing'

import { STOCKHOLM, sunAt } from './astro'
import { withSettings } from './ghostty'
import { luminance, mix, saturate } from './paint'
import { sceneAt } from './shader'
import { STOPS } from './sky'
import { activeTune, asSettings, barOf, clampTune, DEFAULT_TUNE, LIMITS, NEUTRAL, onTuneKey, PHASES, phaseWeights, PREVIEW_LIFE_MS, previewMoment, TUNE_ROWS, TUNE_WORDS, tuneAt, tunedColour, valueText } from './tune'
import type { PaneState, Phase, TuneSettings, TuneValues } from './tune'

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
  const settings = (until: number) => ({ pace: 'spar' as const, tune: saved, preview: { tune, phase: 'dusk' as Phase, until } })
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
const press = (keys: string[], from: PaneState = { phase: 'day', row: 'brightness', tune: OPENED, opened: OPENED }) =>
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
  const night = { phase: 'night' as Phase, row: 'brightness' as const, tune: OPENED, opened: OPENED }
  expect(press(['tab'], night).state.phase).toBe('dawn')
  expect(press(['['], { ...night, phase: 'dawn' }).state.phase).toBe('night')
  // Enter keeps, and what it kept is where u goes back to from then on.
  const kept = press(['left', 'return'])
  expect(kept.action).toBe('keep')
  expect(kept.state.opened.day.brightness).toBe(0.95)
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
  expect(TUNE_WORDS.hint).toBe('\u2191 \u2193 pick   \u2190 \u2192 move   tab phase   \u23ce keep   r reset   u undo   esc close')
})
