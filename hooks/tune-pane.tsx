// The tune pane's surface module: it takes the keys while it has the focus
// (once clicked), keeps the pane's state as the person moves it, draws it
// in the riso inks on the pane's dark blue, and posts each change to the
// hooks module, which writes the preview and keeps the tune. It runs on the
// drawing thread with no $; what it knows of the world comes in its props.

import type { ClientModule, ClientSurface } from 'claude-code'

import { barOf, onPaneKey, PHASES, ROW_LABELS, TUNE_ROWS, TUNE_WORDS, valueText } from './tune'
import type { PaneLocal, PaneState } from './tune'

// What the hooks module hands it: the state to open on, and how many
// keeps it has written since the pane opened.
export type TunePaneProps = { start: PaneState; kept: number }

const INK = { body: '#10142a', pink: '#ff6fc0', yellow: '#ffe800', blue: '#9fd3ff' }

const TunePane: ClientModule<TunePaneProps, PaneLocal> = (props, surface: ClientSurface<PaneLocal>) => {
  const { Box, Text } = surface.elements
  const opening: PaneLocal = { pane: props.start, keeps: props.kept, keptTune: null, isKeptLast: false }
  const local = surface.state ?? opening
  const { pane } = local

  // Each key starts from the state the last one left, which may not be
  // drawn yet: two keys can come in one frame.
  surface.onKey(event => {
    if (event.ctrl || event.meta) return
    const { local: next, post } = onPaneKey(surface.state ?? opening, event.key)
    surface.setState(next)
    if (post !== null) surface.post(post)
  })

  // Kept once the hooks module has written the last keep, until the next key.
  const isKept = local.isKeptLast && props.kept >= local.keeps

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        {PHASES.map(phase => (
          <Text color={phase === pane.phase ? INK.body : INK.pink} backgroundColor={phase === pane.phase ? INK.pink : undefined} bold={phase === pane.phase}>
            {` ${phase} `}
          </Text>
        ))}
      </Box>
      {TUNE_ROWS.map(row => {
        const isChosen = row === pane.row
        const value = pane.tune[pane.phase][row]
        const bar = barOf(row, value)
        const knob = bar.indexOf('●')

        return (
          <Box flexDirection="row">
            <Text color={isChosen ? INK.yellow : INK.pink} bold={isChosen}>
              {`${isChosen ? '›' : ' '} ${ROW_LABELS[row].padEnd(12)}`}
            </Text>
            <Text color={INK.pink}>{bar.slice(0, knob)}</Text>
            <Text color={INK.yellow}>{'●'}</Text>
            <Text color={INK.pink} dimColor>{bar.slice(knob + 1)}</Text>
            <Text color={isChosen ? INK.yellow : INK.pink}>{`   ${valueText(row, value)}`}</Text>
          </Box>
        )
      })}
      <Text color={isKept ? INK.yellow : INK.blue}>{isKept ? TUNE_WORDS.kept : TUNE_WORDS.hint}</Text>
    </Box>
  )
}

export default TunePane
