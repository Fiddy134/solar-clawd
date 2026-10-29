# Ticks that tear Claude Code's text

2026-10-29. Vincent saw Claude Code's conversation garbled in Ghostty: lines drawn over each other, letters of one line inside another, mostly while long tool output and diffs were written. Plain Ghostty with Claude Code does not do this; the mod's ticks did. Three tracks were researched at once (Ghostty's source, the macOS and Node write path, a lab on a pty of its own); this note keeps what they found and what was chosen.

## The cause

1. **Two writers on one tty.** Since 0.8.1 the helper, a zsh beside Claude Code, wrote the tab's mark `ESC ] 4;16;rgb:… ESC \` 24 times a second to the tab's tty, while Claude Code writes the conversation to the same tty. [källkod: `hooks/ghostty.ts`, `TICKER`]
2. **The kernel lets the helper in mid-write.** XNU's `ptswrite` holds the tty lock through `ttwrite`, but `ttwrite` sleeps, dropping the lock, once the output queue is full; the queue holds 1024 bytes (`clalloc(&tp->t_outq, TTYCLSIZE=1024)`, tty.c:3274, tty.h:105), so a write longer than its free room is handed over in pieces and another writer's bytes can come between them. [källkod, apple-oss-distributions/xnu f6217f8]
3. **Lab, own pty, the real TICKER, a Node writer of Claude Code-like frames (CSI moves, SGR, å/ä/ö):** no frame under 1024 B was ever split with a fast reader (0 of 8110, 0 of 338, 0 of 8190); with large frames 11 of 494 ticks (60 Hz) and 37 of 493 (back to back) landed inside a CSI, OSC or UTF-8 character, every one at an exact multiple of 1024 B into a single `write(2)`. With a slow reader, 34–43 % of the ticks did, and three times the tick itself was split, which would print `4;16;rgb:1f/0a/06` as text. [labbad, scratchpad `tick-lab/`]
4. **What Ghostty makes of it.** An ESC in CSI entry, param or intermediate state aborts the CSI (parse_table.zig:71, Parser.zig:288-291), so Claude Code's cursor move is lost and its remaining bytes print as text; an ESC mid-UTF-8 gives one U+FFFD and each orphaned continuation byte another (simd/vt.zig:82-87, 113-121). That is the garbling seen. [källkod, Ghostty v1.4.0]

## What the tick needs

- **Any byte wakes a frame.** Every pty read wakes the renderer before parsing (Termio.zig:716), the rebuild always sets `cells_rebuilt` (generic.zig:2917), and the shader runs with a new `iTime`. [källkod]
- **A NUL breaks no sequence.** C0 bytes but CAN and SUB are executed inside ESC, CSI and OSC states without leaving them (parse_table.zig:127-129, 273-275, 296-298, 354-357), and executing NUL does nothing (stream.zig:1558). It still breaks a UTF-8 character it lands inside, and DCS or APC payloads. [källkod]
- **The palette keeps the mark** between its writes, so the mark need only be written when it changes and at the minute's heartbeat. [design]

## Chosen

- **The ticks rest while Claude writes** (`skyRules`'s `isWriting`: a turn of the main conversation, save while it asks the person, when the prompt stands still and the lighthouse sweeps). Claude Code's own writes draw frames meanwhile. [design, Vincent's choice of option 1]
- **The tick is a lone NUL**, so between turns (scrolling, a resize, the band's redraws) a tick inside a long write can at worst cost one character, never a cursor move. The mark is the session's to write; the helper no longer carries it and outlives its changes. [design]
- Kept in reserve: AppleScript `perform action "scroll_page_lines:0"` draws a frame without touching the tty (Ghostty.sdef:162, PageList.zig:3411-3428), but needs an Automation permission, restarts scrollback compression each tick and is unmeasured. Ghostty's own animation (`true`) during turns was the other option and costs the GPU the pace saved.

## Ej verifierat

- Claude Code's real write sizes: it runs on Bun (`~/.local/share/claude/versions/2.1.312` says "Bun v1.4.4"), whose TTY write path was not read. `dtruss -t write -p <pid>` would show it, with SIP relaxed.
- Ghostty's real drain speed against the lab's slow reader.
- How often the tick itself was split: n = 3.
- The mark written by the session (`markTab`, `$.fs.write`) on each change, a few times a turn, can in principle land inside Claude Code's write too, if the host writes from another thread than the renderer's; not checked.
- That the garbling is gone live: Vincent's eyes, through the mirror.
