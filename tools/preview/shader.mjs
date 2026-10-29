// The Ghostty sky shader, run in WebGL (headless Chrome, SwiftShader) over a
// stand-in terminal, as a PNG: and first, whether it compiles at all, which
// Ghostty never says. GLSL ES 3.00 is stricter than Ghostty's GLSL 4.30, so
// what compiles here compiles there.
//
//   tools/preview/run.sh shader --at 2026-10-24T22:00 --weather 2,6,3,40 --time 30
//   --width 1512 --height 982   --demo (a whole day; --time picks the moment)   --aurora
//   --stage 480 (the strip at the right where the lighthouse stands; the stand-in text stops short of it)
//   --diff (Claude Code's own dark fields: a diff's removed and added rows, a tool's highlighted diff with a grey comment, a prompt row, a shell row, and a line of its dimmest text)
//   --p3 (the terminal in Display P3, as a Mac's Ghostty gives it to the shader)
//   --unmarked (a tab Claude has not marked: the terminal as it is)   --unfocused (the window out of focus, iFocus 0)
//   --light (the lighter sky of a Mac on battery or a person away: no clouds)
//   --tune 0.72,1,1,0 (the tune's brightness, text shade, colour and warmth, the same at every part of the day)
//   --tool command --agents 3 (what Claude is doing, in the tab's mark: none, command, edit, read, web or other, and 0 to 7 subagents)
//   --market up|down (prices for a theme that shows them, fresh, every symbol's day up or down; NDX down 2.4 %)
//   --zoom x,y,w,h (a window of the frame, 3x with no smoothing, as <out>-zoom.png beside the whole frame)
//   --bench 200 (ms a frame, and what the theme costs: its frame less the engine's alone, and against fyr's)
//   --rounds 3 (with --bench: a warm-up round thrown away, then three rounds of theme, none and fyr by turns, and the middle ratio)
//   --gpu (the Mac's own GPU instead of SwiftShader) --without clouds,shaded --passthrough
//   --theme fyr (the theme the sky is drawn with, fyr by default; none for the engine alone, the four
//   functions stubbed; or a folder with a manifest.json and a theme.glsl)

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { STOCKHOLM } from '../../hooks/astro.ts'
import { contextAt, EVENTS, eventsAt, shootingRate, specsOf } from '../../hooks/events.ts'
import { TOOLS } from '../../hooks/activity.ts'
import { tabMark } from '../../hooks/mark.ts'
import { shaderParams, skyShader } from '../../hooks/shader.ts'
import { PHASES } from '../../hooks/tune.ts'
import { drawFrame, ROWS } from '../../hooks/clawd.ts'
import { NO_THEME } from '../../hooks/themes/check.ts'
import { THEMES } from '../../hooks/themes/index.ts'
import { themeNamed } from '../theme/load.mjs'
import { cellsSvg, dumpDom, options, OUT, screenshot, timeOf, weatherOf } from './lib.mjs'

// Whether another headless Chrome is drawing on this machine (a preview in
// another checkout, say): a bench taken then measures that as well.
function warnIfBusy() {
  try {
    execFileSync('pgrep', ['-f', 'Google Chrome.*--headless'], { stdio: 'ignore' })
    console.log('warning: another headless Chrome is running on this machine, so this bench is noise; wait for it and run it again')
  } catch {
    // pgrep found none (or is not there): nothing to say.
  }
}

const o = options({ width: 1512, height: 982, time: 20, background: '282c34' })
const [width, height] = [Number(o.width), Number(o.height)]
const stage = o.stage ? Number(o.stage) : 0
const ms = timeOf(o.at)
const background = parseInt(o.background, 16)
const cursor = o.cursor ? String(o.cursor).split(',').map(Number) : [-10000, -10000]
const weather = o.weather ? weatherOf(o.weather) : null
// --event balloon (or several, comma-separated) plays them as a preview would.
const forced = o.event ? String(o.event).split(',').map(kind => ({ kind, at: ms })) : []
const context = contextAt(ms, STOCKHOLM, weather, o.rained ? ms - 600_000 : null)
const theme = themeNamed(o.theme ?? 'fyr')
const events = eventsAt(ms, context, forced, [...EVENTS, ...specsOf(theme)])
// --fish 7 or 7,catch or 7,grill or 0,embers: the tab's mark for its context
// window, the keeper's line of fish (--basket the old name, burn the old grill).
const [fish, fishState] = (o.fish ?? o.basket) === undefined ? [] : String(o.fish ?? o.basket).split(',')
function contextState(state) {
  if (state === undefined) return 'idle'
  if (state === 'burn') return 'grill'
  if (['idle', 'catch', 'grill', 'embers'].includes(state)) return state
  throw new Error(`--fish: no state called "${state}" (idle, catch, grill or embers)`)
}
// What Claude is doing, as the tab's mark carries it.
if (o.tool !== undefined && !TOOLS.includes(String(o.tool))) throw new Error(`--tool: one of ${TOOLS.join(', ')}`)
const work = { tool: o.tool === undefined ? 'none' : String(o.tool), agents: o.agents === undefined ? 0 : Number(o.agents) }
// Prices to preview a market with: BTC, ETH, the Nasdaq-100 and Apple as
// the research saw them on 2026-10-27, the others made up near where they
// stood; the day up, or down for every symbol.
function sampleMarket(day) {
  if (day !== 'up' && day !== 'down') throw new Error(`--market: up or down, not "${day}"`)
  const prices = [80988.83, 2353, 29651.44, 347.28, 512.4, 201.7, 268.9, 231.5, 742.1, 448.2]
  const up = [1.01, 1.24, 1.29, 0.98, 0.61, 2.13, 1.42, 0.35, 0.82, 3.21]
  const down = [-1.73, -2.85, -2.41, -1.12, -0.94, -4.06, -1.88, -2.27, -1.35, -5.62]

  return { quotes: prices.map((price, i) => ({ price: Number(price.toPrecision(5)), change: (day === 'up' ? up : down)[i] })), isFresh: true }
}
// --tune b,s,c,w: one tune for dawn, day, dusk and night alike, as given,
// off the pane's steps if need be.
function tuneOf(text) {
  const [brightness, shade, colour, warmth] = text.split(',').map(Number)
  if (![brightness, shade, colour, warmth].every(Number.isFinite)) throw new Error(`--tune: four numbers, brightness,shade,colour,warmth, not "${text}"`)
  const values = { brightness, shade, colour, warmth }

  return Object.fromEntries(PHASES.map(phase => [phase, values]))
}
const params = shaderParams(
  { ms, t: ms / 1000, place: STOCKHOLM, weather, kp: o.kp ? Number(o.kp) : null, isAuroraForced: !!o.aurora },
  {
    demo: o.demo ? { seconds: 48 } : null,
    events,
    shootingRate: shootingRate(context),
    // --waiting asking|done [--urgent]: Claude waiting, fyr's lighthouse lit
    // (--beacon the old name).
    waiting: (o.waiting ?? o.beacon) ? { mode: o.waiting ?? o.beacon, isUrgent: !!o.urgent } : null,
    // --iss: the station halfway up the southern sky, heading east to west.
    iss: o.iss ? { at: { x: 0.05, y: 0.33 }, trail: { x: -0.02, y: 0.345 } } : null,
    // --y-up: fragCoord as OpenGL (Ghostty on Linux) gives it, to see the flip.
    isYUp: !!o['y-up'],
    stagePx: o.stage ? Number(o.stage) : 0,
    isLight: !!o.light,
    context: fish === undefined ? null : { fish: Number(fish), state: contextState(fishState) },
    market: o.market ? sampleMarket(String(o.market)) : null,
    tune: o.tune ? tuneOf(String(o.tune)) : undefined,
  },
)
if (events.length > 0) console.log('events:', events.map(e => e.kind).join(', '))
// --broken: a shader that cannot compile, to see the check catch it.
// --ufo: every cloud a saucer, to see one.
const whole = o.ufo ? skyShader(params, theme).replace('if (rand(seed + 3) < 0.08) kind = 1 + int(hashi(seed) % 6u);', 'kind = 6;') : skyShader(params, theme)
// --without clouds,scenery: mainImage without those stages, to see what each costs (with --bench).
const left = o.without ? String(o.without).split(',') : []
const sky = whole.split('\n').filter(line => !left.some(name => new RegExp(`sky = ${name}\\(`).test(line))).join('\n')
// --passthrough: the terminal as it is and no sky, the floor a bench of
// the sky is read against.
const passthrough = 'void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(texture(iChannel0, fragCoord / iResolution.xy).rgb, 1.0); }'
const source = (o.passthrough ? passthrough : sky) + (o.broken ? '\nint broken = ;\n' : '')
writeFileSync(join(OUT, 'sky.glsl'), source)

// Ghostty's frame, as WebGL can give it: y from the top, iChannel0 the
// terminal with row 0 at the top.
const fragment = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform vec3 iBackgroundColor;
uniform vec4 iCurrentCursor;
uniform float iTimeCursorChange;
uniform int iFocus;
uniform vec3 iPalette[256];
uniform float iTime;
uniform sampler2D iChannel0;
out vec4 outColor;
${source}
void main() { mainImage(outColor, ${o['y-up'] ? 'gl_FragCoord.xy' : 'vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y)'}); }
`

// --band: the band above the prompt as the mod draws it, the sky showing
// through it (--cell 16 for a Retina window's cells, 8 by default).
const CELL = o.cell ? Number(o.cell) : 8
const bandColumns = Math.floor(width / CELL)
const bandTop = height - 120 - ROWS * CELL * 2 - 8
const bandSvg = o.band
  ? `<svg xmlns="http://www.w3.org/2000/svg" width="${bandColumns * CELL}" height="${ROWS * CELL * 2}" font-family="Menlo" shape-rendering="crispEdges">${cellsSvg(
      drawFrame({
        columns: bandColumns,
        ms,
        t: ms / 1000 + Number(o.time),
        mode: 'live',
        place: STOCKHOLM,
        weather,
        isClear: true,
        event: null,
      }),
      bandColumns,
      ROWS,
      CELL,
      0,
      background,
    )}</svg>`
  : null

const page = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${width}" height="${height}" style="display:block"></canvas>
<pre id="renderer" hidden></pre>
<pre id="log" style="position:absolute;top:0;left:0;margin:8px;color:#f66;font:12px Menlo;white-space:pre-wrap"></pre>
<script>
const log = document.getElementById('log')
const fail = text => { log.textContent = 'FAIL\\n' + text; document.title = 'fail' }
const w = ${width}, h = ${height}
// The stand-in terminal: its background, and lines of light text.
const term = document.createElement('canvas')
term.width = w; term.height = h
const t = term.getContext('2d')
// --retina: the stand-in drawn at twice the scale, as a Mac's Retina window has it.
const k = ${o.retina ? 2 : 1}
t.scale(k, k)
t.fillStyle = '#${o.background}'; t.fillRect(0, 0, w, h)
t.font = '13px Menlo'; t.fillStyle = '#d7dae0'
const lines = ['● Solar Clawd: the sky behind the terminal', '', '  Read 1 file, ran 2 shell commands', '', '❯ how does it read?', '', '  ⎿  tools/preview/run.sh shader --at 22:00']
lines.forEach((line, i) => t.fillText(line, 16, 40 + i * 20, w - ${stage} - 32))
// --diff: Claude Code's dark fields in the colours its dark theme gives
// them (2.1.310): a diff's removed rows on diffRemoved and added rows on
// diffAdded; a tool's diff as color-diff highlights it, its rows and the
// words changed in them on colours of its own; a prompt row on
// userMessageBackground and a shell row on bashMessageBackground, light
// text on each; and a line of subtle, its dimmest text, on the plain
// background.
if (${!!o.diff}) {
  const removed = 'rgb(122,41,54)', added = 'rgb(34,92,43)', user = 'rgb(55,55,55)', bash = 'rgb(65,60,65)'
  const deleteLine = 'rgb(61,1,0)', deleteWord = 'rgb(92,2,0)', addLine = 'rgb(2,40,0)', addWord = 'rgb(4,71,0)'
  const diff = [
    [removed, '  41 -  const days = weekdays(start, end)'],
    [removed, '  42 -  return days.length'],
    [added, '  41 +  const days = weekdays(start, end).filter(isOpen)'],
    [added, '  42 +  if (days.length === 0) return null'],
    [added, '  43 +  return days.length'],
    [null, ''],
    [deleteLine, '  12 -  const GLASS = 0.4;', [deleteWord, '0.4']],
    [addLine, '  12 +  const GLASS = 0.55;', [addWord, '0.55']],
    [addLine, '  13 +  // lighter, so the sky shows through', null, 'rgb(106,115,125)'],
    [null, ''],
    [user, '> and the weekends?'],
    [null, ''],
    [bash, '! git status --short'],
  ]
  diff.forEach(([fill, line, word, ink], i) => {
    if (fill) { t.fillStyle = fill; t.fillRect(0, 186 + i * 20, w, 20) }
    if (word) {
      const at = line.lastIndexOf(word[1])
      t.fillStyle = word[0]; t.fillRect(16 + t.measureText(line.slice(0, at)).width, 186 + i * 20, t.measureText(word[1]).width, 20)
    }
    t.fillStyle = ink ?? '#d7dae0'; t.fillText(line, 16, 200 + i * 20, w - ${stage} - 32)
  })
  t.fillStyle = 'rgb(80,80,80)'; t.fillText('     … +12 lines (ctrl+o to expand)', 16, 200 + diff.length * 20, w - ${stage} - 32)
  t.fillStyle = '#d7dae0'
}
// --prose: a reply of long paragraphs as a Retina window shows them (22px
// text on 27px rows), to see the shade behind text on a bright sky; the
// second and third in Claude Code's two greys, its inactive and subtle text.
if (${!!o.prose}) {
  t.font = '22px Menlo'
  const inks = ['#d7dae0', 'rgb(153,153,153)', 'rgb(80,80,80)', '#d7dae0']
  const words = 'Det fanns förr en fyrvaktare på en liten ö långt ut i Bottenhavet som hade för vana att skriva ner vädret varje morgon i en tjock, klotbunden bok. Han skrev inte bara vindriktning och lufttryck, utan också hur himlen såg ut.'.split(' ')
  let row = 0
  for (let p = 0; p < 4; p++) {
    t.fillStyle = inks[p]
    let line = p === 0 ? '● ' : '  '
    for (let i = 0; i < 3 * words.length; i++) {
      const word = words[(i + p * 7) % words.length]
      if (t.measureText(line + word).width > w - ${stage} - 64) { t.fillText(line, 16, 330 + row++ * 27); line = '  ' }
      line += word + ' '
    }
    t.fillText(line, 16, 330 + row++ * 27)
    row++
  }
  t.font = '13px Menlo'; t.fillStyle = '#d7dae0'
}
t.fillStyle = '#3e4451'; t.fillRect(0, h / k - 120, w, 22)
t.fillStyle = '#98c379'; t.fillText('Model: Opus 5.5 | Ctx Used: 14.0%', 16, h / k - 60)
// --p3: the terminal as a Mac's Ghostty hands it to the shader, its sRGB
// colours converted to Display P3 (the background as good as unchanged).
if (${!!o.p3}) {
  const image = t.getImageData(0, 0, w, h), d = image.data
  const decode = new Float32Array(256).map((_, v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
  const encode = v => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)))
  for (let i = 0; i < d.length; i += 4) {
    const r = decode[d[i]], g = decode[d[i + 1]], b = decode[d[i + 2]]
    d[i] = encode(0.8225 * r + 0.1774 * g)
    d[i + 1] = encode(0.0332 * r + 0.9669 * g)
    d[i + 2] = encode(0.0171 * r + 0.0724 * g + 0.9108 * b)
  }
  t.putImageData(image, 0, 0)
}
const render = () => {
const gl = document.getElementById('c').getContext('webgl2', { preserveDrawingBuffer: true })
if (!gl) fail('no WebGL2')
// What it ran on, said with every run: a bench on SwiftShader and one on
// the GPU are not the same kind of number.
const info = gl && gl.getExtension('WEBGL_debug_renderer_info')
if (gl) document.getElementById('renderer').textContent = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
const shader = (type, text) => {
  const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
  return s
}
try {
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, '#version 300 es\\nin vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, ${JSON.stringify(fragment)}))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, term)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.uniform3f(gl.getUniformLocation(program, 'iResolution'), w, h, 1)
  gl.uniform1f(gl.getUniformLocation(program, 'iTime'), ${Number(o.time)})
  gl.uniform1i(gl.getUniformLocation(program, 'iChannel0'), 0)
  // --cursor x,y (its centre, y down) and --since s: a cursor that moved s seconds ago.
  gl.uniform4f(gl.getUniformLocation(program, 'iCurrentCursor'), ${cursor[0] - 5}, ${cursor[1] + 10}, 10, 20)
  gl.uniform1f(gl.getUniformLocation(program, 'iTimeCursorChange'), ${Number(o.time) - Number(o.since ?? 100)})
  gl.uniform1i(gl.getUniformLocation(program, 'iFocus'), ${o.unfocused ? 0 : 1})
  // A tab Claude has marked (register.tsx, markTab), or with --unmarked one
  // it has not, colour 16 as xterm has it.
  gl.uniform3f(gl.getUniformLocation(program, 'iPalette[16]'), ${o.unmarked ? '0, 0, 0' : tabMark(params.context, work).map(v => v / 255).join(', ')})
  gl.uniform3f(gl.getUniformLocation(program, 'iBackgroundColor'), ${((background >> 16) & 255) / 255}, ${((background >> 8) & 255) / 255}, ${(background & 255) / 255})
  gl.viewport(0, 0, w, h)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  // --bench n: the time a frame takes, over n frames, each read back so
  // the next waits for it (SwiftShader on the CPU, or with --gpu the GPU).
  const runs = ${Number(o.bench ?? 0)}
  if (runs > 0) {
    const pixel = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    const begin = performance.now()
    for (let i = 0; i < runs; i++) { gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel) }
    document.title = 'ok ' + ((performance.now() - begin) / runs).toFixed(2)
  } else document.title = 'ok'
} catch (error) { fail(String(error.message || error)) }
}
const bandSvg = ${JSON.stringify(bandSvg)}
if (bandSvg) {
  const band = new Image()
  band.onload = () => { t.drawImage(band, 0, ${bandTop}); render() }
  band.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(bandSvg)
} else render()
</script></body></html>`
const html = join(OUT, `${o.out ?? 'shader'}.html`)
writeFileSync(html, page)

const webgl = o.gpu ? 'gpu' : true
if (o.bench && !o['bench-alone']) warnIfBusy()
// An event up costs an engine pass wherever a theme's themeWindow is above
// 0: everywhere for none, less for a theme with walls. The difference of
// theme and none then leaves part of that pass out, and the ratio is not a
// measure of the theme.
if (o.bench && !o['bench-alone'] && o.event) {
  console.log("warning: with --event the ratio to fyr is not a measure; bench your theme with and without --event, each with --bench-alone, and keep the ratio for the scene without events")
}
const dom = dumpDom(html, webgl)
const renderer = /<pre id="renderer"[^>]*>([\s\S]*?)<\/pre>/.exec(dom)?.[1]
console.log('renderer:', renderer ? renderer.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : 'unknown')
const failed = /<title>fail<\/title>/.test(dom) || !/<title>ok( [\d.]+)?<\/title>/.test(dom)
if (failed) {
  const text = /<pre id="log"[^>]*>([\s\S]*?)<\/pre>/.exec(dom)?.[1] ?? dom.slice(0, 2000)
  console.error(text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
  process.exit(1)
}
if (o.bench) {
  const frame = /<title>ok ([\d.]+)<\/title>/.exec(dom)?.[1]
  console.log(`${frame} ms a frame`)
  // What the theme costs: its frame less the engine's alone, the same
  // scene drawn with --theme none, and that against what fyr's costs. The
  // others run one after the other in a process each, as this one did; on
  // a busy machine the difference is noise, so read it on a calm one.
  if (!o['bench-alone'] && theme !== NO_THEME) {
    const other = (name, label = name) => {
      const args = [...process.argv.slice(2), '--theme', name, '--bench-alone', '--out', `${o.out ?? 'shader'}-${label}`]
      const text = execFileSync(process.execPath, [process.argv[1], ...args], { encoding: 'utf8', env: process.env })
      return Number(/([\d.]+) ms a frame/.exec(text)?.[1])
    }
    const rounds = Math.max(1, Math.floor(Number(o.rounds ?? 1)))
    if (rounds === 1) {
      const none = other('none')
      const cost = Number(frame) - none
      console.log(`none: ${none.toFixed(2)} ms a frame`)
      console.log(`theme cost = ${Number(frame).toFixed(2)} − ${none.toFixed(2)} = ${cost.toFixed(2)} ms a frame`)
      const fyrCost = theme === THEMES.fyr ? cost : other('fyr') - none
      console.log(`ratio to fyr = ${(cost / fyrCost).toFixed(2)}${theme === THEMES.fyr ? ' (this is fyr)' : ` (fyr's cost ${fyrCost.toFixed(2)} ms a frame)`}`)
    } else {
      // --rounds n: the frame above was the theme's first, which reads
      // high on a shader the browser has not compiled before, so it is
      // thrown away with a whole round after it (none and fyr new as well).
      // Then n rounds of the theme, none and fyr by turns, each round its
      // own ratio. A round whose none is more than 15 % slower than the
      // quietest none ran on a busy machine and is left out; the ratio is
      // the middle one of the rest.
      const self = o.theme ?? 'fyr'
      const isFyr = theme === THEMES.fyr
      const measured = []
      for (let i = 0; i <= rounds; i++) {
        warnIfBusy()
        const themeFrame = other(self, 'theme')
        const none = other('none')
        const fyrFrame = isFyr ? themeFrame : other('fyr')
        const round = { themeFrame, none, cost: themeFrame - none, fyrCost: fyrFrame - none }
        const said = `theme ${themeFrame.toFixed(2)}, none ${none.toFixed(2)}, fyr ${fyrFrame.toFixed(2)} ms a frame: cost ${round.cost.toFixed(2)} against fyr's ${round.fyrCost.toFixed(2)}, ratio ${(round.cost / round.fyrCost).toFixed(2)}`
        if (i === 0) console.log(`warm-up, not counted: ${said}`)
        else {
          console.log(`round ${i}: ${said}`)
          measured.push(round)
        }
      }
      const quietest = Math.min(...measured.map(round => round.none))
      const kept = measured.filter(round => round.none <= 1.15 * quietest)
      if (kept.length < measured.length) console.log(`left out: ${measured.length - kept.length} round(s) whose none was over 15 % slower than the quietest, ${quietest.toFixed(2)} ms`)
      const middle = values => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)]
      const ratio = middle(kept.map(round => round.cost / round.fyrCost))
      console.log(`theme cost ${middle(kept.map(round => round.cost)).toFixed(2)} ms a frame, fyr's ${middle(kept.map(round => round.fyrCost)).toFixed(2)}, the middle of ${kept.length} round(s)`)
      console.log(`ratio to fyr = ${ratio.toFixed(2)}${isFyr ? ' (this is fyr)' : ''}`)
    }
  }
  process.exit(0)
}
const name = o.out ?? 'shader'
const png = screenshot(html, width, height, name, webgl)
console.log(png)
if (o.zoom) {
  const [zx, zy, zw, zh] = String(o.zoom).split(',').map(Number)
  const big = join(OUT, `${name}-zoom.html`)
  writeFileSync(
    big,
    `<!doctype html><body style="margin:0;background:#000;overflow:hidden"><div style="width:${zw * 3}px;height:${zh * 3}px;overflow:hidden;position:relative"><img src="file://${png}" style="position:absolute;left:${-zx * 3}px;top:${-zy * 3}px;width:${width * 3}px;height:${height * 3}px;image-rendering:pixelated"></div></body>`,
  )
  console.log(screenshot(big, zw * 3, zh * 3, `${name}-zoom`))
}
console.log(`${source.length} chars, scene`, JSON.stringify(params.scene))
