// A theme built in, written out as the two files a theme from elsewhere is:
// <out>/manifest.json and <out>/theme.glsl. Read back through the engine's
// own check, so what is written is a theme that loads.
//
//   tools/theme/run.sh pack fyr .preview/fyr-packed

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { checkTheme, themeFiles } from '../../hooks/themes/check.ts'
import { THEMES } from '../../hooks/themes/index.ts'
import { themeNamed } from './load.mjs'

const [name, out] = process.argv.slice(2)
if (!name || !out || !Object.hasOwn(THEMES, name)) {
  console.error(`usage: tools/theme/run.sh pack <${Object.keys(THEMES).join('|')}> <folder>`)
  process.exit(1)
}
const dir = resolve(out)
mkdirSync(dir, { recursive: true })
for (const [file, text] of Object.entries(themeFiles(THEMES[name]))) writeFileSync(join(dir, file), text)
const back = themeNamed(dir)
const problems = checkTheme(back)
for (const problem of problems) console.log(`  ${problem}`)
if (problems.length > 0) process.exit(1)
console.log(dir)
