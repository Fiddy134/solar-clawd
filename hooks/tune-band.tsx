// The tune tool's surface module, in the band above the prompt: it takes
// the keys while it has the focus (once clicked), keeps the tool's state as
// the person moves it, draws it in the riso inks on dark blue, and posts
// each change to the hooks module, which writes the preview, keeps the tune
// and closes the tool on q. It runs on the drawing thread with no $; what it
// knows of the world comes in its props.

import type { ClientModule, ClientSurface } from 'claude-code'

import { BAR, barOf, onPaneKey, PHASES, ROW_LABELS, TAB_TEXT, TEXT_LABELS, TEXT_ROWS, TEXT_WORDS, textBarOf, textValueText, TUNE_ROWS, TUNE_WORDS, valueText } from './tune'
import type { OwnText, PaneLocal, PaneState } from './tune'

// What the hooks module hands it: the state to open on, how many keeps it
// has written since the pane opened, the person's own text and the fonts
// as Ghostty said them when the pane opened, and what it has to say of the
// text as last written (a key Ghostty refused), null for nothing.
export type TuneBandProps = { start: PaneState; kept: number; own: OwnText; fonts: string[]; note: string | null }

const INK = { body: '#10142a', pink: '#ff6fc0', yellow: '#ffe800', blue: '#9fd3ff' }

const TuneBand: ClientModule<TuneBandProps, PaneLocal> = (props, surface: ClientSurface<PaneLocal>) => {
  const { Box, Text } = surface.elements
  const opening: PaneLocal = { pane: props.start, keeps: props.kept, keptTune: null, keptText: null, isKeptLast: false }
  const local = surface.state ?? opening
  const { pane } = local
  const world = { own: props.own, fonts: props.fonts }

  // Each key starts from the state the last one left, which may not be
  // drawn yet: two keys can come in one frame.
  surface.onKey(event => {
    if (event.ctrl || event.meta) return
    const { local: next, post } = onPaneKey(surface.state ?? opening, event.key, world)
    surface.setState(next)
    if (post !== null) surface.post(post)
  })

  // Kept once the hooks module has written the last keep, until the next key.
  const isKept = local.isKeptLast && props.kept >= local.keeps
  const tabs = [...PHASES, TAB_TEXT]
  const isChosenTab = (tab: string) => (pane.isOnText ? tab === TAB_TEXT : tab === pane.phase)
  // A row: its label, its bar (the knob in yellow), its value, and what
  // follows the value, dimmed where it is the person's own.
  const row = (label: string, isChosen: boolean, bar: string | null, value: string, isOwn: boolean, after: string) => {
    const knob = bar?.indexOf('●') ?? -1

    return (
      <Box flexDirection="row">
        <Text color={isChosen ? INK.yellow : INK.pink} bold={isChosen}>
          {`${isChosen ? '›' : ' '} ${label.padEnd(12)}`}
        </Text>
        {bar === null
          ? [<Text>{' '.repeat(BAR)}</Text>]
          : [
              <Text color={INK.pink} dimColor={isOwn}>{bar.slice(0, knob)}</Text>,
              <Text color={INK.yellow} dimColor={isOwn}>{'●'}</Text>,
              <Text color={INK.pink} dimColor>{bar.slice(knob + 1)}</Text>,
            ]}
        <Text color={isChosen ? INK.yellow : INK.pink} dimColor={isOwn}>{`   ${value}`}</Text>
        {after !== '' && <Text color={INK.blue} dimColor={isOwn}>{`  ${after}`}</Text>}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        {tabs.map(tab => (
          <Text color={isChosenTab(tab) ? INK.body : INK.pink} backgroundColor={isChosenTab(tab) ? INK.pink : undefined} bold={isChosenTab(tab)}>
            {` ${tab} `}
          </Text>
        ))}
      </Box>
      {pane.isOnText
        ? TEXT_ROWS.map(key => {
            // An untouched row shows the person's own value, where Ghostty
            // said it; the gap is always the mod's.
            const value = pane.text[key]
            const isOwn = value === null
            const shown = key === 'gap' ? pane.text.gap : (value ?? props.own[key])
            const bar = key !== 'font' && typeof shown === 'number' ? textBarOf(key, shown) : null
            const after = key === 'gap' ? TEXT_WORDS.newWindows : isOwn ? TEXT_WORDS.own : ''

            return row(TEXT_LABELS[key], key === pane.textRow, bar, shown === null ? '' : textValueText(key, shown), isOwn, after)
          })
        : TUNE_ROWS.map(key => {
            const value = pane.tune[pane.phase][key]

            return row(ROW_LABELS[key], key === pane.row, barOf(key, value), valueText(key, value), false, '')
          })}
      <Text color={props.note !== null || isKept ? INK.yellow : INK.blue}>{props.note ?? (isKept ? TUNE_WORDS.kept : TUNE_WORDS.hint)}</Text>
    </Box>
  )
}

export default TuneBand
