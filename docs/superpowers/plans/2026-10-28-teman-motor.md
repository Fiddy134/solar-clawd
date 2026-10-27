# The engine before the two themes

The engine work the design `docs/superpowers/specs/2026-10-28-tva-teman-design.md` puts before the airport (`terminal`) and the trading floor (`floor`), built on the branch `teman` in `.worktrees/teman`, test-first, one commit per task. The research behind it is `docs/superpowers/notes/teman-research.md`. Nothing here is merged to `main` or pushed.

Holds throughout: the 146 tests pass (changed only where a change is declared), `tsc` is clean, and fyr's parity is unchanged against `.worktrees/takt/.preview/parity-takt`. Every new shader name starts with `sky_`; `ENGINE_CONTRACT` stays 1 since every name is additive.

## Task 1: market prices

- `hooks/market.ts`, pure: the ten symbols in a fixed order (BTC, ETH, NDX, AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA); reading Cboe's and Binance's answers into quotes (price, day change in percent); a snapshot merged from a fetch and the one before (a symbol that failed keeps its last quote, or has none); New York's clock and whether its market is open (the NYSE rules, holidays and early closes, checked against the official 2026–2028 calendar); and the market as one scene shows it, latched to the scene grid.
- `hooks/net.ts`: `refreshMarket($, path)` reads the shared `market.json`, fetches only when its newest snapshot is 5 minutes old or more, writes `{ previous, current }` whole, keeps the last snapshot in `$.store` for a restart; a failure writes nothing and throws nothing.
- `hooks/ghostty.ts` reads `market.json` in each update and hands the latched market to the shader; `hooks/shader.ts` emits `sky_QUOTE_COUNT`, `sky_BTC` … `sky_TSLA`, `sky_QUOTE_PRICE[10]`, `sky_QUOTE_CHANGE[10]`, `sky_QUOTES_FRESH`, `sky_MARKET_OPEN` and `sky_NEW_YORK_HOUR`, all in `THEME_SIGNALS`; the long night carries a full market.
- Tests: the parsers on the research's real answers and on failures; the merge; `newYorkOpen` across both DST switches, weekends, every 2026–2028 holiday and early close; the latch (the same text all through a scene, a fetch inside a scene changes nothing until the next); two sessions on one `market.json` write the same shader; a session's fetch adds no reload; fyr's session fetches nothing.

Choices against the research:

- **Only a theme that asks for prices gets them fetched** (`"market": true` in its manifest). Fyr does not, so a session with fyr contacts no market host at all, and Cboe's terms (the research's grey area) only come into it when a theme that shows prices is switched on. Until F8 there is no switch, so in practice nothing is fetched yet; the sheets draw prices from a preview flag.
- **The clock signals follow the scene's clock, the prices the real one.** `sky_MARKET_OPEN` and `sky_NEW_YORK_HOUR` come from the scene's moment, like `LOCAL_HOUR`, so they change exactly when it does and a pinned time shows the market's hours at that time. Prices and freshness are latched on the real clock's grid, so a pinned sky may reload once per fetch that changes a price (at most every 5 minutes), where today it reloads not at all.
- `sky_NEW_YORK_HOUR` is added beyond the research, so a theme can ring the opening and closing bells and show New York's clock without knowing the offset between the place and New York.
- Unplanned closures are not detected.

## Task 2: what Claude does now

- `hooks/activity.ts`, pure: `activityKindOf(tool)` (command, edit, read, web, other; null for Agent and AskUserQuestion, which leave the kind as it is), the newest open call's kind held `HOLD_MS` = 1.5 s, agents clamped 0..7.
- `hooks/mark.ts`: `tabMark(context, work)` is `[state + 4*agents, fish, 1 + tool]`, at most (31, 10, 6), the same as today with nothing open.
- GLSL: the gate in `mainImage` takes b 1..6 and r up to 31; `contextState()` reads `r & 3`; `sky_TOOL_NONE` … `sky_TOOL_OTHER`, `sky_tool()` and `sky_agents()` in the context mark.
- `hooks/ghostty.ts`: `remark($, ghostty, mark)` writes a changed mark at once with no shader built; the session's end waits for it before unmarking.
- `hooks/register.tsx`: every `tool.call` (any loop) opens and closes its call; `agent.spawn`'s result and a `tool.call` from an unknown loop add an agent; that agent's `turn.complete` takes it away; each sky update drops agents `$.agent.list()` says have ended and any silent 10 minutes. Nothing of this reaches `livelyAt` or the pace.
- Tests: the encoding and its clamps; the kinds and the hold; a Bash call changes the tab's mark and adds no reload; a subagent raises the count and its end lowers it; the last word to the tab is still its unmarking.

## Task 3: the stage strip's width

- `ThemeManifest.stagePt` (one of `STAGE_WIDTHS`, 240 to 480 in steps of 40, and only with `stage: "wanted"`), checked by `themeOf` and so by the lint; `stagePtOf(theme)` is 240 when left out.
- `hooks/ghostty.ts`: the mod's own padding line is any of the widths; `includeInGhostty` writes the theme's; pure `rightPaddingOf` and `restaged`.
- `/solar ghostty` on a config that includes the sky: the mod's own padding line at another width is rewritten to the theme's, and a person's own is left alone with a word on what the theme wants. The stage in pixels is the theme's width or the config's right padding, whichever is less, times the screen's scale.
- `tools/theme/run.sh stage <theme>`, the lint prints the width, `sheet.sh theme` draws at it. Fyr keeps 240 and its config line is unchanged.

## Task 4: `sky_glyph`

- `hooks/glsl/glyphs.ts`: 50 glyphs of 3×5 drawn as text and packed into `sky_FONT`, one uint each; `sky_glyph`, `sky_line16`, `sky_number` at the end of `COMMON`, with a TypeScript twin of the number's layout for tests.
- Tests: every glyph packs back to its drawing; the GLSL's array and its `u` literals; the names are the engine's; the number's layout for negatives, decimals and BTC over 100,000; a fixture theme with a 40-character board lints clean, and its bench against `--theme none` is recorded here.

## Last

Version 0.9.0, a README section on the new signals and what the price fetch contacts, the full test run, `tsc`, and fyr's parity.
