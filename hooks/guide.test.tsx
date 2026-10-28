// The theme guide, docs/THEME-GUIDE.md, held to the code: its sections are
// the sixteen the work plan names, what it quotes of the engine and of fyr
// is the code as it stands, its examples and its template lint clean, and
// its tables list what the engine has. A test has no file system, so it
// reads the guide from hooks/themes/guide.ts, which `node
// tools/theme/guide.mjs` writes from it.

import { expect, test } from 'claude-code/testing'

import { clawdRows } from './clawd'
import { EVENT_WORDS } from './events'
import { BASKET } from './glsl/basket'
import { CLOUDS } from './glsl/clouds'
import { COMMON } from './glsl/common'
import { CONTEXT_MARK } from './glsl/context'
import { EVENTS as EVENTS_GLSL } from './glsl/events'
import { GLYPHS } from './glsl/glyphs'
import { MAIN } from './glsl/main'
import { PROTOTYPES } from './glsl/prototypes'
import { SKY } from './glsl/sky'
import { skyShader, THEME_SIGNALS } from './shader'
import { checkTheme, engineNames, longNight } from './themes/check'
import { THEME_GUIDE } from './themes/guide'
import { BASE_THEME, THEMES } from './themes/index'
import { ENTRY_POINTS, lintTheme, SHADER_MAX, STAGE_WIDTHS, THEME_GLSL_MAX, themeOf, topLevelNames } from './themes/theme'
import type { Theme, ThemeEventSpec, ThemeManifest, ThemeWhen } from './themes/theme'

const FYR = THEMES[BASE_THEME]

// The tags a fenced block of the guide may have, each checked as below.
const TAGS = ['text', 'sh', 'glsl', 'glsl-signature', 'glsl-engine', 'glsl-fyr', 'json-manifest', 'json-template', 'glsl-template', 'text-reserved', 'text-clawd']

// The guide's fenced blocks, each with its tag and its text.
function fences(): { tag: string; text: string }[] {
  const found: { tag: string; text: string }[] = []
  let open: { tag: string; lines: string[] } | null = null
  for (const line of THEME_GUIDE.split('\n')) {
    if (open === null && line.startsWith('```')) open = { tag: line.slice(3).trim(), lines: [] }
    else if (open !== null && line.startsWith('```')) {
      found.push({ tag: open.tag, text: open.lines.join('\n') })
      open = null
    } else open?.lines.push(line)
  }

  return found
}

const blocks = (tag: string) => fences().filter(fence => fence.tag === tag).map(fence => fence.text)

// The rows of each table that follows a `<!-- guide-test: <name> -->`
// comment, its header and rule left out, as cells.
function rows(name: string): string[][] {
  const lines = THEME_GUIDE.split('\n')
  const found: string[][] = []
  lines.forEach((line, i) => {
    if (line.trim() !== `<!-- guide-test: ${name} -->`) return
    for (let j = i + 3; j < lines.length && lines[j]!.startsWith('|'); j++) {
      found.push(lines[j]!.split('|').slice(1, -1).map(cell => cell.trim()))
    }
  })

  return found
}

// The names a cell gives in backticks, a function's without its brackets.
const namesIn = (cell: string) => [...cell.matchAll(/`([A-Za-z_]\w*)(?:\(\))?`/g)].map(m => m[1]!)
const firstNames = (name: string) => rows(name).flatMap(row => namesIn(row[0] ?? ''))

// A line of GLSL as the guide quotes it: no comment after it, no indent.
const bare = (line: string) => line.replace(/\s*\/\/.*$/, '').trim()
const isElided = (line: string) => line.trim().startsWith('// …')

test('the guide has the sixteen sections, and every block in it a tag the test knows', () => {
  expect([...THEME_GUIDE.matchAll(/^## (\d+)\. /gm)].map(m => Number(m[1]))).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  const tags = fences().map(fence => fence.tag)
  expect(tags.length).toBeGreaterThan(20)
  for (const tag of tags) expect(TAGS, `a block tagged "${tag}"`).toContain(tag)
})

test("every line of a glsl-signature block is the engine's own, as a theme may call it", () => {
  const shootingStarAge = /^float shootingStarAge\([^)]*\) \{$/m.exec(EVENTS_GLSL)?.[0] ?? ''
  const contract = [COMMON, PROTOTYPES, CONTEXT_MARK, shootingStarAge].join('\n').split('\n').map(line => line.trim())
  let count = 0
  for (const block of blocks('glsl-signature')) {
    for (const line of block.split('\n').map(bare).filter(line => line !== '')) {
      const head = line.replace(/;$/, '')
      expect(contract.some(own => own.startsWith(`${head} {`) || own.startsWith(`${head};`)), line).toBe(true)
      count++
    }
  }
  // The four functions, and every helper of COMMON's a theme calls.
  expect(count).toBeGreaterThan(80)
  for (const signature of PROTOTYPES.split('\n').filter(line => /^\w/.test(line))) expect(blocks('glsl-signature').join('\n')).toContain(signature)
})

test("every signal the guide's tables name is declared in the shader, and every one a theme may read is named", () => {
  const declared = new Set(topLevelNames(skyShader(longNight(), FYR)))
  const listed = firstNames('signals')
  for (const name of listed) expect(declared.has(name), name).toBe(true)
  for (const signal of THEME_SIGNALS) expect(listed, signal).toContain(signal)
  for (const name of topLevelNames(CONTEXT_MARK)) expect(listed, name).toContain(name)
})

test("the manifest's example is fyr's, and the tables list a manifest's fields, an event's, its when and the engine's events as the engine has them", () => {
  const [fyr, ...more] = blocks('json-manifest')
  expect(more).toHaveLength(0)
  const example = JSON.parse(fyr ?? '') as unknown
  expect(example).toEqual(JSON.parse(JSON.stringify(FYR.manifest)))
  expect('error' in themeOf(example, FYR.glsl)).toBe(false)

  const manifestFields = { engine: 0, name: 0, title: 0, description: 0, author: 0, version: 0, license: 0, stage: 0, stagePt: 0, waits: 0, context: 0, market: 0, events: 0, previews: 0, aliases: 0 } satisfies Record<keyof ThemeManifest, 0>
  const eventFields = { kind: 0, word: 0, slotMinutes: 0, chance: 0, minutes: 0, layer: 0, when: 0, salt: 0 } satisfies Record<keyof ThemeEventSpec, 0>
  const whenKeys = { sun: 0, clearAtMost: 0, windBelow: 0, windAtLeast: 0, windAtMost: 0, dry: 0, months: 0, elevationAbove: 0, elevationBelow: 0 } satisfies Record<keyof ThemeWhen, 0>
  expect(firstNames('manifest fields').sort()).toEqual(Object.keys(manifestFields).sort())
  expect(firstNames('event fields').sort()).toEqual(Object.keys(eventFields).sort())
  expect(firstNames('when').sort()).toEqual(Object.keys(whenKeys).sort())
  const stagePt = rows('manifest fields').find(row => row[0] === '`stagePt`')?.[1] ?? ''
  expect(stagePt).toContain(`${STAGE_WIDTHS.slice(0, -1).join(', ')} or ${STAGE_WIDTHS.at(-1)}`)
  const words = Object.fromEntries(rows('engine events').map(row => [namesIn(row[0] ?? '')[0], row[1]]))
  expect(words).toEqual({ ...EVENT_WORDS })
  const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  expect(THEME_GUIDE).toContain(`${thousands(THEME_GLSL_MAX)} characters`)
  expect(THEME_GUIDE).toContain(thousands(SHADER_MAX))
})

test("the template is a theme that checks clean, and every glsl example lints clean on its own", () => {
  const [manifest, ...moreManifests] = blocks('json-template')
  const [glsl, ...moreGlsl] = blocks('glsl-template')
  expect(moreManifests).toHaveLength(0)
  expect(moreGlsl).toHaveLength(0)
  const template = themeOf(JSON.parse(manifest ?? '') as unknown, `${glsl ?? ''}\n`)
  expect('error' in template ? template.error : null).toBeNull()
  expect(checkTheme(template as Theme)).toEqual([])
  for (const name of ENTRY_POINTS) expect(glsl).toContain(`${name}(`)

  const names = engineNames()
  const examples = blocks('glsl')
  expect(examples.length).toBeGreaterThan(8)
  for (const example of examples) expect(lintTheme(example, names), example.split('\n').find(line => line.trim() !== '')).toEqual([])
})

test("the excerpts are lines of fyr and of the engine as they stand", () => {
  const linesOf = (text: string) => new Set(text.split('\n').map(line => line.trim()))
  const fyr = linesOf(FYR.glsl)
  const engine = linesOf([COMMON, PROTOTYPES, SKY, CLOUDS, EVENTS_GLSL, CONTEXT_MARK, BASKET, MAIN].join('\n'))
  const quoted = (tag: string, own: Set<string>) => {
    const excerpts = blocks(tag)
    expect(excerpts.length).toBeGreaterThan(0)
    for (const excerpt of excerpts) {
      for (const line of excerpt.split('\n').filter(line => line.trim() !== '' && !isElided(line))) expect(own.has(line.trim()), line).toBe(true)
    }
  }
  quoted('glsl-fyr', fyr)
  quoted('glsl-engine', engine)
})

test("the reserved names are the engine's, Clawd is the band's, and the codes one-liner has the font's order", () => {
  const [reserved] = blocks('text-reserved')
  const expected = engineNames()
    .filter(name => !(ENTRY_POINTS as readonly string[]).includes(name) && !name.startsWith('sky_'))
    .sort()
  expect((reserved ?? '').split(/\s+/).filter(name => name !== '')).toEqual(expected)

  const [clawd] = blocks('text-clawd')
  expect((clawd ?? '').split('\n')).toEqual(clawdRows('open', 'down', 'stand'))

  const font = /const font = "([^"]*)" \+ String\.fromCharCode\(39\) \+ "([^"]*)"/.exec(THEME_GUIDE)
  expect(font).not.toBeNull()
  expect(`${font![1]}'${font![2]}`).toBe(GLYPHS.map(([ch]) => ch).join(''))
})
