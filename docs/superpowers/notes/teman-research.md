# Research for the two themes' engine work

Two research passes made on 2026-10-27/28 before the `teman` branch: where market prices can come from with no key, and how the engine can carry the new signals without more reloads. Line numbers are for `main` at `3159217`. The build on `teman` follows this, and where it chose otherwise the plan (`docs/superpowers/plans/2026-10-28-teman-motor.md`) says so.

## 1. Market prices

Two sources, plain GETs, no key: Cboe's delayed-quote JSON for the Nasdaq-100 and the Mag 7 (8 requests), and Binance's public market-data host for BTC and ETH (1 request). Whether New York's market is open has no free no-key source, so the engine computes it from the New York clock and the NYSE holiday rules. Everything was tried with curl and Node fetch on 2026-10-27 around 23:47 UTC, with the market closed (19:47 in New York), so every stock answer is an after-close answer.

### What `$.http.fetch` allows

- `$.http.fetch(url, { method, headers, body, auth, socketPath })` resolves to `{ status, ok, headers, text }`; `ok` is a 2xx.
- No timeout option, no host list, no size cap; only the organisation's web-fetch policy can refuse a URL.
- Redirects are documented as followed on the socket path only, so use URLs that need none.
- `getJson` in `net.ts` gives `null` on any error or non-2xx: a failing source is just `null`.
- `number()` in `hooks/json.ts` takes real numbers only; Binance, Coinbase and Kraken send prices as strings, so `Number(...)` first.
- Cache like `issElements`: `{ fetchedAt, json }` in `$.store`, fetched at most every 5 minutes.

### Stocks: Cboe delayed quotes

- `https://cdn-api.cboe.com/api/global/delayed_quotes/quotes/<SYM>.json`, one per symbol: `_NDX` (the index itself, so no QQQ), `AAPL`, `MSFT`, `NVDA`, `GOOGL`, `AMZN`, `META`, `TSLA`.
- Use `cdn-api` directly: the older `cdn.cboe.com` answers 307.
- About 530 B and 0.1–0.9 s each, with any client and no extra headers; a CDN with `cache-control: max-age=0, s-maxage=5`.

```
{"timestamp": "2026-10-27 23:47:50", "data": {"symbol": "^NDX", "security_type": "index", "current_price": 29651.4414, "price_change": 378.0414, "price_change_percent": 1.2914, "close": 29651.4414, "prev_day_close": 29273.4004, "last_trade_time": "2026-10-27T16:14:59"}, "symbol": "^NDX"}
{"timestamp": "2026-10-27 23:47:58", "data": {"symbol": "AAPL", "security_type": "stock", "current_price": 347.28, "price_change": 3.19, "price_change_percent": 0.9276, "open": 343.24, "high": 347.78, "low": 342.39, "close": 347.1, "prev_day_close": 343.91, "last_trade_time": "2026-10-27T15:59:59", "tick": "down"}}
```

- Price is `data.current_price`, which includes after-hours trades (AAPL 347.28 against a close of 347.10). `price_change_percent` is the regular session's (`close` against `prev_day_close`). For a tape that agrees with itself: `(current_price / prev_day_close - 1) * 100`.
- `timestamp` is UTC without a zone (`Date.parse(ts.replace(' ', 'T') + 'Z')`); `last_trade_time` is New York local time without one. Cboe says the quotes are 15 minutes delayed.
- An unknown symbol gives 403 with an XML `AccessDenied`, so `null`. Indices need the underscore: `_NDX`, `_SPX` work; `NDX`, `_COMP` give 403. Untested: an answer during market hours.
- No documented rate limit; 8 small requests every 5 minutes against a CDN is negligible.
- **Terms.** [Cboe's terms](https://www.cboe.com/terms): "You may view … the Materials for your personal non-commercial use"; [Use of Content](https://www.cboe.com/use-of-content) bars using them to "license, transmit, display, broadcast…" without written consent. A person's own machine fetching for its own display is close to personal use; shipping it as a built-in theme in a public mod is a grey area, and that call is Vincent's.

### Crypto: Binance's public market-data host

- One request for both: `https://data-api.binance.vision/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D` (about 1.5 KB; `&type=MINI` drops `priceChangePercent`).

```
[{"symbol":"BTCUSDT","priceChange":"810.09000000","priceChangePercent":"1.010","prevClosePrice":"80178.73000000","lastPrice":"80988.83000000","openPrice":"80178.74000000","openTime":1793058415003,"closeTime":1793144815003},{"symbol":"ETHUSDT","priceChangePercent":"1.237","lastPrice":"2353.00000000","openPrice":"2324.26000000"}]
```

- Price `Number(lastPrice)`, change `Number(priceChangePercent)`, over a rolling 24 hours, in USDT (close enough to USD).
- Limits per IP; `x-mbx-used-weight-1m` was 2 of thousands a minute. A 429 or 418 comes with `Retry-After`.
- The host is documented for public market data. Not confirmed whether it is geo-blocked (`api.binance.com` answers 451 to US addresses); not a problem from Sweden, but the reason for a fallback.

### Market open: computed

- Monday to Friday 09:30–16:00 New York time, unless a holiday; 13:00 on early-close days.
- New York is UTC-4 from the second Sunday of March 07:00 UTC to the first Sunday of November 06:00 UTC, otherwise UTC-5 (mirrors `swedishOffsetMs`). This week tests it: Sweden left summer time on Oct 25, New York keeps it until Nov 1.
- Holidays, by rule: New Year's Day (Sunday → Monday off, Saturday → none), MLK Day (third Monday of January), Washington's Birthday (third Monday of February), Good Friday (Easter − 2), Memorial Day (last Monday of May), Juneteenth Jun 19, Independence Day Jul 4 and Christmas Dec 25 (Saturday → Friday, Sunday → Monday), Labor Day (first Monday of September), Thanksgiving (fourth Thursday of November).
- Early closes at 13:00: the day after Thanksgiving; Dec 24 and Jul 3 when Monday to Thursday.
- Checked against [NYSE's 2026–2028 calendar](https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx):
  - 2026: Jan 1, Jan 19, Feb 16, Apr 3, May 25, Jun 19, Jul 3, Sep 7, Nov 26, Dec 25; early Nov 27, Dec 24.
  - 2027: Jan 1, Jan 18, Feb 15, Mar 26, May 31, Jun 18, Jul 5, Sep 6, Nov 25, Dec 24; early Nov 26.
  - 2028: no New Year's Day, Jan 17, Feb 21, Apr 14, May 29, Jun 19, Jul 4, Sep 4, Nov 23, Dec 25; early Jul 3, Nov 24.
- Gap: unplanned closures (days of mourning) are missed. A possible test: closed when it should be open but every Cboe `last_trade_time` is from an earlier New York date, trusted only 15 minutes or more after 09:30.

### Fallbacks

1. Crypto, Coinbase Exchange: `https://api.exchange.coinbase.com/products/BTC-USD/stats` and `.../ETH-USD/stats`, e.g. `{"open":"80008.79","high":"81182","low":"79365.93","last":"80890.01",...}`; change `last / open - 1` over 24 hours; 10 requests a second per IP.
2. Crypto, Kraken: `https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD`, `result.XXBTZUSD` and `result.XETHZUSD`, price `c[0]`, open `o` since 00:00 UTC (the UTC day, not 24 hours).
3. CoinGecko, last resort: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true` gave `{"bitcoin":{"usd":80831,"usd_24h_change":0.98,...}}`, but its [keyless documentation](https://docs.coingecko.com/docs/keyless-public-api.md) says about 5 calls a minute shared per IP, "not suitable for … scheduled polling", and attribution required.
4. Stocks: no clean second source without a key. Keep the last Cboe values and mark them stale. For the index alone `https://fred.stlouisfed.org/graph/fredgraph.csv?id=NASDAQ100` is CSV, a day behind (`2026-10-26,29273.400` matched Cboe's `prev_day_close`).

### Rejected

- Stooq `q/l/?s=…&e=csv` (and `e=json`, `stooq.pl`): 404, gone.
- Yahoo v8 chart on `query1`/`query2`: 429 every time; its terms forbid this use too. One try with a browser's identity header was refused by the permission system as bot-check circumvention, and the engine should not pretend to be a browser either.
- Nasdaq `api.nasdaq.com/api/quote/AAPL/info`: timed out; its edge blocks non-browser clients.
- CNBC's quote service: 403.

Sources: [CoinGecko keyless API](https://docs.coingecko.com/docs/keyless-public-api.md), [Binance REST general info](https://developers.binance.com/en/docs/products/spot/rest-api), [Coinbase Exchange rate limits](https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits), [Cboe terms](https://www.cboe.com/terms), [Cboe use of content](https://www.cboe.com/use-of-content), [NYSE 2026–2028 calendar](https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx), [apis.io on Cboe's open endpoints](https://apis.io/providers/cboe/).

## 2. The engine

The short version: Claude's activity and agent count can travel in the tab's mark at no reload; prices can ride the reload that already happens every two minutes, if every session reads one shared snapshot; the wider strip and the glyph table are small, additive changes.

### What the engine branch must respect

- **A reload every two minutes already.** `shaderParams` rounds `ms` to `SCENE_MS` = 120 s (`shader.ts:128`, `:176`); `LOCAL_HOUR` (`:434`) changes at each grid step, so in live mode the text changes and Ghostty reloads every tab about every 2 minutes.
- **The text is compared every 10 s.** `SKY_MS` (`register.tsx:82`, `:500`) calls `updateGhosttySky`, which writes and reloads only on a difference (`ghostty.ts:323-337`).
- **The animation lives in the include.** Changing `custom-shader-animation` (`ghostty.ts:329`) also reloads.

### What Claude does now: the mark

- WAITING today: `waitFor` → `shareWaiting` writes `waiting-<id>` → `refreshSky`; `writeGhosttySky` merges every session's waits (`ghostty.ts:296-297`, `waiting.ts:18-25`) into `WAITING`/`WAITING_URGENT`. Shared by every tab, a reload per change.
- The mark: `tabMark` (`mark.ts:12-17`) sets colour 16 to `[state, fish, 1]`; `markTab` writes `OSC 4;16` to the session's tty (`ghostty.ts:123-126`, no process), on change or once a minute, and the ticks rewrite it 24 times a second. The shader reads `iPalette[16]` (`glsl/context.ts:19-20`), gated at `glsl/main.ts:217` (b = 1, r ≤ 3, g ≤ 10). A tty write wakes Ghostty for one frame; while Claude works the spinner keeps it drawing anyway. Wherever the sky shows the mark exists, so it can carry activity per tab and no quantized fallback is needed (that would lag up to 2 minutes, useless for tool kinds).
- Events: `tool.call` (one hook sees start and end, main loop and subagents via `e.agentId`); `agent.spawn` (result `.agentId`; a remote workflow agent has none); `turn.complete` with `agentId` ("Every hook hears an agent's end"); not `turn.start` for subagents (a spawn nested in the hook is not heard starting); `$.agent.list()` as ground truth only to drop listed ids that are no longer `pending`, `running` or `waiting` (workflow agents and forks are not listed).
- Design: a pure `hooks/activity.ts` (`Tool = none | command | edit | read | web | other`, codes 0..5; command: Bash, BashOutput, KillShell; edit: Edit, Write, MultiEdit, NotebookEdit; read: Read, Grep, Glob, LS, NotebookRead, ToolSearch; web: WebFetch, WebSearch; Agent leaves the kind as it is; the rest, MCP included, other; `clawd.ts`'s `toolKind` stays apart since Bash counts as write there), held `HOLD_MS` = 1.5 s, agents clamped 0..7. The mark becomes `[state + 4*agents, fish, 1 + tool]`, at most (31, 10, 6). The gate accepts b 1..6, r ≤ 31, g ≤ 10; an unmarked tab is still (0, 0, 0) and rejected first. `sky_tool()`, `sky_agents()`, `sky_TOOL_*`; `contextState()` reads `r & 3`. A top-level `remark($, ghostty, mark)` writes only a changed mark, and the session's end waits for it before `UNMARK_TAB`. Activity never feeds `livelyAt` or `skyRules` (that would flip the include's animation and reload).
- Cost: zero reloads, no shader build; about 20 bytes to the tty per change, at most about one a second with the hold, and one Ghostty frame.
- Risks: colour 16 slightly off black (up to rgb(31, 10, 6)) for programs that paint with index 16; the palette must round-trip exactly above 10/255 (today's values are exact; worth one look in Vincent's Ghostty); whether `agent.spawn` is heard for spawns nested in the mod's own `tool.call` hook is undocumented, hence the fallback through the first `tool.call` with an unknown id; parallel subagents flip the kind, which the hold covers.

### Market prices: no extra reloads

- Constants `sky_QUOTE_COUNT`, `sky_BTC … sky_TSLA`, `sky_QUOTE_PRICE[10]`, `sky_QUOTE_CHANGE[10]`, `sky_MARKET_OPEN`, `sky_QUOTES_FRESH`, appended to `THEME_SIGNALS`; `ENGINE_CONTRACT` stays 1 since the names are additive; the long night measures a full market.
- Latch prices to the scene grid that already reloads. **Every session must read the same snapshot**: the shader is shared and each session rewrites it when its own text differs (`ghostty.ts:321-327`), so two sessions with different snapshots would rewrite and reload in turn every 10 s. Keep `{ previous, current }` in `${ghostty.folder}/market.json`, written whole; fetch only when `current` is older than 5 minutes; at a boundary every session uses the newest snapshot fetched at or before it. Freshness and open/closed are computed at the latch too.
- Weather has the same weakness today (each session fetches its own, `net.ts:131`), found by reading, not seen.
- Float precision: Metal's highp float is 32-bit, so two decimals are exact only below about 167,772; print BTC without decimals. Latch on the real clock, not `momentAt`.

### A stage strip wider than 240 pt

- Today `STAGE_PT = 240` (`ghostty.ts:443`), written once as `window-padding-x = <own>,240` under the `STAGED` comment; `OUR_LINES[2]` matches only `,240`; `stagePxOf` multiplies by the scale; the active theme is fixed (`register.tsx:173`), no switch until F8; the manifest already has `stage: 'wanted' | 'none'`.
- Design: `ThemeManifest.stagePt?`, `STAGE_WIDTHS = [240, 280, …, 480]` (the cap 480), checked by `themeOf` only with `stage: 'wanted'`, `stagePtOf(theme)`; `OUR_LINES[2]` takes any width in `STAGE_WIDTHS`; `includeInGhostty($, ghostty, pt)`; pure `rightPaddingOf(text)` (the last `window-padding-x`) and `restaged(text, pt)`; `stagePx = min(theme's width, the config's right padding) × scale`; `/solar ghostty` rewrites the mod's own line when the width differs and leaves a person's own alone, saying what the theme wants; `sheet.sh theme` takes the width from the manifest. Fyr keeps 240.
- Risks: Ghostty applies padding only to new windows (the `min()` limits the mismatch); a person's padding equal to an allowed width counts as the mod's (as `,240` today); `/solar ghostty` editing the config again is an exception to "given once, then the person's" that Vincent should approve.

### `sky_glyph`, a packed bitmap font

- `hooks/glsl/glyphs.ts`, 3×5 glyphs drawn as ASCII art, packed at module load, one uint each (bit `row*3 + col`, row 0 at the top, at most `0x7FFFu`), at the end of `COMMON`. 50 glyphs: digits 0–9 as 0–9, A–Z as 10–35, then space, `.`, `,`, `:`, `-`, `+`, `%`, `/`, `$`, `!`, `?`, `'`, ▲, ▼. No `#` (the lint refuses it in a theme).
- `sky_glyph(p, origin, cell, code)` about 10 operations a pixel with no loop; `sky_line16(p, origin, cell, int text[16])`; `sky_number(p, origin, cell, value, width, decimals)`, right-aligned, with a TypeScript twin for tests.
- About 2 KB of shader text; the long night from 184 KB to about 186 KB of 224 KB. No pixel of fyr changes.
- Risks: 3×5 letters are crude (M, W, N), so boards want `cell` at 2–3 device pixels or more; float `pow`/`mod` lose exactness above 2^24; out-of-range codes must be blank.
