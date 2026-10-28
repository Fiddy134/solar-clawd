// What Claude is doing now, as a theme can show it: the kind of tool the
// newest call still running is, in any loop, and how many subagents are at
// work. It travels in the tab's mark (mark.ts), which costs no reload, and
// never in the shader's text.

// The kinds of tool, in the shader's order (sky_TOOL_NONE is 0).
export const TOOLS = ['none', 'command', 'edit', 'read', 'web', 'other'] as const
export type Tool = (typeof TOOLS)[number]

// A kind shown stays at least this long, so that parallel calls and
// subagents do not flicker it; and the most agents the mark counts.
export const HOLD_MS = 1_500
export const MAX_AGENTS = 7

const KINDS: Record<string, Tool> = {
  Bash: 'command',
  BashOutput: 'command',
  KillShell: 'command',
  Edit: 'edit',
  Write: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Read: 'read',
  Grep: 'read',
  Glob: 'read',
  LS: 'read',
  NotebookRead: 'read',
  ToolSearch: 'read',
  WebFetch: 'web',
  WebSearch: 'web',
}

// The kind a tool's call shows. An Agent call leaves the kind to what its
// subagent does (its own calls carry its agentId), and a question to the
// person shows as WAITING already: null for both. Anything else, an MCP
// server's tools among them, is `other`. Unlike clawd.ts's toolKind, where
// Bash counts as writing for Clawd's hands, a command is its own kind here.
export function activityKindOf(tool: string): Tool | null {
  if (tool === 'Agent' || tool === 'Task' || tool === 'AskUserQuestion') return null

  return Object.hasOwn(KINDS, tool) ? KINDS[tool]! : 'other'
}

// A call running, its kind and the moment it began.
export type Call = { tool: Tool; at: number }
// The kind shown, since when.
export type Shown = { tool: Tool; since: number }
// What the tab's mark carries of Claude's work.
export type Work = { tool: Tool; agents: number }

// The kind of the newest call still running, `none` with none.
export function wantedTool(open: Iterable<Call>): Tool {
  let newest: Call | null = null
  for (const call of open) if (newest === null || call.at >= newest.at) newest = call

  return newest?.tool ?? 'none'
}

// The kind to show now: the one wanted, once the one shown has been up
// HOLD_MS; until then, the one shown.
export function heldTool(shown: Shown, wanted: Tool, now: number): Shown {
  return wanted !== shown.tool && now - shown.since >= HOLD_MS ? { tool: wanted, since: now } : shown
}
