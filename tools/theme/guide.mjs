// The theme guide, docs/THEME-GUIDE.md, as hooks/guide.test.tsx reads it:
// a test under `claude plugin test` has no file system, so the guide's text
// is copied into hooks/themes/guide.ts, which the test imports. And the
// guide's template (§15), its two files written out as a theme's folder.
//
//   node tools/theme/guide.mjs                         (writes hooks/themes/guide.ts)
//   node tools/theme/guide.mjs --check                 (exits 1 if that copy is not the guide as it is)
//   node tools/theme/guide.mjs template themes/<name>  (writes the template's manifest.json, named after the folder, and theme.glsl)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const guidePath = join(root, 'docs/THEME-GUIDE.md')
const copyPath = join(root, 'hooks/themes/guide.ts')
const guide = readFileSync(guidePath, 'utf8')

// The copy as the test imports it: the guide's text whole, as one string.
const copy = `// docs/THEME-GUIDE.md as text, for hooks/guide.test.tsx, which has no file
// system to read it with. Written by \`node tools/theme/guide.mjs\` after each
// change to the guide, never by hand.
export const THEME_GUIDE: string = ${JSON.stringify(guide)}
`

// The text of each fenced block tagged `tag`, in order.
function blocks(text, tag) {
  const found = []
  let open = null
  for (const line of text.split('\n')) {
    if (open === null && line.startsWith('```') && line.slice(3).trim() !== '') open = { tag: line.slice(3).trim(), lines: [] }
    else if (open !== null && line.startsWith('```')) {
      if (open.tag === tag) found.push(`${open.lines.join('\n')}\n`)
      open = null
    } else if (open !== null) open.lines.push(line)
  }

  return found
}

const [command, folder] = process.argv.slice(2)
if (command === undefined) {
  writeFileSync(copyPath, copy)
  console.log(copyPath)
} else if (command === '--check') {
  if (!existsSync(copyPath) || readFileSync(copyPath, 'utf8') !== copy) {
    console.log('hooks/themes/guide.ts is not the guide as it is: run node tools/theme/guide.mjs')
    process.exit(1)
  }
  console.log('clean')
} else if (command === 'template' && folder) {
  const [manifest] = blocks(guide, 'json-template')
  const [glsl] = blocks(guide, 'glsl-template')
  if (!manifest || !glsl) {
    console.error('the guide has no template (blocks tagged json-template and glsl-template)')
    process.exit(1)
  }
  const dir = resolve(folder)
  mkdirSync(dir, { recursive: true })
  // The manifest named after its folder, as the lint wants it, where the
  // folder's name is one a theme may have.
  const name = basename(dir)
  const named = /^[a-z0-9-]{1,32}$/.test(name) ? manifest.replace('"name": "my-theme"', `"name": "${name}"`) : manifest
  writeFileSync(join(dir, 'manifest.json'), named)
  writeFileSync(join(dir, 'theme.glsl'), glsl)
  console.log(dir)
} else {
  console.error('usage: node tools/theme/guide.mjs [--check | template <folder>]')
  process.exit(1)
}
