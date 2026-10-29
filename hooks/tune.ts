// The tune settings: four values for each part of the day, kept in the
// shared sky.json beside the pace and the theme. Brightness only lowers the
// sky from today's and shade only strengthens the rim, so the neutral values
// are today's sky. This file knows the limits and what a settings file may
// say, how much of each part of the day a moment is, and the colour a tune
// makes of the sky; the shader, the sessions and the pane build on it.

import { clamp, luminance, mix, saturate, smoothstep } from './paint'
import type { Pace } from './pace'
import type { Scene } from './shader'

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

// How much of each part of the day a scene is. Day and night by the sun's
// height, night as the sky's own nightness (from -5° to -13°); what lies
// between is twilight, dawn before the day's middle and dusk after it, the
// middle being where the sun's or the moon's arc is half crossed. Each
// weight changes smoothly with the sun, so they sum to 1 at every moment
// and no part of the day jumps in at sunrise, sunset, noon or midnight.
export function phaseWeights(scene: Scene): Record<Phase, number> {
  const day = smoothstep(4, 12, scene.elevation)
  const night = smoothstep(-5, -13, scene.elevation)
  const twilight = Math.max(0, 1 - day - night)
  const half = smoothstep(0.35, 0.65, scene.progress)
  const evening = scene.isDay ? half : 1 - half

  return { dawn: twilight * (1 - evening), day, dusk: twilight * evening, night }
}

// The four values for a scene: each phase's own, weighted as the scene is
// made of them, and rounded to a hundredth so the shader's text changes
// only when a value does.
export function tuneAt(settings: TuneSettings, scene: Scene): TuneValues {
  const weights = phaseWeights(scene)
  const out = { ...NEUTRAL }
  for (const key of KEYS) {
    const sum = PHASES.reduce((total, phase) => total + weights[phase] * settings[phase][key], 0)
    out[key] = Math.round(sum * 100) / 100 || 0
  }

  return out
}

// The sky's saturation after its dimming, as the shader's SATURATION and
// the wallpaper have it.
export const SATURATION = 1.35

// What full warmth and full coolness multiply a colour by, before it is
// brought back to its own lightness.
const WARM = [1.08, 1.0, 0.86] as const
const COOL = [0.9, 0.98, 1.1] as const

// The sky's colour c (packed RGB, as paint.ts has it) tuned and toned: tinted
// warmer or cooler at its own lightness, then dimmed by k and the tune's
// brightness together and saturated by the tune's colour. Never lighter
// than today's tone of c: less saturation clips less of a bright horizon
// and would lighten it. The neutral tune is the sky's plain tone, to the
// bit.
export function tunedColour(c: number, k: number, values: TuneValues): number {
  const today = saturate(mix(0, c, k), SATURATION)
  if (values.brightness === 1 && values.colour === 1 && values.warmth === 0) return today
  let tinted = c
  if (values.warmth !== 0) {
    const tint = values.warmth > 0 ? WARM : COOL
    const w = Math.abs(values.warmth)
    const channels = [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff].map((v, i) => v * (1 + (tint[i]! - 1) * w))
    const own = luminance(c) * 255
    const now = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
    const [r, g, b] = channels.map(v => Math.round(clamp(now > 0 ? (v * own) / now : v, 0, 255)))
    tinted = (r! << 16) | (g! << 8) | b!
  }

  const tuned = saturate(mix(0, tinted, k * values.brightness), SATURATION * values.colour)
  const lightness = luminance(tuned)

  return lightness > luminance(today) ? mix(0, tuned, luminance(today) / lightness) : tuned
}
