// The tune settings: four values for each part of the day, kept in the
// shared sky.json beside the pace and the theme. Brightness only lowers the
// sky from today's and shade only strengthens the rim, so the neutral values
// are today's sky. This file knows the limits and what a settings file may
// say, how much of each part of the day a moment is, and the colour a tune
// makes of the sky; the shader, the sessions and the pane build on it. The
// pane's keys and words are here too, plain functions its surface module
// and the tests share.

import { sunAt } from './astro'
import type { Place } from './astro'
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

// How far ahead a preview's `until` may lie: the tuning session renews it
// every 20 s, so one further off is a dead session's or a clock gone wrong,
// and counts not at all. No preview outlives its last word by more than a
// minute, and every session, however lately started, judges it alike.
export const PREVIEW_LIFE_MS = 60_000

// The tune to draw now: the preview's, and the part of the day it shows,
// while its time lasts and lies at most PREVIEW_LIFE_MS ahead (and the
// second its write may take); the saved tune and no part of the day
// otherwise.
export function activeTune(settings: Settings, now: number): { tune: TuneSettings; phase: Phase | null } {
  const { preview } = settings
  if (preview !== null && now < preview.until && preview.until <= now + PREVIEW_LIFE_MS + 1_000) return { tune: preview.tune, phase: preview.phase }

  return { tune: settings.tune, phase: null }
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
// The sun's height at its rise and set, as dayArc counts them.
const HORIZON = -0.83

// The moment a preview shows its part of the day at: today's sunrise for
// dawn, the sun at its highest for day, sunset for dusk, and twelve hours
// after noon for night. Today is the place's solar day, from one midnight
// of its longitude to the next, so every moment of it gives the same four.
// Where the sun neither rises nor sets that day, now.
export function previewMoment(phase: Phase, now: number, place: Place): number {
  const elevation = (ms: number) => sunAt(ms, place.lat, place.lon).elevation
  const shift = (place.lon / 360) * DAY_MS
  const midnight = Math.floor((now + shift) / DAY_MS) * DAY_MS - shift
  // Noon within the half hour the equation of time moves it, to the second.
  let [from, to] = [midnight + 11.5 * HOUR_MS, midnight + 12.5 * HOUR_MS]
  while (to - from > 1_000) {
    const a = from + (to - from) / 3
    const b = to - (to - from) / 3
    if (elevation(a) < elevation(b)) from = a
    else to = b
  }
  const noon = Math.round((from + to) / 2)
  const before = noon - 12 * HOUR_MS
  const after = noon + 12 * HOUR_MS
  const high = elevation(noon)
  if (high <= HORIZON || elevation(before) >= HORIZON || elevation(after) >= HORIZON) return now
  // Where the sun crosses the horizon between a low and a high, to the second.
  const crossing = (low: number, top: number) => {
    let [a, b] = [low, top]
    while (Math.abs(b - a) > 1_000) {
      const middle = (a + b) / 2
      if (elevation(middle) < HORIZON) a = middle
      else b = middle
    }

    return Math.round((a + b) / 2)
  }
  if (phase === 'dawn') return crossing(before, noon)
  if (phase === 'dusk') return crossing(after, noon)

  return phase === 'day' ? noon : after
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

// The pane, /solar tune: its id, how often a session writes what it shows
// (at most, the last state winning), and how often it renews the preview
// while open, well within PREVIEW_LIFE_MS.
export const TUNE_PANE = 'solar-tune'
export const PREVIEW_MS = 250
export const RENEW_MS = 20_000

// What the pane says, in English as the rest of Solar.
export const TUNE_WORDS = {
  notGhostty: 'Solar: tune is for the sky in Ghostty on a Mac.',
  kept: 'kept',
  hint: '\u2191 \u2193 pick   \u2190 \u2192 move   tab phase   \u23ce keep   r reset   u undo   esc close',
}

// The pane's rows, top to bottom, and their labels.
export const TUNE_ROWS: readonly (keyof TuneValues)[] = ['brightness', 'shade', 'colour', 'warmth']
export const ROW_LABELS: Record<keyof TuneValues, string> = { brightness: 'brightness', shade: 'text shade', colour: 'colour', warmth: 'warmth' }

// The pane as the person has it: the part of the day and the row chosen,
// the tune they are making, and the one it started from (the saved tune as
// the pane opened, or as last kept).
export type PaneState = { phase: Phase; row: keyof TuneValues; tune: TuneSettings; opened: TuneSettings }
export type TuneAction = 'none' | 'preview' | 'keep'

const around = <T>(list: readonly T[], item: T, by: number): T => list[(list.indexOf(item) + by + list.length) % list.length]!

// One key pressed in the pane: up and down pick a row, left and right move
// its value a step within its limits, tab and ] go to the next part of the
// day and [ to the one before, r puts the row back to its default, u the
// whole tune back to where the pane started, and Enter keeps it. A key that
// changes what the sky should show asks for a preview.
export function onTuneKey(state: PaneState, key: string): { state: PaneState; action: TuneAction } {
  const { phase, row, tune } = state
  const set = (value: number) => {
    const values = clampTune({ ...tune[phase], [row]: value })
    return values[row] === tune[phase][row] ? { state, action: 'none' as const } : { state: { ...state, tune: { ...tune, [phase]: values } }, action: 'preview' as const }
  }
  if (key === 'up' || key === 'down') return { state: { ...state, row: around(TUNE_ROWS, row, key === 'up' ? -1 : 1) }, action: 'none' }
  if (key === 'left' || key === 'right') return set(tune[phase][row] + (key === 'left' ? -1 : 1) * LIMITS[row].step)
  if (key === 'tab' || key === ']' || key === '[') return { state: { ...state, phase: around(PHASES, phase, key === '[' ? -1 : 1) }, action: 'preview' }
  if (key === 'r') return set(DEFAULT_TUNE[phase][row])
  if (key === 'u') return { state: { ...state, tune: state.opened }, action: 'preview' }
  if (key === 'return') return { state: { ...state, opened: tune }, action: 'keep' }

  return { state, action: 'none' }
}

// A value as the pane shows it: brightness as a percent, the others as
// normal at today's value and otherwise the steps away from it, signed.
export function valueText(key: keyof TuneValues, value: number): string {
  if (key === 'brightness') return `${Math.round(value * 100)} %`
  const steps = Math.round((value - NEUTRAL[key]) / LIMITS[key].step)
  if (steps === 0) return 'normal'

  return steps > 0 ? `+${steps}` : `\u2212${-steps}`
}

// A row's bar, BAR cells wide: filled up to the knob, empty after it.
export const BAR = 20
export function barOf(key: keyof TuneValues, value: number): string {
  const { min, max } = LIMITS[key]
  const at = Math.round(((value - min) / (max - min)) * (BAR - 1))

  return '\u2593'.repeat(at) + '\u25cf' + '\u2591'.repeat(BAR - 1 - at)
}
