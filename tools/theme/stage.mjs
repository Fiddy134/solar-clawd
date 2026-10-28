// How wide a theme wants the stage strip, in points (0 for one that wants
// none), for tools/preview/sheet.sh theme, which draws it at that width.
//
//   tools/theme/run.sh stage fyr

import { stagePtOf } from '../../hooks/themes/theme.ts'
import { themeNamed } from './load.mjs'

const theme = themeNamed(process.argv[2] ?? 'fyr')
console.log(theme.manifest.stage === 'wanted' ? stagePtOf(theme) : 0)
