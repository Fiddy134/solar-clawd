// The checkpoint pane: /solar look shows the pictures Claude puts in the
// session's .preview/checkpoint/ beside the conversation, side by side or one
// under the other, whichever draws them larger, each with its name under it
// and the folder's notes (.md and .txt) below them. tools/preview/checkpoint.sh
// puts them there, cut to the stage unless asked for the whole frame. The
// pictures are the terminal's Image, which Ghostty draws with the Kitty
// graphics protocol; on any other surface the pane says so.

import type { EngineInterface, FsEntry } from 'claude-code'

import { fromBase64 } from './paint'

export const LOOK_PANE = 'solar-look'
export const LOOK_FOLDER = '.preview/checkpoint'
// How often the folder is looked at while the pane is open.
export const LOOK_MS = 1000
// A terminal cell is about twice as tall as it is wide.
const CELL_RATIO = 2
export const GAP = 2
// An Image is at most this many cells either way, and $.fs.read reads at most
// 4 MiB.
const MAX_CELLS = 255
const MAX_BYTES = 4 * 1024 * 1024

export type Size = { width: number; height: number }
export type Picture = Size & { name: string; png: string }
export type Look = { pictures: Picture[]; notes: string[] }
export type LookState = { look: Look; signature: string | null; watch: { cancel: () => void } | null }
export type Layout = { isDown: boolean; boxes: { columns: number; rows: number }[]; rows: number }

const isPicture = (name: string) => /\.png$/i.test(name)
const isNote = (name: string) => /\.(md|txt)$/i.test(name)

// What the folder holds as far as the pane cares, to tell when to read it
// again: each picture's and note's name, size and time.
export function signatureOf(entries: readonly FsEntry[]): string {
  return entries
    .filter(entry => entry.kind === 'file' && (isPicture(entry.name) || isNote(entry.name)))
    .map(entry => `${entry.name}:${entry.size}:${entry.mtimeMs}`)
    .sort()
    .join('\n')
}

// A PNG's width and height from its header, or null where it is none; and
// whether it is whole, since one still being written has no IEND at its end.
export function pngSize(bytes: Uint8Array): Size | null {
  const isPng = bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!isPng) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  return { width: view.getUint32(16), height: view.getUint32(20) }
}

export function isWholePng(bytes: Uint8Array): boolean {
  const end = bytes.length - 8
  return end > 0 && bytes[end] === 0x49 && bytes[end + 1] === 0x45 && bytes[end + 2] === 0x4e && bytes[end + 3] === 0x44
}

// The pictures and notes in the folder, the pictures in the order of their
// names; null while a picture is half written, to be read again next time.
export async function readLook($: EngineInterface, folder: string): Promise<Look | null> {
  const entries = await $.fs.list(folder).catch(() => [])
  const files = entries.filter(entry => entry.kind === 'file').sort((a, b) => a.name.localeCompare(b.name))
  const pictures: Picture[] = []
  const notes: string[] = []
  for (const entry of files.filter(file => isPicture(file.name))) {
    if (entry.size > MAX_BYTES) {
      notes.push(`${entry.name} is over 4 MiB, more than the pane can read.`)
      continue
    }
    const { base64 } = await $.fs.read(`${folder}/${entry.name}`, { as: 'bytes' })
    const bytes = fromBase64(base64)
    if (!isWholePng(bytes)) return null
    const size = pngSize(bytes)
    if (size !== null) pictures.push({ name: entry.name, png: base64, ...size })
  }
  for (const entry of files.filter(file => isNote(file.name))) {
    const text = await $.fs.read(`${folder}/${entry.name}`).catch(() => '')
    notes.push(...text.replace(/\n+$/, '').split('\n'), '')
  }

  return { pictures, notes: notes.length > 0 && notes[notes.length - 1] === '' ? notes.slice(0, -1) : notes }
}

// Where the pictures go in a body of columns × rows cells: side by side, or
// one under the other where that draws them larger, each with a line for its
// name under it. Every picture keeps its shape; all are as wide as the
// tallest of them allows.
export function layout(sizes: readonly Size[], columns: number, rows: number): Layout {
  const n = sizes.length
  if (n === 0) return { isDown: false, boxes: [], rows: 0 }
  const tallest = Math.max(...sizes.map(size => size.height / size.width))
  const fit = (width: number, rowsEach: number) =>
    Math.max(1, Math.min(width, MAX_CELLS, Math.floor((rowsEach * CELL_RATIO) / tallest)))
  const across = fit(Math.floor((columns - GAP * (n - 1)) / n), Math.min(rows - 1, MAX_CELLS))
  const down = fit(columns, Math.min(Math.floor(rows / n) - 2, MAX_CELLS))
  const isDown = n > 1 && down > across
  const width = isDown ? down : across
  const boxes = sizes.map(size => ({
    columns: width,
    rows: Math.max(1, Math.min(MAX_CELLS, Math.round((width * size.height) / size.width / CELL_RATIO))),
  }))
  const tall = Math.max(...boxes.map(box => box.rows))

  return { isDown, boxes, rows: isDown ? boxes.reduce((sum, box) => sum + box.rows + 2, 0) - 1 : tall + 1 }
}

// The rows the pictures may take: the body's, less a third for the notes
// where there are notes.
export function pictureRows(bodyRows: number, notes: number): number {
  return Math.max(2, bodyRows - Math.min(notes, Math.floor(bodyRows / 3)) - (notes > 0 ? 1 : 0))
}


// The folder read again where what it holds changed, and the pane drawn
// again; not while a picture is half written, which is read next time.
export async function refreshLook($: EngineInterface, state: LookState): Promise<void> {
  const now = signatureOf(await $.fs.list(LOOK_FOLDER).catch(() => []))
  if (now === state.signature) return
  const read = await readLook($, LOOK_FOLDER)
  if (read === null) return
  state.look = read
  state.signature = now
  $.ui.invalidate('ui.render')
}

// The folder read now and then every second while the pane is open: the
// timer ends itself once the pane is closed.
export async function watchLook($: EngineInterface, state: LookState): Promise<void> {
  await refreshLook($, state)
  state.watch?.cancel()
  state.watch = $.clock.every(LOOK_MS, () => {
    void (async () => {
      if (!(await $.ui.panes()).some(pane => pane.id === LOOK_PANE)) {
        state.watch?.cancel()
        state.watch = null
        return
      }
      await refreshLook($, state)
    })().catch(() => undefined)
  })
}
