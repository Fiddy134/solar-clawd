# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-28 natt, session `8eedae6e` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. F1–F5 klara. **Himlens egen takt är byggd och mergad** till `main` (`541a4a3`, version **0.8.0**), **inte pushad**: `main` ligger 10 commits före `origin/main`. Push först efter Vincents ja, som `Fiddy134`.
- **Takten väntar på Vincents prov i Ghostty**, som han sköt till senare. Stegen han fick: `/solar full`, `/solar vsync off`, gamla flikar före omstart (fryser eller hackar de?), ⌘Q och öppna igen, `tools/measure/gpu.sh live full-natt-fokus` och `full-natt-ofokus` från Terminal.app, Claudes CPU med `top -pid <pid> -l 7 -s 10 -stats pid,cpu` med himlen synlig och dold (`/solar`), en session med mycket utskrift (leta efter `]4;16;` eller `[38;2;` i texten). Ångra: `/solar vsync on` och starta om. Vincent har **inte** stängt av vsync än.
- **Planen** `docs/superpowers/plans/2026-10-27-himlens-takt.md`: Task 0–4 klara, Task 5 steg 1–3 klara (README, granskning, merge); steg 4–7 är Vincents prov ovan, sedan raderna in i `docs/gpu-measurements.md` och utfallet in i planen.
- **Spegeln** var armerad 8 h från ~21:00 2026-10-27 (alltså till ~05:00) och har 0.8.0. Allt som mergas till `main` medan den är armerad når den levande himlen.
- **Worktrees som gjort sitt:** `.worktrees/takt` (grenen `takt` är på `main`) och de som stod i förra handoffen; Vincent tar bort dem med `git worktree remove` och `git branch -D`. `post6-moln-avvisad` sparas.

## Vad den här sessionen gjorde

- **Planen för takten** ur designen, sedan bygget inline i `.worktrees/takt`, en fristående granskare (Opus 5.5) på hela grenen, två rättningar, fast-forward till `main`. 146 tester, `tsc` ren, paritet 53/53 identiska.
- **Labbet** (planens beslut 1): `$.fs.write` direkt till `/dev/ttysNNN` fungerar (480/480 på 20 s, median 1,7 ms sen). Kostnaden ~1,4 % av en kärna i Claude Codes process (hälften kedjan `clock.now`+`clock.after`, hälften skrivningarna); en zsh-hjälpare per session ~1,0 %. Valt: `fs.write`-kedjan. Över 1 % i Vincents mätning → zsh-hjälparen bakom samma `startTicks` (proben ligger i labbets beskrivning i planen).
- **Byggt:** `hooks/pace.ts` (`skyRules`, `canTick`, `nextTickAt`, `PACE_HZ = 24`, `FULL_STILL_MS` 20 min), `/solar full|spar|vsync off|on`, `runtime/vsync.ghostty` med egen include-rad efter moddens, `sky.json` bredvid `runtime/` för läget, `ttyOf` (flikens tty en gång; `pts/N` på Linux), `startTicks` i `hooks/ghostty.ts`. Ghosttys version ur `TERM_PROGRAM_VERSION`; okänd version → inga tickar och `vsync off` vägras.
- **Vincent svarade:** `full` är hans läge: tickar fokuserat eller inte, på batteri, och står **still** (inte `spar`) efter 20 min utan tangentbord/mus.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode; spegeln `~/solar-clawd-live` laddas och når den levande himlen bara medan Vincent armerat den. **Merga till `main` först efter att det sammanslagna resultatet testats i en worktree.** **Merga inget till `main` medan Vincent sover**: lämna grenarna färdiga för honom att titta på.
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Inga signaler till Vincents körande Ghostty utan att fråga. **Rör inte `/solar vsync off`** åt Vincent.
- **Worktrees:** i `.worktrees/` (inte `EnterWorktree`). I en ny: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`.
- **Tester och typer:** `claude plugin test .` (**146 tester**) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Testutskriften till en fil. Testkitet har ingen `toBeCloseTo`; `ghosttyWorld` har nu `env` (en Map) och svarar `sh` med `ttys004` (`TTY` i `test-kit.tsx`).
- **Paritet:** `tools/preview/parity.sh [--large] record|check|twice <dir>` (53 scener; en `check` tar över 10 min, kör den i bakgrunden). Baslinje för 0.8.0: `.worktrees/takt/.preview/parity-takt`.
- **Teman:** `tools/theme/run.sh lint|pack …`, `tools/preview/sheet.sh theme <namn>`, `tools/preview/run.sh shader --theme <namn|mapp|none> [--bench 200]`. Kontrakt 1 (`engine: 1`), tak 80 KB tema / 224 KB shader, nya motornamn får prefixet `sky_`. Fyr ligger i `hooks/themes/fyr/`.
- **Hooks-modulen:** `$` får bara skickas till funktioner på filens toppnivå.
- **Mätningen i Ghostty körs av Vincent**, inte medan något tungt kör. Läs GPU i mW.
- **Modellpolicy:** ingen `fable`; där en plan säger `fable` körs Opus 5.5 med samma effort. En workflow kräver Vincents uttryckliga ja (eller ordet "ultracode").
- **Utåtriktat skickas av Vincent;** push bara efter hans ja. Versionsbump i `.claude-plugin/plugin.json` när modden ändras.

## Lösa trådar

- **`spar` med många fönster** (granskarens fynd, Vincent har inte svarat): `spar` tickar varje synligt Claude-fönster medan Ghostty är främst (motorn ger ingen fokussignal per terminal), så sex synliga fönster ger 144 bilder/s mot dagens 120. Gäller bara `spar`, inte Vincents `full`.
- **Avinstallation:** motorn har ingen händelse för det, så vsync-raden följer inte med modden ut; README säger `/solar vsync on` först. Avsteg från designen; Vincent har sagt ja till planen med det i.
- **Småfel från granskningen, uppskjutna:** `/solar full|spar` slår igenom först vid nästa 3 s-tick; en förlorad `clock.after` stoppar tickarna för sessionen; `UNMARK_TAB` kan köras om av en uppdatering mitt i sessionens slut (fanns före); `lsappinfo` var 3:e s även dold/borta/batteri i `spar`; `canTick` litar på filen, inte på att configen inkluderar den; `paceKey` uppdaterar tidigare än förut även utan tickar; kedjan går när `tty` är null.
- Från F5: manifestets `layer` läses aldrig; `themeOf` släpper igenom ord `/solar event` inte når; `kindOf('constructor')`; ingen lint för att `scenery` beror på `WAITING`; korgvägen kompileras inte av någon paritetsscen; importkontrollen är ett node-skript.
- `docs/superpowers/ghostty-discussion-draft.md` ska inte skickas. Ospårade filer Vincent kan städa: `.claude/settings.local.json.bak-*`, `.DS_Store`, `.obsidian/`.

## Nästa steg

1. **Två nya teman: workflowen `teman` kör** (startad 2026-10-28 ~00:45 i session `76e581b6`, run `wf_e103a2df-885`). Designen och Vincents svar: `docs/superpowers/specs/2026-10-28-tva-teman-design.md` (`3159217`). Klart på grenen `teman` (`.worktrees/teman`, 0.9.0, inte på `main`): kurser som `sky_`-signaler, Claudes aktivitet i flikens markering, remsans bredd per tema (240–480 pt), `sky_glyph`, `docs/THEME-GUIDE.md` granskad och rättad. Runda 1 pågick 07:00 (`tema-terminal-r1` 440 pt, `tema-floor-r1` 400 pt), sedan domare, lärfas och runda 2. Ingen merge till `main` innan Vincent sett arken (`.preview/theme-<namn>/` i varje worktree).
2. **Takten på Ghostty 1.4.0** (utgiven 2026-10-27; Vincent uppdaterar först när workflowen är klar, eftersom omstarten dödar sessionen). Läs `docs/ghostty-research.md`, "Ghostty 1.4.0". På 1.4 behövs ingen `/solar vsync off`; provet blir: (a) **ritar samma OSC 4-skrivning en bild?** Står himlen still med `/solar full` är svaret nej, och tickarna får växla mellan två markeringar ett steg isär; (b) gamla flikar, ⌘Q och öppna igen; (c) mätningen om på 1.4 som ett nytt avsnitt "1.4.0" i `docs/gpu-measurements.md` (passthrough, `day-clear`, `night-lit`, fokuserad och ofokuserad; golvet ~40 % borde till stor del försvinna); (d) Claudes CPU med `top`. Sedan raderna in, push på hans ja. Idéer ur 1.4 för senare: fokus per terminal via AppleScripts `tty`/`GHOSTTY_SURFACE_ID` (löser "`spar` med många fönster"), OSC 7501.
3. Markeringsrundan (färgerna 16–19, fyrvaktarens promenad, skärmskalan per flik), nivåer efter dator, helhetsgranskningen av GPU-arbetet, F6.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Bygg de här två temana medan jag sover:"* följt av instruktionerna.

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
