// A theme checked as the engine takes it: its GLSL linted against the
// engine's own names, and the caps on its text and on the whole shader of a
// long night (04:00, the aurora, the ISS and the grill, every star up). And
// a theme as the two files one from elsewhere is, manifest.json and
// theme.glsl, and the engine with no theme at all. The tests and the tools
// (tools/theme/lint.mjs, pack.mjs, `--theme none` in the preview) share
// these, so they say the same.

import { STOCKHOLM } from '../astro'
import { SYMBOLS } from '../market'
import { shaderParams, skyShader } from '../shader'
import type { ShaderParams } from '../shader'
import { ENGINE_CONTRACT, lintTheme, SHADER_MAX, THEME_GLSL_MAX, themeOf, topLevelNames } from './theme'
import type { Theme } from './theme'

// The engine alone: no events of its own, the four functions left to the
// engine's stubs (the sky as it is, every layer outdoors), and no
// wastebasket either, so that what a theme costs is its frame less this
// one's.
export const NO_THEME: Theme = {
  manifest: {
    engine: ENGINE_CONTRACT,
    name: 'none',
    title: 'No theme',
    description: 'The engine alone: the sky, its clouds, weather and events, and nothing of a theme.',
    author: 'Solar Clawd',
    version: '1.0.0',
    license: 'GPL-3.0',
    stage: 'none',
    waits: 'Nothing shows it.',
    context: 'resident',
    events: [],
    previews: [],
    aliases: {},
  },
  glsl: '',
}

// The long night the caps are measured on.
export function longNight(): ShaderParams {
  return shaderParams(
    { ms: Date.UTC(2026, 9, 26, 3), t: 0, place: STOCKHOLM, weather: null, isAuroraForced: true },
    {
      iss: { at: { x: 0.05, y: 0.33 }, trail: { x: -0.02, y: 0.345 } },
      context: { fish: 9, state: 'grill' },
      // Every price known, each as long as a price gets.
      market: { quotes: SYMBOLS.map(() => ({ price: -123456, change: -12.34 })), isFresh: true },
    },
  )
}

// The engine's own top-level names, the wastebasket's among them: what a
// theme may not define again.
export function engineNames(): string[] {
  return topLevelNames(skyShader(longNight(), { ...NO_THEME, manifest: { ...NO_THEME.manifest, context: 'engine' } }))
}

// How much a theme weighs: its GLSL, and the whole shader of the long night
// drawn with it, in characters.
export function weightOf(theme: Theme): { glsl: number; night: number } {
  return { glsl: theme.glsl.length, night: skyShader(longNight(), theme).length }
}

// What is wrong with a theme, empty when nothing is: the lint, and the caps.
export function checkTheme(theme: Theme): string[] {
  const { glsl, night } = weightOf(theme)

  return [
    ...lintTheme(theme.glsl, engineNames()),
    ...(glsl > THEME_GLSL_MAX ? [`its GLSL is ${glsl} characters, more than ${THEME_GLSL_MAX}`] : []),
    ...(night > SHADER_MAX ? [`the whole shader of a long night is ${night} characters, more than ${SHADER_MAX}`] : []),
  ]
}

// A theme as the two files one from elsewhere is.
export function themeFiles(theme: Theme): { 'manifest.json': string; 'theme.glsl': string } {
  return { 'manifest.json': `${JSON.stringify(theme.manifest, null, 2)}\n`, 'theme.glsl': theme.glsl }
}

// A theme from those two files' text; or what is wrong with them.
export function themeOfFiles(manifest: string, glsl: string): Theme | { error: string } {
  let json: unknown
  try {
    json = JSON.parse(manifest)
  } catch (error) {
    return { error: `manifest.json is not JSON: ${String((error as Error).message ?? error)}` }
  }

  return themeOf(json, glsl)
}
