# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-29 kväll, session `eeaf4b57` (Opus 5.5, auto mode) → nästa. På `main` (**0.10.1**, `b0d144f`): `/solar tune` med textfliken (0.10.0) och rättningen av tickfelet. **Inte pushat:** `origin/main` står på `19cc1ca` (0.9.3); de 16 commitarna `e4bfc4c..b0d144f` (0.9.4–0.10.1) är lokala. Push bara efter Vincents ja, som `Fiddy134`.

## Läge

- **Tickfelet är rättat och provat live (0.10.1, `b0d144f`).** Claude Codes text blev trasig (rader ovanpå varandra, tecken från en rad i en annan) vid tung utskrift. Orsaken: hjälparen (`TICKER`, en `zsh` bredvid Claude Code) skrev tabbens markering `ESC ] 4;16;… ESC \` 24 ggr/s till samma tty, och macOS lämnar över en skrivning över 1024 byte i bitar, så ett tick kunde hamna mitt i Claude Codes markörkoder eller i ett å. Rättningen:
  - tickarna vilar under en tur i huvudsamtalet, utom medan Claude frågar personen (`skyRules` har `isWriting`; `register.tsx` sätter det från `claude.isWorking` och `waiting`; `turn.start` och `turn.complete` kör `refreshSky`)
  - ticket är en ensam NUL (Ghostty ritar en ny bild för vilken byte som helst, och en NUL bryter ingen sekvens den landar i); markeringen skriver sessionen själv när den ändras och varje minut, och hjälparen startas inte om när den ändras
  - research, labbsiffror och "Ej verifierat": `docs/superpowers/notes/tick-tearing-research.md`
  - Vincent såg det live: inget hjälpprogram körs under en tur, och texten såg vanlig ut efter en lång diff. Känd lucka: laddas modden om mitt i en tur tickar den resten av den turen.
- **Textfliken i `/solar tune`, Vincents liveprov 2026-10-29:** weight, gap och text shade verkade inte ändra något. Ingen bugg i modden; raderna når Ghostty (`runtime/text.ghostty`).
  - weight: `font-thicken` är macOS kantutjämning och syns knappt på Retina; Vincent sparade weight 0, vilket är lättaste förtjockningen, inte av. Förslag: jämför 255 med off på skärmbilder; syns ingen skillnad, ta bort reglaget.
  - gap: Ghostty ändrar padding bara i nya fönster (Config.zig, och vår research); panelen säger redan "new windows".
  - text shade: kanten är 1,5–1,75 px och ritas inte mot mörk himmel; på dagen når `SHADE_NEAR` sitt tak vid ~1,2. Ska den märkas behöver kanten bli bredare eller mjukare (en egen designfråga).
- **Verktyget flyttar till raden ovanför prompten (brainstorm pågår, inget byggt).** Problemet: tune-panelen dockas bredvid samtalet (Claude Code gör det i fullskärm från 110 kolumner), så samtalet blir smalare och man ser inte hur texten blir. Vincent valde **alternativ A** (skissen i `.superpowers/brainstorm/5314-1793292241/content/band-layout.html`):
  - `/solar tune` ritar verktyget i `AbovePrompt`-raden, reglagen till vänster, vädret (tid, ort, sol/måne) kvar till höger, ~8 rader högt, bara medan verktyget är öppet
  - allt flyttar dit: dawn, day, dusk, night och text
  - **Clawd-gubbarna tas bort från raden oavsett** (Vincents beslut: de passar inte temana)
  - min gissning, inte bekräftad: panelen bredvid samtalet används inte längre för verktyget
  - **Öppet: tangentbordet.** Typerna säger att en `Client` i raden får tangenter först efter klick eller ctrl+x tab; `$.ui.focus` tar bara Button/Input/Select; Esc lämnar tillbaka fokus i stället för att stänga. `prompt.edit` har `key` och kan konsumera tangenter som editorn tar som redigering (vänster/höger i en prompt med text); upp/ner och vänster i en tom prompt tar Claude Code själv (vänsterpil i tom prompt öppnade en annan vy hos Vincent).
  - **Provmodden `band-probe`** (slängkod, inte i repot): `~/.claude/dev-mods/eeaf4b57-d3c2-4f10-866c-55be8338e547/band-probe/`. `/bandprobe` ritar raden och loggar till `/private/tmp/claude-501/band-probe.log` vad `prompt.edit`, `prompt.change`, en `Client` (efter klick) och `/bandprobe focus` (`$.ui.focus` på en Button) får. Första laddningen fungerade; efter en ändring gav `/bandprobe` "unknown command", och `claude --continue` verkade också trasig. Orsak okänd (debugloggen är av).
- **`/solar tune`** (0.10.0, från `700d669` till `bfc76a5`): fyra reglage per läge (brightness, text shade, colour, warmth) med förhandsvisning, och textfliken (size, weight, line height, font, faint text, gap) i `runtime/text.ghostty`, kontrollerad med `+validate-config`. Vincent mätte omladdningen: +23–28 procentenheter Ghostty-CPU medan ett reglage rör sig, inget när det står still (`PREVIEW_MS` 250).
- **Tidigare, på `main`:** `/solar look` och SIGUSR2-omladdningen (0.9.1–0.9.2), temamotorn med `floor` och `terminal` (0.9.0), takten (0.8.x). Designerna för `floor` v3 och `terminal` v3 finns i `docs/superpowers/specs/2026-10-28-*-v3-design.md`; inte byggda. Processguiden för teman: `docs/THEME-PROCESS.md` (steg 5–9 kvar att gå igenom med Vincent).
- **Spegeln** var armerad 2026-10-29 ~18:15 i 8 timmar och har 0.10.1.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode. Spegeln `~/solar-clawd-live` når den levande himlen bara medan Vincent har armerat den (`.claude/hooks/arm.sh` från ett eget terminalfönster; `off` stänger av).
- **Merga till `main` först** efter att det sammanslagna resultatet testats i en worktree. **Merga inget till `main` medan Vincent sover.**
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`; skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`; signaler till Vincents Ghostty utan att fråga; `/solar vsync off` åt Vincent.
- **Worktrees** i `.worktrees/`, inte via `EnterWorktree`. I en ny: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`. `tick-nul` är sammanslagen och kan tas bort.
- **Tester och typer:** `claude plugin test .` (**264** på `main`) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Testutskriften till en fil. `claude plugin test` har ingen filtrering; en körning tar ~65 s.
- **Paritet:** `tools/preview/parity.sh [--large] record|check|twice <dir>` (53 scener), en `check` i bakgrunden.
- **Teman:** `tools/theme/run.sh lint|pack|stage …`, `tools/preview/sheet.sh theme <namn|mapp>`, `tools/preview/run.sh shader --theme … --bench 200 --rounds 3`; kontrakt 1, tak 80 KB tema och 224 KB shader, nya motornamn med `sky_`.
- **Mätningen i Ghostty görs av Vincent.** GPU i mW.
- **Modellpolicy:** ingen `fable`. En workflow kräver Vincents uttryckliga ja eller ordet "ultracode".
- **Utåtriktat skickas av Vincent.** Versionen i `.claude-plugin/plugin.json` bumpas när modden ändras.
- **Svara Vincent på svenska**, också mitt i ett tekniskt arbete (ett svar gled över till engelska den här sessionen).

## Väntar på Vincents ord

- **Push** av `e4bfc4c..b0d144f` (0.9.4–0.10.1, 16 commitar).
- **Cboes villkor** innan ett tema med `"market": true` levereras.
- **Kolla i Ghostty:** palettvärden över 10/255 kommer tillbaka exakt; inget han använder ritar med färg 16.
- **Weight-reglaget:** behålla eller ta bort efter jämförelsen.

## Lösa trådar

- **Tickfelet, kvar:** markeringen som sessionen skriver (`markTab`, `$.fs.write`) vid varje ändring, några gånger per tur, kan i princip landa i Claude Codes skrivning om värden skriver från en annan tråd; inte kontrollerat. Reserv om felet syns igen: AppleScript `perform action "scroll_page_lines:0"` ritar utan tty (kräver Automation-behörighet, omätt).
- **`spar` med många fönster:** AppleScripts `tty` eller `GHOSTTY_SURFACE_ID` ger fokus per terminal.
- **Avinstallation:** vsync-raden följer inte med modden ut.
- **Småfel från takten:** `/solar full|spar` slår igenom vid nästa 3 s-tick; en förlorad `clock.after`; `UNMARK_TAB` kan köras om; `lsappinfo` i `spar` när himlen inte syns; `canTick` litar på filen; `paceKey` tidigt; kedjan när `tty` är null.
- **Från F5:** `layer` läses aldrig; `themeOf` släpper igenom ord som `/solar event` inte når; `kindOf('constructor')`; ingen lint för `scenery` och `WAITING`; korgvägen i ingen paritetsscen.
- **Motorluckor:** "ny topp"-flagga, bredare M/N/W, ingen GLSL 4.30-kontroll.
- **Städning:** `docs/superpowers/ghostty-discussion-draft.md` skickas inte; ospårade `.claude/settings.local.json.bak-*`, `.DS_Store`, `.obsidian/`, `.superpowers/` (brainstormskisser; lägg i `.gitignore`); gamla worktrees (`takt`, `fisk*`, `q2-*`, `gpu`, `lov-faglar`, `motor-tema`, `tema-*-r1`, `tick-nul`).
- **Brainstormservern** (`.superpowers/brainstorm/5314-1793292241`) stängs av sig själv efter 4 h.

## Nästa steg

1. **Få provmodden att svara**, i en ny session:
   - ladda skillen `plugin-authoring` (den startar bevakningen av `~/.claude/dev-mods/<session>/`); en ny session har en ny mapp, så kopiera `band-probe/` dit eller kör med `claude --plugin-dir <mapp>`
   - kör provet: tangenter i prompt med text och i tom prompt, efter klick på raden, och `/bandprobe focus`; läs `/private/tmp/claude-501/band-probe.log`
   - utfallet avgör hur verktyget styrs: (a) tangenter via `prompt.edit` utan fokus, (b) ett klick eller ctrl+x tab först, (c) bokstavstangenter på Buttons (`hotkey`), eller en blandning
2. **Skriv designen** för verktyget i raden (`docs/superpowers/specs/2026-10-29-tune-i-raden-design.md`): alternativ A, Clawd bort, tangentbordet efter provet, hur det öppnas och stängs, vad som händer med `Pane`-koden. Byggarkontroll med en subagent, sedan Vincents godkännande, sedan en plan.
3. **Bygg** efter planen i en worktree, med tester först.
4. **Senare:** `floor` v3 och `terminal` v3 (fråga om workflow eller inline), processguidens steg 5–9, runda 3 av F7, markeringsrundan, nivåer efter dator, helhetsgranskningen av GPU-arbetet, F6, idéerna ur 1.4 (fokus per terminal, OSC 7501).

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Vi fortsätter med verktyget i raden ovanför prompten: först provmodden för tangentbordet."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen och committa den. Den ska ha läget med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle behöva leta efter, och startmeningen. Säg sedan till Vincent att den är klar. I en ny session: läs den före allt annat.
