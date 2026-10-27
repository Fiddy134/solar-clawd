// A theme: what the sky's engine draws its own world with. Its manifest
// says what it is and which events of its own it has, and its GLSL defines
// the four functions the engine declares (glsl/prototypes.ts) and anything
// they need, after mainImage in the shader. A theme built in (themes/fyr) is
// a TypeScript wrapper round exactly these two, so a theme from elsewhere,
// a manifest.json and a theme.glsl, can do all that one can.

import { EVENT_WORDS } from '../events'
import type { ActiveEvent } from '../events'

export { whenOf } from '../events'

// The contract a theme is written against: the four functions, COMMON's
// helpers and the signals (hooks/shader.ts, THEME_SIGNALS). Contract 1 is
// the engine's unprefixed names as they are; every engine name added after
// it starts with sky_, so it cannot collide with a theme's own.
export const ENGINE_CONTRACT = 1

// The shader's numbers for events: the engine's own from 1, a theme's from
// 100 in its manifest's order.
export const ENGINE_EVENT_BASE = 1
export const THEME_EVENT_BASE = 100

// The most a theme's GLSL and the whole shader may weigh, in characters.
// Every tab compiles the whole shader as it opens and on every reload.
export const THEME_GLSL_MAX = 80_000
export const SHADER_MAX = 224_000

// The most of the time a theme's events may keep the sky moving, summed
// over them as chance times length over slot.
const LIVELINESS_MAX = 0.08

// The four functions a theme defines.
export const ENTRY_POINTS = ['scenery', 'resident', 'themeEvent', 'themeWindow'] as const

// When an event of a theme's may play, as a predicate over EventContext
// (whenOf): the sun's height (day above 2°, night below -8°, low between
// -3° and 15°), the clouds, the wind (m/s), no rain or snow, the months,
// and the sun's elevation in degrees.
export type ThemeWhen = {
  sun?: 'day' | 'night' | 'low' | 'any'
  clearAtMost?: number
  windBelow?: number
  windAtLeast?: number
  windAtMost?: number
  dry?: boolean
  months?: number[]
  elevationAbove?: number
  elevationBelow?: number
}

export type ThemeEventSpec = {
  kind: string
  // The word the band and /solar say for it.
  word: string
  slotMinutes: number
  chance: number
  minutes: number
  layer: 'front' | 'behind'
  when: ThemeWhen
  // Its schedule's seed; 1000 and its place in the list when left out.
  salt?: number
}

export type ThemeManifest = {
  engine: typeof ENGINE_CONTRACT
  name: string
  title: string
  description: string
  author: string
  version: string
  license: string
  // Whether it wants the stage strip at the right.
  stage: 'wanted' | 'none'
  // What Claude waiting looks like in it, for /solar help and review.
  waits: string
  // Whether the theme shows the context window itself, through
  // contextFish() and contextState(), or the engine draws its wastebasket.
  context: 'resident' | 'engine'
  events: ThemeEventSpec[]
  // Never scheduled: /solar event <word> plays one, the shader told by
  // THEME_FORCE, its place here counted from 1.
  previews: { kind: string; word: string }[]
  // Old words still taken by /solar event.
  aliases: Record<string, string>
}

export type Theme = { manifest: ThemeManifest; glsl: string }

const WHEN_KEYS = ['sun', 'clearAtMost', 'windBelow', 'windAtLeast', 'windAtMost', 'dry', 'months', 'elevationAbove', 'elevationBelow']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function whenError(when: unknown): string | null {
  if (!isRecord(when)) return 'is not an object'
  for (const key of Object.keys(when)) if (!WHEN_KEYS.includes(key)) return `has no "${key}"`
  if (when.sun !== undefined && !['day', 'night', 'low', 'any'].includes(when.sun as string)) return 'has a sun that is not day, night, low or any'
  for (const key of ['clearAtMost', 'windBelow', 'windAtLeast', 'windAtMost', 'elevationAbove', 'elevationBelow']) {
    if (when[key] !== undefined && typeof when[key] !== 'number') return `has a ${key} that is not a number`
  }
  if (when.dry !== undefined && typeof when.dry !== 'boolean') return 'has a dry that is not true or false'
  if (when.months !== undefined && (!Array.isArray(when.months) || when.months.some(m => !Number.isInteger(m) || m < 1 || m > 12))) return 'has months that are not 1 to 12'

  return null
}

// A theme from its manifest, as read from JSON, and its GLSL; or what is
// wrong with it. Its kinds and words must be its own, each of its events
// shorter than its slot, and together they may keep the sky moving no
// more than LIVELINESS_MAX of the time.
export function themeOf(manifest: unknown, glsl: string): Theme | { error: string } {
  if (!isRecord(manifest)) return { error: 'the manifest is not an object' }
  if (manifest.engine === undefined) return { error: 'the manifest names no engine contract ("engine": 1)' }
  if (manifest.engine !== ENGINE_CONTRACT) return { error: `the manifest asks for engine contract ${String(manifest.engine)}; this engine has ${ENGINE_CONTRACT}` }
  if (typeof manifest.name !== 'string' || !/^[a-z0-9-]{1,32}$/.test(manifest.name)) return { error: 'the name is not 1 to 32 of a-z, 0-9 and -' }
  for (const key of ['title', 'description', 'author', 'version', 'license', 'waits']) {
    if (typeof manifest[key] !== 'string') return { error: `the manifest has no ${key}` }
  }
  if (manifest.stage !== 'wanted' && manifest.stage !== 'none') return { error: 'stage is not "wanted" or "none"' }
  if (manifest.context !== 'resident' && manifest.context !== 'engine') return { error: 'context is not "resident" or "engine"' }
  if (!Array.isArray(manifest.events) || !Array.isArray(manifest.previews) || !isRecord(manifest.aliases)) return { error: 'events, previews and aliases are missing' }
  if (typeof glsl !== 'string') return { error: 'the GLSL is not text' }

  const kinds = new Set<string>(Object.keys(EVENT_WORDS))
  const words = new Set<string>(Object.values(EVENT_WORDS))
  const claim = (kind: unknown, word: unknown): string | null => {
    if (typeof kind !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(kind)) return `"${String(kind)}" is not a kind`
    if (typeof word !== 'string' || word === '') return `${kind} has no word`
    if (kinds.has(kind)) return `the kind ${kind} is taken`
    if (words.has(word)) return `the word "${word}" is taken`
    kinds.add(kind)
    words.add(word)
    return null
  }
  let liveliness = 0
  for (const event of manifest.events as unknown[]) {
    if (!isRecord(event)) return { error: 'an event is not an object' }
    const taken = claim(event.kind, event.word)
    if (taken) return { error: taken }
    const { slotMinutes, chance, minutes } = event
    if (typeof slotMinutes !== 'number' || typeof chance !== 'number' || typeof minutes !== 'number' || slotMinutes <= 0 || minutes <= 0 || chance < 0 || chance > 1) {
      return { error: `${String(event.kind)} needs slotMinutes and minutes over 0 and a chance from 0 to 1` }
    }
    if (minutes >= slotMinutes) return { error: `${String(event.kind)} lasts its whole slot or longer` }
    if (event.layer !== 'front' && event.layer !== 'behind') return { error: `${String(event.kind)}'s layer is not front or behind` }
    if (event.salt !== undefined && !Number.isInteger(event.salt)) return { error: `${String(event.kind)}'s salt is not a whole number` }
    const wrong = whenError(event.when)
    if (wrong) return { error: `${String(event.kind)}'s when ${wrong}` }
    liveliness += (chance * minutes) / slotMinutes
  }
  if (liveliness > LIVELINESS_MAX) return { error: `its events keep the sky moving ${liveliness.toFixed(3)} of the time, more than ${LIVELINESS_MAX}` }
  for (const preview of manifest.previews as unknown[]) {
    if (!isRecord(preview)) return { error: 'a preview is not an object' }
    const taken = claim(preview.kind, preview.word)
    if (taken) return { error: taken }
  }
  for (const [word, kind] of Object.entries(manifest.aliases)) {
    if (words.has(word)) return { error: `the alias "${word}" is a word already` }
    if (typeof kind !== 'string' || !kinds.has(kind)) return { error: `the alias "${word}" names no kind` }
  }

  return { manifest: manifest as ThemeManifest, glsl }
}

// The shader's number for one of a theme's events, 0 for none of its own.
export function themeEventIndex(kind: ActiveEvent['kind'], theme: Theme): number {
  const i = theme.manifest.events.findIndex(event => event.kind === kind)

  return i < 0 ? 0 : THEME_EVENT_BASE + i
}

// --- The lint ---------------------------------------------------------------

// GLSL without its comments, each kept as spaces so the rest stays where
// it was.
export function uncommented(glsl: string): string {
  return glsl.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, c => c.replace(/[^\n]/g, ' '))
}

// Where the block that opens at `open` (a '{') closes.
function closing(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    if (text[i] === '}' && --depth === 0) return i
  }

  return text.length
}

// The statements at the top of a GLSL text, blocks left out: a function's
// signature, a constant's or a struct's declaration.
function topLevel(glsl: string): string[] {
  const text = uncommented(glsl)
  let flat = ''
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      i = closing(text, i)
      flat += '{};'
    } else {
      flat += text[i]
    }
  }

  return flat
    .split(/[;}]/)
    .map(statement => statement.replace(/\s+/g, ' ').trim())
    .filter(statement => statement !== '' && statement !== '{')
}

const QUALIFIERS = /^(?:(?:const|highp|mediump|lowp|precise|invariant|flat|smooth)\s+)*/

// The names a GLSL text declares at its top level: functions, constants,
// structs and anything else.
export function topLevelNames(glsl: string): string[] {
  const names = new Set<string>()
  for (const statement of topLevel(glsl)) {
    const struct = /^struct (\w+)/.exec(statement)
    const declared = /^(\w+)(?: ?\[ ?\d* ?\])? (\w+)/.exec(statement.replace(QUALIFIERS, ''))
    const name = struct?.[1] ?? declared?.[2]
    if (name) names.add(name)
  }

  return [...names]
}

// The body of the loop whose header ends just before `from`: a block, or one
// statement.
function loopBody(text: string, from: number): [number, number] {
  const start = text.slice(from).search(/\S/) + from
  if (text[start] === '{') return [start, closing(text, start) + 1]
  const end = text.indexOf(';', start)

  return [start, end < 0 ? text.length : end + 1]
}

// Where the parenthesis that opens at `open` closes, or the text's end.
function parenClosing(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++
    if (text[i] === ')' && --depth === 0) return i
  }

  return text.length
}

// The index of a loop whose header (between its parentheses) is of the
// allowed form, else null: an int set to a whole number of at most 48 either
// way, compared by <, <=, > or >= with another such, and stepped by a whole
// number above 0 toward it. Nothing else reads as the form, so no loop of
// it runs more than 97 times.
function loopIndex(header: string): string | null {
  const parts = header.split(';')
  if (parts.length !== 3) return null
  const [init, condition, step] = parts as [string, string, string]
  const start = /^\s*int\s+(\w+)\s*=\s*(-?\d+)\s*$/.exec(init)
  if (!start) return null
  const index = start[1]!
  const bound = new RegExp(`^\\s*${index}\\s*(<=?|>=?)\\s*(-?\\d+)\\s*$`).exec(condition)
  if (!bound || Math.abs(Number(start[2])) > 48 || Math.abs(Number(bound[2])) > 48) return null
  const by = new RegExp(`^\\s*(?:${index}\\s*(\\+\\+|--)|(\\+\\+|--)\\s*${index}|${index}\\s*([+-])=\\s*(\\d+))\\s*$`).exec(step)
  if (!by) return null
  const isUp = (by[1] ?? by[2] ?? `${by[3]}${by[3]}`) === '++'
  if (by[4] !== undefined && Number(by[4]) === 0) return null
  if (isUp !== bound[1]!.startsWith('<')) return null

  return index
}

// What is wrong with a theme's GLSL, empty when nothing is: a subset of GLSL
// that cannot read the terminal, hang the GPU or redefine the engine. Its
// loops keep to GLSL ES 1.00's Appendix A (loopIndex): an int index set to a
// constant, compared with a constant of at most 48, stepped toward it by a
// constant, never assigned in the body, and nested at most two deep. `engineNames` are the
// engine's top-level names (topLevelNames of the shader without the
// theme); the four entry points are the theme's to define.
export function lintTheme(glsl: string, engineNames: readonly string[]): string[] {
  const problems: string[] = []
  const text = uncommented(glsl)
  const forbidden: [RegExp, string][] = [
    [/\bwhile\b/, 'a while loop'],
    [/\bdo\b/, 'a do loop'],
    [/\btexture\w*\s*\(|\btexelFetch\w*\s*\(/, 'a texture read'],
    [/\biChannel\d*\b/, 'iChannel'],
    [/\biPalette\b/, 'iPalette (the context comes through contextFish() and contextState())'],
    [/#/, 'the preprocessor'],
    [/\bdiscard\b/, 'discard'],
    [/\bmainImage\b/, 'mainImage'],
  ]
  for (const [pattern, what] of forbidden) if (pattern.test(text)) problems.push(`uses ${what}`)

  const engine = new Set(engineNames.filter(name => !(ENTRY_POINTS as readonly string[]).includes(name)))
  for (const statement of topLevel(glsl)) {
    const first = /^\w+/.exec(statement)?.[0] ?? ''
    if (['uniform', 'in', 'out', 'inout', 'layout', 'buffer', 'attribute', 'varying', 'shared'].includes(first)) {
      problems.push(`declares ${first} at its top: "${statement}"`)
    }
  }
  for (const name of topLevelNames(glsl)) {
    if (name.startsWith('sky_')) problems.push(`names ${name}: sky_ is the engine's`)
    else if (engine.has(name)) problems.push(`defines ${name}, which is the engine's`)
  }

  // Every for counts, as a loop to nest and a header to check; one whose
  // header this cannot read is not of the form.
  const loops: [number, number][] = []
  const header = /\bfor\s*\(/g
  for (let m = header.exec(text); m; m = header.exec(text)) {
    const close = parenClosing(text, m.index + m[0].length - 1)
    const whole = text.slice(m.index, close + 1)
    const body = loopBody(text, close + 1)
    loops.push(body)
    const index = loopIndex(text.slice(m.index + m[0].length, close))
    if (!index) {
      problems.push(`has a loop not of the form for (int i = constant; i < constant up to 48; i++): "${whole.replace(/\s+/g, ' ')}"`)
      continue
    }
    const inside = text.slice(body[0], body[1])
    if (new RegExp(`(?:\\b${index}\\s*(?:[-+*/%]?=(?!=)|\\+\\+|--)|(?:\\+\\+|--)\\s*${index}\\b)`).test(inside)) {
      problems.push(`assigns its loop index ${index} in the loop`)
    }
  }
  for (const [start] of loops) {
    const depth = loops.filter(([from, to]) => from < start && start < to).length
    if (depth >= 2) problems.push('nests loops more than two deep')
  }

  return problems
}
