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
import type { Forced } from './events'
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

// Ghostty's own text settings, one set for every hour and every theme, in
// an include of the mod's beside the sky's. A null is a row the person has
// not touched: their own config decides, and no line is written for it.
// The gap is points added to the mod's own padding line, 0 by default.
export type TextValues = { size: number | null; weight: number | null; lineHeight: number | null; font: string | null; faint: number | null; gap: number }
export type TextRow = keyof TextValues
export type TextNumberRow = Exclude<TextRow, 'font'>

export const DEFAULT_TEXT: TextValues = { size: null, weight: null, lineHeight: null, font: null, faint: null, gap: 0 }

// The size in points; the weight as font-thicken-strength, any number of
// it turning font-thicken on; the line height as adjust-cell-height in
// percent and only up, 0 being today's; faint text's opacity only up from
// Ghostty's 0.5; the gap in points, 0 being today's.
export const TEXT_LIMITS: Record<TextNumberRow, { min: number; max: number; step: number }> = {
  size: { min: 8, max: 28, step: 0.5 },
  weight: { min: 0, max: 255, step: 32 },
  lineHeight: { min: 0, max: 40, step: 5 },
  faint: { min: 0.5, max: 1, step: 0.1 },
  gap: { min: 0, max: 120, step: 8 },
}

export type Settings = {
  pace: Pace
  tune: TuneSettings
  preview: { tune: TuneSettings; phase: Phase; until: number } | null
  text: TextValues
  // Until when an open tune pane's text, not yet kept, stands in Ghostty's
  // text file: renewed as the preview is, and null once kept or closed.
  // A text file unlike the kept text with no live mark is a draft a killed
  // session left, which the next session to start puts back.
  textDraftUntil: number | null
  // Whether that draft moved the gap from the one kept, so the padding line
  // under the include may say another: only then is the line put back,
  // and a padding the person set there by hand stays theirs otherwise.
  // False once kept or closed, as the mark is null.
  isGapDrafted: boolean
  // The events a session plays (/solar event, the milestone), for every
  // session to draw: the sky's shader is one file, and a session that did
  // not know of them would write the sky without them back.
  forced: Forced[]
  // The sky's moment and weather as a session set them (/solar HH:MM,
  // demo, now, storm, aurora), with that session's id and when: they hold
  // for every session while it lives, as they held for it alone before.
  moment: Moment | null
}

export type Moment = { by: string; at: number; pinnedAt: number | null; demoFrom: number | null; isWindForced: boolean; isAuroraForced: boolean }

function asMoment(value: unknown): Moment | null {
  if (!isObject(value) || typeof value.by !== 'string') return null
  const at = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  return { by: value.by, at: at(value.at) ?? 0, pinnedAt: at(value.pinnedAt), demoFrom: at(value.demoFrom), isWindForced: value.isWindForced === true, isAuroraForced: value.isAuroraForced === true }
}

const KEYS = Object.keys(LIMITS) as (keyof TuneValues)[]

// A number within its limits, on the step; the top of the range is
// reachable even where it lies off the steps (a weight of 255).
function snap(value: number, { min, max, step }: { min: number; max: number; step: number }): number {
  const snapped = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step

  return Math.min(max, Math.max(min, Number(snapped.toFixed(4))))
}

// Values within the limits, on the step: a value that is no number is the
// neutral one, one out of range the nearest limit.
export function clampTune(values: Partial<Record<keyof TuneValues, unknown>>): TuneValues {
  const out = { ...NEUTRAL }
  for (const key of KEYS) {
    const value = values[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    out[key] = snap(value, LIMITS[key])
  }

  return out
}

const TEXT_NUMBERS = Object.keys(TEXT_LIMITS) as TextNumberRow[]

// Text values within their limits, on their steps: what is no number is
// untouched (the gap none), and a font is any name that fits on one line,
// kept as it is written, known to the font list or not.
export function clampText(values: Partial<Record<TextRow, unknown>>): TextValues {
  const out = { ...DEFAULT_TEXT }
  for (const key of TEXT_NUMBERS) {
    const value = values[key]
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = snap(value, TEXT_LIMITS[key])
  }
  const font = values.font
  if (typeof font === 'string' && font.trim() !== '' && !/[\u0000-\u001f\u007f]/.test(font)) out.font = font.trim()

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

  const draft = file.textDraftUntil

  return {
    pace: file.pace === 'spar' ? 'spar' : 'full',
    tune: tuneOf(file.tune),
    preview,
    text: clampText(isObject(file.text) ? file.text : {}),
    textDraftUntil: typeof draft === 'number' && Number.isFinite(draft) ? draft : null,
    isGapDrafted: file.isGapDrafted === true,
    forced: Array.isArray(file.forced)
      ? file.forced.flatMap(event =>
          isObject(event) && typeof event.kind === 'string' && typeof event.at === 'number' && Number.isFinite(event.at) ? [{ kind: event.kind, at: event.at }] : [],
        )
      : [],
    moment: asMoment(file.moment),
  }
}

// The lines the text include holds: only what was touched, the font list
// cleared first so the choice replaces the person's families rather than
// adding a fallback to them, and nothing for the gap, which is the padding
// line's.
export function textLines(text: TextValues): string[] {
  const lines: string[] = []
  if (text.size !== null) lines.push(`font-size = ${text.size}`)
  if (text.weight !== null) lines.push('font-thicken = true', `font-thicken-strength = ${text.weight}`)
  if (text.lineHeight !== null) lines.push(`adjust-cell-height = ${text.lineHeight}%`)
  if (text.font !== null) lines.push('font-family = ""', `font-family = ${text.font}`)
  if (text.faint !== null) lines.push(`faint-opacity = ${text.faint}`)

  return lines
}

// The person's own text as Ghostty's +show-config prints it: the size, the
// weight (off where font-thicken is), the line height in percent, the first
// font family ('' for Ghostty's built-in one) and faint text's opacity;
// null where it does not say, says it in pixels, or where the mod's own
// include sets the row (`saved`), since it then prints the mod's value.
export type OwnText = { size: number | null; weight: number | 'off' | null; lineHeight: number | null; font: string | null; faint: number | null }
export const NO_OWN: OwnText = { size: null, weight: null, lineHeight: null, font: null, faint: null }

export function ownTextOf(showConfig: string, saved: TextValues): OwnText {
  const said = new Map<string, string>()
  for (const line of showConfig.split('\n')) {
    const at = line.indexOf('=')
    if (at < 0) continue
    const key = line.slice(0, at).trim()
    if (!said.has(key)) said.set(key, line.slice(at + 1).trim())
  }
  const numberOf = (key: string) => {
    const text = said.get(key)
    return text !== undefined && text !== '' && Number.isFinite(Number(text)) ? Number(text) : null
  }
  const thicken = said.get('font-thicken')
  const cell = said.get('adjust-cell-height')
  const own: OwnText = {
    size: numberOf('font-size'),
    weight: thicken === 'false' ? 'off' : thicken === 'true' ? numberOf('font-thicken-strength') : null,
    lineHeight: cell === '' ? 0 : cell !== undefined && /^\d+(\.\d+)?%$/.test(cell) ? Number(cell.slice(0, -1)) : null,
    font: said.get('font-family')?.replace(/^"(.*)"$/, '$1') ?? null,
    faint: numberOf('faint-opacity'),
  }
  for (const key of ['size', 'weight', 'lineHeight', 'font', 'faint'] as const) if (saved[key] !== null) own[key] = null

  return own
}

// The font families Ghostty's +list-fonts names, each once: the lines that
// are not indented, which are the families (the faces under them are).
export function fontsOf(listFonts: string): string[] {
  return [...new Set(listFonts.split('\n').filter(line => line.trim() !== '' && !/^\s/.test(line)).map(line => line.trim()))]
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
  if (preview !== null && isLive(preview.until, now)) return { tune: preview.tune, phase: preview.phase }

  return { tune: settings.tune, phase: null }
}

// Whether an open pane's mark, running until `until`, still counts: as a
// preview does, while its time lasts and lies at most PREVIEW_LIFE_MS ahead.
const isLive = (until: number, now: number) => now < until && until <= now + PREVIEW_LIFE_MS + 1_000

// Whether a tune pane somewhere has its text, not yet kept, in Ghostty.
export function isTextDraftLive(settings: Settings, now: number): boolean {
  return settings.textDraftUntil !== null && isLive(settings.textDraftUntil, now)
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

// The tool, /solar tune, in the band above the prompt: its Client's key,
// the rows and columns it needs (its tabs, the six text rows and the hint;
// the hint's width), how often a session writes what it shows (at most,
// the last state winning), and how often it renews the preview while open,
// well within PREVIEW_LIFE_MS.
export const TUNE_KEY = 'tune'
export const TOOL_ROWS = 8
export const TOOL_COLUMNS = 76
// The fewest columns the weather keeps beside the tool.
export const WEATHER_MIN = 26
export const PREVIEW_MS = 250
export const RENEW_MS = 20_000

// What the pane says, in English as the rest of Solar.
export const TUNE_WORDS = {
  notGhostty: 'Solar: tune is for the sky in Ghostty on a Mac.',
  notIncluded: "Solar: Ghostty's config does not show the sky yet (/solar ghostty), so the sliders change nothing you can see.",
  hidden: 'Solar: the sky is hidden, so the sliders change nothing you can see until /solar brings it back.',
  kept: 'kept',
  // Only the keys known to reach the tool in the band; tab and Enter may too.
  hint: 'click the tool   \u2191\u2193 \u2190\u2192   [ ] phase   s keep   r reset   u undo   q close',
  waits: `Solar: the tune tool opens in the band once the window has ${TOOL_COLUMNS} columns and room for ${TOOL_ROWS} rows above the prompt.`,
  closed: 'Solar: tune closed.',
}

// The pane's rows, top to bottom, and their labels.
export const TUNE_ROWS: readonly (keyof TuneValues)[] = ['brightness', 'shade', 'colour', 'warmth']
export const ROW_LABELS: Record<keyof TuneValues, string> = { brightness: 'brightness', shade: 'text shade', colour: 'colour', warmth: 'warmth' }

// The text tab's rows, top to bottom, their labels, and the words its
// values are shown with.
export const TEXT_ROWS: readonly TextRow[] = ['size', 'weight', 'lineHeight', 'font', 'faint', 'gap']
export const TEXT_LABELS: Record<TextRow, string> = { size: 'size', weight: 'weight', lineHeight: 'line height', font: 'font', faint: 'faint text', gap: 'gap' }
export const TEXT_WORDS = {
  own: 'own',
  newWindows: 'new windows',
  off: 'off',
  builtIn: 'built-in',
  refused: (key: string) => `Ghostty refuses ${key}; the text stays as it was`,
  noApp: "Solar found no Ghostty app of yours under Applications to check the text with, so it stays as it was",
  noInclude: "Ghostty's config does not show the sky yet (/solar ghostty), so the text stays as it was",
  unreadable: "Ghostty's config could not be read, so the text stays as it was",
}

// The tabs: the four parts of the day, then the text.
export const TAB_TEXT = 'text'
export const TABS: readonly (Phase | typeof TAB_TEXT)[] = [...PHASES, TAB_TEXT]

// The digit of the tab under a column of the tool's top row, where the
// tabs are drawn a space apart; null between them and past the last.
export function tabAt(x: number): string | null {
  let left = 0
  for (const [i, tab] of TABS.entries()) {
    if (x >= left && x < left + tab.length) return String(i + 1)
    left += tab.length + 1
  }

  return null
}

// A digit 1 to 5 typed into an empty prompt is the tab's while the tool is
// open; anything else is the person's text.
export function tabKeyOf(edit: { text: string; inputText: string }): string | null {
  return edit.text === '' && /^[1-5]$/.test(edit.inputText) ? edit.inputText : null
}

// The pane as the person has it: the part of the day and the row chosen,
// the tune they are making, and the saved tune as the pane opened, which u
// goes back to however often they keep; and the same for the text, with
// whether its tab is the one shown. On the text tab the sky goes on showing
// the part of the day last chosen.
export type PaneState = {
  phase: Phase
  row: keyof TuneValues
  tune: TuneSettings
  opened: TuneSettings
  isOnText: boolean
  textRow: TextRow
  text: TextValues
  textOpened: TextValues
}
export type TuneAction = 'none' | 'preview' | 'text' | 'keep' | 'close'

// What the text tab moves through besides its limits: the person's own
// values, where a row they have not touched starts from, and the fonts.
export type TextWorld = { own: OwnText; fonts: readonly string[] }
const NO_TEXT_WORLD: TextWorld = { own: NO_OWN, fonts: [] }

// Where an untouched row starts when the person's own value is not known:
// Ghostty's own defaults on a Mac.
const TEXT_START: Record<Exclude<TextNumberRow, 'weight'>, number> = { size: 13, lineHeight: 0, faint: 0.5, gap: 0 }

// The tab a state shows: the text tab, or the part of the day.
export function tabOf(state: PaneState): Phase | typeof TAB_TEXT {
  return state.isOnText ? TAB_TEXT : state.phase
}

// The state on a tab: a part of the day previews it, the text tab leaves
// the sky on the part of the day it showed.
function toTab(state: PaneState, tab: Phase | typeof TAB_TEXT): { state: PaneState; action: TuneAction } {
  if (tab === TAB_TEXT) return { state: { ...state, isOnText: true }, action: 'none' }

  return { state: { ...state, phase: tab, isOnText: false }, action: 'preview' }
}

const around = <T>(list: readonly T[], item: T, by: number): T => list[(list.indexOf(item) + by + list.length) % list.length]!

// The text one step along a row: from its value, or where untouched from
// the person's own; the font through the list, from the person's own into
// it where theirs is not in it; the weight from off to its least on the
// way up, and left off on the way down. Null where nothing would change.
function stepText(text: TextValues, row: TextRow, by: 1 | -1, world: TextWorld): TextValues | null {
  if (row === 'font') {
    const { fonts } = world
    if (fonts.length === 0) return null
    const at = fonts.indexOf(text.font ?? world.own.font ?? '')
    const font = at < 0 ? fonts[by > 0 ? 0 : fonts.length - 1]! : around(fonts, fonts[at]!, by)

    return font === text.font ? null : { ...text, font }
  }
  const own = row === 'gap' ? null : world.own[row]
  let from = text[row] ?? (typeof own === 'number' ? own : null)
  if (from === null && row === 'weight') {
    if (by < 0) return null
    return { ...text, weight: TEXT_LIMITS.weight.min }
  }
  from ??= TEXT_START[row as Exclude<TextNumberRow, 'weight'>]
  const value = snap(from + by * TEXT_LIMITS[row].step, TEXT_LIMITS[row])

  return value === text[row] ? null : { ...text, [row]: value }
}

// One key on the text tab: as on the sky's, up and down pick a row, left
// and right move it, r leaves it untouched again (the gap at none), u takes
// every row back to how the pane opened, and Enter keeps. A key that
// changes the text asks for it to be written.
function onTextKey(state: PaneState, key: string, world: TextWorld): { state: PaneState; action: TuneAction } {
  const { text, textRow } = state
  const set = (next: TextValues | null) => (next === null ? { state, action: 'none' as const } : { state: { ...state, text: next }, action: 'text' as const })
  if (key === 'up' || key === 'down') return { state: { ...state, textRow: around(TEXT_ROWS, textRow, key === 'up' ? -1 : 1) }, action: 'none' }
  if (key === 'left' || key === 'right') return set(stepText(text, textRow, key === 'left' ? -1 : 1, world))
  if (key === 'r') return set(text[textRow] === DEFAULT_TEXT[textRow] ? null : { ...text, [textRow]: DEFAULT_TEXT[textRow] })
  if (key === 'u') return { state: { ...state, text: state.textOpened }, action: 'text' }
  if (key === 'return' || key === 's') return { state, action: 'keep' }

  return { state, action: 'none' }
}

// One key pressed in the pane: up and down pick a row, left and right move
// its value a step within its limits, tab and ] go to the next tab and [ to
// the one before, the digits 1 to 5 straight to one, r puts the row back
// to its default, u the whole tune back to where the pane started, Enter
// (or s) keeps it, and q closes. A key that changes
// what the sky should show asks for a preview; the text tab's keys are its
// own (onTextKey), and coming to it changes nothing the sky shows.
export function onTuneKey(state: PaneState, key: string, world: TextWorld = NO_TEXT_WORLD): { state: PaneState; action: TuneAction } {
  const { phase, row, tune } = state
  if (key === 'q') return { state, action: 'close' }
  if (key === 'tab' || key === ']' || key === '[') return toTab(state, around(TABS, tabOf(state), key === '[' ? -1 : 1))
  const digit = TABS[Number(key) - 1]
  if (/^[1-5]$/.test(key) && digit !== undefined) return digit === tabOf(state) ? { state, action: 'none' } : toTab(state, digit)
  if (state.isOnText) return onTextKey(state, key, world)
  const set = (value: number) => {
    const values = clampTune({ ...tune[phase], [row]: value })
    return values[row] === tune[phase][row] ? { state, action: 'none' as const } : { state: { ...state, tune: { ...tune, [phase]: values } }, action: 'preview' as const }
  }
  if (key === 'up' || key === 'down') return { state: { ...state, row: around(TUNE_ROWS, row, key === 'up' ? -1 : 1) }, action: 'none' }
  if (key === 'left' || key === 'right') return set(tune[phase][row] + (key === 'left' ? -1 : 1) * LIMITS[row].step)
  if (key === 'r') return set(DEFAULT_TUNE[phase][row])
  if (key === 'u') return { state: { ...state, tune: state.opened }, action: 'preview' }
  if (key === 'return' || key === 's') return { state, action: 'keep' }

  return { state, action: 'none' }
}

// What the pane's surface module keeps: the pane, how many keeps it has
// made and the tune and text of the last, and whether the last key was
// Enter, so it says kept until the next key. Enter keeps both, on either
// tab. What it posts carries the keeps too: the engine delivers one post a
// frame, the last, so a keep followed by a move in the same frame still
// reaches the hooks module, in the move's post.
export type PaneLocal = { pane: PaneState; keeps: number; keptTune: TuneSettings | null; keptText: TextValues | null; isKeptLast: boolean }
export type PanePost = { state: PaneState; action: TuneAction; keeps: number; keptTune: TuneSettings | null; keptText: TextValues | null }

// One key in the surface module: the next local state, and the post to
// send, or null where neither the sky nor the text would change.
export function onPaneKey(local: PaneLocal, key: string, world: TextWorld = NO_TEXT_WORLD): { local: PaneLocal; post: PanePost | null } {
  const { state, action } = onTuneKey(local.pane, key, world)
  const isKeep = action === 'keep'
  const next: PaneLocal = {
    pane: state,
    keeps: local.keeps + (isKeep ? 1 : 0),
    keptTune: isKeep ? state.tune : local.keptTune,
    keptText: isKeep ? state.text : local.keptText,
    isKeptLast: isKeep,
  }

  // A move to another tab is posted even where the sky stays, so the band
  // knows the tab.
  const isPosted = action !== 'none' || tabOf(state) !== tabOf(local.pane)

  return { local: next, post: isPosted ? { state, action, keeps: next.keeps, keptTune: next.keptTune, keptText: next.keptText } : null }
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

// A text value as the pane shows it: the size and the gap in points, the
// weight as its strength or off, the line height as the percent it adds,
// the font by its name or as Ghostty's built-in one, faint text's opacity.
export function textValueText(row: TextRow, value: number | string): string {
  if (row === 'font') return value === '' ? TEXT_WORDS.builtIn : String(value)
  if (row === 'weight') return value === 'off' ? TEXT_WORDS.off : String(value)
  if (row === 'size' || row === 'gap') return `${value} pt`
  if (row === 'lineHeight') return value === 0 ? '0 %' : `+${value} %`

  return Number(value).toFixed(1)
}

// A text row's bar, as a sky row's (barOf), where it has numbers.
export function textBarOf(row: TextNumberRow, value: number): string {
  const { min, max } = TEXT_LIMITS[row]
  const at = Math.round(((Math.min(max, Math.max(min, value)) - min) / (max - min)) * (BAR - 1))

  return '\u2593'.repeat(at) + '\u25cf' + '\u2591'.repeat(BAR - 1 - at)
}

