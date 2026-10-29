// The tune settings: four values for each part of the day, kept in the
// shared sky.json beside the pace and the theme. Brightness only lowers the
// sky from today's and shade only strengthens the rim, so the neutral values
// are today's sky. This file knows the limits and what a settings file may
// say; the shader, the sessions and the pane build on it.

import type { Pace } from './pace'

export type Phase = 'dawn' | 'day' | 'dusk' | 'night'
export const PHASES: readonly Phase[] = ['dawn', 'day', 'dusk', 'night']

export type TuneValues = { brightness: number; shade: number; colour: number; warmth: number }
export type TuneSettings = Record<Phase, TuneValues>

// Today's sky.
export const NEUTRAL: TuneValues = { brightness: 1, shade: 1, colour: 1, warmth: 0 }
export const DEFAULT_TUNE: TuneSettings = { dawn: NEUTRAL, day: NEUTRAL, dusk: NEUTRAL, night: NEUTRAL }

export const LIMITS: Record<keyof TuneValues, { min: number; max: number; step: number }> = {
  brightness: { min: 0.5, max: 1, step: 0.05 },
  shade: { min: 1, max: 1.5, step: 0.05 },
  colour: { min: 0.5, max: 1.3, step: 0.05 },
  warmth: { min: -1, max: 1, step: 0.25 }
}

export type Settings = {
  pace: Pace
  tune: TuneSettings
  preview: { tune: TuneSettings; phase: Phase; until: number } | null
}

const KEYS = Object.keys(LIMITS) as (keyof TuneValues)[]

// Values within the limits, on the step: a value that is no number is the
// neutral one, one out of range the nearest limit.
export function clampTune(values: Partial<Record<keyof TuneValues, unknown>>): TuneValues {
  const out = { ...NEUTRAL }
  for (const key of KEYS) {
    const value = values[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const { min, max, step } = LIMITS[key]
    const snapped = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step
    out[key] = Math.min(max, Math.max(min, Number(snapped.toFixed(4))))
  }

  return out
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// A tune of whatever shape: the phases and keys it lacks are neutral.
function tuneOf(value: unknown): TuneSettings {
  const given = isObject(value) ? value : {}

  return {
    dawn: clampTune(isObject(given.dawn) ? given.dawn : {}),
    day: clampTune(isObject(given.day) ? given.day : {}),
    dusk: clampTune(isObject(given.dusk) ? given.dusk : {}),
    night: clampTune(isObject(given.night) ? given.night : {})
  }
}

// The settings a file says, defaults for what it does not say plainly. A
// preview counts only whole: a tune, a known phase and a number to run until.
export function asSettings(text: string): Settings {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    value = null
  }
  const file = isObject(value) ? value : {}
  const p = file.preview
  const preview =
    isObject(p) && isObject(p.tune) && PHASES.includes(p.phase as Phase) && typeof p.until === 'number' && Number.isFinite(p.until)
      ? { tune: tuneOf(p.tune), phase: p.phase as Phase, until: p.until }
      : null

  return { pace: file.pace === 'full' ? 'full' : 'spar', tune: tuneOf(file.tune), preview }
}
