// The tune pane's surface module: it takes the keys while it has the focus,
// keeps the pane's state as the person moves it, draws it in the riso inks
// on the pane's dark blue, and posts each change to the hooks module, which
// writes the preview and keeps the tune. It runs on the drawing thread with
// no $; what it knows of the world comes in its props.

import type { ClientModule, ClientSurface } from 'claude-code'

import { barOf, PHASES, ROW_LABELS, TUNE_ROWS, TUNE_WORDS, onTuneKey, valueText } from './tune'
import type { PaneState } from './tune'

// What the hooks module hands it: the state to open on, and how many times
// a tune has been kept since it opened, so it can say so.
export type TunePaneProps = { start: PaneState; kept: number }
// What it keeps itself: the state as moved, and the kept count it had seen
// when the last key came, so "kept" shows until the next key.
type Local = { pane: PaneState; kept: number }

const INK = { body: '#10142a', pink: '#ff6fc0', yellow: '#ffe800', blue: '#9fd3ff' }

const TunePane: ClientModule<TunePaneProps, Local> = (props, surface: ClientSurface<Local>) => {
  const { Box, Text } = surface.elements
  const local = surface.state ?? { pane: props.start, kept: props.kept }
  const { pane } = local

  surface.onKey(event => {
    if (event.ctrl || event.meta) return
    const { state, action } = onTuneKey(pane, event.key)
    surface.setState({ pane: state, kept: props.kept })
    if (action !== 'none') surface.post({ state, action })
  })

  const isKept = props.kept > local.kept

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
