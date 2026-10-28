// The tab's mark as text: what the session writes into its own tab
// (ghostty.ts, markTab) and the shader reads back (glsl/context.ts).

import { MAX_AGENTS, TOOLS } from './activity'
import type { Work } from './activity'
import type { ShaderParams } from './shader'

// A tab's mark, palette colour 16 as the session sets it (ghostty.ts,
// markTab): blue a step or a few off black says Claude runs there, and
// what kind of tool it runs now (1 none, 2 a command, up to 6 anything
// else: activity.ts); green counts the tenths of its context window that
// are full; red's two low bits say what is happening to it (0 idle, 1
// clearing as the conversation compacts, 2 cleared, 3 a tenth just
// gained) and the rest count the subagents at work, up to 7. At most
// rgb(31, 10, 6), still all but black. Per tab, where the shader's text is
// one for all of them.
export function tabMark(context: ShaderParams['context'], work: Work | null = null): [number, number, number] {
  const fish = Math.max(0, Math.min(10, Math.round(context?.fish ?? 0)))
  const state = { idle: 0, grill: 1, embers: 2, catch: 3 }[context?.state ?? 'idle']
  const agents = Math.max(0, Math.min(MAX_AGENTS, Math.round(work?.agents ?? 0)))

  return [state + 4 * agents, fish, 1 + TOOLS.indexOf(work?.tool ?? 'none')]
}

// Colour 16 back to the terminal's own, as a session leaves its tab.
export const UNMARK_TAB = '\x1b]104;16\x1b\\'

// The mark for this tab's context window, how full and what is happening
// to it, and for what Claude is doing (tabMark).
export function markOf(context: ShaderParams['context'], work: Work | null = null): string {
  const hex = tabMark(context, work).map(v => v.toString(16).padStart(2, '0'))

  return `\x1b]4;16;rgb:${hex.join('/')}\x1b\\`
}
