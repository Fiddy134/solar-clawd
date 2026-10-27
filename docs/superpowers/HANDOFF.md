# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-27 sent, session `0069f433` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. **F1–F5 är klara** och på `main`, pushade som `Fiddy134` till **`db2eef4`** (version **0.7.0**). Ej pushat: designen för himlens takt (`d7a4d03`) och den här handoffen.
- **Nästa sak är himlens egen takt**: designen `docs/superpowers/specs/2026-10-27-himlens-takt-design.md` är godkänd av Vincent ("ok"). Nästa steg är planen (`superpowers:writing-plans`), sedan bygget **inline, utan workflow** (Vincents och Claudes beslut: få filer, en skribent), en fristående granskare på hela grenen före merge, och Vincent tittar i Ghostty.
- **Modellpolicy:** ingen `fable`; där planen säger `fable` körs Opus 5.5 med samma effort.
- **Spegeln** var armerad i 8 timmar från ~21:00 2026-10-27 och har 0.7.0. Utgången armering lämnar filerna kvar; den stoppar bara nya kopior.
- **Worktrees som gjort sitt** (allt är på `main`); Vincent kan ta bort dem från en terminal: `.worktrees/{gpu,lov-faglar,q2-a,q2-b,q2-c,fisk,fisk-m1,fisk-m2,fisk-i1,fisk-i2,motor-tema}` med `git worktree remove` och grenarna med `git branch -D`. `post6-moln-avvisad` sparas.

## Vad den här sessionen gjorde

- **0.6.0 sedd i Ghostty** (spegeln var på 0.4.0 tills Vincent armerade; kolla `~/solar-clawd-live/.claude-plugin/plugin.json` först nästa gång något ska ses). Löv, fåglar, blommor, fjädrar, fångst, grill: "ser bra ut". Fyrvaktaren hoppar till linan och grillen (känt, löses i markeringsrundan).
- **F5, motor och tema** (workflow `motor-tema`, 8 agenter, plan `docs/superpowers/plans/2026-10-27-motor-tema.md`, uppdaterad efter labb + research): fyr ligger i `hooks/themes/fyr/` (inte toppnivå: spegeln kopierar bara `hooks`, `assets`, `types`), motorn anropar `scenery`/`resident`/`themeEvent`/`themeWindow` via `PROTOTYPES`; kontrakt 1 (`engine: 1`, nya motornamn får prefixet `sky_`), lint (Appendix A-loopar, `{}`-kroppar, inga `int` out/inout, djup genom anrop och överlagringar, inget `iPalette`), tak 80 KB tema / 224 KB shader; korgen bara i texten för `context: "engine"`; verktyg `tools/theme/run.sh lint|pack …`, `sheet.sh theme <namn>`, `--theme none`. **Pixlarna identiska**: 53 + 8 scener. Säkerhetsgranskningen (pluginet) hittade fyra omgångar hål i lintern; alla täppta och testade.
- **Himlens egen takt** (labbcell i arbetsplanen, nu design): research (Ghosttys kod, macOS, andra appar) fann receptet `custom-shader-animation = false` + `window-vsync = false` på 1.3.1 (Ghostty varnar för kernel panic på macOS 14.4+; ingen panik i kväll). **Blindprov** (`tools/measure/try.sh blind`): 120/30/24 Hz fick 5, 15 Hz 4 (hack i delfinens hopp). **Mätning** (`gpu.sh plan fps`, `docs/gpu-measurements.md` sista avsnittet, tabellen i `docs/measurements/2026-10-27-fps.md`): fokuserad dag 5,9 W → 1,26 W vid 24 Hz (−79 %), tänd natt −83 %, golvet −59 %, takten exakt, tung utskrift 39 bilder/s; minimerat och bakgrundsflik ritar inte, **täckt fönster ritar varje tick**, ofokuserat ~som fokuserat.
- **Planen fick:** markeringsrundan med promenad till linan/grillen och tillbaka från där fyrvaktaren är; **skärmskalan per flik** (fyren hamnar under texten på en extern skärm med skala 1, eftersom `stagePxOf` frågar skalan en gång vid sessionsstart, `hooks/register.tsx:88`); 24 Hz-slutaren från Vincents projekt `~/visual` (`src/95-film.js`); nivåer efter dator (full/lätt/minimal via `ioreg`/`pmset`).
- **Svaret om eget animeringsspråk** (Vincent frågade igen): nej för GPU:n (F4:s dom i `docs/gpu-measurements.md`), vinsten ligger i bildrutorna – vilket takten nu tar.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode; spegeln `~/solar-clawd-live` laddas och når den levande himlen bara medan Vincent armerat den. **Merga till `main` först efter att det sammanslagna resultatet testats i en worktree** (spegeln kopierar `main` direkt).
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Inga signaler till Vincents körande Ghostty utan att fråga.
- **Worktrees:** i `.worktrees/` (inte `EnterWorktree`). I en ny: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`.
- **Tester och typer:** `claude plugin test .` (**124 tester**) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Testutskriften till en fil.
- **Paritet:** `tools/preview/parity.sh [--large] record|check|twice <dir>` (53 scener, `--large` 8 i 3024×1964); baslinjen från F5 ligger i worktreen `motor-tema` under `.preview/parity-f5*` (spela in en ny på `main` om den behövs).
- **Hooks-modulen:** `$` får bara skickas till funktioner på filens toppnivå.
- **Mätningen i Ghostty körs av Vincent**, inte Claude, och inte medan något tungt kör (workflows, paritet, tester). `gpu.sh` vägrar när Spotlight/Siri indexerar; vänta eller `--force`. Läs GPU i mW, inte device %.
- **Utåtriktat skickas av Vincent;** push bara efter Vincents ja, som `Fiddy134` (`gh auth switch -u Fiddy134`, push, tillbaka till `Iggy-Vincent`). Versionsbump i `.claude-plugin/plugin.json` när modden ändras.
- `tool.check`-hooken förblir ren genomsläppning. Inget gör himlen mer levande utan mätning (takten är mätt).

## Lösa trådar

- Granskarnas småsaker från F5 som inte åtgärdades: manifestets `layer` läses aldrig av motorn; `themeOf` släpper igenom ord och alias som `/solar event` inte når; `kindOf('constructor')` (fanns före F5); ingen lint för att `scenery` beror på `WAITING`; korgvägen (`context: "engine"`) kompileras inte av någon paritetsscen; importkontrollen är ett node-skript (`tools/theme/imports.mjs`), inte ett test.
- `docs/superpowers/ghostty-discussion-draft.md` ska inte skickas (förklarat och rättat på Ghosttys main).
- Ospårade filer Vincent kan städa: två `.claude/settings.local.json.bak-*`, `.DS_Store`, `.obsidian/`.

## Nästa steg

1. **Planen för himlens takt** ur designen (`superpowers:writing-plans`), Vincent godkänner, bygg inline på en gren i `.worktrees/takt`. Viktigast att lösa först: tickarna utan en process per bild (`markTab` startar `sh` per skrivning idag; pröva `$.fs.write` direkt mot ttyn), att tickarna inte förstör Claude Codes utskrift, vsync-raden i en egen fil som inte töms, mätraden för gamla flikar. Vincent mäter (`gpu.sh live`) och tittar på en session där Claude skriver mycket.
2. **Markeringsrundan**: färgerna 16–19 med kontrollsumma, starttid så att fyrvaktaren går till linan och grillen och tillbaka, skärmskalan per flik (probe-shadern först, Vincent kör).
3. Nivåer efter dator (full/lätt/minimal), helhetsgranskningen av GPU-arbetet efter F5, sedan F6 (installationen frågar om `full`/`spar` och vsync).

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Skriv planen för himlens takt."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
