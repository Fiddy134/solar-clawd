// A theme by name or folder, for the tools: one built in (fyr), `none` (the
// engine alone, the four functions stubbed), `glyph-board` (a fixture of the
// font, hooks/themes/fixtures.ts), or a folder holding a
// manifest.json and a theme.glsl, read as the engine would read one from
// elsewhere. Throws with what is wrong.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { NO_THEME, themeOfFiles } from '../../hooks/themes/check.ts'
import { GLYPH_BOARD } from '../../hooks/themes/fixtures.ts'
import { THEMES } from '../../hooks/themes/index.ts'

export function themeNamed(name) {
  if (name === 'none') return NO_THEME
  if (name === 'glyph-board') return GLYPH_BOARD
  if (Object.hasOwn(THEMES, name)) return THEMES[name]
  const dir = resolve(name)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`no theme called "${name}" (${[...Object.keys(THEMES), 'none'].join(', ')}, or a folder with manifest.json and theme.glsl)`)
  }
  const read = file => {
    const path = join(dir, file)
    if (!existsSync(path)) throw new Error(`${name}: no ${file}`)
    return readFileSync(path, 'utf8')
  }
  const theme = themeOfFiles(read('manifest.json'), read('theme.glsl'))
  if ('error' in theme) throw new Error(`${name}: ${theme.error}`)

  return theme
}
