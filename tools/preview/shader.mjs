// The Ghostty sky shader, run in WebGL (headless Chrome, SwiftShader) over a
// stand-in terminal, as a PNG: and first, whether it compiles at all, which
// Ghostty never says. GLSL ES 3.00 is stricter than Ghostty's GLSL 4.30, so
// what compiles here compiles there.
//
//   tools/preview/run.sh shader --at 2026-10-24T22:00 --weather 2,6,3,40 --time 30
//   --width 1512 --height 982   --demo (a whole day; --time picks the moment)   --aurora

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { STOCKHOLM } from '../../hooks/astro.ts'
import { contextAt, eventsAt, shootingRate } from '../../hooks/events.ts'
import { shaderParams, skyShader } from '../../hooks/shader.ts'
import { dumpDom, options, OUT, screenshot, timeOf, weatherOf } from './lib.mjs'

const o = options({ width: 1512, height: 982, time: 20, background: '282c34' })
const [width, height] = [Number(o.width), Number(o.height)]
const ms = timeOf(o.at)
const background = parseInt(o.background, 16)
const cursor = o.cursor ? String(o.cursor).split(',').map(Number) : [-10000, -10000]
const weather = o.weather ? weatherOf(o.weather) : null
// --event balloon (or several, comma-separated) plays them as a preview would.
const forced = o.event ? String(o.event).split(',').map(kind => ({ kind, at: ms })) : []
const context = contextAt(ms, STOCKHOLM, weather, o.rained ? ms - 600_000 : null)
const events = eventsAt(ms, context, forced)
const params = shaderParams(
  { ms, t: ms / 1000, place: STOCKHOLM, weather, kp: o.kp ? Number(o.kp) : null, isAuroraForced: !!o.aurora },
  {
    demo: o.demo ? { seconds: 48 } : null,
    events,
    shootingRate: shootingRate(context),
    // --beacon asking|done [--urgent]: the lighthouse.
    beacon: o.beacon ? { mode: o.beacon, isUrgent: !!o.urgent } : null,
    // --iss: the station halfway up the southern sky, heading east to west.
    iss: o.iss ? { at: { x: 0.05, y: 0.33 }, trail: { x: -0.02, y: 0.345 } } : null,
  },
)
if (events.length > 0) console.log('events:', events.map(e => e.kind).join(', '))
// --broken: a shader that cannot compile, to see the check catch it.
const source = skyShader(params) + (o.broken ? '\nint broken = ;\n' : '')
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
uniform float iTime;
uniform sampler2D iChannel0;
out vec4 outColor;
${source}
void main() { mainImage(outColor, vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y)); }
`

const page = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${width}" height="${height}" style="display:block"></canvas>
<pre id="log" style="position:absolute;top:0;left:0;margin:8px;color:#f66;font:12px Menlo;white-space:pre-wrap"></pre>
<script>
const log = document.getElementById('log')
const fail = text => { log.textContent = 'FAIL\\n' + text; document.title = 'fail' }
const w = ${width}, h = ${height}
// The stand-in terminal: its background, and lines of light text.
const term = document.createElement('canvas')
term.width = w; term.height = h
const t = term.getContext('2d')
t.fillStyle = '#${o.background}'; t.fillRect(0, 0, w, h)
t.font = '13px Menlo'; t.fillStyle = '#d7dae0'
const lines = ['● Solar Clawd: the sky behind the terminal', '', '  Read 1 file, ran 2 shell commands', '', '❯ how does it read?', '', '  ⎿  tools/preview/run.sh shader --at 22:00']
lines.forEach((line, i) => t.fillText(line, 16, 40 + i * 20))
t.fillStyle = '#3e4451'; t.fillRect(0, h - 120, w, 22)
t.fillStyle = '#98c379'; t.fillText('Model: Opus 5.5 | Ctx Used: 14.0%', 16, h - 60)
const gl = document.getElementById('c').getContext('webgl2', { preserveDrawingBuffer: true })
if (!gl) fail('no WebGL2')
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
  gl.uniform1i(gl.getUniformLocation(program, 'iFocus'), 1)
  gl.uniform3f(gl.getUniformLocation(program, 'iBackgroundColor'), ${((background >> 16) & 255) / 255}, ${((background >> 8) & 255) / 255}, ${(background & 255) / 255})
  gl.viewport(0, 0, w, h)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  document.title = 'ok'
} catch (error) { fail(String(error.message || error)) }
</script></body></html>`
const html = join(OUT, `${o.out ?? 'shader'}.html`)
writeFileSync(html, page)

const dom = dumpDom(html, true)
const failed = /<title>fail<\/title>/.test(dom) || !/<title>ok<\/title>/.test(dom)
if (failed) {
  const text = /<pre id="log"[^>]*>([\s\S]*?)<\/pre>/.exec(dom)?.[1] ?? dom.slice(0, 2000)
  console.error(text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
  process.exit(1)
}
console.log(screenshot(html, width, height, o.out ?? 'shader', true))
console.log(`${source.length} chars, scene`, JSON.stringify(params.scene))
