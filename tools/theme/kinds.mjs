// A theme's own kinds, its events and then its previews, one to a line, for
// tools/preview/sheet.sh theme.
//
//   tools/theme/run.sh kinds fyr

import { themeNamed } from './load.mjs'

const theme = themeNamed(process.argv[2] ?? 'fyr')
for (const { kind } of [...theme.manifest.events, ...theme.manifest.previews]) console.log(kind)
