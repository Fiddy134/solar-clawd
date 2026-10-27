// The engine's imports, checked: no file under hooks/ outside hooks/themes/
// imports from a theme's own folder (hooks/themes/fyr, or any other), and
// none but register.tsx, which draws the band, imports the character
// (hooks/clawd.ts). The tests under `claude plugin test` have no file system
// to read sources with, so this runs under node instead:
//
//   node tools/theme/imports.mjs
//
// It prints each import that breaks a rule and exits 1, or prints `clean`.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const hooks = join(root, 'hooks')
const themes = join(hooks, 'themes')
const clawd = join(hooks, 'clawd.ts')
// The files in hooks/themes/ itself (the register, the manifest's checks)
// are the engine's own; only a theme's folder under it is out of bounds.
const isInATheme = path => path.startsWith(themes + '/') && dirname(path) !== themes

function filesUnder(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return filesUnder(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

// A relative specifier as the file it names, with or without its extension.
function resolved(from, spec) {
  const base = resolve(dirname(from), spec)
  for (const path of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(path) && statSync(path).isFile()) return path
  }
  return base
}

// Every `import … from '…'` and `export … from '…'`, over as many lines as
// it takes.
function importsOf(path) {
  const text = readFileSync(path, 'utf8')
  return [...text.matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]/gms)]
    .map(match => match[1])
    .filter(spec => spec.startsWith('.'))
    .map(spec => ({ spec, path: resolved(path, spec) }))
}

const broken = []
for (const file of filesUnder(hooks)) {
  if (file.startsWith(themes + '/')) continue
  const isTest = /\.test\.tsx?$/.test(file)
  for (const { spec, path } of importsOf(file)) {
    if (isInATheme(path)) broken.push(`${relative(root, file)}: '${spec}' is a theme's own`)
    if (path === clawd && !isTest && file !== join(hooks, 'register.tsx')) broken.push(`${relative(root, file)}: '${spec}' is the character`)
  }
}

if (broken.length > 0) {
  for (const line of broken) console.log(line)
  process.exit(1)
}
console.log('clean')
