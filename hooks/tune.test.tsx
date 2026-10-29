// The tune settings: their limits, what a settings file may say, and how a
// saved tune and a saved pace keep each other.

import { expect, test } from 'claude-code/testing'

import { withSettings } from './ghostty'
import { asSettings, clampTune, DEFAULT_TUNE } from './tune'
import type { TuneSettings } from './tune'

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
