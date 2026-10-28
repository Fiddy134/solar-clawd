// A theme checked as the engine would take it: the lint (no loop the GPU
// could hang on, nothing that reads the terminal, no engine name defined
// again) and the caps on its GLSL and on the whole shader of a long night.
//
//   tools/theme/run.sh lint fyr
//   tools/theme/run.sh lint path/to/folder     (manifest.json + theme.glsl)
//
// Prints what is wrong and exits 1, or prints the weights and `clean`.

import { checkTheme, weightOf } from '../../hooks/themes/check.ts'
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
for (const problem of problems) console.log(`  ${problem}`)
console.log(problems.length === 0 ? 'clean' : `${problems.length} to put right`)
process.exit(problems.length === 0 ? 0 : 1)
