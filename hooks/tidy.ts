// What a session crashed or killed leaves behind: iTerm2 wallpapers in the
// cache folder and Ghostty heartbeats in runtime/. Tidying is careful: only
// these folders, only names the mod itself writes, only files an hour old,
// and never the ones the session at hand keeps.

import type { FsEntry } from 'claude-code'

// Older than this, and not ours now: left behind.
export const STALE_MS = 3_600_000

// The names the mod writes: an iTerm2 session's two wallpapers, an older
// version's sky-*.png, Ghostty sessions' heartbeats and what they wait on
// the person for, and what a write cut short left before it was moved into
// place.
const OURS = [
  /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}-[01]\.png$/i,
  /^sky-[\w-]+\.png$/,
  /^alive-[\w-]+$/,
  /^waiting-[\w-]+$/,
  /^(sky\.glsl|solar-clawd\.ghostty|vsync\.ghostty)\.tmp-[\w-]+$/,
]

// Full paths of the files in `folder` to remove. `keep` names what the
// session at hand owns: its iTerm2 session id, its heartbeat's name.
export function staleFiles(entries: readonly FsEntry[], folder: string, now: number, keep: readonly string[]): string[] {
  return entries
    .filter(entry => entry.kind === 'file' && !entry.isLink)
    .filter(entry => OURS.some(pattern => pattern.test(entry.name)))
    .filter(entry => !keep.some(owned => entry.name === owned || entry.name.startsWith(`${owned}-`)))
    .filter(entry => now - entry.mtimeMs > STALE_MS)
    .map(entry => `${folder}/${entry.name}`)
}
