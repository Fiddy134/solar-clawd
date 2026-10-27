// The tab's mark as text: what the session writes into its own tab
// (ghostty.ts, markTab) and the shader reads back (glsl/context.ts).

import type { ShaderParams } from './shader'

// A tab's mark, palette colour 16 as the session sets it (ghostty.ts,
// markTab): blue one step off black says Claude runs there, green counts
// the tenths of its context window that are full, and red says what is
// happening to it: 0 idle, 1 clearing (the conversation compacts), 2
// cleared (it just has), 3 gained (a tenth has just filled). Per tab, where
// the shader's text is one for all of them.
export function tabMark(context: ShaderParams['context']): [number, number, number] {
  const fish = Math.max(0, Math.min(10, Math.round(context?.fish ?? 0)))
  const state = { idle: 0, grill: 1, embers: 2, catch: 3 }[context?.state ?? 'idle']

  return [state, fish, 1]
}

// Colour 16 back to the terminal's own, as a session leaves its tab.
export const UNMARK_TAB = '\x1b]104;16\x1b\\'

// The mark for this tab's context window: how full, and what is happening
// to it (tabMark).
export function markOf(context: ShaderParams['context']): string {
  const hex = tabMark(context).map(v => v.toString(16).padStart(2, '0'))

  return `\x1b]4;16;rgb:${hex.join('/')}\x1b\\`
}
