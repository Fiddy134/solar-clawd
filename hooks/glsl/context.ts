// The sky shader's GLSL, part of hooks/shader.ts's BODY: what this tab's
// mark says of its context window and of what Claude is doing. A theme
// reads it through these functions alone, never through iPalette, so the
// mark can change its form without the theme knowing.
export const CONTEXT_MARK = `
// --- The context window --------------------------------------------------------

// What this tab's mark (tabMark) says its context window is doing: nothing
// new, clearing as the conversation compacts, just cleared, and a tenth
// just gained.
const int CONTEXT_IDLE = 0;
const int CONTEXT_CLEARING = 1;
const int CONTEXT_CLEARED = 2;
const int CONTEXT_GAINED = 3;

// How many tenths of the context window are full, and what the window is
// doing, from the tab's mark; none where the band shows the context
// itself.
int contextFish() { return CONTEXT == 1 ? clamp(int(iPalette[16].g * 255.0 + 0.5), 0, 10) : 0; }
int contextState() { return CONTEXT == 1 ? int(iPalette[16].r * 255.0 + 0.5) & 3 : CONTEXT_IDLE; }

// --- What Claude is doing ---------------------------------------------------------

// The kind of tool Claude's newest call still running is, in the main
// conversation or a subagent (hooks/activity.ts): none, a command, an edit,
// a search or a read, the web, anything else. A kind shows at least 1.5 s.
const int sky_TOOL_NONE = 0;
const int sky_TOOL_COMMAND = 1;
const int sky_TOOL_EDIT = 2;
const int sky_TOOL_READ = 3;
const int sky_TOOL_WEB = 4;
const int sky_TOOL_OTHER = 5;

// That kind, and how many subagents are at work, 0 to 7, from the tab's
// mark: each tab its own, changing at once and costing no reload.
int sky_tool() { return clamp(int(iPalette[16].b * 255.0 + 0.5) - 1, sky_TOOL_NONE, sky_TOOL_OTHER); }
int sky_agents() { return int(iPalette[16].r * 255.0 + 0.5) >> 2; }
`
