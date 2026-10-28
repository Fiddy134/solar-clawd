// What Claude is doing now, carried in the tab's mark: the kinds of tool,
// the hold that keeps a kind from flickering, and the mark's encoding with
// the shader's reading of it.

import { expect, test } from 'claude-code/testing'

import { activityKindOf, HOLD_MS, heldTool, TOOLS, wantedTool } from './activity'
import { markOf, tabMark } from './mark'
import { CONTEXT_MARK } from './glsl/context'
import { MAIN } from './glsl/main'

test('each tool shows as its kind; an Agent call and a question to the person leave the kind as it is', () => {
  expect(TOOLS).toEqual(['none', 'command', 'edit', 'read', 'web', 'other'])
  const kinds = Object.fromEntries(
    ['Bash', 'BashOutput', 'KillShell', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'ToolSearch', 'WebFetch', 'WebSearch', 'TodoWrite', 'mcp__github__create_issue', 'Agent', 'AskUserQuestion'].map(tool => [tool, activityKindOf(tool)]),
  )
  expect(kinds).toEqual({
    Bash: 'command', BashOutput: 'command', KillShell: 'command',
    Edit: 'edit', Write: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit',
    Read: 'read', Grep: 'read', Glob: 'read', LS: 'read', NotebookRead: 'read', ToolSearch: 'read',
    WebFetch: 'web', WebSearch: 'web',
    TodoWrite: 'other', mcp__github__create_issue: 'other',
    Agent: null, AskUserQuestion: null,
  })
  // A name every object has is no tool of the table's.
  expect(activityKindOf('constructor')).toBe('other')
})

test('the newest call running gives the kind, held a moment so parallel calls do not flicker it', () => {
  expect(wantedTool([])).toBe('none')
  expect(wantedTool([{ tool: 'read', at: 10 }, { tool: 'command', at: 20 }, { tool: 'edit', at: 15 }])).toBe('command')
  const reading = heldTool({ tool: 'none', since: -Infinity }, 'read', 1000)
  expect(reading).toEqual({ tool: 'read', since: 1000 })
  // A quick read over, an edit begun: the read stays out its hold.
  expect(heldTool(reading, 'none', 1200)).toBe(reading)
  expect(heldTool(reading, 'edit', 1000 + HOLD_MS - 1)).toBe(reading)
  expect(heldTool(reading, 'edit', 1000 + HOLD_MS)).toEqual({ tool: 'edit', since: 1000 + HOLD_MS })
  expect(heldTool(reading, 'read', 9000)).toBe(reading)
})

test('the mark carries the tool in blue and the agents in red over the context window, at most (31, 10, 6)', () => {
  // With nothing running it is the mark it always was.
  expect(tabMark({ fish: 7, state: 'idle' })).toEqual([0, 7, 1])
  expect(tabMark({ fish: 7, state: 'idle' }, { tool: 'none', agents: 0 })).toEqual([0, 7, 1])
  expect(tabMark({ fish: 3, state: 'grill' }, { tool: 'command', agents: 2 })).toEqual([9, 3, 2])
  expect(tabMark(null, { tool: 'other', agents: 1 })).toEqual([4, 0, 6])
  expect(tabMark({ fish: 14, state: 'catch' }, { tool: 'other', agents: 40 })).toEqual([31, 10, 6])
  expect(tabMark(null, { tool: 'web', agents: -3 })).toEqual([0, 0, 5])
  expect(markOf({ fish: 10, state: 'catch' }, { tool: 'other', agents: 7 })).toBe('\x1b]4;16;rgb:1f/0a/06\x1b\\')
  expect(markOf(null)).toBe('\x1b]4;16;rgb:00/00/01\x1b\\')
})

test("the shader's tab test lets every mark of ours through, and a theme reads it through sky_tool() and sky_agents()", () => {
  // Blue 1 to 6, red up to 31, green up to 10; an unmarked tab is still black.
  expect(MAIN).toContain('iPalette[16].b < 0.5 / 255.0 || iPalette[16].b > 6.5 / 255.0 || iPalette[16].r > 31.5 / 255.0 || iPalette[16].g > 10.5 / 255.0')
  expect(CONTEXT_MARK).toContain('int contextState() { return CONTEXT == 1 ? int(iPalette[16].r * 255.0 + 0.5) & 3 : CONTEXT_IDLE; }')
  expect(CONTEXT_MARK).toContain('int sky_tool() { return clamp(int(iPalette[16].b * 255.0 + 0.5) - 1, sky_TOOL_NONE, sky_TOOL_OTHER); }')
  expect(CONTEXT_MARK).toContain('int sky_agents() { return int(iPalette[16].r * 255.0 + 0.5) >> 2; }')
  TOOLS.forEach((tool, i) => expect(CONTEXT_MARK).toContain(`const int sky_TOOL_${tool.toUpperCase()} = ${i};`))
})
