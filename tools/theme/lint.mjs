// A theme checked as the engine would take it: the lint (no loop the GPU
// could hang on, nothing that reads the terminal, no engine name defined
// again) and the caps on its GLSL and on the whole shader of a long night.
//
//   tools/theme/run.sh lint fyr
//   tools/theme/run.sh lint path/to/folder     (manifest.json + theme.glsl)
//
// Prints what is wrong and exits 1, or prints the weights and `clean`.

import { existsSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { checkTheme, weightOf } from '../../hooks/themes/check.ts'
import { THEMES } from '../../hooks/themes/index.ts'
import { SHADER_MAX, stagePtOf, THEME_GLSL_MAX } from '../../hooks/themes/theme.ts'
import { themeNamed } from './load.mjs'

const name = process.argv[2]
if (!name) {
  console.error('usage: tools/theme/run.sh lint <name|folder>')
  process.exit(1)
}
let theme
try {
  theme = themeNamed(name)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const { glsl, night } = weightOf(theme)
console.log(`${theme.manifest.name}: GLSL ${glsl} of ${THEME_GLSL_MAX} characters, the long night's shader ${night} of ${SHADER_MAX}`)
console.log(theme.manifest.stage === 'wanted' ? `  the stage ${stagePtOf(theme)} points wide` : '  no stage')
const problems = checkTheme(theme)
// A theme in a folder is named after it, as the sheet's folder is.
const isFolder = !['none', 'glyph-board'].includes(name) && !Object.hasOwn(THEMES, name) && existsSync(resolve(name)) && statSync(resolve(name)).isDirectory()
const folder = basename(resolve(name))
if (isFolder && theme.manifest.name !== folder) problems.push(`its manifest's name is "${theme.manifest.name}", not its folder's, "${folder}"`)
for (const problem of problems) console.log(`  ${problem}`)
console.log(problems.length === 0 ? 'clean' : `${problems.length} to put right`)
process.exit(problems.length === 0 ? 0 : 1)
