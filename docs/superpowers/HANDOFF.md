# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-27 kväll, session `fbc36b4f` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. **F1, F2, F3 och F4 är klara** och på `main`, pushade som `Fiddy134` till **`caf632c`** (version **0.6.0**). Ej pushad: den här handoffen.
- **Nästa fråga är F5** (motor/tema-split). Planen har fått nya punkter i F5 (bredare flikmarkering med kontrollsumma, och "när tillståndet började" så att fyrvaktaren kan gå till grillen), en labbcell före F6 (stillbild i stället för shader när inget rör sig), F6-noter (SIGUSR2, iglass/ghostfx-installation) och "Senare: full himmel hela tiden" (Vincents beslut: gäller på batteri också, och himlen syns även i flikar utan Claude; `iFocus` sparar ofokuserat).
- **Modellpolicy (Vincent, 2026-10-27): ingen `fable`.** Där planens tabeller säger `fable` körs Opus 5.5 med samma effort (står i planens policyavsnitt).
- **Worktrees som gjort sitt** (allt är på `main`); Vincent kan ta bort dem från en terminal: `.worktrees/{gpu,lov-faglar,q2-a,q2-b,q2-c,fisk,fisk-m1,fisk-m2,fisk-i1,fisk-i2}` med `git worktree remove` och grenarna med `git branch -D`. `post6-moln-avvisad` sparas.

## Vad den här sessionen gjorde

- **F3a (löv, blommor, fåglar, fjädrar)**, workflow `lov-faglar` (8 agenter): tre designer, två domare (C > B > A, B > C > A), ympning: C:s löv och blommor, B:s gäss med C:s tranor, B:s fjädrar. Husreceptet: `limb`/`smin`, palettbläck via `lift`, raster, nyckelplåt; `tumble()` och `widthShown()` i `common.ts`, `smin` flyttad dit (delfinen byte-identisk). Kostnad löv **1,13× main** (median, lugn dator, mjukvarurendering). Vincent såg arket och animationerna: "ser bra ut".
- **F3b (kontexten som fisk)**, workflows `fisk-mockups` (M1 lina mot M2 hjell, domare 31–26) och `fisk-bygg`: Vincent valde **linan med lån från M2** (skelett i glöden, mörkare dagsrök, droppar vid fångsten). Markeringen `[state, fish, 1]` (0 idle, 1 clearing/grill, 2 cleared/glöd, 3 gained/fångst), `ShaderParams.context`, `const int CONTEXT`, `hooks/glsl/catch.ts`, stolpen permanent (`post()`), `/solar catch|grill` med `toss/burn/kasta/bränn` som alias, bandets blick och `~`-lukt. `basket.ts` finns kvar men anropas inte (F5:s reserv).
- **`/clear` grillar också** (Vincents fråga): 8 s grill som `/solar grill`, glöd, sedan tom lina (`playGrill` i `register.tsx`, test i `session.test.tsx`). Under 10 % kontext: ingen grill.
- **Fångstens nyaste fisk** visas stadigt krämvit hela fångsten (blinket var osynligt halva tiden i en stillbild).
- **README-GIF:en** i två scener med övertoning (fångst utan fyr, sedan grill med fyren som frågar), så han aldrig teleporterar; 9,5 s, 644 KB. I den riktiga himlen hoppar han fortfarande till grillen (shadern vet inte när komprimeringen började) – F5-punkten löser det.
- **Ghostty-researchen**, `docs/ghostty-research.md`: hela config-referensen, features + VT, Ghosttys kod och GitHub, r/Ghostty och ett andra pass via GitHub. Viktigast: **vsync-rapporten (`docs/superpowers/ghostty-discussion-draft.md`) ska inte skickas** – felet är förklarat i 1.3.1:s kod och rättat på Ghosttys main (PR #13943, #14035), ännu inte släppt; **SIGUSR2 laddar om på macOS också** (kollat i koden, inte prövat); oanvända uniforms (`iFocus`, `iTimeFocus`, `iForegroundColor`); `iPalette[256]` når shadern; projekt att låna från (ghostfx, an0sunshy, ghostty-landscapes, ghostty-term-tag, shader-lab, linecast; licenser noterade).
- **Verktyg:** `tools/preview/sheet.sh q2|fisk <namn>`, `--zoom x,y,w,h`, `tools/preview/parity.sh record|check <dir>` (nu med fiskscenerna), `--fish N[,catch|grill|embers]` (felstavat tillstånd ger fel).

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode; spegeln `~/solar-clawd-live` laddas och når den levande himlen bara medan Vincent armerat den.
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Skicka inga signaler till Vincents körande Ghostty utan att fråga.
- **Worktrees:** i `.worktrees/` (inte `EnterWorktree`). I en ny: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`.
- **Tester och typer:** `claude plugin test .` (**108 tester**) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Testutskriften till en fil. Statistiktestet i `sky.test.tsx` kan slå i tidsgränsen under last; kör om.
- **Hooks-modulen:** `$` får bara skickas till funktioner på filens toppnivå (motorns statiska kontroll), som `showCatch` och `playGrill`.
- **Förhandsvisningen:** `SOLAR_ROOT=$PWD npx -y esbuild@0.24.0 tools/preview/shader.mjs --bundle --platform=node --format=esm --outfile=.preview/shader.bundle.mjs`, sedan `node .preview/shader.bundle.mjs <flaggor> --out <namn>`. Två samtidigt i samma worktree krockar. Bench bara i växelvisa par och helst på en lugn dator (samtidiga workflows gav brus upp till 1,4×).
- **Att visa Vincent:** `open -a Preview <png…>`, animationer som mp4 (`ffmpeg` finns) i QuickTime, GIF i Safari.
- **Mätningen i Ghostty körs inte av Claude.** Läs GPU-kostnad i mW och busy cycles, inte device %.
- **Utåtriktat skickas av Vincent;** push bara efter Vincents ja, som `Fiddy134` (`gh auth switch -u Fiddy134`, push, tillbaka till `Iggy-Vincent`). Versionsbump i `.claude-plugin/plugin.json` när modden ändras.
- `tool.check`-hooken förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning.

## Lösa trådar

- **0.6.0 är inte sedd i riktiga Ghostty**, bara i förhandsvisningen. Vincent armerar spegeln och tittar; fel rättas i 0.6.1.
- Avvikelser Vincent kan vilja ändra: gässens glid håller hela vart sjätte slag (planen sa 30 %, domarna valde så); fyrvaktaren går till grillen även när rutinen har honom inne.
- F3a-granskningens kvarvarande småsaker: max två bitar per pixel i löven (den tredje klipps där tre överlappar); `--zoom` väntar inte på bildavkodning; kontaktarket i `sheet.sh q2` delar a/b-par över rader.
- `(b)` (kanten bara där himlen är ljus) är fortfarande omätt i Ghostty.
- `docs/superpowers/ghostty-discussion-draft.md` ligger kvar men ska inte skickas; kan tas bort eller skrivas om till en rad om att pröva nattbygget.
- Två ospårade säkerhetskopior i `.claude/` kan tas bort av Vincent.

## Nästa steg

1. Vincent tittar på 0.6.0 i Ghostty (armerad spegel).
2. **F5** (motor/tema-split) enligt planen, med de nya punkterna: markeringen i kontraktet (16–19, kontrollsumma, starttid för tillståndet), `basket.ts` som motorns reserv. Opus 5.5 i stället för fable.
3. Valfritt före F6: labbcellen med stillbilden, och en snabb prövning av SIGUSR2 och av färgerna 17–19 per flik (probe-shader).

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Börja F5."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
