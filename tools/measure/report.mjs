// A run of tools/measure/gpu.sh as markdown: its machine, every row, and
// the three tables the questions need (what each animation setting really
// draws, what the sky costs over the floor, the branch against main).
//   node tools/measure/report.mjs .preview/measure/out/<run>
// powermetrics*.log, when the run had sudo, is cut into the rows by time:
// the instance's own GPU time (ms/s, Activity Monitor's "% GPU" is a tenth
// of it), WindowServer's, and the GPU's power and active residency. macOS 27
// gives every process 0.00 ms/s, so those columns are left out when no row
// has any.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const dir = process.argv[2]
if (!dir || !existsSync(join(dir, 'rows.tsv'))) {
  console.error('usage: node tools/measure/report.mjs <run folder with rows.tsv>')
  process.exit(2)
}

const [header, ...lines] = readFileSync(join(dir, 'rows.tsv'), 'utf8').trim().split('\n')
const names = header.split('\t')
const rows = lines.filter(Boolean).map(line => Object.fromEntries(line.split('\t').map((value, i) => [names[i], value])))
const number = text => (text === undefined || text === '' || text === '-' ? null : Number(text))

// powermetrics' text: samples headed "*** Sampled system activity (Mon Oct
// 26 17:01:02 2026 +0100) (1001.23ms elapsed) ***", each with a task table
// and the GPU's lines.
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
export function samplesOf(text) {
  const parts = text.split(/^\*\*\* Sampled system activity \((.+?)\) \(([\d.]+) ?ms elapsed\) \*\*\*$/m)
  const samples = []
  let isTaskHeaderSeen = false
  for (let i = 1; i + 2 < parts.length; i += 3) {
    const [stamp, , body = ''] = [parts[i], parts[i + 1], parts[i + 2]]
    const m = /\w{3} (\w{3}) +(\d+) (\d\d):(\d\d):(\d\d) (\d{4}) ([+-])(\d\d)(\d\d)/.exec(stamp)
    if (!m) continue
    const offset = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]))
    const at = (Date.UTC(Number(m[6]), MONTHS[m[1]], Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])) - offset * 60_000) / 1000
    const tasks = new Map()
    const bodyLines = body.split('\n')
    const top = bodyLines.findIndex(line => /^Name\s+ID\s+CPU ms\/s/.test(line))
    if (top >= 0) {
      isTaskHeaderSeen = true
      const isGpuLast = /GPU ms\/s\s*$/.test(bodyLines[top])
      for (const line of bodyLines.slice(top + 1)) {
        if (!line.trim()) break
        const words = line.trim().split(/\s+/)
        // The name may hold spaces; the first whole number after it is the pid.
        const at = words.findIndex((word, i) => i > 0 && /^\d+$/.test(word))
        if (at < 0) continue
        tasks.set(Number(words[at]), { cpu: Number(words[at + 1]), gpu: isGpuLast ? Number(words.at(-1)) : null })
      }
    }
    const find = re => (re.exec(body) ? Number(re.exec(body)[1]) : null)
    samples.push({
      at,
      tasks,
      power: find(/GPU (?:HW )?Power:\s*([\d.]+)\s*mW/i),
      residency: find(/GPU HW active residency:\s*([\d.]+)%/),
      frequency: find(/GPU HW active frequency:\s*([\d.]+)\s*MHz/),
    })
  }

  return { samples, isTaskHeaderSeen }
}

const mean = values => {
  const known = values.filter(v => v !== null && !Number.isNaN(v))
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null
}
const fixed = (value, digits = 1) => (value === null || value === undefined ? '–' : value.toFixed(digits))

// One log for a whole plan, or one per row where live or single rows share
// a folder; every sample carries its time, so they read as one.
const pmFiles = readdirSync(dir).filter(name => /^powermetrics(-.+)?\.log$/.test(name)).sort()
const pm = pmFiles.length ? samplesOf(pmFiles.map(name => readFileSync(join(dir, name), 'utf8')).join('\n')) : null
for (const row of rows) {
  if (!pm) continue
  const [start, end] = [number(row.start), number(row.end)]
  const inside = pm.samples.filter(s => s.at > start + 0.5 && s.at <= end + 0.5)
  row.pm_n = inside.length
  row.ghostty_gpu = mean(inside.map(s => s.tasks.get(Number(row.ghostty_pid))?.gpu ?? null))
  row.server_gpu = mean(inside.map(s => s.tasks.get(Number(row.server_pid))?.gpu ?? null))
  row.power = mean(inside.map(s => s.power))
  row.residency = mean(inside.map(s => s.residency))
}

// Per-process GPU time is only shown when powermetrics gave some.
const hasGpuTime = rows.some(r => r.ghostty_gpu > 0 || r.server_gpu > 0)

const out = []
const say = (...text) => out.push(...text)
const table = (heads, body) => {
  say(`| ${heads.join(' | ')} |`, `|${heads.map(() => '---').join('|')}|`)
  for (const cells of body) say(`| ${cells.join(' | ')} |`)
  say('')
}

say(`# GPU-mätning ${basename(dir)}`, '')
if (existsSync(join(dir, 'context.txt'))) say('```', readFileSync(join(dir, 'context.txt'), 'utf8').trim(), '```', '')
if (!existsSync(join(dir, 'done'))) say('**Körningen blev inte klar** (ingen `done`-markör); raderna nedan är de som hann mätas.', '')
if (!pm) say('Ingen powermetrics-logg (`--no-sudo`): bara ioreg och CPU, ingen GPU-tid per process och ingen effekt.', '')
else if (pm.samples.length === 0) say('**powermetrics-loggen har inga prov som rapporten kan läsa** (rubrikraden har ett annat format); GPU-tid per process och effekt saknas.', '')
else if (!pm.samples.some(s => s.power !== null)) say('powermetrics-loggen har ingen rad `GPU Power` som rapporten känner igen; effekten saknas.', '')
if (pm && pm.samples.length && !pm.isTaskHeaderSeen) say(`**powermetrics-loggen har ${pm.samples.length} prov men ingen tabell över processer** som rapporten känner igen; GPU-tid per process saknas.`, '')
else if (pm && pm.isTaskHeaderSeen && !hasGpuTime) say('powermetrics ger 0.00 GPU ms/s för varje process (macOS 27), så GPU-tid per process saknas; kostnaden står på device % och GPU mW, som gäller hela maskinen.', '')

// Rows measured more than once (the ABBA passes) are averaged by their key.
const keyOf = row => [row.shader, row.animation, row.focus, row.activity, row.mark].join(' ')
const groups = new Map()
for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row])
const avg = (key, field) => mean((groups.get(key) ?? []).map(row => (typeof row[field] === 'number' ? row[field] : number(row[field]))))

say('## Alla rader', '')
table(
  ['#', 'varv', 'shader', 'animation', 'fokus', 'aktivitet', 'flik', 'device %', 'Ghostty CPU %', 'WindowServer CPU %', ...(hasGpuTime ? ['Ghostty GPU ms/s', 'WindowServer GPU ms/s'] : []), 'GPU mW', 'fps', 'anm.'],
  rows.map(r => [
    r.index, r.pass, r.shader, r.animation, r.focus, r.activity, r.mark,
    `${fixed(number(r.device_mean))} ± ${fixed(number(r.device_sd))}`,
    fixed(number(r.ghostty_cpu_mean)), fixed(number(r.server_cpu_mean)),
    ...(hasGpuTime ? [fixed(r.ghostty_gpu ?? null), fixed(r.server_gpu ?? null)] : []), fixed(r.power ?? null, 0),
    r.fps ?? '–', r.note ?? '',
  ]),
)

const probes = rows.filter(r => r.shader === 'probe')
if (probes.length) {
  say('## Vad varje inställning ritar (proben, bildrutor per sekund)', '')
  say('För täckt, minimerad och flik gäller siffran hela sträckan fönstret var dolt, från en bild före till en efter.', '')
  const activities = [...new Set(probes.map(r => r.activity))]
  const focuses = ['focused', 'unfocused', 'covered', 'minimized', 'tab'].filter(f => probes.some(r => r.focus === f))
  for (const activity of activities) {
    say(`**${activity}**`, '')
    table(['animation', ...focuses], ['true', 'false', 'always'].filter(a => probes.some(r => r.animation === a && r.activity === activity)).map(a => [
      a,
      ...focuses.map(f => {
        const key = `probe ${a} ${f} ${activity} marked`
        return groups.has(key) ? `${fixed(avg(key, 'fps'))} fps, ${fixed(avg(key, 'device_mean'))} %` : '–'
      }),
    ]))
  }
}

const floorKey = 'passthrough true focused idle marked'
const floor = groups.has(floorKey) ? { device: avg(floorKey, 'device_mean'), gpu: avg(floorKey, 'ghostty_gpu'), power: avg(floorKey, 'power') } : null
const noneKey = 'none true focused idle marked'
if (floor) {
  say('## Golvet', '')
  const gpuOf = key => (hasGpuTime ? `, ${fixed(avg(key, 'ghostty_gpu'))} GPU ms/s` : '')
  say(`Genomsläppningsshadern, fokuserad och stilla: ${fixed(floor.device)} % device${gpuOf(floorKey)}, ${fixed(floor.power, 0)} mW${groups.has(noneKey) ? `; utan shader ${fixed(avg(noneKey, 'device_mean'))} % device${gpuOf(noneKey)}, ${fixed(avg(noneKey, 'power'), 0)} mW` : ''}. Himlens kostnad nedan räknas över golvet i samma läge: genomsläppningen (eller proben, som kostar detsamma) med samma animation och fokus, och stilla om aktiviteten inte mättes för den.`, '')
}

const scenes = [...groups.keys()].filter(key => key.split(' ')[0].includes(':'))
if (scenes.length) {
  say('## Vad himlen kostar', '')
  const over = (value, base, digits = 1) => (value === null || base === null || base === undefined ? '–' : `${value - base >= 0 ? '+' : ''}${(value - base).toFixed(digits)}`)
  // A scene's floor is the empty shader in the same state, since an
  // unfocused window under true draws nothing whatever the shader is.
  const floorOf = key => {
    const [, animation, focus, activity] = key.split(' ')
    for (const shader of ['passthrough', 'probe']) {
      for (const act of [activity, 'idle']) {
        const candidate = `${shader} ${animation} ${focus} ${act} marked`
        if (groups.has(candidate)) return candidate
      }
    }
    return focus === 'focused' && groups.has(floorKey) ? floorKey : null
  }
  table(
    ['shader', 'animation', 'fokus', 'aktivitet', 'flik', 'device %', 'över golvet', ...(hasGpuTime ? ['Ghostty GPU ms/s', 'över golvet'] : []), 'GPU mW', 'över golvet', 'golv', 'n'],
    scenes.map(key => {
      const [shader, animation, focus, activity, mark] = key.split(' ')
      const base = floorOf(key)
      const device = avg(key, 'device_mean'), gpu = avg(key, 'ghostty_gpu'), power = avg(key, 'power')
      const at = field => (base ? avg(base, field) : null)
      return [
        shader, animation, focus, activity, mark,
        fixed(device), over(device, at('device_mean')),
        ...(hasGpuTime ? [fixed(gpu), over(gpu, at('ghostty_gpu'))] : []),
        fixed(power, 0), over(power, at('power'), 0), base ?? '–', groups.get(key).length,
      ]
    }),
  )

  const pairs = scenes.filter(key => key.startsWith('ljus-himmel:')).map(key => [key, key.replace(/^ljus-himmel:/, 'main:')]).filter(([, other]) => groups.has(other))
  if (pairs.length) {
    say('## Grenen mot main', '')
    table(
      ['scen', 'animation', 'fokus', 'aktivitet', 'flik', 'device % main → gren', ...(hasGpuTime ? ['GPU ms/s main → gren'] : []), 'mW main → gren'],
      pairs.map(([branch, base]) => {
        const [shader, animation, focus, activity, mark] = branch.split(' ')
        const both = field => `${fixed(avg(base, field), field === 'power' ? 0 : 1)} → ${fixed(avg(branch, field), field === 'power' ? 0 : 1)}`
        return [shader.split(':')[1], animation, focus, activity, mark, both('device_mean'), ...(hasGpuTime ? [both('ghostty_gpu')] : []), both('power')]
      }),
    )
  }
}

const lives = rows.filter(r => r.shader === 'live')
if (lives.length) {
  say('## Den levande fliken, med moddens egen policy', '')
  table(['läge', 'device %', 'Ghostty CPU %', ...(hasGpuTime ? ['Ghostty GPU ms/s'] : []), 'GPU mW'], lives.map(r => [
    r.focus, `${fixed(number(r.device_mean))} ± ${fixed(number(r.device_sd))}`, fixed(number(r.ghostty_cpu_mean)), ...(hasGpuTime ? [fixed(r.ghostty_gpu ?? null)] : []), fixed(r.power ?? null, 0),
  ]))
}

const twice = [...groups.entries()].filter(([key]) => !key.startsWith('live ')).filter(([, list]) => list.some(r => r.pass === '1') && list.some(r => r.pass === '2'))
if (twice.length) {
  say('## Drift mellan varven', '')
  say('Samma rad i första och andra varvet (ABBA); en stor skillnad betyder att maskinen ändrade sig under körningen.', '')
  table(['rad', 'device % varv 1', 'varv 2', 'skillnad'], twice.map(([key, list]) => {
    const one = mean(list.filter(r => r.pass === '1').map(r => number(r.device_mean)))
    const two = mean(list.filter(r => r.pass === '2').map(r => number(r.device_mean)))
    return [key, fixed(one), fixed(two), fixed(two - one)]
  }))
}

console.log(out.join('\n'))
