# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-28 eftermiddag, session `76e581b6` (Opus 5.5, auto mode) → nästa. Vincent uppdaterar Ghostty till 1.4.0 nu, och omstarten avslutar sessionen. Han öppnar den igen med `claude --continue`.

## Läge

- **`main`** har bara dokument sedan förra sessionen, alltså inga ändringar i modden. Det är:
  - designen för de två temana: `3159217`
  - avsnittet "Ghostty 1.4.0" i `docs/ghostty-research.md`: `8237b16`
  - designerna för `floor` v3 och `terminal` v3 med skisser: `849091d` till och med commiten med den här handoffen

  Takten (0.8.0, `541a4a3`) är fortfarande **inte pushad**. Push bara efter Vincents ja, som `Fiddy134`.
- **Workflowen `teman` är klar** (run `wf_e103a2df-885`, 17 agenter, ~14 h). Grenen `teman` (`.worktrees/teman`, version **0.9.0**, inte på `main`) har motorarbetet, guiden och två lärfaser. Senaste commit: `050033c`.
  - **Kurser:** `sky_QUOTE_PRICE[10]`, `sky_QUOTE_CHANGE[10]`, `sky_QUOTES_FRESH`, `sky_MARKET_OPEN` och `sky_NEW_YORK_HOUR`.
    - Börskurserna kommer från Cboe med 15 min fördröjning. Kryptot kommer från Binance, med Coinbase som reserv.
    - Hämtas högst var 5:e min till `runtime/market.json`, och **bara när temats manifest har `"market": true`**.
  - **Claudes aktivitet:** `sky_tool()` (0–5) och `sky_agents()` (0–7). De går genom flikens markering (palettfärg 16), utan omladdning.
  - **Remsans bredd:** manifestets `stagePt` får vara 240–480.
  - **Font och hjälpfunktioner:** `sky_glyph` och `sky_number` (3×5), plus `sky_under` från lärfasen.
  - **Verktyg:** flaggorna `--market`, `--tool` och `--agents` i förhandsvisningen, och scenerna 32–37 i arket.
  - **Kontroll:** 187 tester, `tsc` rent, fyrs paritet 53/53 identisk mot `.worktrees/takt/.preview/parity-takt`.
  - **Plan och utfall:** `docs/superpowers/plans/2026-10-28-teman-motor.md`. Research: `docs/superpowers/notes/teman-research.md`. Rundornas anteckningar: `docs/superpowers/notes/one-shot-round-1.md` och `-2.md`, alla på grenen `teman`.
- **Guiden** är `docs/THEME-GUIDE.md`, med `hooks/guide.test.tsx`, på `teman`.
- **Rundorna:**

  | Runda | `terminal` | `floor` |
  |---|---|---|
  | 1 | underkänd (bench 1,40) | godkänd (bench 1,18) |
  | 2 | godkänd (1,06) | godkänd (0,81) |

  F7:s "två raka godkännanden" kräver en runda 3 från noll. Den är **uppskjuten**, eftersom Vincent nu vill bygga sin vision i stället för att blindtesta guiden.
- **Vincent har sett arken** från runda 2 och skissat om båda temana med Claude. Det ledde till två designer:
  - **`docs/superpowers/specs/2026-10-28-floor-v3-design.md`:**
    - NYSE sett snett uppifrån som i Stardew Valley och Pokémon Ruby, med taket lyft och ett förgyllt kassettak inifrån överst
    - valvfönster, golvet med poster och Clawdar i alla riktningar
    - en trottoar med dörr längs västra muren
    - **ingen utsida:** himlen till vänster lämnas som den är
    - allt i marginalen, 400–480 pt
    - skissen: `2026-10-28-floor-v3/skiss-*.png`
  - **`docs/superpowers/specs/2026-10-28-terminal-v3-design.md`:**
    - utsidan behålls från runda 2
    - gaten snett uppifrån: fackverkstak, glasvägg mot plattan, avgångstavlan, stolsrader, Viktors hörna, kiosken och bagagebandet längst fram
    - "ta gärna inspiration från riktiga flygplatser"
    - skissen: `2026-10-28-terminal-v3/skiss-*.png`
  - **Vincents egna foton** till `floor` ligger lokalt i `.preview/ref-floor/` och committas inte.
  - Skissgeneratorn är `docs/superpowers/specs/2026-10-28-floor-v3/skisser.py`. Den gör SVG, som renderas med headless Chrome. Skisserna visades i brainstorm-companionen i scratch.
- **Spegeln** har 0.8.0 och är inte armerad sedan ~05:00.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode. Spegeln `~/solar-clawd-live` laddas och når den levande himlen bara medan Vincent har armerat den.
- **Merga till `main` först** efter att det sammanslagna resultatet testats i en worktree.
- **Merga inget till `main` medan Vincent sover.** Lämna grenarna färdiga för honom att titta på. **Inga teman blir inbyggda innan Vincent sett arken.**
- **Aldrig genom Claude:**
  - `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh` och `.claude/hooks/mirror.sh --now`
  - skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`
  - signaler till Vincents körande Ghostty utan att fråga
  - **`/solar vsync off`** åt Vincent
- **Worktrees** ligger i `.worktrees/`, inte via `EnterWorktree`. I en ny: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`.
- **Tester och typer:** `claude plugin test .` (146 på `main`, **187 på `teman`**) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Testutskriften skrivs till en fil.
- **Paritet:** `tools/preview/parity.sh [--large] record|check|twice <dir>` (53 scener). En `check` tar över 10 min, så kör den i bakgrunden. Baslinjen är `.worktrees/takt/.preview/parity-takt`.
- **Teman:**
  - `tools/theme/run.sh lint|pack|stage …`, `tools/preview/sheet.sh theme <namn|mapp>` (`KEEP=1` fortsätter där det stannade) och `tools/preview/run.sh shader --theme … --bench 200 --rounds 3`
  - kontrakt 1, tak 80 KB tema och 224 KB shader, nya motornamn får prefixet `sky_`
  - bench mäts utan `--event`
  - två ark samtidigt gör Chrome upptaget, så rendera ett i taget om det går
- **Mätningen i Ghostty görs av Vincent**, och inte medan något tungt kör. Läs GPU i mW.
- **Modellpolicy:** ingen `fable`. En workflow kräver Vincents uttryckliga ja, eller ordet "ultracode".
- **Utåtriktat skickas av Vincent.** Push bara efter hans ja. Versionen i `.claude-plugin/plugin.json` bumpas när modden ändras.

## Väntar på Vincents ord

- **Cboes villkor:** får kurserna från Cboe användas innan ett tema med `"market": true` levereras? Researchen kallar det en gråzon.
- **Marginalen följer temat:** `/solar ghostty` skriver om moddens egen padding-rad till temats bredd (avvikelse 8 i motorns rapport). Det är ett undantag från regeln att marginalen sätts en gång och sedan är personens. Personens egen padding lämnas orörd.
- **Kolla i Ghostty:**
  - att palettvärden över 10/255 kommer tillbaka exakt, eftersom markeringen nu går upp till rgb(31,10,6)
  - att inget han använder ritar med färg 16

## Lösa trådar

- **`spar` med många fönster** (granskarens fynd). Med Ghostty 1.4 finns en väg: AppleScripts `tty` eller `GHOSTTY_SURFACE_ID` ger fokus per terminal.
- **Avinstallation:** vsync-raden följer inte med modden ut, och README säger `/solar vsync on` först.
- **Småfel från takten, uppskjutna:**
  - `/solar full|spar` slår igenom först vid nästa 3 s-tick
  - en förlorad `clock.after` stoppar tickarna
  - `UNMARK_TAB` kan köras om
  - `lsappinfo` körs i `spar` även när himlen inte syns
  - `canTick` litar på filen
  - `paceKey` uppdaterar tidigt
  - kedjan går när `tty` är null
- **Från F5:**
  - `layer` läses aldrig
  - `themeOf` släpper igenom ord som `/solar event` inte når
  - `kindOf('constructor')`
  - ingen lint för `scenery` och `WAITING`
  - korgvägen kompileras inte i någon paritetsscen
- **Motorluckor från rundorna, inte byggda:**
  - en signal för veckodag eller handelsdag i New York
  - en flagga för "ny topp"
  - bredare M, N och W (finns i `floor` v3-designen)
  - ingen GLSL 4.30-kontroll i kitet
- Bench-kvoten för ett tema med väggar mäts mot `none`, som betalar för händelsepasset överallt (se `one-shot-round-2.md`).
- **Städning:**
  - `docs/superpowers/ghostty-discussion-draft.md` ska inte skickas.
  - Ospårade filer: `.claude/settings.local.json.bak-*`, `.DS_Store` och `.obsidian/`.
  - Worktrees som gjort sitt: `takt`, `fisk*`, `q2-*`, `gpu`, `lov-faglar`, `motor-tema`, `tema-*-r1`. `post6-moln-avvisad` och `tema-*-r2` sparas.

## Nästa steg

1. **Ghostty 1.4.0 och takten, nu, innan något tungt kör.** Läs `docs/ghostty-research.md`, avsnittet "Ghostty 1.4.0". På 1.4 behövs ingen `/solar vsync off`. Provet:
   - **(a) Tickar himlen** med `/solar full`? Står den still behöver tickarna växla mellan två markeringar ett steg isär. Rätta det före allt annat.
   - **(b)** Gamla flikar, ⌘Q och öppna igen.
   - **(c)** `tools/measure/gpu.sh live full-natt-fokus` och `full-natt-ofokus` från Terminal.app. Raderna in som avsnittet "1.4.0" i `docs/gpu-measurements.md`: passthrough, `day-clear`, `night-lit`, fokuserad och ofokuserad. Golvet på ~40 % borde till stor del försvinna.
   - **(d)** Claudes CPU med `top -pid <pid> -l 7 -s 10 -stats pid,cpu`, med himlen synlig och dold.

   Därefter går utfallet in i planen för takten, och push sker på Vincents ja.
2. **Bygga `floor` v3 och `terminal` v3** efter designerna, på grenar från `teman`:
   - **Motorn först:** bredare M, N och W i en egen funktion, och det författarna behöver ur luckorna.
   - **Sedan per tema:** en författare som utgår från `tema-*-r2` och får guiden, designen och skissen, en domare som jämför mot skissen och Vincents ord, och en rättningsrunda.
   - Arken skickas till Vincent.

   Fråga honom om det ska vara en workflow eller inline.
3. **Senare:**
   - runda 3 av F7 om guiden ska bevisas
   - markeringsrundan
   - nivåer efter dator
   - helhetsgranskningen av GPU-arbetet
   - F6
   - idéerna ur 1.4: fokus per terminal och OSC 7501

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Jag har uppdaterat till Ghostty 1.4.0, nu provar vi takten."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen och committa den. Den ska ha:
- läget med commit-id:n
- regler som ändrats
- lösa trådar
- nästa steg, med de fakta nästa session annars skulle behöva leta efter
- startmeningen

Säg sedan till Vincent att den är klar. I en ny session: läs den före allt annat.
