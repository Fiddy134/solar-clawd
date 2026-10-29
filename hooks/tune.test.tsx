// The tune settings: their limits, what a settings file may say, how a
// saved tune and a saved pace keep each other, the parts of the day they
// follow, and the colour they make of the sky.

import { expect, test } from 'claude-code/testing'

import { STOCKHOLM, sunAt } from './astro'
import { withSettings } from './ghostty'
import { luminance, mix, saturate } from './paint'
import { sceneAt } from './shader'
import { STOPS } from './sky'
import { activeTune, asSettings, clampTune, DEFAULT_TUNE, LIMITS, NEUTRAL, PHASES, phaseWeights, PREVIEW_LIFE_MS, previewMoment, tuneAt, tunedColour } from './tune'
import type { Phase, TuneSettings, TuneValues } from './tune'

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

test('a preview counts until its time, and a minute after this session first read it at most', () => {
  const saved = { ...DEFAULT_TUNE, day: { ...NEUTRAL, brightness: 0.7 } }
  const tune = { ...DEFAULT_TUNE, dusk: { ...NEUTRAL, warmth: 0.5 } }
  const settings = { pace: 'spar' as const, tune: saved, preview: { tune, phase: 'dusk' as Phase, until: 100_000 } }
  expect(activeTune(settings, 50_000, 40_000)).toEqual({ tune, phase: 'dusk' })
  expect(activeTune(settings, 100_000, 40_000)).toEqual({ tune: saved, phase: null })
  expect(activeTune(settings, 50_000, 50_000 - PREVIEW_LIFE_MS)).toEqual({ tune: saved, phase: null })
  expect(activeTune(settings, 50_000, null)).toEqual({ tune, phase: 'dusk' })
  expect(activeTune({ ...settings, preview: null }, 50_000, 40_000)).toEqual({ tune: saved, phase: null })
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
