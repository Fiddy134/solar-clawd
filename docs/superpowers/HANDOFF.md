# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-29 kväll → nästa. På `main` (**0.11.1**, `4871a1a`): `/solar tune` i raden ovanför prompten, mergat från `tune-band` och **godkänt av Vincent live** ("bra för nu"). **Inte pushat:** `origin/main` står på `19cc1ca` (0.9.3); 30 commits från `e4bfc4c` och framåt är lokala. Push bara efter Vincents ja, som `Fiddy134`.

## Läge

- **`/solar tune` ritas i raden ovanför prompten** och är klart för nu. Design: `docs/superpowers/specs/2026-10-29-tune-i-raden-design.md`; plan: `docs/superpowers/plans/2026-10-29-tune-i-raden.md`. Commitarna:
  - `edcbc63`: raden visar bara orden och himmelsremsan, utan Clawd och papperskorgen, överallt (Vincents beslut). `/solar catch` och `/solar grill` säger utanför Ghostty att de syns i Ghosttys himmel; `/solar storm` står kvar. Fyrvaktarens catch, grill och glöd i shadern är oförändrade (`EMBERS_MS`, `claude.embersAt`). `clawdRows` står kvar, eftersom temaguiden citerar den som fyrvaktarens figur.
  - `2a80d8f`: tangenterna. `q` stänger, 1–5 byter flik, `s` keepar som Enter.
  - `313e7d3`: verktyget i raden. `$.state`-atomen `isTuning`, `closeTuning` på toppnivå, nås via `q`, `/solar tune` igen och en omladdning. Panelen och `TUNE_PANE` är borta; `hooks/tune-pane.tsx` heter `hooks/tune-band.tsx`. Verktyget väntar under 8 rader eller 76 kolumner, viker för en fråga (`hasSurvey`) utan att stängas, och står kvar när himlen är dold.
  - `d4a5d14`: `/solar tune` säger när fönstret är för litet, och hjälpraden visar bara tangenter som säkert når verktyget.
  - `5778a18`: raden lämnar bara över en ny bild till Claude Code när den har ändrats (en gång i minuten med klar himmel i Ghostty, oftare när det regnar). En bild tar 0,11 ms att rita (`tools/preview/run.sh timing`).
  - `4871a1a` (0.11.1): flikarna ritas av verktyget självt på dess översta rad, så ett klick på en flik ger verktyget tangenterna; raden ritar inga knappar längre. En `prompt.edit`-hook tar 1–5 i tom prompt medan verktyget syns. (Ersätter `80f12e7`:s knappar, där ett klick lämnade tangenterna i prompten och ← öppnade agentvyn.)
- **Tangentbordsprovet (2026-10-29, i specen):** bara personen ger raden fokus, med ett klick. ctrl+x tab når inte en ensam `Client`. Motorn kan inte flytta fokus till en `Client`. **← i tom prompt öppnar agentvyn**, och efter den kör en dev-modd inte längre. Provmodden ligger i `~/.claude/dev-mods/94ad2f64-6707-47b8-acba-e12e9a57c101/band-probe/`.
- **Tickfelet** (0.10.1) är rättat och provat live; detaljer i `docs/superpowers/notes/tick-tearing-research.md`.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode. Spegeln `~/solar-clawd-live` når den levande himlen bara medan Vincent har armerat den (`.claude/hooks/arm.sh` från ett eget terminalfönster; `off` stänger av). Spegeln följer klonen, inte worktrees: grenen syns live först när den är mergad.
- **Merga till `main` först** efter att det sammanslagna resultatet testats i en worktree. **Merga inget till `main` medan Vincent sover.**
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`; skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`; signaler till Vincents Ghostty utan att fråga; `/solar vsync off` åt Vincent.
- **Worktrees** i `.worktrees/`, inte via `EnterWorktree`. I en ny: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`.
- **Tester och typer:** `claude plugin test .` (**265** på `tune-band`) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Testutskriften till en fil; en körning tar ~65 s. För snabba röd–grön: kopiera trädet utan de andra `*.test.tsx` och kör `claude plugin test <kopia>` (sessionen gjorde så med ett skript i `.superpowers/sdd/`).
- **I hooks-modulen:** en funktion som tar `$` måste ligga på filens toppnivå; motorn vägrar ladda modulen annars.
- **Paritet:** `tools/preview/parity.sh [--large] record|check|twice <dir>`. En baslinje från `main` spelas in i en frikopplad worktree (`git worktree add --detach .worktrees/parity-base main`), som sedan tas bort.
- **Mätningen i Ghostty görs av Vincent.** GPU i mW.
- **Modellpolicy:** ingen `fable`. En workflow kräver Vincents uttryckliga ja eller ordet "ultracode".
- **Utåtriktat skickas av Vincent.** Versionen i `.claude-plugin/plugin.json` bumpas när modden ändras.
- **Svara Vincent på svenska.** Tryck inte ← i tom prompt under prov.

## Väntar på Vincents ord

- **Push** av allt från `e4bfc4c` (30 commits, till 0.11.1).
- **`assets/demo.gif`** visar fortfarande Clawd i raden; `tools/preview/gif.sh` spelar in den på nytt.
- **Cboes villkor** innan ett tema med `"market": true` levereras.
- **Weight-reglaget:** behålla eller ta bort.

## Lösa trådar

- **Mindre fynd från slutgranskningen av `tune-band` (inte åtgärdade; kontrollera mot 0.11.1, flikarna har flyttats sedan granskningen):**
  - den valda raden glöms när en siffra byter flik eller raden ritas om, eftersom rad-byten inte postas
  - raden hoppar mellan 6 och 8 rader mellan himmelsflikarna och textfliken (ge `Client` `height={TOOL_ROWS - 1}`)
  - långa textanteckningar (`TEXT_WORDS.noApp`, `noInclude`) bryts över 76 kolumner och gör verktyget 9 rader
  - `plugin.json`:s beskrivning säger fortfarande "with a pixel Clawd above the prompt"
  - README säger inte att en siffra först i tom prompt byter flik medan verktyget är öppet
  - testet för en fråga kontrollerar inte att förhandsvisningen förnyas
  - inaktuella kommentarer i `hooks/sky.ts:636` och `hooks/tune-band.tsx:17`
- **Beslut tagna under bygget** (arbetsloggen är borta; här är de): uppgift 3 och 4 byggdes ihop; vädret tar alla kolumner till höger om verktyget (`WEATHER_MIN` 26); `TOOL_COLUMNS` 76; flikarna ritas som text (vald ljus, andra dämpade) i stället för den rosa fliken, sedan 0.11.1 av verktyget självt; alt-texten till `demo.gif` lämnades.
- **Tickfelet, kvar:** markeringen som sessionen skriver (`markTab`) kan i princip landa i Claude Codes skrivning om värden skriver från en annan tråd; inte kontrollerat.
- **`spar` med många fönster**, **avinstallation** (vsync-raden följer inte med), **småfel från takten**, **från F5** och **motorluckor**: som i förra handoffen (git-historiken).
- **Städning:** ospårade `.claude/settings.local.json.bak-*`, `.DS_Store`, `.obsidian/`, `.superpowers/` (lägg i `.gitignore`); gamla worktrees (`tune-band`, `takt`, `fisk*`, `q2-*`, `gpu`, `lov-faglar`, `motor-tema`, `tema-*-r1`, `tick-nul`).

## Nästa steg

1. **Push** efter Vincents ja (som `Fiddy134`).
2. **De mindre fynden** ovan, i en egen omgång i en worktree, med test först.
3. **`demo.gif`** och `plugin.json`:s beskrivning utan Clawd i raden.
4. **Senare:** `floor` v3 och `terminal` v3, processguidens steg 5–9, runda 3 av F7, markeringsrundan, nivåer efter dator, helhetsgranskningen av GPU-arbetet, F6, idéerna ur 1.4.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Ta <nästa steg>."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen och committa den. Den ska ha läget med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle behöva leta efter, och startmeningen. Säg sedan till Vincent att den är klar. I en ny session: läs den före allt annat.
