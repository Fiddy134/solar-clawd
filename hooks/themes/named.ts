// A theme by its name, for /solar theme: one built in, or a folder of the
// plugin's own themes/ holding a manifest.json and a theme.glsl, read and
// checked as any theme from elsewhere is before the sky is drawn with it.

import type { EngineInterface } from 'claude-code'

import { checkTheme, themeOfFiles } from './check'
import { THEMES } from './index'
import type { Theme } from './theme'

// A theme's name as a folder may have it: no path, no dots.
const NAME = /^[a-z0-9][a-z0-9-]{0,31}$/

// Every theme the sky can be drawn with: those built in first, then the
// folders under themes/, by name.
export async function themeNames($: EngineInterface): Promise<string[]> {
  const entries = await $.fs.list(`${$.plugin.root}/themes`).catch(() => [])
  const folders = entries.filter(entry => entry.kind === 'dir' && NAME.test(entry.name)).map(entry => entry.name)

  return [...Object.keys(THEMES), ...folders.filter(name => !Object.hasOwn(THEMES, name)).sort()]
}

// The theme called `name`, or what keeps the sky from being drawn with it.
export async function themeNamed($: EngineInterface, name: string): Promise<Theme | { error: string }> {
  if (Object.hasOwn(THEMES, name)) return THEMES[name as keyof typeof THEMES]
  if (!NAME.test(name)) return { error: `no theme called "${name}"` }
  const folder = `${$.plugin.root}/themes/${name}`
  const [manifest, glsl] = await Promise.all([
    $.fs.read(`${folder}/manifest.json`).catch(() => null),
    $.fs.read(`${folder}/theme.glsl`).catch(() => null),
  ])
  if (manifest === null || glsl === null) return { error: `no theme called "${name}"` }
  const theme = themeOfFiles(manifest, glsl)
  if ('error' in theme) return { error: `${name}: ${theme.error}` }
  if (theme.manifest.name !== name) return { error: `${name}: its manifest calls it "${theme.manifest.name}"` }
  const wrong = checkTheme(theme)

  return wrong.length > 0 ? { error: `${name}: ${wrong[0]}` } : theme
}
