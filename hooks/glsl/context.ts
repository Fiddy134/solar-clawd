// The sky shader's GLSL, part of hooks/shader.ts's BODY: what this tab's
// mark says of its context window. A theme reads it through these
// functions alone, never through iPalette, so the mark can change its form
// without the theme knowing.
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
int contextState() { return CONTEXT == 1 ? int(iPalette[16].r * 255.0 + 0.5) : CONTEXT_IDLE; }
`
