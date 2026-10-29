# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-29 förmiddag, session `9d832978` (Opus 5.5, auto mode) → nästa. På `main` (**0.9.2**, `971417c`): allt i 0.9.0 plus `/solar look`, omladdning med SIGUSR2 på Mac, processguiden för teman, researchen om text och tune-designens och planens textflik. **Allt är pushat** (`741ad68..854b3e6`, 2026-10-29, som `Fiddy134`). Spegeln kopierar `themes/`.

## Läge

- **Nytt 2026-10-29 förmiddag, på `main` och pushat, men inte provat live genom spegeln:**
  - **`/solar look`** (0.9.1, `c6474b4`): en ruta (pane) bredvid samtalet som visar PNG:erna i sessionens `.preview/checkpoint/` sida vid sida eller under varandra, med `.md`/`.txt` under, omritad inom 1 s när mappen ändras. `hooks/look.tsx` (layout, läsning, bevakning), krokarna i `register.tsx`. `tools/preview/checkpoint.sh [--whole] [--stage 400] a.png b.png` lägger bilder där, beskurna till staget. Idén kom från [claude-inline-images](https://github.com/kbrianps/claude-inline-images): mod-API:t har `Image` (Kitty graphics, Claude Code håller bilden vid omritning). Lärdomar om API:t: `on` får inte skickas till en hjälpare vars värde behålls, och `$` får bara skickas till funktioner på toppnivå eller importerade; `$.fs` gör relativa sökvägar absoluta mot arbetsmappen.
  - **SIGUSR2 på Mac** (0.9.2, `c5deff9`): `reloadGhostty` skickar `kill -USR2` till Ghosttys app (ur `ps -axo pid=,ppid=,comm=`, föräldern 1, så aldrig en `ghostty` körd från ett skal), för Ghostty 1.2+, och AppleScript bara där det inte går. Vincent provade signalen live: Ghosttys logg sa `reloading configuration in response to SIGUSR2`, utan fönster framme och utan behörighetsfråga.
  - **`tools/preview/show.py`**: samma bilder i ett eget Ghostty-fönster med Kitty graphics (en split är för smal, eftersom varje split får hela marginalen). Reserv för små detaljer.
  - **`docs/THEME-PROCESS.md`**: processguiden för att skapa eller ändra ett tema, nio steg, med "För en ändring"-rutor. Steg 1 (visionen, med "läses som"-listan och alternativ sida vid sida) och steg 3–4 (två kontrollpunkter, bilder i rutan) är genomgångna med Vincent; steg 5–9 är dispositionen. floor v3-designen har sin "läses som"-lista (24 rader, 6 bärande som Claudes förslag, tre öppna frågor till Vincent).
  - **`docs/superpowers/notes/text-tuning-research.md`**: Ghostty 1.4.0:s källkod och ghostty-designer. Textinställningar slår igenom live vid omladdning (font, `font-thicken`, `adjust-cell-height`; `font-size` utom i fönster zoomade för hand), padding bara i nya fönster, `minimum-contrast` ser inte himlen. **`faint-opacity = 1` gör Claude Codes dimmade text läsbar mot dagshimlen** (provat; Vincent lade raden sist i sin egen `config.ghostty`). Modden laddar om Ghostty var 3:e–10:e sekund (loggen); kostnaden är inte mätt.
- **`/solar tune` är designat och planerat, inte byggt.** Design: `docs/superpowers/specs/2026-10-28-solar-tune-design.md`, med textfliken (`6ab771b`). Plan: `docs/superpowers/plans/2026-10-28-solar-tune.md`, med uppgift 5b för textfliken och mätningen med SIGUSR2 (`971417c`). Vincent vill bygga i en ny session, med subagenter. Himlens fyra reglage per läge (dawn, day, dusk, night) och en flik `text` för alla tider och teman: size, weight, line height, font, faint text och gap. **Gapet är ett och samma för alla teman** (Vincents beslut), och dagens radavstånd och luft är grundvärdena (*"Man kan läsa all text utan att det känns ihoptryckt och man får en bra mängd luft"*). Steg 1 i planen är Vincents mätning av omladdningen.
- **`main` (0.9.0, `59801c5`)** har nu temamotorn (från `teman` + `v3-motor`: `sky_glyphWide`, `sky_NEW_YORK_WEEKDAY`, `sky_TRADING_DAY`, guidens avsnitt om vyn uppifrån), temana `themes/floor` (400 pt, bench 1,07) och `themes/terminal` (440 pt, bench 1,23, nära taket), och `/solar theme <namn>`. Sammanslaget på grenen `v3` (`.worktrees/v3`) och snabbspolat; 199 tester, tsc rent, fyrs paritet 53/53 identisk. Pushat 2026-10-29 som `Fiddy134` (`bf2e85d..741ad68`).
  - **Hjälparen och temamotorn:** `remark` (markeringen när Claude gör något) stoppar den gamla hjälparen och startar en med den nya markeringen (`ab281e1`).
  - **`/solar theme`** (`hooks/themes/named.ts`, `register.tsx`): läser `themes/<namn>/` med `themeOfFiles` + `checkTheme`, sparar `theme` i `sky.json` sammanslaget med `pace` (`writeSettings`, atomiskt), alla sessioner följer inom 3 s, moddens egen padding-rad följer temats `stagePt` (personens egen rörs inte), staget ritas aldrig bredare än paddingen fönstret öppnades med (`openPaddingPt`), ett tema som inte lintar provas en gång. Granskat av en fristående granskare; I2–I4 och M4–M6 rättade (`59801c5`). Kvar, mindre: M1 (en gammal markering kan skrivas efter en ny i sällsynta fall, rättas inom 10 s), M2 (två hjälpare en bildruta), M7 (symlänkade temamappar listas inte).
  - **Mätning med tema:** `tools/measure/gpu.sh row .:day-clear@floor …` (scenes.sh tar `<scen>@<tema>`).
  - **Ej testat i kitet:** att en ny session startar med temat i `sky.json` (koden finns; syns live).
- Tidigare dokument på `main`:
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
    - **gaten heter B4, aldrig 67** (Vincent: 67 läses som memet)
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

1. **Ghostty 1.4.0 och takten: klart 2026-10-28, se slutet av takt-planen.**
   - (a) Himlen tickar på 1.4 med vsync på; ingen vsync-rad behövs.
   - (c) GPU-raderna står i `docs/gpu-measurements.md` ("Ghostty 1.4.0"): 24 i sekunden drar 84 % mindre än `true` på dagen och natten, golvet 77 % mindre; golvet under `true` ligger kvar på ~37 %.
   - (d) Kedjan inne i Claude Code kostade ~9 % av en kärna live. **Hjälparen** (en `zsh` bredvid Claude Code, `startTicks` i `hooks/ghostty.ts`) ersätter den: 0.8.1 på `main` (`80d5f46`), Claude Code 15,2 → 9,9 %, hjälparen själv 1,1 %. Vincent godtog det.
   - **Kvar till en senare runda:** Claude Code med himlen synlig men stilla (`spar`, Ghostty bakom) som rättvis baslinje, (b) ⌘Q och gamla flikar.
   - 0.8.0 och 0.8.1 är pushade.
2. **Bygga `floor` v3 och `terminal` v3** efter designerna, på grenar från `teman`:
   - **Motorn först:** bredare M, N och W i en egen funktion, och det författarna behöver ur luckorna.
   - **Sedan per tema:** en författare som utgår från `tema-*-r2` och får guiden, designen och skissen, en domare som jämför mot skissen och Vincents ord, och en rättningsrunda.
   - Arken skickas till Vincent.

   Fråga honom om det ska vara en workflow eller inline.
3. **Från Vincents liveprov 2026-10-29 natt:**
   - floor i 400 pt ser bra ut på Mac-skärmen (Vincent). Dörrgubben som stod fast är rättad (`7a1c070`).
   - **Skärmens skala: rättad** (`cbe20a3`, `f90386d`). Skalan hämtas från skärmen det främsta Ghostty-fönstret ligger på (`CGWindowListCopyWindowInfo`, ingen behörighet; `SCREEN_SCALE` i `hooks/mac.ts`), var 10:e s medan Ghostty är framme, av en session åt alla (`runtime/scale` = "skala tidpunkt"). Alla sessioner räknar staget ur samma konfiguration, tema och skalfil, så ingen tävlar om shadern längre (väggen som hoppade). Vincent såg det fungera på båda skärmarna med 30 s; 10 s kräver omstart av sessionerna. Kostnad ~0,6 % av en kärna totalt när Ghostty är framme.
   - **Kvar, känt:** ett fönster som öppnades med smalare marginal än temats (före ett temabyte) visar staget under texten tills det öppnas på nytt; svaret på `/solar theme` säger att nya fönster visar det. Fönster på två skärmar samtidigt: det främsta blir rätt. En omladdning av modden startar inte om sessionens himmel; ny kod i `session.start` kräver `claude --continue`.
   - Trottoaren i floor ligger med avsikt under textens sista kolumner (dämpad med `sky_under`); Vincent har inte sagt att den stör.
4. **Prova temana live (Vincent):**
   - **Klart:** `.claude/hooks/mirror.sh` kopierar nu `themes/` (Vincent ändrade det); tidigare kopierade spegeln inte `themes/`. Ändra raden `for part in hooks assets types; do` till `for part in hooks assets types themes; do`, sedan armera. Utan det svarar `/solar theme floor` "no theme called".
   - `/solar theme floor`, `/solar theme terminal`, `/solar theme fyr`. Marginalen följer temat i nya fönster; i ett öppet fönster ritas staget inte bredare än fönstrets padding, så öppna ett nytt fönster (⌘N) för att se hela temat.
   - floor hämtar kurser från Cboe/Binance/Coinbase; villkoren innan leverans är fortfarande öppna.
   - Mät gärna fyr/floor/terminal: `tools/measure/gpu.sh row .:day-clear@floor tick24 focused …` (se gpu.sh-huvudet).
   - 0.9.0 är pushat. `/solar theme floor` fungerade live genom spegeln 2026-10-29.
   - Steg-för-steg-guiden finns nu: `docs/THEME-PROCESS.md` (se Läge). Kvar att gå igenom med Vincent: steg 5–9.
5. **`/solar tune`:** bygg efter planen `docs/superpowers/plans/2026-10-28-solar-tune.md` i `.worktrees/tune`, subagentdrivet, uppgifterna 1–7 med 5b (textfliken). Börja med steg 1 (skriptet, sedan Vincents mätning, med en och två flikar öppna).
   - **Före det:** Vincent provar `/solar look` och SIGUSR2-omladdningen live när han armerat spegeln. floors skisser, beskurna till staget, ligger redan i `.preview/checkpoint/`.
6. **Senare:**
   - runda 3 av F7 om guiden ska bevisas
   - markeringsrundan
   - nivåer efter dator
   - helhetsgranskningen av GPU-arbetet
   - F6
   - idéerna ur 1.4: fokus per terminal och OSC 7501

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Nu bygger vi /solar tune efter planen, med subagenter."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen och committa den. Den ska ha:
- läget med commit-id:n
- regler som ändrats
- lösa trådar
- nästa steg, med de fakta nästa session annars skulle behöva leta efter
- startmeningen

Säg sedan till Vincent att den är klar. I en ny session: läs den före allt annat.
