// The checkpoint pane: where its pictures go, what it reads from the folder,
// and /solar look opening it, drawing it and closing it.

import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { isWholePng, layout, LOOK_FOLDER, LOOK_PANE, pictureRows, pngSize, signatureOf } from './look'

// A PNG as far as the pane reads one: its signature, an IHDR of that width and
// height, and an IEND at its end, or none for one still being written.
function png(width: number, height: number, isWhole = true): string {
  const bytes = new Uint8Array(33 + (isWhole ? 12 : 0))
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  if (isWhole) bytes.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], 33)

  return btoa(String.fromCharCode(...bytes))
}

const fromB64 = (text: string) => Uint8Array.from(atob(text), char => char.charCodeAt(0))

const solar = ($: Engine, args: string) =>
  $.command.run({ command: 'solar', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })

// The engine's panes, in memory: which are open, and what each open asked.
function paneWorld(on: On) {
  const open = new Set<string>()
  const opened: { id: string; columns?: number }[] = []
  on('ui.open', (_, e) => {
    open.add(e.id)
    opened.push({ id: e.id, columns: e.columns })
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    open.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('command.register', () => ({ value: { command: 'solar' } }))
  on('env.get', () => ({ value: undefined }))

  return { open, opened }
}

const PANE = {
  plugin: 'solar-clawd',
  surface: 'terminal',
  component: 'Pane',
  requestId: LOOK_PANE,
  props: {
    title: 'Checkpoint',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 50 },
    view: {},
  },
} as const

// The folder in memory, names to base64 pictures or note text, wherever the
// engine resolves the session's working directory to.
function folderWorld(on: On, files: Map<string, string>) {
  on('fs.list', (_, e) => ({
    value: String(e.path).endsWith(`/${LOOK_FOLDER}`)
      ? [...files].map(([name, body]) => ({ name, kind: 'file' as const, size: body.length, mtimeMs: 1, isLink: false }))
      : [],
  }))
  on('fs.read', (_, e) => {
    const [folder, name] = [String(e.path).slice(0, String(e.path).lastIndexOf('/')), String(e.path).split('/').pop()!]
    const body = folder.endsWith(`/${LOOK_FOLDER}`) ? files.get(name) : undefined
    if (body === undefined) return { deny: 'no such file' }

    return { value: e.as === 'bytes' ? { base64: body } : body }
  })
}

test('a PNG gives its size from its header, and is whole once it has its IEND', () => {
  expect(pngSize(fromB64(png(400, 982)))).toEqual({ width: 400, height: 982 })
  expect(pngSize(new Uint8Array([1, 2, 3]))).toBeNull()
  expect(isWholePng(fromB64(png(400, 982)))).toBe(true)
  expect(isWholePng(fromB64(png(400, 982, false)))).toBe(false)
})

test('two stages stand side by side in a docked pane, two whole frames one under the other', () => {
  const stages = layout([{ width: 400, height: 982 }, { width: 400, height: 982 }], 60, 48)
  expect(stages.isDown).toBe(false)
  // 29 columns each would be 36 rows of a 2.45 tall picture; the height
  // allows 47, so they take all the width.
  expect(stages.boxes).toEqual([{ columns: 29, rows: 36 }, { columns: 29, rows: 36 }])

  const frames = layout([{ width: 1512, height: 982 }, { width: 1512, height: 982 }], 60, 48)
  expect(frames.isDown).toBe(true)
  expect(frames.boxes[0]!.columns).toBeGreaterThan(29)
  expect(frames.rows).toBeLessThanOrEqual(48)
})

test('pictures never take more rows than the body has, nor more than an Image may', () => {
  for (const [columns, rows] of [[60, 20], [200, 60], [24, 30], [300, 300]] as const) {
    const placed = layout([{ width: 400, height: 982 }, { width: 1512, height: 982 }, { width: 800, height: 600 }], columns, rows)
    expect(placed.rows).toBeLessThanOrEqual(rows)
    for (const box of placed.boxes) expect(Math.max(box.columns, box.rows)).toBeLessThanOrEqual(255)
  }
  // The notes take at most a third, and a line between them and the pictures.
  expect(pictureRows(48, 0)).toBe(48)
  expect(pictureRows(48, 4)).toBe(43)
  expect(pictureRows(48, 40)).toBe(31)
})

test('the pane shows the folder in the order of its names, and waits while a picture is half written', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 29, 10, 0) })
  const files = new Map([['2-frame.png', png(400, 982)], ['1-sketch.png', png(400, 982)], ['list.md', '1. Bearing.\n2. The rest.\n'], ['other.json', '{}']])
  folderWorld(on, files)
  paneWorld(on)

  await solar($, 'look')
  const ui = await $.ui.mount(PANE)
  expect((await ui.findAll({ type: 'Image' })).map(image => image.props.alt)).toEqual(['1-sketch.png', '2-frame.png'])
  expect((await ui.findAll({ type: 'Text' })).map(text => text.text)).toEqual(['1-sketch.png', '2-frame.png', '1. Bearing.', '2. The rest.'])

  // A third picture still being written: the pane keeps what it showed.
  files.set('3-half.png', png(400, 982, false))
  await clock.advance(1000)
  expect(await ui.findAll({ type: 'Image' })).toHaveLength(2)
  files.set('3-half.png', png(400, 982))
  await clock.advance(1000)
  expect(await ui.findAll({ type: 'Image' })).toHaveLength(3)
  await ui.unmount()

  // The signature leaves out what the pane does not show.
  const entries = [...files].map(([name, body]) => ({ name, kind: 'file' as const, size: body.length, mtimeMs: 1, isLink: false }))
  expect(signatureOf(entries)).not.toContain('other.json')
})

test('/solar look opens the pane on the folder\'s pictures and notes, and closes it again', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 29, 10, 0) })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const files = new Map([['1-sketch.png', png(400, 982)], ['2-frame.png', png(400, 982)], ['list.md', 'Is this the picture you meant?\n']])
  folderWorld(on, files)
  const panes = paneWorld(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const { text } = await solar($, 'look')
  expect(text).toContain(LOOK_FOLDER)
  expect(panes.opened).toEqual([{ id: LOOK_PANE, columns: 64 }])

  const ui = await $.ui.mount(PANE)
  const images = await ui.findAll({ type: 'Image' })
  expect(images.map(image => image.props.alt)).toEqual(['1-sketch.png', '2-frame.png'])
  expect(images[0]!.props.source).toEqual({ png: files.get('1-sketch.png') })
  expect((await ui.find({ type: 'Text', text: /picture you meant/ }))?.text).toBe('Is this the picture you meant?')
  await ui.unmount()

  expect((await solar($, 'look')).text).toContain('closed')
  expect(panes.open.size).toBe(0)
})

test('with nothing in the folder the pane says so', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 29, 10, 0) })
  folderWorld(on, new Map())
  paneWorld(on)

  await solar($, 'look')
  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(`Nothing in ${LOOK_FOLDER} yet.`)
  await ui.unmount()
})
