# Solar Clawd – arbetsplan för åtta frågor (2026-10-26)

> **För agenter:** varje fråga körs som en egen Workflow (se "Workflow" under respektive fråga) med `superpowers:writing-plans`-stil på uppgifterna. Planfilen kopieras vid godkännande till `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md` i repot, och varje fråga får sedan sin egen spec/plan i `docs/superpowers/` när dess workflow startar.

## Kontext

Vincent listade åtta "frågor" för solar-clawd (Claude Code-modden med en risografhimmel bakom Ghostty, fyr-ön med fyrvaktar-Clawd, och bandet ovanför prompten). Han vill ha en plan per fråga med uppgifter, och varje fråga ska köras som en workflow där rätt modell och rätt antal agenter får rätt jobb. Sedan tas frågorna en i taget.

Svar som styr planen (från frågerundan 2026-10-26):

- **Ordning:** beroendeordningen, men installationen efter motor/tema-splitten: 1 auto mode → 2 GPU-mätning (fokus) → 3 kontext-fisk + löv/fåglar → 4 GPU-optimering → 5 motor/tema-split → 6 installation (Mac mini) → 7 två kontrasterande teman → 8 community-teman.
- **Installation:** målet är att man på en färsk Mac skriver "kan du installera github.com/Fiddy134/solar-clawd" till Claude och Claude gör resten. Vincent testar själv på Mac minin (SSH som `fiddy@100.76.220.37` över Tailscale finns också, enligt en äldre minnesanteckning, om vi vill verifiera därifrån).
- **GPU ~20 %:** mätt snabbt igår på den här datorn (M1 Pro, 3024×1964 @ 120 Hz, Ghostty 1.3.1), troligen Aktivitetskontroll. Spiken mätte 73–76 % "Device Utilization" (ioreg) med ett nattmotiv. Siffrorna behöver ett gemensamt protokoll; Mac minin mäts senare.
- **Tema #2:** två kontrasterande teman (Michelin-köket och ett till).

Nuläge i repot: `main` på `3cef45e` (v0.4.0) plus en **ocommittad ändring** i sex filer (ljusare himmel `LUMINANCE` 0.36→0.8, nya dag-stops, halverad vädergrå, tonat glas, text på glas och en 21-samplings mörk kant runt text, `shade()`). Den ändringen är GPU-tung (en bakgrundspixel går från 1 till 22 texturläsningar) och måste hanteras i steg 0 nedan.

## Gemensamt för alla frågor

### Steg 0 – den ocommittade ljusa himlen

Innan fråga 1 startar: lägg arbetet på en gren så att `main` är ren och mätbar.

- `git switch -c ljus-himmel && git commit -am "A brighter sky with a rim round the text, in progress"` och tillbaka till `main`. Grenen mäts i fråga 2 (HEAD mot `ljus-himmel`) och avgörs i fråga 4 (behålla, göra billigare eller släppa).
- Rekommendation: den ljusare himlen är ett designbeslut som står i konflikt med GPU-målet; den får inte smyga in i `main` omätt.

### Arbetssätt

- **Gren per fråga** med svenskt namn (`auto-mode`, `gpu-matning`, `fisk`, `lov-faglar`, `gpu`, `motor-tema`, `installation`, `tema-kok`, `community`). Specar på svenska i `docs/superpowers/specs/`, planer och kod på engelska i `docs/superpowers/plans/`, kommentarer i projektets prosa-stil, commit-ämnen som beskriver världen som den nu är.
- **Verifiering:** `claude plugin test .`, `npx -y -p typescript@5.6.3 tsc -p .`, och för all GLSL: `tools/preview/run.sh shader …` → PNG som någon faktiskt tittar på (agenter kan läsa PNG med Read).
- **Push** bara efter godkännande, som `Fiddy134` (`gh auth switch -u Fiddy134`, push, tillbaka till `Iggy-Vincent`), och `.claude-plugin/plugin.json` bumpas när något levereras, eftersom repot är marketplace.
- **Två regler som inte får brytas:** (1) `tool.check`-hooken i `hooks/register.tsx:561-566` förblir ren genomsläppning (en omskrivning gör varje ask till "en persons" och bryter auto mode för alla användare); (2) ingenting får göra himlen mer "lively" än idag (`hooks/register.tsx:262-269`) utan en mätning.

### Modell- och agentpolicy för workflows

| Roll | Modell (`model` i `agent()`) | Effort | Används till |
|---|---|---|---|
| Design, visuell GLSL-författning, domare, arkitektur | `fable` (sessionsmodellen; utelämna `model`) | `xhigh`/`max` för domare, annars `high` | tema-kontrakt, löv/fåglar/fisk-varianter, bedömning mot stilreferenser, adversariell granskning |
| Implementation av välspecade uppgifter, refaktor med tester, kodgranskning | `opus` | `high` | TS/GLSL-ändringar enligt plan, `/solar doctor`, mätskript, README |
| Mekaniska svep, renderingar, mätkörningar, dokumentation, torrkörningar | `sonnet` | `low`/`medium` | preview-ark, kataloger, "färsk Claude följer README", parity-renderingar |

Regler: högst ~10 agenter per workflow (sessionens riktlinje), `pipeline()` som standard, `isolation: 'worktree'` bara när agenter redigerar GLSL parallellt, adversariell verifiering (2–3 refuterare) för beslut som är dyra att ångra (tema-kontraktet, GPU-policyn, fiskens design). Det en bakgrundsagent **inte** kan göra: ta skärmfokus på Vincents Mac, köra en interaktiv auto mode-session (utom via tmux), installera på Mac minin. Sådana steg märks **[Vincent]** eller **[tmux]**.

---

## F1. Auto mode måste fungera

### Rotorsak (bevisad)

- I båda de stora sessionerna 25–26 okt (`4222954d`, `b8a67eae`, Claude Code 2.1.310) stängdes auto mode av efter att `Edit` på t.ex. `hooks/glsl/sea.ts` och `tools/preview/shader.mjs` fick: *"The server-side auto mode classifier gave no verdict (it skipped this action), so auto mode cannot determine the safety of Edit. This is a hard failure…"*, `reasonCode: classifier:auto-mode:unavailable`, följt av *"Exited Auto Mode"*. Sex respektive fyra gånger; samma ändringar gick igenom direkt efter byte till `acceptEdits` (med manuell bekräftelse varje gång). Bash gick bra i auto mode. Även Markdown-filer föll, så innehållet är inte orsaken.
- Officiella docs (`code.claude.com/docs/en/permission-modes`): skyddade sökvägar skrivs aldrig automatiskt; i auto mode "routed to the classifier". I listan: *"A directory you loaded with `--plugin-dir`, because Claude Code reloads and runs a mod's code from it when a file changes"* och `~/.claude/dev-mods/`. *"`permissions.allow` rules … do not pre-approve protected-path writes"* (därför hjälper inte `Edit(/**)` i `.claude/settings.local.json`). *"Claude Code denies an action the server gives no verdict for … A session that received either answer keeps auto mode off until the session ends."*
- `~/.claude/settings.json` har `env.CLAUDE_CODE_PLUGIN_DIRS = "~/solar-clawd"` (README:s utvecklingsupplägg). Mappen är alltså en laddad plugin-mapp **och** sessionens cwd. GitHub-ärendet anthropics/claude-code#95982 har en deterministisk repro med exakt dessa tre villkor (plugin laddad från mapp i cwd, interaktiv session, mål inuti plugin-mappen: 11/11 "no verdict"; `claude -p` reproducerar inte). Rapporterade icke-lösningar: allow-regler, `autoMode.allow`, `disableAllHooks`, kortare `hooks.json`. Fungerande: plugin laddad från en kopia utanför cwd medan originalet redigeras (10/10), `CLAUDE_CODE_AUTO_MODE_SERVER=0` (lokal klassificerare, "räknas mot användning"), eller lämna auto mode.
- Diagnosen gjordes en gång tidigare (minnesfil `~/.claude/projects/-Users-vincentrogvall/memory/auto-mode-plugin-dir-protected.md`, 2026-10-25) med en worktree-workaround, men den ligger i hemmappens projektminne och syns aldrig i sessioner som startar i repot. Worktree-upplägget tappar dessutom hot reload och är därför inte "att köra auto mode".
- Tre bifynd: (a) `autoMode.environment` i `~/.claude/settings.json` saknar `"$defaults"` (bekräftat med `claude auto-mode config`: exakt de 25 egna raderna, inga inbyggda) och beskriver bara migration-suite ("Source control: this repo … only"), vilket kan ge klassificerarfriktion vid push till `Fiddy134/solar-clawd` (beslut: listan lämnas orörd, se nedan); (b) symlänk hjälper inte – motorn bevakar "the folder the link names"; (c) sedan 2.1.299 får sandlådade shell-kommandon inte heller skriva i en `--plugin-dir`-mapp (changelog), så även `tools/preview/run.sh` (skriver `.preview/`) och `git` riskerar friktion så länge repot är den laddade mappen – ett skäl till att lösningen måste flytta laddningen, inte bara Edit.
- Felsökningsverktyg om något avviker: `claude --safe-mode --permission-mode auto` (utan hooks/plugins) för att bisektera, `claude --debug-file ./auto-debug.log` och `grep '\[auto-mode\]'` för motorns egna skäl (`verifyAutoModeGateAccess`, `kickOutOfAutoIfNeeded`, `canCycleToAuto=false`), och `/fast off` (fast mode stänger av auto mode).

### Lösning: spegeln, genomförd

Det här avsnittet skrevs om efter bygget. Specen `docs/superpowers/specs/2026-10-26-auto-mode.md` är den gällande beskrivningen; här står det som en senare fråga behöver veta.

Klonen `~/solar-clawd` är cwd och laddas inte. Motorn laddar spegeln `~/solar-clawd-live` (`CLAUDE_CODE_PLUGIN_DIRS`, absolut sökväg), som bara innehåller det motorn läser: `.claude-plugin/` utom `types`, `hooks/`, `assets/`, `types/` och `tsconfig.json`. Sparningar i docs, README eller `tools/` laddar alltså inte om modden.

- **Synken** är `.claude/hooks/mirror.sh`, placerad under `.claude/` så att den själv är skyddad. Den anropas av `PostToolUse` och `PostToolUseFailure` i `.claude/settings.local.json` (matcher `Edit|Write|NotebookEdit|Bash`), av git-hookarna `post-checkout`, `post-merge`, `post-rewrite` och `post-index-change`, och valfritt av `tools/dev/watch.sh` (kräver `fswatch`). Den tar ett lås i `$TMPDIR` och avstår i en worktree.
- **Armering:** spegeln kopierar bara medan personen armerat den, vem som än anropar. Vincent kör `.claude/hooks/arm.sh` i ett terminalfönster och skriver tillbaka fyra slumpade bokstäver; det gäller 8 timmar, `off` avarmerar. Oarmerad stannar ändringar i klonen och en hook-notis säger det en gång i timmen. Grinden kom ur tre varv säkerhetsgranskning: en spegel som kopierar av sig själv skulle upphäva skyddet av laddade plugin-mappar.
- **Bytet** gör `tools/dev/bootstrap.sh`: första speglingen, typerna till spegeln med symlänken `.claude-plugin/types` tillbaka i klonen, git-hookarna, `CLAUDE_CODE_PLUGIN_DIRS` och settings-hookarna. `arm.sh`, bootstrapen och `mirror.sh --now` vägrar ett skal utan `/dev/tty` eller med `CLAUDECODE` satt, så de körs bara av personen.
- **`autoMode.environment` lämnas orörd.** Ingen `"$defaults"`-splitsning, eftersom listan skrevs av `/auto-mode-setup` och redan stavar ut standardvärdena. Ingen rad om betrodd repo, eftersom den skulle göra klassificeraren mer tillåtande kring just modd-koden.
- **Ersatt från första designen:** `tools/dev/mirror.sh` blev `.claude/hooks/mirror.sh`, rsync av hela repot med exkluderingar blev en vitlista, och `core.hooksPath` blev vanliga hookar i `.git/hooks`. Reservalternativen B (mapp-marketplace) och C (`CLAUDE_CODE_AUTO_MODE_SERVER=0`) behövdes inte.

### Uppgifter (klara)

1. **Repro:** felet fanns redan i sessionsloggarna (sex respektive fyra gånger) och kom igen när ett heredoc in i repot nekades som `[Auto-Mode Bypass]` den 26 okt; någon separat repro behövdes inte.
2. **Bygg:** 22d0abd, a088a8d, d71c807, 618c15e, med sandlådeverifieringen i specen.
3. **Byt:** Vincent körde bootstrapen och `arm.sh` från ett terminalfönster.
4. **Verifiera:** i session `c8a8995c` gick två Edit i klonen igenom i auto mode och spegeln följde med; `claude plugin list` visar `solar-clawd@inline` från `/Users/vincentrogvall/solar-clawd-live`.
5. **Reservalternativ:** behövdes inte.
6. **Minne:** `auto-mode-plugin-dir.md` i projektminnet.

### Workflow `auto-mode` (4 agenter)

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| Repro | 1 | sonnet / medium | tmux-driven auto mode-session, fångar feltexten; hoppas över om Vincent redan gjort steg 1 |
| Bygg | 1 | opus / high | skript, hook, README, körbara tester av `mirror.sh` |
| Granska | 2 parallellt | fable / xhigh | refutera: "kan klassificeraren fortfarande se en skyddad väg?", "raderar `--delete` något motorn äger?", "fungerar hooken för MultiEdit/NotebookEdit och för sparningar utanför Claude?", "Linux-sökvägar?" |
| Verifiera | 1 | sonnet / medium | efter Vincents byte: tmux-session i auto mode + filkontroller enligt uppgift 4 |

Klart när: Vincent startar en ny session i auto mode i `~/solar-clawd`, ber om en ändring, den går igenom, och himlen uppdateras utan att han gör något mer. Uppfyllt 2026-10-26, med tillägget att spegeln måste vara armerad.

---

## F2. GPU-mätning: fokus/ofokus och en baslinje

### Vad vi vet, och vad som ändrar frågan

- **Har vi mätt ofokus?** Delvis. `spike/RESULTS.md` har `always`+ofokus (18.5 % CPU / 73 % GPU), `false`+ofokus (7.7 % / 50 %), `true`+fokus (15.9 % / 76 %), `false`+fokus (16.3 % / 76 %), ingen shader (5.9 % / 6 %), men **ingen `true`+ofokus-rad** (spikens "Unfocused: free" har inga sparade siffror), inget om gömd flik, minimerat eller täckt fönster, och inget efter 25 okt 10:40 (varken fyrvaktaren, glaset, stillahimmel-regeln eller den ocommittade `shade()`). Ghosttys docs: `true` animerar bara fokuserad yta, `false` ritar bara när terminalen uppdateras, `always` alltid; ingen fps-gräns finns (shadern ritas om varje vsync). Modden skriver `always` bara medan fyren sveper (< 5 min efter att Claude börjat vänta), `false` när borta/batteri/inte "lively", annars `true` (`hooks/beacon.ts:36-41`).
- **20 % mot 75 % är olika mått på samma sak.** Aktivitetskontrollens "% GPU" per process ≈ `powermetrics` "GPU ms/s" ÷ 10 (kräver sudo); `ioreg` "Device Utilization" är hela GPU:n inkl. WindowServer, och en tom genomsläppsshader ligger redan på 40 % där vid 120 Hz. Modellen är *frames × pixlar × arbete per pixel*; golvet (Ghosttys loop + compositing) nås inte från shaderkod.
- **Spikens `false`-rader är misstänkta:** en färsk instans vid ett stilla skal mätte 73 % under `false` mot 71 % under `true` (`spike/instance-test.txt`) – antingen ignorerar Ghostty 1.3.1 `false` när fönstret är fokuserat, eller var mätningen störd. Protokollet måste därför **räkna bildrutor**, inte bara utnyttjande.
- Ghosttys prelude (ur binären): `#version 430 core`, UBO med `iFocus`, `iTimeFocus`, `iFrame`, `iTimeDelta`; GLSL → SPIR-V → MSL. Ghostty hanterar fönsterockludering (`windowDidChangeOcclusionState:`), så täckt/minimerat slutar troligen rita av sig självt – mäts, antas inte. `config-file`-inkluderingar appliceras efter huvudfilen, så en mätsele kan inte skriva över moddens `custom-shader-animation`; kontrollerade rader kräver en färsk instans med `--config-default-files=false`. Den externa 1920×1080-skärmen går i 165 Hz – mät på den inbyggda med den externa urkopplad.

### Protokollet (spec för `tools/measure/gpu.sh`, zsh)

- **Mått per rad:** `ioreg` Device/Renderer/Tiler-utnyttjande 1 Hz (medel ± sd); Ghostty- och WindowServer-CPU via `top -l 31 -s 1 -stats pid,command,cpu`; med sudo en långlivad `powermetrics --samplers tasks,gpu_power --show-process-gpu -i 1000` vars logg klipps per rad (GPU ms/s per process, GPU-effekt mW, aktiv residens, frekvens; kolumnindex läses ur rubrikraden); **effektiv bildfrekvens** via prob-shadern `tools/measure/probe.glsl` som målar hela ytan i gråvärden som kodar `iFrame` (övre halvan `iFrame % 32`, nedre `(iFrame/32) % 32`, grått så P3 inte skevar), två `screencapture -x -R` 4 s isär, avkodade med ffmpeg + `od` → frames/s (för gömd/minimerad: fånga, göm 10 s, visa, fånga); kontext en gång per körning (maskin, skärm, macOS, `ghostty +version`, commit + dirty, shaderns sha256, `pmset -g batt`/`therm`, last). Valfritt: `MTL_HUD_ENABLED=1` vid direkt exec för Apples Metal-HUD.
- **Matrisen:** shader {`none`, `passthrough` (`spike/passthrough.glsl`), `probe`, pinnade scener `day-clear` (`--at 2026-10-26T12:30 --weather 1,10,3,20 --stage 480`), `day-overcast` (`--weather 3,8,4,90`), `night-lit` (`--at 2026-10-26T22:00 --weather 0,5,2,10 --beacon asking --stage 480`), `night-dark`, `day-leaves`, `milestone`, `comet`} × {HEAD `3cef45e`, grenen `ljus-himmel`} × animation {true, false, always} × fokus {fokuserad, ofokuserad synlig, täckt, minimerad, markerad flik gömd bakom vanlig flik} × terminalaktivitet {idle (blink av), blink, spinner 10 Hz, stream 50 rader/s} × flik {markerad `printf '\e]4;16;rgb:00/00/01\e\\'`, omarkerad} × skärm {120 Hz, 60 Hz (en rad, Vincent byter), 165 Hz extern (en rad som varning)}. Första körningens lista ≈ 40 rader × 45 s ≈ 30 min: (1) golv och **semantiktabellen** med proben (true/false/always × alla fokuslägen × idle/blink/spinner, bara fps); (2) `day-clear` + `night-lit` från grenen × {true,false,always} × {fokus, ofokus} × {idle, spinner}; (3) samma från HEAD ("vad kostade glas + kant"); (4) omarkerad flik; (5) de fyra händelsescenerna; (6) 60 Hz-raden.
- **Tre nivåer:** **A** färsk instans, helt styrd, utan Claude (körs obevakat när den startats): `/Applications/Ghostty.app/Contents/MacOS/ghostty --config-default-files=false --custom-shader=<fil> --custom-shader-animation=<v> --window-padding-x=2,240 --background=282c34 --title=solar-measure --command="tools/measure/term.sh <mark> <mode>" --wait-after-command=true &`, settle 10 s, mät 30 s, döda PID; först `touch "$HOME/Library/Application Support/solar-clawd/runtime/hidden"` så alla levande sessioner tömmer inkluderingen (samma brytare som `/solar`), bort efteråt; fokus via `osascript` (Finder fram / tillbaka via System Events på PID); gömd flik/minimera via System Events-tangenter (kräver Hjälpmedel) eller `--interactive` som väntar på Vincent. **B** den levande Claude-fliken med moddens egen policy (`gpu.sh live <etikett>`, Vincent skapar lägena: `/solar 12:30`, `/solar event balloon` → `true` 90 s, en öppen fråga → `always` 5 min, en lång verktygstung prompt → "Claude arbetar"; var och en fokus/ofokus) – det realistiska svaret på "sparar vi GPU ofokuserat" som modden beter sig idag. **C** (valfri) fryst levande flik via `chflags uchg` på `sky.glsl` och inkluderingen (moddens `mv -f` misslyckas tyst) – dokumenterat som mäthack.
- **Pinnade scener:** `tools/measure/scenes.sh <ref> <namn>…` renderar med `tools/preview/run.sh shader <flaggor>` (temporär `git worktree` för en commit) och kopierar `.preview/sky.glsl` till `.preview/measure/<sha|dirty>/<namn>.glsl`; GLSL-texten beror bara på scenflaggorna, aldrig på bredd/höjd/p3. Alltid `--at`.
- **Disciplin:** settle 10 s efter varje start/omladdning/fokusbyte, mät 30 s, medel/sd/n; hela listan två gånger i ABBA-ordning (termisk drift; datorn har 41 dagars upptid och last 4.3 just nu); vägra starta på batteri eller om någon annan process > 20 % CPU; varna om extern skärm. Resultat i `.preview/measure/out/<ISO>/{context.txt, rows.tsv, powermetrics.log, probe-*.png}`, `tools/measure/report.mjs` → markdown, och det levande dokumentet `docs/gpu-measurements.md` (en sektion per körning; `spike/RESULTS.md` får en pekare). Mac minin lägger senare till en sektion med samma scenfiler från samma commit.
- **[Vincent]:** Skärminspelning (för `screencapture`) och Hjälpmedel (för tangenter) till terminalen som kör skriptet; `sudo -v` strax före (eller `--no-sudo` = bara ioreg); extern skärm ur, lock öppet, nätström, ingen video; lämna datorn 30–40 min (skriptet säger till med `say`); nivå B-raderna och 60 Hz-raden på uppmaning.

### Frågorna första körningen måste besvara (innan F4 dimensioneras)

1. fps under `false` fokuserad idle/blink/spinner – ritar Ghostty vid vsync ändå? Då sparar stillahimmel- och batteriregeln ingenting på macOS och ett Ghostty-ärende med proben som repro är på sin plats.
2. fps och GPU under `true` ofokuserad (den saknade raden).
3. `always` ofokuserad mot fokuserad för grenen (fyrens fall).
4. Gömd flik, minimerad, täckt – slutar de rita av ockludering?
5. Golvet: passthrough mot none i device %, mW och ms/s – allt i F4 mäts mot (shader − passthrough).
6. Gren mot HEAD, dag och natt – vad `shade()` + `isTextOnGlass` + `LUMINANCE` 0.8 kostar.

### Uppgifter

1. `tools/measure/scenes.sh` – scenerna skrivna ut från valfri commit; verifiera att dag/natt skiljer sig och att HEAD:s `day-clear` saknar `SHADE_DISC` medan grenens har den.
2. `tools/measure/probe.glsl` + `tools/measure/term.sh <marked|unmarked> <idle|blink|spinner|stream>`; verifiera proben i en färsk instans (två gråtoner som ändras).
3. `tools/measure/gpu.sh` (`context`, `row`, `live`, `plan --twice`, `report`; `--no-sudo`, `--interactive`, `--settle 10 --sample 30`; `trap` som dödar instansen, stoppar powermetrics, tar bort `hidden`, återställer fokus) + `tools/measure/report.mjs`; verifiera `zsh -n`, `--dry-run`, en riktig rad medan Vincent tittar.
4. Första körningen [Vincent startar, går därifrån]; agenten väntar på `done`-markören, kör `report`; Vincent gör nivå B och 60 Hz-raden.
5. `docs/gpu-measurements.md`: kontext, tabeller, svaren på 1–6 i prosa, 20/75-förklaringen, vad det betyder för `animationOf`, baslinjen F4 mäts mot. Commit i husstil ("What the sky costs, measured: focused, unfocused, hidden, and the frame rate under each animation setting").
6. Policy-uppföljning bara om fråga 1 kräver: `hooks/beacon.ts` `animationOf` + testet `hooks/sky.test.tsx:296-307`, eller Ghostty-ärendet. **Avgjord 2026-10-26:** `false` ritar vid vsync fokuserad; `animationOf` lämnas, stilla- och batteriregeln får en lättare shader i F4 (uppgift 5b), svepet får ofokuserad väg (F4 uppgift 5), Ghostty-rapporten ligger som utkast i `docs/superpowers/ghostty-discussion-draft.md` för Vincent att pröva, redigera och skicka. Beslutet står också i `docs/gpu-measurements.md`.

### Workflow `gpu-matning` (4 agenter)

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| Bygg | 1 | opus / high | uppgift 1–3 (bara nya filer under `tools/measure/`, ingen GLSL) |
| Kör | 1 | sonnet / medium | uppgift 4 nivå A – **får inte köras som bakgrundsagent medan Vincent arbetar** (tar fokus, öppnar fönster, gömmer den levande himlen); startas när Vincent lämnar datorn |
| Tolka och skriv | 1 | fable / high | uppgift 5, och uppgift 6 som en fråga till Vincent |
| Granska | 1 | opus / medium | skriptens robusthet (traps, vägran), prosan, att siffrorna i dokumentet matchar `rows.tsv` |

## F3. Kontext-fisk och löv/fåglar

Två oberoende spår som kan löpa överlappande: **F3a löv/fåglar** rör bara `hooks/glsl/events.ts` (+ en hjälpare i `common.ts`); **F3b kontext-fisk** rör `hooks/glsl/ufo.ts`, `main.ts`, `shader.ts`, `register.tsx`, `clawd.ts` och ersätter `basket.ts`. F3b kräver att steg 0 är gjort (den rör `main.ts`).

### Husreceptet (det domarna bedömer mot)

Ur delfinen (`hooks/glsl/sea.ts:186-260`) och fyrvaktaren (`hooks/glsl/keeper.ts:135-177`): (1) silhuett av avsmalnande kapslar `limb()` (`common.ts:127-131`) sammanfogade med `smin()` (flyttas från `sea.ts:186-189` till `common.ts`); (2) bara palettens bläck via `lift(c,k)` så de dimmas med himlen, skuggning som halvtonsraster `screen(p, tone, max(3.0, u*0.24), vinkel)` med bläckets vinkel (gul 0, blå 15, grön/orange 45, rosa 75, violett 30, indigo 60), aldrig mjuka gradienter; (3) en INDIGO nyckelplåt ur register: samma SDF vid `p - vec2(0.12, 0.1)*u` som kontur `abs(sd) - 0.05u` i alpha 0.5–0.7; (4) karaktär och en sekundär rörelse som ändå är en sund stillbild. Idag bryter `drift()` (`events.ts:197-216`, en platt ellips per löv, ingen plåt, ingen stjälk), `birds()` (`events.ts:85-100`, två linjesegment i indigo **utan `lift`**, dimmas inte på natten) och `feathers()` (`events.ts:342-357`) receptet.

### F3a. Löv, blommor, fåglar (och fjädrar)

**Behåll exakt** rörelsen i `drift()`: x-driften med `WIND`, y-krypet + sinusgungan (rad 206), spinnhastigheten (209), `shy()` mot markören (207), 18 bitar, färgcykeln `i % 3`.

- **Löv, silhuett efter frö** (`i % 3`, storleksjitter 0.85–1.15): *lönn* fem flikar `limb` från basen i vinklarna 0, ±0.45, ±0.9 rad, längder 0.34u/0.30u/0.26u, `smin` 0.06u, stjälk `segment` 0.12u; *björk/asp* ett äggrunt blad 0.4u med spets och stjälk; *ek* tre par rundade flikar kring en mittnerv, `smin` 0.05u, 0.45u. **Blomblad:** körsbär med skåra (två limbs från basen i 0.35 rad, `smin` 0.03u), var fjärde bit en hel femflikig blomma 0.3u med gul mittpunkt.
- **Bläck:** kropp som idag (ORANGE, YELLOW, orange–rosa) plus `mix(INK_ORANGE, INK_INDIGO, 0.25)` för ek; EN andra plåt per löv (YELLOW 0° på ljusa halvan, eller INDIGO 45° ton 0.35 på skuggsidan); blomblad `mix(INK_PINK, CREAM, 0.55)` med PINK 75°-raster tätast vid basen. Nyckelplåt alpha 0.55 på löv, 0.3 på blomblad, plus mittnerven som tunn nyckellinje.
- **Ny sekundär rörelse:** tumla = spinnet + en flipp `cos(iTime*(1.1+1.3a)+7b)` som skalar minoraxeln `mix(0.3, 1.0, abs(flip))` och visar baksidan (kropp mot CREAM 0.35, ingen andra plåt) när `flip < 0`; fladder `x += sin(iTime*5+20a)*0.15u`. Delad hjälpare `vec2 tumble(vec2 q, float spin, float flip)` i `common.ts`, används av `drift`, `feathers` och (nivå 2) `confetti`.
- **Kostnad (krav):** per bit räknas `x, y`, `shy()`, sedan `vec2 q = p - at; if (abs(q.x) > 0.4*size || abs(q.y) > 0.4*size) continue;` **före** rotation, flikar, raster och nyckelplåt. Acceptans: `--bench 20` på `--event leaves` ≤ 1.15× main.
- **Fåglar:** tranor och gäss (lång hals framåt, tranor med släpande ben), per fågel i egen ram med `s_i = 0.55u*(1-0.06*rank)`: kropp `limb`, hals, huvudcirkel, näbb, ben (tranor); vingar två avsmalnande limbs vardera (axel→armbåge→spets, radier 0.1s→0.06s→0.015s, `smin` 0.04s); flaxcykel `phase = iTime*6 + 1.3i - 0.6*rank`, `a1 = 0.55 sin(phase)`, `a2 = 0.5 sin(phase-0.6)`, glid (`a1=0.15, a2=0.1`) 30 % av var sjätte slag så V:et böljar; behåll 9 fåglar och V-geometrin (rad 91-94) + jitter ±0.15u och en långsam andning; kropp `lift(INK_INDIGO,k)` med en felregistrerad andra plåt (BLUE/VIOLET skiftad (0.1,0.08)u alpha 0.45 under kroppen) – designagenterna provar båda; per-fågel-låda `if (abs(q.x) > 1.2s || abs(q.y) > 1.1s) continue;`.
- **Fjädrar** (samma pass): fana `limb` i färgen via `lift`, CREAM-raster längs spolen, nyckelkontur 0.45, flipp som löven; behåll svaj och fall (347-352).
- **Nivåer:** nivå 1 nu = löv, blommor, fåglar, fjädrar. Nivå 2 om domarna blir klara tidigt = drakens nyckel skiftad (`events.ts:194`) + INDIGO 45°-raster, delfinens skum som rasterprickar (`sea.ts:169-183`), konfetti får bara flippen, bandets UFO-moln (`hooks/sky.ts:517-546`, färger utanför paletten) → `mix(INKS.blue, CREAM)`/`mix(PALE, INKS.indigo)`. Nivå 3 senare/tema = häxa, släde (brunt/rött utanför paletten), Lucia, majstång, fyrtornets kropp (platt, ingen plåt – görs ihop med F3b om Vincent vill), **månen**: det enda fotografiska objektet bredvid en tryckt sol; förslag som separat mockup (cremeskiva, haven som BLUE/INDIGO 15°-raster med `seas(q)` som ton, terminatorn rastrerad, nyckelring 0.4, halon kvar) som Vincent bedömer på ett nattark innan den landar.
- **Bevis-arket** (allt med `--stage 480`, två `--time` 1.3 s isär så rörelsen syns): `--at 2026-10-26T13:00 --weather 2,8,7,40 --event leaves` (dag a/b), `16:10` (skymning), `21:00` (natt); `--at 2026-05-10T12:00 --event blossom` och `20:45`; `--at 2026-10-26T07:40 --event birds` (a/b) och `16:00`; `--at 2027-03-26T12:00 --event feathers`; `--event leaves --cursor 700,500 --since 0.2` (skyggheten). Zoom: ny flagga `--zoom x,y,w,h` i `tools/preview/shader.mjs` (3× utan utjämning) eller `sips -c … --cropOffset`. **Paritet:** fast lista renderad på main och grenen vid samma `--time`, jämförd med sha256 (`tools/preview/parity.sh`): `--at 2026-10-24T15:35 --event dolphin --beacon asking --basket 6`, `--at 2026-10-24T22:00`, `--at 2026-10-26T13:00 --weather 61,8,4,90`, `--event kite|balloon|plane|sleigh` – byte-identiska utom de rörda händelserna.
- **Tester:** i `hooks/sky.test.tsx` i stil med konfetti-texttestet (377-383): `birds`-kroppen innehåller `lift(` och inte `vec3(0.0)`; `drift` har lådtestet före `mat2`.

**Workflow `lov-faglar` (8 agenter)**

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| T0 Verktyg | 1 | sonnet / medium | `tools/preview/sheet.sh q2 <variant>`, `--zoom`, `tools/preview/parity.sh`, baslinjeark från main till `.preview/q2-baseline/` |
| T1 Design | 3 parallellt, worktrees | fable / max | A "botanisk" (lönn/ek/björk, tranor med hals och ben), B "djärvt tryck" (enklare flikar, stark andra plåt, gäss), C "fri" (max karaktär inom receptet, hela blommor); var och en renderar arket, bench, `claude plugin test .`, skriver `NOTES.md` |
| T2 Domare | 2 parallellt | fable / high | poäng 0–5 per del (löv, blommor, fåglar, fjädrar) på husstil mot `.preview/dolphin/*.png` och `.preview/keeper/crop/*`, läsbarhet i fönsterskala utan zoom, "äkta" silhuett, bevarad rörelse (a/b-paren), stillbildssundhet, kostnad; utdata: rankning + ympningar ("A:s löv, C:s fåglar, B:s fjädrar") + fixlista |
| T3 Implementera | 1 | opus / high | ren gren från main, vinnare + ympningar + fixlista, husröst i kommentarer, lådtestet, `lift()`-fixen, nivå 2 om grönt, tester, ark, paritet, bench; commits i husstil ("Leaves as the wind carries them: lobes, a stem, their backs showing as they tumble") |
| T4 Granska | 1 | opus / high | code-review; Vincent tittar på slutarket |

### F3b. Kontexten hos fyrvaktaren

**Idéer** (alla med grillen som komprimeringshändelse): (1) *hjell/torkställning* på klipporna vid `x+1.3s` – par av fiskar över en slå, lätt att räkna, men står där hängmattan hänger 03–06; (2) *fisklina från tornet till hängmattans stolpe* – lina från `(x+0.47s, foot−2.2s)` till stolpens topp `(x+2.0s, foot−1.05s)` (stolpen blir permanent), fiskar i fack 0.19s isär, nyaste närmast tornet, svajar med `WIND`; pärlor på en tråd, tio fyller den; kolliderar med ingenting (hängmattans rep fäster lägre, han går under den till dörren, lyktan och strålen orörda); billigast; (3) *tunna/låda vid dörren* – stjärtar som sticker upp, dålig läsbarhet över fem, bara som restbehållare; (4) **grillen** (Vincents idé) – stenring (indigo, rastrerad) med galler på klipporna vid `x+1.1s`, korgens treblecks-lågor (`basket.ts:24-30, 89-103`) genom gallret, fiskarna svartnar (`burnt` mot indigo som `paperBall`), 3–4 rökpelare (`basket.ts:57-64`) driver med vinden upp förbi galleriet, sedan glöd 3 s; *lukten*: bandets Clawd tittar åt höger och två `~`-glyfer driver in från bandets högerkant medan det brinner; (5) *rökeri* (eget) – falurött skjul med skorsten, rök i stället för eld; nordiskt men ny stor silhuett och ~80 rader mer; (6) *måsar* (eget tillägg) – en mås per tre fiskar landar på räcket/klipporna och skingras när grillen tänds; återanvänder F3a:s fågel-SDF i litet format.

**Rekommendation: 2 + 4** (linan från tornet till stolpen, grillen på klipporna under den), med "rökta rester" som senare ton och måsar som senare tillägg. Läsbart med en blick, komponerar med det som finns, ~90 rader GLSL, behåller alla slag Vincent bad om: fångst → häng → grilla → rök och lukt → ett par kvar. Tvåa: hjellen, om Vincent vill ha ett fristående ställ; den kostar hängmattans plats. **Beslutet lina mot ställ är Vincents**, taget på mockup-arket (fas D2).

**Band och iTerm2:** papperskorgen blir kvar där (6-px-Clawd vid ett skrivbord; användare utan Ghostty behöver en kontextvisning). I Ghostty med himlen ersätts bandets kast mot hörnet (`isBasketInSky`, `clawd.ts:562-572`): vid fångst tittar han åt höger 1.8 s, vid komprimering tittar han åt höger och `~`-glyferna driver in; ingen boll, ingen tändsticka.

**Plumbing** (motorns kontrakt är palett-16-markeringen `[state, tiondelar, 1]`; vad som ritas är temats – en söm som F5 behåller):

- Idag: `claude.paper`, `compactingSince`, `burnShownUntil`, `ballShownUntil` (`register.tsx:121-134`); `takePaper` upptäcker en passerad tiondel (184-194), pollas var 30 s (401-405) och efter varje tur (547); `basketAt(now)` → `{balls, fire}` (196-202); `markOf(...)` skriver OSC `4;16;rgb:rr/gg/bb` (`ghostty.ts:104-112`); shadern läser `iPalette[16]` (`basket.ts:41-42`); flik-testet `main.ts:222` godtar `r ≤ 2/255`, `g ≤ 10/255`, `b = 1/255`; `session.compact` (599-621) sätter elden, sedan glöd, `paper = null`, ny avläsning.
- Ny markering: `tabMark(context) → [state, fish, 1]`, `g` = fisk 0–10, `r` = 0 vila, 1 grillar, 2 glöd, **3 fångar**. `main.ts:222` ändras till `r > 3.5/255`.
- **Fångstens trigger (beslutat):** shadern kan inte se en förändring, så TS äger fönstret: vid ett steg sätter `takePaper` `claude.catchUntil = now + 2500` och uppdaterar himlen direkt (`r=3, g=n+1`) och igen efter `CATCH_MS` via `$.clock.sleep().then(refreshSky)` (mönstret från `THROW_SECONDS`, 402/547). I fönstret ritar shadern en fasfri loop (spöet böjt, fisken sprattlar `sin(iTime*20)`), så varje bildruta är en sund stillbild. Fiskar han inte just då (galleri, inne, surf, sover, bortförd) blinkar i stället den nyaste fisken på linan (cremeglimt 3 Hz) – han teleporteras inte för en fisk.
- **Grillning:** `state == 1` → `keeper()` byter pose till `keeperGrill(l)` vid `x+0.7s` mot grillen om han inte är bortförd eller inne; `keeperMode` förblir ren så UFO-schemat (`ufo.ts:23-36`) inte påverkas per flik. `state == 2` → glöd och tunn rök, fiskantalet som markeringen säger.
- **Kod:** ny `hooks/glsl/catch.ts` (`CATCH`) med `float fish(vec2 q, float s)`, `vec3 fishLine(vec3 sky, vec2 p, Lighthouse l, int fish, int state, float k)`, `vec3 grill(...)`, och `flame()`/röken flyttade ur `basket.ts`. **`basket.ts` behålls i repot men anropas inte** – F5 kopplar den som motorns reservvisning för teman som inte ritar kontexten själva. Markeringens tillstånd får **motorneutrala namn** i TS och i shaderns kommentarer (0 idle, 1 clearing = komprimering pågår, 2 cleared = glöd, 3 gained = en tiondel just fylld); fyrens ord är catch/grill. `BASKET` → `CATCH` i `BODY` (`shader.ts:425`); lina + grill anropas från `keeper()` i `ufo.ts` efter dörren (~rad 168; röken efter spriten, före `ufo()`); `sky = basket(...)` bort från `main.ts:256`; `const int BASKET` → `CONTEXT` (0 behåller bandets egen visning där himlen inte ingår). Stolpens två rader ut ur `hammock()` (`night.ts:97`) till en `post()` som alltid ritas.
- **TS:** `ShaderParams.basket` → `context: { fish; state: 'idle'|'catch'|'grill'|'embers' } | null` (`shader.ts:46-49, 87-92`); `basketAt` → `catchAt(now)` (`contextAt` är upptaget i `events.ts`); `livelyAt` (268): grill/glöd lively som elden idag, fångsten på 2.5 s inte; `ghostty.ts:158-164, 259`; kommandon `/solar catch` och `/solar grill` med `toss`, `burn`, `kasta`, `bränn` kvar som alias (643), registreringstext (292-296) och usage-rad (784); README punkt 16 och kommandoraderna 88-89.
- **Fisken (brief):** ~0.2s (13 px): `limb`-kropp + två små limbs som kluven stjärt + 1-px indigoöga, hänger med huvudet upp i en kort cremeögla; ett bläck `lift(mix(INK_BLUE, CREAM, 0.5))` (två plåtar ryms inte på 13 px) + helpixelskift av nyckeln som fyrvaktarens `max(1, floor(0.4c))` + en cremeglimt; rökt: mot INK_INDIGO 0.5; svaj `0.15*sin(iTime*1.3+i)*(0.5+WIND/10)`; på gallret platt och svartnande med `burnt`.
- **Preview:** `--fish N[,catch|grill|embers]` med `--basket` som alias (`shader.mjs:45-46`, `tabMark(params.context)` vid 228); `--sky-basket` → `--sky-context` (alias kvar); `tools/preview/gif.sh` använder kastet – README-GIF:en renderas om efter F3b. Ark: `--stage 480 --at 2026-10-24T15:35 --fish 0|3|7|10 --time 20`; `--at 2026-10-24T22:00 --fish 7`; `--fish 7,catch --time 20` och `20.4`; `--fish 7,grill --time 20|22|26`; `--fish 0,embers`; `--beacon asking --fish 5`; `--event abduction --fish 5 --time 15`; `--at 2026-10-24T04:00 --fish 6` (sover under linan); `--band --paper 70 --sky-context --reaction toss,0.4`.
- **Tester:** anpassa `hooks/band.test.tsx:79-93` (`const int CONTEXT`, nya tupler inkl. `[3, n, 1]`, bandets blick) och `hooks/session.test.tsx:763-780` (`/solar catch` → `rgb:03/01/01` direkt, `rgb:00/01/01` efter 2.5 s; `/solar grill` → `01/..` → `02/00/01` → `00/0[01]/01`; svenska alias). Nya: ett `session.compact`-test (finns inget idag) med `session.usage` 60 % → komprimering → `r=1` → resultat → `r=2, g=0` → efter 3.2 s `g=1` från 15 %; ett tiondelssteg-test (8 % → 12 % → `r=3,g=1`, sedan `r=0,g=1`); ett shader-texttest att fyrvaktarens kod läser `iPalette[16]` och att `main.ts` godtar `r = 3`. `band.test.tsx:66` och `:95` står kvar (bandets egen korg).
- **Lively-regeln:** oförändrad i anda – grillelden (en komprimering, under en minut, eller 8 s förhandsvisning) animerar som korgelden; fångsten inte; rutinen aldrig.

**Workflow `fisk` (6 agenter + Vincents val)**

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| D0 Brief | orkestreraren | fable | en sida ur ovan + markeringskontraktet + den delade minipatchen (`--fish`, `tabMark`-tupeln) till båda mockup-agenterna |
| D1 Mockups | 2 parallellt, worktrees | fable / max | M1 = lina + grill (rekommenderad), M2 = hjell + grill; bara GLSL, styrd av `--fish`; arket dag och natt med zoom |
| D2 Domare | 1 + **[Vincent]** | fable / high | läsbarhet 0/3/7/10 med en blick, komprimeringens dramatik, rester, passform mot hängmatta/dörr/UFO, kostnad; Vincent väljer lina eller ställ |
| D3 Implementera | 2 parallellt | opus / high | I1 GLSL (`catch.ts`, `keeper()` i `ufo.ts`, `main.ts` test + ordning, `basket.ts` bort, preview-flaggor, `gif.sh`); I2 TS (`register.tsx` tillstånd/kommandon/alias, `shader.ts` params/`tabMark`/konstant, `ghostty.ts` namn, `clawd.ts` blick + luktglyfer, tester, README, versionsbump) – mot samma markeringskontrakt |
| D4 Granska | 1 | opus / high | code-review; Vincent tittar på slutarket och den nya GIF:en |

## F4. GPU-optimering (och frågan om ett eget animeringsspråk)

### Kostnadsmodell (resonemang ur `hooks/glsl/main.ts:183-261` på grenen; mätningen i F2 avgör)

Pixelklasser på en typisk Claude Code-skärm: himmel 85–90 %, text och kanter 8–12 %, Claude Codes fält 0–20 %. Per himmelpixel på HEAD: 1 texturläsning, mask ~15 op, gradient ~80, natt: stjärnor 40–300 + `shootingStarAge` ~50 på varje nattpixel, `beacon()/sea()` 30–80, **`clouds()` på övre halvan ~540 op innan ett enda moln ritas** (nio slots × hash + fyra `rand` per slot för per-bild-konstanter som räknas om per pixel) + ~230 per täckande moln; händelser ~0 när ingen är uppe; `keeper`, `basket`, sol, måne begränsade av billiga lådtester. Grenen lägger till `shade()`: **21 läsningar + ~700 op på varje bakgrundspixel** – i samma storleksordning som hela HEAD-himlen på nedre halvan (hypotes: 35–50 % av grenens kostnad). Textpixel på grenen: `glass()` 43 färger × ~8 op, `isTextOnGlass` 16 läsningar (32 på färgade fält). `screen()` ~20–25 op per anrop, ingen hotspot. Allt betalas per bild: 5.9 Mpx × 120 Hz; inget steg per bild finns i Ghosttys pipeline, så inga konstanter kan lyftas ur fragmentshadern. Bärande detalj: i `shade()` väger de åtta yttersta av 21 samplingar (avstånd 2.236) **exakt 0** vid `r = 1.65` – de påverkar bara `brightest`.

### Rangordnade ändringar (ordningen att prova, inget löfte)

| # | Var | Vad | Väntad besparing (av himlens egen kostnad = shader − passthrough) | Risk | Verifiering |
|---|---|---|---|---|---|
| 1 | `main.ts` `shade()`/`SHADE_DISC` | släpp de åtta samplingarna på 2.236 (13 kvar, bevisligen identisk `near`); återanvänd `mainImage`:s `mask` för mitten; därefter 9 (3×3, kanten sänks ≤ 0.074 en pixel ut) | 13: −15–20 % av grenens total; 9: −20–25 % | ingen / pytteliten | paritets-PNG `--prose --retina --p3`, `--diff --p3`, pixeldiff ≤ 8/255 utom inom 1 px från text; F2-rader `day-clear`/`night-lit` |
| 2 | `main.ts` `glass()` | avvisa på ljushet före 43-färgsloopen (alla fältfärger har luminans < 0.6; ljus text 0.85 avfärdas på 5 op) | −2–3 % | ingen | paritet `--diff --p3` |
| 3 | `main.ts` `mainImage` | flikkontrollen (`iPalette[16]`) **före** glas/textarbetet; omarkerad flik returnerar `term.rgb` direkt | 0 % i Claude-fliken; en synlig vanlig flik under `true`/`always` faller till passthrough | ingen | preview med `--unmarked` (ny flagga); F2-rad 4 |
| 4 | `main.ts` `isTextOnGlass()` | 8-samplings kors (±1, ±4) som förtest; kör 16-looparna bara om någon korssampling är mörkare än `term` med chroma ≥ 0.05 | −2–4 % | låg | paritet `--diff --p3 --retina`, `comment-reach`-fallet |
| 5 | `clouds.ts` `clouds()` | per slot: räkna bara det snabbutgången behöver (frö, storlek, y) och fråga `kind` efter lådtestet; samma slumpsekvens | −5–8 % av övre halvan | ingen (identisk per konstruktion) | paritet dag-klar/dag-mulen vid två `--time`, pixelidentisk; bench `--without clouds` |
| 6 | `clouds.ts` | andra steget bara om benchen säger att molnen dominerar: en hash per slot med bitfält | ytterligare −5–8 % | ny molnsekvens | Vincent godkänner på fyra scener |
| 7 | `events.ts` | lådtester för de obegränsade: `comet()` (return utanför `along ∈ (−3u, 50u)`, |side| < 12u, jonsvansen < 70u), `constellation()` (FIGURE-extent + 0.5u), `kite()` (segmentavstånd till snöret först), `maypole()`, `drift()/feathers()/confetti()` (x först per bit, `continue` om |p.x − x| > u före y/sin/`shy`) | bara under händelser: kometen −90 % av sina ~300 op/pixel i tre dagar av 60; löv/konfetti/fjädrar ~−50 %; drake −70 % | låg (marginal förbi sista synliga pixel) | paritet per händelse vid två `--time`, pixelidentisk |
| 8 | `main.ts` | ofokuserad väg under `always` (`iFocus == 0`): hoppa `shade()` och `isTextOnGlass()`; ev. `events(…, false)` och molnens rasterplåtar | bara under ≤ 5 min-svepen: −30–60 % då | synlig (kanten/prickarna försvinner ofokuserat); minimala varianten nästan osynlig; beslut efter F2-fråga 3 | F2 `always` ofokus före/efter + skärmbildspar till Vincent |
| 9 | `common.ts` `screen()` | räkna de roterade gitterkoordinaterna en gång per pixel för de fyra vinklarna | −1–2 % | ingen | paritet pixelidentisk |
| 10 | `sky.ts` `realStars()` | bara om nattbenchen säger så: hoppa glimtvägen när markören är långt från tilen | ≤ −3 % natt | ingen | paritet natt |

Summan av 1–5 och 7 i en vanlig dagscen: grovt −30–40 % av grenens egen kostnad (hypotes). −50 % kräver antingen `shade()`-beslutet nedan (att släppa den helt är −35–50 %) eller det per-stegs-benchen avslöjar (molnens omsådd, hav/fyr-omstrukturering lysta nätter).

**Hjälper inte, och varför:** precisionskvalificerare (verkningslösa på GLSL 430 → SPIR-V → MSL); det dubbla `events()`-anropet (`const`-tabeller, loopar rullas ut och viks bort); **2-minuters-omkompileringen** (en omladdning kostar CPU en gång, ingen GPU; spiken mätte ISS-omladdning var 2 s till +2 p CPU, så var 2 min ≈ 0.03 %); solen kan inte flyttas i shadern (`iTime` har okänd origo, `iDate` = 0). Den enda vägen förbi omladdningar är en datakanal modden redan har: palettfärger via OSC 4 (`iPalette[16]` idag) – färg 17–23 kunde bära elevation, progress, väder, väntläge och ISS (24 bitar var) var 60 s utan omkompilering; det tar också bort ISS:ens 2-sekundersomladdningar, med risken att 256-färgsprogram i fliken visar udda färger. **Parkeras i F5 (temaformat), räknas inte som GPU.**

### Policyn `true`/`false`/`always`

`always` gäller redan bara medan fyren sveper. Resten beror på F2-fråga 1: ritar `false` verkligen bara vid uppdatering är policyn rätt och gapet är svepet (post 8, ev. kortare `BEACON_SWEEP_MS`); ritar `false` ändå vid vsync i 1.3.1 köper `livelyAt` ingenting på macOS, batteriregeln bör bli "en lättare shader" i stället för "en stilla", och ett Ghostty-ärende är på sin plats. Post 3 görs oavsett (inkluderingen är global; en synlig vanlig flik betalar shadern). Ingen ändring i `animationOf` förrän siffrorna finns (testet `hooks/sky.test.tsx:296-307` pinnar tabellen).

**F2 svarade (2026-10-26, `docs/gpu-measurements.md`):** `false` ritar 118–120 fps fokuserad, alltså vsync. Vincents beslut: `animationOf` lämnas som den är; stilla- och batteriregeln blir "en lättare shader" (uppgift 5b); svepet behåller `always` i fem minuter och får post 8 (uppgift 5); Ghostty-rapporten skickas av Vincent ur utkastet.

### Ljus mot läsbarhet mot GPU **[Vincents beslut, med siffror från F2-fråga 6]**

`shade()` finns för att `LUMINANCE` gick 0.36 → 0.8. Tre mätta alternativ: (a) 0.8 med 13/9-samplingskanten; (b) 0.8 med kanten bara där texten är ljus och himlen ljus (`gap`-grindad: `luminance(sky)` först, hoppa samplingarna när himlen är mörkare än ~0.45 – gratis natt och skymning); (c) ett mellanvärde 0.5–0.6 utan kant. Rekommendation (a)+(b) om kanten ändå mäter under ~5 p device-utnyttjande; annars är (c) på bordet.

### Svaret på "eget animeringsspråk"

**Nej, för GPU:n.** Kostnaden är bildrutor × pixlar × arbete per pixel. Ett DSL som kompileras till GLSL ändrar varken bildrutor (Ghosttys vsync-loop, styrbar bara med `custom-shader-animation`) eller pixlar (fönstret); det ändrar arbete per pixel bara om kompilatorn tvingar fram struktur som handkoden saknar: obligatoriskt lådtest per sprite, minimala per-bild-konstanter, tile-binning som stjärnkartan redan gör med `TILE_*`. Det är tre konventioner, tillämpade för hand på ett tiotal funktioner (post 5–7) på en dag; en kompilator skulle generera samma tidiga utgångar, inte bättre. Där ett deklarativt scenformat betalar sig är **författande och temaformatet** (F5/F7/F8) – med GPU-neutralitet som krav, inte som mål. Rekommendation: inför konventionerna nu (varje händelse har ett lådtest; `events()`-anropsrader en per rad så `--without` fungerar), skriv ner siffrorna, och ta scenformatfrågan i F5 utifrån hur one-shot-rundorna går.

### Mål (mätt med F2-protokollet, M1 Pro, inbyggd skärm, färsk instans, `true`, fokuserad, `idle` och `spinner`)

- Himlens egen kostnad (device-utnyttjande minus passthrough, GPU-effekt minus passthrough) i `day-clear` och `night-lit` ≤ 50 % av grenens baslinje, redovisad med medel-MHz och aktiv residens bredvid så att en klockändring inte läses som mindre arbete. Ghosttys GPU ms/s finns inte på macOS 27 (powermetrics ger 0.00 per process), så målet står i device-punkter och mW över golvet (beslut 2026-10-26); baslinjen är tabellen i `docs/gpu-measurements.md`.
- `true` + ofokus på `none`-nivå; en omarkerad synlig flik inom 5 p från passthrough; `always` + ofokus inom 10 p från fokuserat, och efter post 8 klart lägre i mW än fokuserat (F2: grenen ofokuserad under `always` drar 87–88 % av fokuserad mW).
- Ingen paritets-PNG skiljer mer än 8/255 utanför ett 1-px-band kring text, utom där en ändring är deklarerat visuell (post 6, 8).
- Resultatdokumentet säger att ~40 % device-golvet vid 120 Hz är Ghosttys loop + compositing och inte nås från shaderkod.

### Uppgifter

**Läge 2026-10-26 kväll (grenen `gpu`, `ff85241`, inte på `main`):** uppgift 0 klar (`--gpu`, renderaren skrivs ut, `--without shaded`, `--passthrough`); fas 1 rangordnade om efter benchen (kanten och molnen störst, stjärnkartan 21 % av natten, glaset litet). Fas 2 inne: post 1 (13 grannar; 9 sprack vid 3456×2234), 2, 3, 5, 7 och 10, alla granskade. Utelämnade: post 4 (korset gav mörka prickar i feta bokstäver, backad), post 6 (Vincent nej, grenen `post6-moln-avvisad`), post 8 (grå text bleknade ofokuserat, Vincent tog bort den). Förhandsvisningen: himlens egen kostnad −37 till −43 %, alltså 57–63 % av baslinjen; målet ≤ 50 % avgörs i fas 4. Uppgift 5b klar (`743d58a`): molnen bort på batteri och borta, kanten kvar. **Fas 4 körd 2026-10-27** (`d19a474`, `plan f4 --twice` plus tre rader vid 60 Hz): himlens egen kostnad i Ghostty är 38–44 % av baslinjen i mW (målet nått), 58–66 % i busy cycles (MHz × residens) och 78–95 % i device-punkter, som inte kan mäta målet (device % står vid 75–77 % för varje scen oavsett mW). Vid 60 Hz halveras baslinjens arbete, så dagshimlen var inte mättad vid 120 Hz. Den lättare himlen: −53 % dag, −40 % natt i mW. Ljusbeslutet (Vincent 2026-10-27): (a)+(b); kanten tonas ut där himlen är mörkare än 0.2 och läses inte under 0.1 (inte ~0.45: skymningens grå text behöver kanten), natt-tänd −24 % i benchen, dagen identisk. Uppgift 7 klar (domen i `docs/gpu-measurements.md`, README "What it costs"). Kvar: `gpu` till `main` med versionsbump, push efter Vincents ja. Detaljerna: `docs/gpu-measurements.md`, "F4 phase 2" och "F4 phase 4".

0. **Bench på riktig GPU (grind):** `tools/preview/lib.mjs` `--gpu` (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist` i stället för SwiftShader; `.preview/shader-gpu.bundle.mjs` från idag 14:40 antyder att det redan provats), `shader.mjs` skriver `UNMASKED_RENDERER_WEBGL`, kanten får en egen rad `sky = shaded(sky, …)` så `--without shaded` fungerar; `--bench 200 --gpu` per `--without` {clouds, shaded, beacon, keeper, stars, realStars, events, basket, aurora} vid 3024×1964 för `day-clear` och `night-lit`; blir det SwiftShader ändå: relativa tal, sagt rakt ut.
1. **Kanten från färre grannar** (post 1): 13, sedan 9 om diffen håller; ny `tools/preview/diff.mjs` (ffmpeg raw + node, efter `spike/still-test.sh`) rapporterar max och antal ändrade pixlar.
2. **Billiga avvisningar för text** (post 2, 3, 4) + `--unmarked`; en commit var.
3. **Molnen frågar var innan vem** (post 5, sedan 6 om mätt): paritet pixelidentisk vid `--time 0, 37, 120` för `day-clear`, `day-overcast`, `--ufo`.
4. **Varje händelse slutar där den tonar** (post 7): en commit per händelse eller en för de drivande.
5. **Ofokuserad under `always`** (post 8, beslutad 2026-10-26): minimal först; `--unfocused` sätter `iFocus = 0`; skärmbilder till Vincent.
5b. **En lättare shader på batteri och borta** (beslut 2026-10-26, eftersom `false` ritar vid vsync fokuserad; avgränsad av Vincent samma kväll): på batteri eller när personen är borta skrivs en himmel utan moln, med kanten kvar; `animationOf` och dess test lämnas. Stilla-regeln (`!isLively`) fick ingen lättare himmel: den gäller en vanlig dag, så den lättare hade blivit vardagshimlen. Kanten behölls eftersom grå text bleknade utan den (post 8). **Klar (`743d58a`):** konstanten `LIGHT`, `--light` i förhandsvisningen; benchen: himlens egen kostnad −58 % dag-klar, −66 % dag-mulen, −43 % natt-tänd (`docs/gpu-measurements.md`, "F4 task 5b"). Modden ändras, alltså versionsbump när `gpu` går till `main`.
6. **Sammanfoga, mät, ljusbeslutet:** worktrees i ordning 1 → 2 → 5 (alla `main.ts`), 3 och 4 parallellt; före jämförelsen kör Vincent om F2-selen med `--twice` på en lugn dator (och 60 Hz-raderna med mW), så baslinjen står på två varv; F2-selen på den sammanslagna shadern; alternativ a/b/c till Vincent med siffror; ny sektion i `docs/gpu-measurements.md`.
7. **Domen i skrift:** `docs/gpu-measurements.md` ("What a scene language would and would not change"), README ett kort "What it costs" (per-process-siffran, 120 Hz-noten, att ofokuserat är gratis under `true`).

### Workflow `gpu` (8 agenter)

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| 0 Bench-grind | 1 | opus / high | uppgift 0 (bara `tools/preview/` + en rad i `main.ts`; mergas före fas 2) |
| 1 Rangordna med siffror | orkestreraren | fable | ordningen, och om ljusbeslutet behövs nu |
| 2 Implementera | 3 parallellt, worktrees | A opus/high: uppg. 1+2+5 i följd (allt `main.ts`, en ägare); B opus/medium: uppg. 3; C sonnet/medium: uppg. 4 (ett mönster per händelse, paritetskontrollerat) | var och en slutar med tester, tsc, paritets-PNG:er |
| 3 Granska | 1 | opus / high | diffar mot paritets-PNG:erna, kommentarröst, att ingen lådmarginal klipper en synlig pixel (tittar på bilderna, inte bara siffrorna) |
| 4 Sammanfoga och mät | 1 | sonnet / medium | kräver att Vincent lämnar datorn (som F2) |
| 5 Beslut och skrift | orkestreraren | fable / high | uppgift 6:s fråga till Vincent, uppgift 7 |

## F5. Motor/tema-split

### Fakta som styr designen (verifierade)

- `/theme` är ett inbyggt kommando i Claude Code 2.1.310 och `command.register` vägrar inbyggda namn → växling heter **`/solar theme <namn>`**.
- En hooks-modul med `import()` laddas inte → inbyggda teman importeras statiskt via ett register; community-teman är **data** (`manifest.json` + `theme.glsl`) som läses med `$.fs.read` (absoluta sökvägar; modden läser redan under `~/Library/Application Support/solar-clawd/`).
- Ghostty 1.3.1 loggar en trasig shader (`spirv error path=… info=…`, `error loading custom shaders err=…`) och macOS-loggen sparar det → **ett kompileringsorakel utan kompilator**: `log show --last 20s --predicate 'subsystem == "com.mitchellh.ghostty" AND messageType == error'` efter omladdning (overifierat om texten är `%{public}`; testas live med en trasig shader). Ingen GLSL-kompilator finns på datorn (`glslangValidator`, `glslc`, `naga`: nej).
- `tsc -p .` inkluderar bara `hooks`, `types`, `tests` → ett toppnivå-`themes/` behöver `"include"` i rot-`tsconfig.json`, annars `hooks/themes/`.
- Händelsefrön använder specens arrayindex (`events.ts:280`) → flyttas delfinerna ur `EVENTS` såddas stjärnbilden och delfinerna om; specar behöver ett stabilt `salt`.
- Nyckelplåtsidiomet är inte enhetligt (ballong `0.08u/0.7`, plan `0.06u/0.7`, UFO `0.06px/0.6`, korg `0.04u/0.5`, delfin `vec2(.1,.08)u 0.05u/0.6`) → en `keyPlate()`-hjälpare måste ta bredd och alpha, skiftet stannar vid anropsplatsen; annars blir extraktionen inte pixelidentisk. Säkra mekaniska hjälpare: `pitch(u)` (13 ställen), `night()` (8), `keyInk(k)` (21).

### Beslut: rå GLSL under ett strikt motorkontrakt, med lintad GLSL-delmängd och deklarativt manifest – inget scen-DSL nu

Jämförda: (a) rå GLSL-delar + TS-register + manifest; (b) deklarativt scen-DSL kompilerat till GLSL; (c) hybrid. **(a) härdad** valdes: delfinens `smin`-kropp, fyrvaktarens procedurella grid med poser och lägesprioritet, UFO:ts 31.5 s-tidslinje och surfvågen är procedurell kod med tillståndsmaskiner – ett DSL som uttrycker dem är ett programspråk med kompilator, dokumentation och felmeddelanden att bygga och underhålla, och one-shot-författaren skulle lära sig det ur guiden ensam (det riskablaste man kan be om). Modeller skriver GLSL de redan kan. Allt (b) lovar fås billigare på GLSL-text: **kompilering** garanteras av CI (headless WebGL + `glslangValidator` på GLSL 4.30) och pinnade sha256 i `index.json`; lokalt av preview-verktyget eller Ghostty-oraklet med återställning; **budget** av en statisk lint på en delmängd (inga `while`/`do`, `for` med litterala gränser ≤ 48, nästling ≤ 2, inga texturläsningar, inget `iChannel`, ingen preprocessor, inget `discard`, inga `uniform/in/out/layout`, inget `mainImage`, inga motor-namn omdefinierade, ≤ 40 KB) plus mätt `--bench`-kostnad relativt motorn ensam med `fyr` som måttstock och en ljushetskontroll av PNG:n; **säkerhet**: en fragmentshader har ingen IO – farorna är kompileringsfel (hanterat), GPU-häng (begränsade loopar), läsning av terminalbilden (förbjudna tokens) och kostnad (bench). Aldrig TypeScript från ett community-tema; inbyggda teman är TS-omslag kring samma två filer, så inbyggda och community-teman har identisk makt – det håller one-shot-experimentet ärligt. DSL omprövas bara om one-shot-rundorna visar att författare misslyckas med GLSL i sig (syntax, typer) snarare än med kontraktet eller stilen; protokollet klassificerar varje fel.

### Filer och kontrakt

```
themes/index.ts      export const THEMES = { fyr: FYR } as const; export const BASE_THEME = 'fyr'
themes/theme.ts      Theme, ThemeManifest, ThemeEventSpec; themeOf(json, glsl): Theme | { error }; lintTheme(glsl, engineNames): string[];
                     whenOf(spec): (ctx) => boolean; ENGINE_EVENT_BASE = 1, THEME_EVENT_BASE = 100
themes/fyr/index.ts  export const FYR: Theme = themeOfParts(FYR_MANIFEST, [SEA, KEEPER, SURF, NIGHT, ROUTINE, UFO])
themes/fyr/manifest.ts, themes/fyr/glsl/{sea,keeper,surf,night,routine,ufo}.ts (git mv från hooks/glsl/), themes/fyr/README.md
```

Community-formen av samma tema: `<dir>/manifest.json` + `<dir>/theme.glsl`; `tools/theme/pack.mjs fyr` skriver den ur TS-temat och ett test hävdar att den validerar och lintar rent.

**Manifest** (format 1): `name` `[a-z0-9-]{1,32}` = mappnamn, `title`, `description`, `author`, `version`, `license`, `stage: "wanted" | "none"`, `waits` (vad WAITING ser ut som, för `/solar help` och granskning), `context: "resident" | "engine"` (temat visar kontextfyllnaden självt genom att läsa markeringen `iPalette[16]` som F3b:s fisklina gör, eller motorn ritar sin reservkorg i hörnet – `basket.ts`, kvar efter F3b), `events[]` (`kind`, `word`, `slotMinutes`, `chance`, `minutes`, `layer: "front" | "behind"`, `when`, `salt`), `previews[]` (`kind`, `word`; schemaläggs aldrig, `/solar event <word>` bakar `THEME_FORCE` = 1-baserad position), `aliases` (gamla ord). `when`-vokabulär (kompileras av `whenOf` till ett predikat över `EventContext`): `sun: day|night|low|any`, `clearAtMost`, `windBelow`, `windAtLeast`, `dry`, `months`, `elevationAbove/Below` – täcker varje spec i `EVENTS` idag. Validering: unika kinds (ej motorns), unika ord över motor + tema, `minutes < slotMinutes`, livlighetsbudget `Σ chance × minutes / slotMinutes ≤ 0.08` (delfinerna 0.033 + 0.0014); `salt` default `1000 + position`; fyr pinnar 7 och 8 så delfinerna behåller dagens schema, motorns specar får explicita salt 0..9 = dagens index.

**GLSL-sidan:** ny motordel `PROTOTYPES` direkt efter `COMMON`; temats text läggs efter `MAIN` så temat kan anropa allt i motorn och definiera egna hjälpare:

```glsl
vec3 scenery(vec3 sky, vec2 p, float u, float k);      // marken, rekvisitan och ljuset som visar att Claude väntar (WAITING); efter solen och bakre händelser, före resident och moln
vec3 resident(vec3 sky, vec2 p, float u, float k);     // karaktärerna och deras saker
vec3 themeEvent(vec3 sky, vec2 p, float u, float k, int kind, float seed, float t, bool isBehind);  // kind 0-baserat i manifestordning
float themeWindow(vec2 p, float u);                    // hur mycket av utomhuslagren (moln, främre händelser, nederbörd) som syns vid p: 1.0 ute, 0.0 bakom vägg, däremellan genom en ruta
```

`MAIN` (`main.ts:249-255`): `events(behind)` → ISS → `scenery` → `resident` → `window = themeWindow(p,u)`; om `> 0`: moln → `events(front)` → väder i `outdoor`, `sky = window >= 1 ? outdoor : mix(sky, outdoor, window)` → `basket`. För fyr returnerar `themeWindow` 1.0, kompilatorn viker grenen, pixlarna är dagens. `events()` (`events.ts:482-508`) får först i loopen `if (kind >= 100) { sky = themeEvent(…, kind - 100, …); continue; }` och tappar rad 507; fyrs `themeEvent` mappar 0/1 till `dolphin(…, kind == 1)`. Index: motorns kinds 1..20, temats `100 + position`; `THEME_FORCE` ersätter `KEEPER_FORCE`. Shadertexten ändras; pixlarna inte.

**Signaler ett tema får läsa** (bakade konstanter; den stängda listan i `skyShader` 366-417 blir den dokumenterade signalmängden): befintliga (`ELEVATION PROGRESS IS_DAY MOON_* CLOUDINESS COVER WIND PRECIPITATION AURORA* DEMO_* ISS_* STAGE_PX Y_UP SHOOTING_RATE FIREWORKS FLAG_DAY BASKET EVENT_*`), omdöpta **`WAITING`/`WAITING_URGENT`** (var `BEACON*`), **`CLAWD_ASLEEP`** (var `KEEPER_ASLEEP`), **`THEME_FORCE`**; nya (uppgift 6, behövs av testtemana): `LOCAL_HOUR` (0..24 med minuter), `WEEKDAY`, `MONTH`, `DAY`, `TEMPERATURE`, `CLAWD_ACTIVITY` (0 earlyBird .. 5 sleep). Ingen tema-TS, alltså ingen `extraConstants`-krok: ett tema som behöver en ny signal ber motorn om den – precis den återkoppling experimentet ska ge.

**Hjälpare ett tema får anropa** (COMMON efter uppgift 1; exakta signaturer citeras i guiden och kontrolleras av ett test): `pitch(u)`, `SCREEN_KEY/PINK/YELLOW/BLUE/ORANGE`, `night()`, `keyInk(k)`, `keyShift(u)`, `keyPlate(sky, sdShifted, width, alpha, k)`, `nightInk(c,k)`, `smin`, `box`, `flame`, `noise2`, `fbm(x, seed, octaves ≤ 4)`, `steam(p, foot, h, w, speed, seed)`, `lamp(sky, p, at, radius, ink, strength)`, `spriteAt(uint rows[8], ivec2 size, ivec2 c, bool flip)` (4 bitar per cell), `sprite(sky, p, origin, cell, rows, size, flip, vec3 palette[8], k)` (tryckt, nyckelplåt en cell av). Regler motorn upprätthåller: varje temafunktion börjar med sitt lådtest; `scenery` måste rita något som beror på `WAITING` (lint: token finns; granskning: syns); tema-GLSL ≤ 40 KB, hela shadern ≤ 128 KB (idag 86.6 KB).

**TS-sidan:** `Theme = { manifest; glsl }`; `skyShader(params, theme)` = header + motorkonstanter + `THEME_FORCE` + `[COMMON, PROTOTYPES, SKY, CLOUDS, EVENTS, BASKET, MAIN]` + `theme.glsl` (efter F3b är `BASKET` reservkorgen, anropad i `MAIN` bara när manifestet säger `context: "engine"`; fyrs fisklina och grill följer med `keeper()` in i `resident()`); `shaderParams(input, { theme })`; `eventsAt(ms, ctx, forced, specs)` med `[...ENGINE_EVENTS, ...specsOf(theme)]`; `wordsOf(theme)`, `kindOf(word, theme)` (alias som `OLD_EVENT_WORDS`); `EventKind = EngineEventKind | (string & {})`. `register.tsx` håller `let theme = THEMES[BASE_THEME]`; vägran "bara i Ghostty" (`register.tsx:698-701`) generaliseras till varje temas preview-kinds. **Bandet oförändrat** (visar temats händelseord; en senare runda kan låta manifestet namnge en hörnsprite när `clawd.ts`:s `print()`/`HATS`/`SCENES` öppnats). "Claude väntar" förblir motorlogik: `hooks/beacon.ts` → `hooks/waiting.ts` (`waitingAt`, `WAITING_*_MS`, `animationOf`), `ShaderParams.waiting`, `SkyExtras.waiting`. **`STAGE_PT`, `STAGED`-strängen (`ghostty.ts:325`) och `OUR_LINES` ändras inte** (ett nytt namn skulle lägga till marginalen igen i varje befintlig config); `stagePx` bakas alltid, `manifest.stage: "none"` är information.

### Paritetsselen (uppgift 0, före varje motorändring)

`tools/preview/parity.sh record|check [--size small|large]` renderar matrisen i `tools/preview/parity.list` till `.preview/parity/<sha>/<namn>.png` (baslinjens sha i `.preview/parity/BASELINE`); `check` jämför med `tools/preview/parity.mjs`: `cmp` först, vid avvikelse en liten PNG-avkodare (zlib i Node, filter 0–4, 8-bit RGB/RGBA) som rapporterar max kanaldiff, antal pixlar och skriver en diff-PNG med `pngOf` ur `hooks/paint.ts`. Godkänt = identiskt; toleransläge (`--tolerance 2:0.01%`) bara för scener som bevisat är icke-deterministiska, var och en listad. Determinismen verifieras först (en scen två gånger). Matrisen (~35 renderingar vid `1512×982 --stage 240`, 8 märkta också vid `3024×1964 --stage 480`): fyrvaktarens dagloop (`--time 20/45/60/75`), `dolphin`, `pinkDolphin`, `surf`, `abduction` (stråle 88, nedsläpp 126), `--beacon asking` skymning + `--urgent` natt + `done`, natt med stjärnor/`--aurora`/`--iss`/måne/hängmatta 04:00, regn, snö, storm + drake, kontexten `--fish 6`/`--fish 9,grill`/`--fish 0,embers` (flaggorna från F3b; `--basket` är alias), `comet,constellation`, `rainbow --rained`, `balloon,plane,birds`, jul, flaggdag, nyår, `milestone`, `--demo`, `--stage 0`, `--y-up`, `--diff --p3`, och band-raden ur `gif.sh` (med `--sky-context`). Varje uppgift slutar med `claude plugin test .`, `tsc -p .`, `parity.sh check` allt identiskt. Baslinje: gren `motor-tema` från `main` efter steg 0.

### Uppgifter (sömmarna i ordning; bygget grönt efter varje)

0. **Bevisa och spela in:** paritetsselen + determinism; bevisa att `import { THEMES } from '../themes'` laddar under `claude plugin test .` och `tsc` med nytt `include` (reserv `hooks/themes/`); bevisa att prototyper och storleksatta arrayparametrar (`uint rows[8]`) kompilerar i WebGL-previewn (och i Ghostty vid första sprite-temat). Commit: "A parity harness that renders the sky before and after, and compares the pixels".
1. **Hjälpare i COMMON:** lägg till hjälparna; flytta `smin`, `box`, `flame` ordagrant; ersätt `max(3.0, u*0.24)` → `pitch(u)` (13; `rainbow()`:s variant lämnas), `nightness(sceneNow().elevation)` → `night()` (8), `lift(INK_INDIGO,k)` → `keyInk(k)` (21), nyckelplåten → `keyPlate(sky, x, w, a, k)` med varje ställes egna `w`, `a` och skift. Pixelidentiskt (samma operationer i samma ordning).
2. **Prototyper och ritordningen:** `PROTOTYPES`; `main.ts` som ovan; `beacon()` → `scenery()`, `keeper()` → `resident()`, `themeWindow` = 1.0 i sea.ts; `events()`-dispatch `kind >= 100`; delfinerna till 100/101.
3. **Temat `fyr`:** `themes/theme.ts`, `themes/index.ts`, `themes/fyr/*`; `git mv`; `skyShader(params, theme)`; `shaderParams` tema-medveten; `events.ts`: delfinerna ut ur `EVENTS`, `salt` på varje spec, `specsOf/wordsOf/kindOf`, `ABDUCTION/SURF` bort, `OLD_EVENT_WORDS` tappar `delfin`/`rosa delfin` (alias nu); `KEEPER_FORCE` → `THEME_FORCE` (`surf.ts:12,23`, `routine.ts:10`, `ufo.ts:24,50`); `register.tsx` skickar `theme` till `eventsNow`, `viewAt`, `shaderAt`, `/solar events`, `/solar event`; `tools/preview/shader.mjs --theme <namn|dir>` (default fyr); tester `sky.test.tsx:433-454`, `session.test.tsx:52-70`.
4. **Väntljuset med eget namn:** `BEACON*` → `WAITING*` (`shader.ts:394-395`, fyrs delar, `main.ts`-kommentarer), `KEEPER_ASLEEP` → `CLAWD_ASLEEP` (`shader.ts:406`, `routine.ts:75`, `surf.ts:24`), `beacon.ts` → `waiting.ts`, `ShaderParams.beacon`/`SkyExtras.beacon` → `waiting`, token `'beacon'` vid `register.tsx:284`, formuleringar `register.tsx:136, 356, 420-424`, `shader.ts:43-45`; tester `sky.test.tsx:251-258, 286-307`, `session.test.tsx:586-647`, `band.test.tsx:50`.
5. **Sista kanterna:** `hooks/hours.ts` får `activityAt/On` (så `shader.ts` slutar importera `clawd`), `isPrintable` → `paint.ts`, `field/number` → `hooks/json.ts`, `tabMark/markOf/UNMARK_TAB` → `hooks/mark.ts`, radera `hooks/print.ts`.
6. **Signaler:** `LOCAL_HOUR`, `WEEKDAY`, `MONTH`, `DAY`, `TEMPERATURE`, `CLAWD_ACTIVITY` bakade; `SIGNALS` exporterad som dokumenterad lista (guidens test läser den).
7. **Temaverktyg:** `tools/preview/sheet.sh <tema>` (matrisen för ett tema i liten storlek, kontaktark via ffmpeg `tile`), `tools/theme/lint.mjs`, `tools/theme/pack.mjs`, `--bench` med `--theme none` (motorn ensam, prototyperna stubbade) så arket skriver `temakostnad = frame(tema) − frame(none)` och kvoten mot fyr; ljushetskontroll i `parity.mjs`.
8. **Docs:** README "Developing" (motor och teman), `themes/fyr/README.md`. Planfil `docs/superpowers/plans/2026-10-2x-tema-motor.md` i projektets stil.

### Workflow `motor-tema` (8 agenter; inga worktrees – en följd av gröna commits, parallella skribenter kolliderar i `main.ts`/`shader.ts`)

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| Bevisa | 2 parallellt | sonnet/medium: paritetsselen + determinism; opus/medium: import/tsconfig/prototyp-spikar | uppgift 0 |
| Dela | 1 (en skribent) | opus / high | uppgift 1–3, paritet efter varje, en commit var |
| Döp om | samma träd | opus / medium | uppgift 4–6 |
| Verifiera | 3 parallellt | opus/high adversariell: diffa `themes/fyr/glsl` mot originaldelarna token för token bortsett från namnbyten – omflyttad aritmetik är ett fynd även om pariteten gick igenom; opus/high: TS-kanter och tester, ingen motorfil importerar ett tema, grep "lighthouse/keeper/beacon" bara i fyr och användartext; sonnet/low: uppgift 7 + stora paritetsmängden + `--y-up` | |
| Döm | 1 | fable / high | läser arken mot baslinje-PNG:erna, beslutar klart eller gör-om-lista |

Öppna frågor som avgörs i uppgift 0: Ghostty-loggens synlighet (`<private>`?) och latens; om laddaren tar imports från toppnivå-`themes/`; SwiftShaders bytedeterminism; storleksatta arrayparametrar i GLSL ES 3.00 och Ghosttys 4.30.

## F6. Installation som Claude sköter

Körs efter F5; designad mot dagens kod men oberoende av filnamn (inkluderingslogiken i `hooks/ghostty.ts`, `/solar`-kommandot i `hooks/register.tsx`). Målbild: på en färsk Mac skriver man *"Install the Claude Code plugin from github.com/Fiddy134/solar-clawd and set it up on this Mac. Follow its README."* och Claude gör resten.

### Verifierat på den här datorn (2.1.310, Ghostty 1.3.1)

`claude plugin install <plugin> --marketplace <owner/repo>` lägger till marketplace först, `-s user` är default, `--json` ger en maskinrad; `claude plugin list [--json]`, `uninstall`, `update` ("restart required"), `marketplace add|list|remove|update`. Ghostty exporterar `TERM_PROGRAM=ghostty`, `TERM_PROGRAM_VERSION=1.3.1`, `GHOSTTY_BIN_DIR` (doktorn läser versionen ur miljön; reserv `defaults read /Applications/Ghostty.app/Contents/Info.plist CFBundleShortVersionString`). `brew install --cask ghostty` ger 1.3.1. Motor-API: `$.session.version()`, `$.ui.ask(question, options)` (avvisas om stängd och under `-p`), `CommandRunResult.context` (dold text modellen läser efter ett kommandos utskrift – så `/solar doctor` når Claude), `CommandRunResult.exitCode` (plugin-kommandon körs under `claude -p "/name"`), `SessionStartInput.isInteractive`. **Overifierat, verifieras först:** (V1) om `claude -p "/solar …"` fungerar startat från ett Claude-Bash-verktyg (nästlad miljö); (V2) om `$.ui.ask` får anropas i `session.start` före första renderingen eller måste vänta till första `turn.complete`; (V3) om shell-installationen frågar j/n för marketplace när stdin är en TTY, och exakt utskrift (fångas på Mac minin); (V4) om pluginens `session.start` körs under `-p` alls.

### Designen

- **(a) README:n en färsk Claude läser** (`README.md:28-56` skrivs om som procedur: kommando, väntat resultat, reserv, i kodblock – tabeller hämtas illa som text; `gh repo view` och WebFetch av raw-README:n ger den): 0 förutsättningar (Homebrew, Ghostty ≥ 1.3 via brew, Claude Code ≥ 2.1.275 via `claude update`; kör Claude *inuti Ghostty*); 1 `claude plugin install solar-clawd --marketplace Fiddy134/solar-clawd` (exit 0, raden som namnger solar-clawd; j om marketplace-frågan; reserv `marketplace add` + `install solar-clawd@solar-clawd`); 2 verifiera `claude plugin list --json` innehåller `"solar-clawd"`; 3 ladda: `/reload-plugins` eller ny `claude` i ett Ghostty-fönster; 4 Ghostty: första sessionen i Ghostty frågar *"Show the sky behind Ghostty?"* – Ja skriver inkluderingen och 240-pt-marginalen och laddar om (`/solar ghostty` gör samma för hand; nya fönster får marginalen); 5 `/solar doctor` – varje rad `ok`; klistra in den när du ber om hjälp; 6 avinstallera: `/solar uninstall` + `claude plugin uninstall solar-clawd`. Plus rutan **"For Claude installing this"**: gör steg 0–2 med Bash; lämna steg 3–4 till personen (omstart + Ja); be dem köra `/solar doctor` och klistra in; redigera aldrig Ghosttys config för hand (modden äger raden `config-file = ?<runtime>/solar-clawd.ghostty` under `# Solar Clawd: …`). Linux-avsnittet (58-72) kvar med samma verifieringsrader.
- **(b) Ghostty-steget utan att någon skriver `/solar ghostty`** – **O1 (rekommenderad): modden erbjuder det vid första Ghostty-sessionen** – i `session.start` efter Ghostty-blocket (`register.tsx:316-361`), när `ghostty !== null && !ghostty.isIncluded && !(await hasOurInclude($, ghostty)) && e.isInteractive && (await $.store.get('ghosttyOffer')) !== 'never'`: `void $.ui.ask("Show Solar Clawd's sky behind Ghostty? It adds one include line and a 240-point right margin to Ghostty's config.", ['Yes', 'Not now', 'Never'])` → Ja kör samma kod som `/solar ghostty` (en toppnivå-`includeSky($, ghostty, shaderAt, skyState)` faktoriserad ur 674-686), Never sparar flaggan, Not now frågar igen (max tre gånger). Fire-and-forget; visar V2 att frågan vägras vid start: en `ghosttyOfferDue`-flagga och frågan vid första `turn.complete`. Ersätter toasten på rad 360. Testerna behöver `on('ui.ask', …)` i `hooks/test-kit.tsx`:s värld. O2 (`tools/install/ghostty.sh` som shell-spegel av `includeInGhostty`) **förkastas** (driver isär). O3 (`claude -p "/solar ghostty"`) dokumenteras som skriptväg bara om V1/V4 går på Mac minin.
- **(c) `/solar doctor`** (alias `status`): returnerar `{ text, context: [text] }`, en rad per kontroll med `ok`/`--`/`!!`: Claude Code-version mot 2.1.275; plugin-rot (`$.plugin.root`: cache eller `CLAUDE_CODE_PLUGIN_DIRS`) och version ur `plugin.json`; terminal (`TERM_PROGRAM`, version, `GHOSTTY_BIN_DIR`; iTerm2 → tapetläge; Linux → `uname`, `systemctl --user is-active app-com.mitchellh.ghostty.service`, signalkunskap); varje `ghostty.configs`: finns / inkluderar oss / har `STAGED` / `window-padding-x`-värde; inkluderingsfilens sökväg, innehåll (shaderväg + animationsläge) och mtime; shaderfilen: finns, storlek, mtime, första raden är headern; fliken: senaste markeringen (`ghostty.written.mark` avkodad: fisk/tillstånd), `stagePx`, hidden-fil; tillstånd: borta, batteri, väntläge, lively nu, demo/pinnad, `written.isReloadOwed`; plats/väder (`placeText(where)`, nytt `fetchedAt` i `Where`), Kp, ISS-element; senaste fel (nytt `lastError` fångat vid `.catch(() => undefined)`-ställena 365-379, 395-407); kontextfyllnad från `$.session.usage()` och fisken den ger; en domrad ("ok: the sky should show in this tab" / "!! Ghostty does not include the sky: answer Yes at start or run /solar ghostty").
- **(d) `/solar uninstall`:** `removeFromGhostty($, ghostty)` bredvid `includeInGhostty` tar bort våra tre rader ur varje config (`STAGED`, inkluderingen som matchar `OUR_LINES[1]`, marginalen bara om den matchar `OUR_LINES[2]` exakt – en personredigerad marginal står kvar), tömmer inkluderingsfilen, laddar om, tar bort runtime-mappens filer, rensar store-nycklar, avmarkerar fliken, svarar "To remove the plugin: `claude plugin uninstall solar-clawd`". Tester speglar config-testerna `session.test.tsx:410-490`. README får "Uninstall".
- **(e) Mac mini-protokollet [Vincent, för hand]:** förberedelse: färsk macOS-användare (renast) eller `mv ~/.claude/plugins ~/.claude/plugins.bak`, rensa `Solar Clawd`-rader ur Ghosttys config(ar), `rm -rf "~/Library/Application Support/solar-clawd"`, ingen `CLAUDE_CODE_PLUGIN_DIRS`, `claude update`. Öppna Ghostty, kör `claude`, skriv exakt målmeningen ovan; svara på frågorna; starta om `claude` i Ghostty när det sägs och svara Ja på himmelsfrågan; `/solar doctor`. **Lyckat:** himlen bakom den fliken (inte i en vanlig skalflik), fyren i högermarginalen, Clawds band ovanför prompten, varje doktorrad `ok`, ett nytt Ghostty-fönster med marginalen; skärmbild dag och med `/solar event dolphin`. **Rapportera:** kommandona Claude körde, varje tvekan/fråga, doktortexten, skärmbilderna, `cat` av Ghostty-configen. Loop: vi fixar README/doktor → Vincent återställer (`/solar uninstall`, `claude plugin uninstall`, plugins.bak-dansen) → nytt försök; räkna med 2–3 rundor; kör avinstallationsvägen en gång på slutet. (SSH till minin finns som reserv för felsökning om Vincent vill.) Linux: dokumenterat, inte testat.

### Workflow `installation` (5 agenter)

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| Verifiera + designa | 1 | fable / high | V1–V4 (från ett vanligt Ghostty-skal, inifrån ett Claude-Bash-verktyg, och en slit-och-släng-dev-plugin som anropar `$.ui.ask` i `session.start`), sedan designdokumentet: README-proceduren, doktorns radlista, frågeflödet, uninstall-semantiken |
| Implementera | 2 parallellt | opus/high: `register.tsx`/`ghostty.ts` (`includeSky`, erbjudandet med store-flagga, `/solar doctor`, `/solar uninstall`, `lastError`/`fetchedAt`, tester + test-kit `ui.ask`-mock); opus/medium: README ("Install", "For Claude", "Uninstall", Linux-kontroll) + `docs/install-test.md` (Mac mini-protokollet, engelska) | |
| Färsk Claude | 1 | sonnet / medium | spelar en färsk Claude som bara får grenens README, torrkörning (`claude plugin …` ersatt av `echo`), rapporterar exakt kommandoföljd, vad den väntar sig se, varje tvetydighet; README-agenten itererar en gång |
| Granska | 1 | opus / high | code-review av implementationen; sedan kör Vincent Mac mini-protokollet |

## F7. Två kontrasterande teman i ett skott

### THEME-GUIDE – den generella prompten

`docs/THEME-GUIDE.md` (engelska som kod och planer; länkad från README och ett en-styckes `themes/README.md`). Den **är** hela prompten: en färsk agent får filen och Vincents stycke, inget annat. Innehåll: (1) vad ett tema är och inte är (bandet, kompositen, vädret och himlen är motorns), de två filerna, löftet "skrivet i ett svep ur detta dokument"; (2) världen man ritar i: `p` i pixlar y nedåt, `u`, horisonten `ARC.w*H` (0.62), `STAGE_PX`, ritordningen numrerad med de fyra prototyperna inplacerade; (3) kontraktet: prototyperna med exakta signaturer och ett exempel var, manifestschemat med fyrs ifyllda exempel och `when`-vokabulären, reserverade namn (genererad lista), lint-reglerna, storleksgränserna, regeln att `scenery` måste visa `WAITING`; (4) motorns signaler (namn, typ, intervall, mening, när de ändras – "scenen skrivs om ungefär varannan minut, så en konstant kan hoppa"); (5) primitiverna med signatur och en mening, grupperade (tal och brus, former, tryck, spriter, tid, markören); (6) husstilen (bläcken, vad risograf betyder här: få bläck, raster med `screen` i husvinklarna, nyckelplåt ur register, cremepapper, inga platta färger utanför bläcken, inga mjuka gradienter, inget rent svart, natt som indigoplåt inte som mörker, dis för det avlägsna); (7) arbetsexempel med utdrag och lärdom: ballongen, planet, delfinen, fyrvaktaren (grid-sprite, poser, lägesprioritet `routine.ts:72-80`, dörren), UFO:t (slot-schemaläggning, 31.5 s-tidslinje), surfen; (8) tid: `iTime` utan start och över omladdningar, slot-idiomet med koden ur `shootingStarAge`/`abductionAt`, previews via `THEME_FORCE`, varje ögonblick en stillbild, inget ett tema gör räknas som lively; (9) ljus: `k` och `LUMINANCE`, `tone` mot `lift`, `night()`/`nightInk`, lampor, `themeWindow` för interiörer, ljushetskontrollen; (10) kostnad: lådtest som första sats, loop-tak, hash per cell – aldrig loop över instanser (fönster, plattor, folkmassor), bench-kvoten; (11) väntljuset: vad asking/done/urgent betyder för personen, bra och dåliga exempel; (12) temahändelser; (13) förhandsvisning och fallgropar (`run.sh shader --theme <dir>`, `sheet.sh`, `lint.mjs`, GLSL ES-listan: ingen implicit int/float, `%` på negativa, `vec3[3](...)`, storleksatta arrayparametrar, ingen rekursion, prototyper före användning, `uint`-litteraler med `u`); (14) acceptanschecklistan (= domarens rubrik); (15) mall: manifest + `theme.glsl` med prototyperna stubbade, lintar rent och kompilerar som den är; (16) delning (community-repot och vad CI kontrollerar). **Hålls i synk av `hooks/guide.test.tsx`:** fenced block taggade `glsl-signature` måste finnas ordagrant i `COMMON`/`PROTOTYPES`, varje signalnamn i tabellen emitteras av `skyShader`, manifestexemplet validerar, reserverade-namn-blocket = den genererade listan, mallen lintar rent; CI renderar mallen genom `sheet.sh`.

### De två temana

- **Michelin-köket** (Vincents): behöver `themeWindow` och interiörljusregeln (ett kök lyst av egna lampor under en riktig himmel i fönstret och fläktens utlopp utanför), `lamp()` för passets värmelampor, `flame()` för brännarna, `steam()`/`fbm` för kastruller, diskmaskin, värmedaller, `sprite()` för en andra karaktär (kocken i vitt bredvid en souschef-Clawd, eller kock-Clawd och en commis), `LOCAL_HOUR` (lunch- och middagsservice, köket mörkt efter stängning, kocken sover med `CLAWD_ASLEEP`), `CLAWD_ACTIVITY` (kaffet = espresso); väntljuset som passets värmelampa (orange) och serviceklockan (asking svänger den), den färdiga tallriken under vit lampa (done); händelser: flambering (front), en sufflé som reser sig, leverans av en fisklåda; preview flamberingen. **Text** (bongräls med läsbara beställningar, menytavla) skjuts medvetet upp: bongar är pappersformer; griper författaren efter text är det en dokumenterad motorlucka för runda 2 (en packad 3×5-glyftabell ≈ 2 KB konstanter).
- **Ett tak över en stad** (mitt val som kontrast och kontroll): stressar det köket inte gör – skala och budget (en skyline med hundratals fönster måste hashas per cell, inte loopas: lärdomen varje community-tema behöver), `stage: "none"` (skylinen spänner över bredden; kontraktets väg utan remsa motioneras), nattdominerat innehåll under en riktig dag/natt-himmel (fönster tänds med `LOCAL_HOUR` och `night()`, solen går ner bakom husen eftersom `scenery` ritar över solen – testar ritordningsförklaringen), motorns väder inne i temat (`PRECIPITATION` för blöta gator, `WIND` för tvättlinor), ett annat väntljusidiom (en takneon eller flyghinderljus: orange blink för asking, stadigt vitt för done), en tak-Clawd med duvor (motorns `birds` finns), teleskop på natten, tvätt på dagen; händelser: helikopter, luftskepp, ett tåg över en viadukt. Behöver **inget nytt** av motorn utöver F5:s signaler – kontrollen: räcker guiden ensam någonstans ska den göra det här. (Japansk vår var tvåa men för nära fyren.)

### Experimentprotokollet

1. Färsk agent (`fable`, effort max, `isolation: 'worktree'`), prompt = THEME-GUIDE.md + Vincents stycke (Vincent skriver köksstycket; jag utkastar takstycket för godkännande) + "skriv `themes/<namn>/manifest.json` och `theme.glsl`; kör lint och ark; rätta vad de rapporterar; läs **inte** `hooks/` eller `themes/fyr/`" (variant A). Variant B får läsa `themes/fyr/`. A först; är B markant bättre i runda 2 flyttas mer av fyr in i guidens exempel.
2. Agenten returnerar mappen och sitt ark; selen renderar matrisen (`sheet.sh`, paritetsscenerna minus fyrspecifika previews, plus temats egna).
3. Domare (`fable`, effort high, läser PNG:erna, svarar i schema): kompilerar (hårt), lint rent (hårt), bench-kvot ≤ 1.25 × fyr (hårt), ljushet inom tak (hårt), `WAITING` läsbart i asking/done/urgent (hårt), identitet (Clawd igenkännlig; temat läses som sitt stycke på fem sekunder vid 1512×982), stil, stillbild (tio slumpade `--time`), dag/natt/regn koherent, ingen motoromdefinition, storlek.
4. Vid misslyckande: klassificera och **redigera guiden, inte temat**: kompileringsfel → fallgrop saknas i §13; prototyp-/manifestmiss → §3 otydlig eller lint-meddelandet dåligt (rätta det också); stilmiss → §6/§7; stillbilds-/tillståndshopp → §8 behöver kod; budget → §10:s hash-idiom; identitet/väntljus → §11/§14; författaren återuppfann en primitiv → motorn får den och §5 listar den; saknad signal → F5 uppgift 6 växer. Varje fel och guideändring i `docs/superpowers/notes/one-shot-round-N.md`.
5. Kör om från noll med ny guide och färsk agent. **Klart** när båda temana går igenom i ett svep två gånger i rad; de godkända blir inbyggda teman efter Vincents granskning av utseendet (registret växer – Vincents beslut).

### Workflow `teman` (9 agenter; körs två gånger eller tills två raka godkännanden)

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| Guide | 1 | fable / max | skriver `docs/THEME-GUIDE.md` och `hooks/guide.test.tsx` ur kontraktet och fyr |
| Refutera | 2 parallellt → 1 | opus/high: varje påstående mot koden (signaturer, namn, kommandon, sökvägar); opus/high: spelar förstagångsförfattare och listar tvetydigheter → fable/medium rättar guiden | |
| Författa | pipeline över de två styckena | fable/max i worktree (bara guide + stycke, kör lint och ark själv) → fable/high domare med checklist-schema | |
| Lär | 1 | fable / high | ur båda domarna: guideändringar, motorluckor, en rundanteckning; rör aldrig temana |

Runda 2 kör Författa och Lär igen med reviderad guide och färska författare (ny körning, inte resume).

## F8. Community-teman

### Växling

`/solar theme` listar inbyggda teman och de under användarmappen (`~/Library/Application Support/solar-clawd/themes/<namn>/` på macOS, `$XDG_CONFIG_HOME/solar-clawd/themes/<namn>/` på Linux), markerar det aktiva och om temat använder scenremsan. `/solar theme <namn>` validerar (`themeOf`, lint), skriver shadern, laddar om, toastar; misslyckad validering behåller nuvarande tema och skriver de första felen. Persistens: `$.store.set('theme', name)`. Eftersom shadern är **en fil för alla sessioner** (`ghostty.ts:174-178`) måste två sessioner vara överens: valet skrivs till `${folder}/theme` bredvid `hidden`, och `writeGhosttySky` läser det varje tick och byter tema när namnet ändras (inbyggt: direkt; användarmapp: två läsningar), som den redan gör för `hidden`. Ett tema som lintar rent men faller i Ghostty: efter en växling körs kompileringsoraklet en gång; vid ett fel som namnger vår shaderväg skrivs föregående shader tillbaka, Ghostty laddas om och toasten bär Ghosttys ord. Scenmarginalen rörs aldrig per tema; `/solar theme` säger "this theme stands on the stage strip" eller "needs no strip".

### Kompileringskontroll, i viabilitetsordning

(1) **Ghostty-loggoraklet** på macOS (`/usr/bin/log show --last 20s --style compact --predicate 'subsystem == "com.mitchellh.ghostty" AND messageType == error'`, grep `spirv error path=<shader>` eller `error loading custom shaders`); 1–3 s, körs bara efter växling/installation; Linux under systemd `journalctl --user -u app-com.mitchellh.ghostty.service -S -20s`; annars inget orakel, och modden säger det. (2) `glslangValidator` om på PATH (`brew install glslang`): kompilera ett omslag (`#version 430` + Ghosttys uniform-preamble + shadern) med `-S frag --target-env opengl`. (3) Pluginens eget preview-verktyg om `node` och en Chrome finns (pluginmappen levererar `tools/`). `/solar theme check <namn|dir>` kör lint och de som finns och skriver en rapport. **Uppgift 0 bevisar (1)** med en scratch-config som pekar `custom-shader` på en trasig fil i ett nytt Ghostty-fönster, och bekräftar att texten inte är `<private>`.

### Distribution (designdokument den här rundan, implementation senare)

Ett `solar-clawd-themes`-repo på GitHub, en mapp per tema (`manifest.json`, `theme.glsl`, `preview.png`, `README.md`), PR granskade av Vincent mot checklistan; CI på varje PR: lint, headless WebGL-kompilering + ark, `glslangValidator` på GLSL 4.30, bench-kvot mot fyr, ljushet, storlek; vid merge en tagg per temaversion och `index.json` (`{ name, title, author, version, sha256: { manifest, glsl }, url, preview, stage, requiresEngine }`). Modden: `/solar theme install <namn|url>` hämtar `index.json` (`$.http.fetch`), laddar ner pinnade filer, verifierar sha256 (`crypto.subtle`), skriver under användarmappen, validerar, växlar; `/solar theme update` kollar versioner; `requiresEngine` skyddar mot teman som behöver nyare signaler. Säkerhet i sammandrag: bara GLSL, lintad delmängd, ingen TS, inga texturläsningar, verifierade hashar, begränsad kostnad, återställning vid kompileringsfel – ett tema kan som värst se dåligt ut. Uppmuntran: THEME-GUIDE:n är själva inbjudan; de två F7-temana är de första exemplen i repot.

### Första implementationen (minimal)

Användarmappen, laddaren med validering, `/solar theme` lista + växla med `$.store` och den delade `theme`-filen, macOS-loggoraklet med återställning, `/solar theme check`, tester i `ghosttyWorld` (filkartan och `answers` för `/usr/bin/log`), README-avsnittet "Themes", och designdokumentet för resten (`docs/superpowers/specs/2026-10-2x-teman-design.md`, svenska).

### Uppgifter

0. Bevisa oraklet (trasig shader i ett scratch-Ghostty-fönster – **fråga Vincent innan fönster öppnas**); `$.fs.list` på saknad mapp avvisar (catch); `+validate-config` med trasig `custom-shader` (väntat: ingen klagan).
1. Användarmappen och laddaren: `hooks/themes.ts` (`themesDir`, `loadTheme($, dir)`, `listThemes($)`), `themes/theme.ts` (validering), tester `hooks/theme.test.tsx` med `ghosttyWorld.files`. Commit: "Themes of the person's own, read from their folder and checked before they are shown".
2. `/solar theme`: `register.tsx` (under-ordet, `argumentHint` rad 295, `$.store`, den delade `theme`-filen), `ghostty.ts` (`writeGhosttySky` läser temafilen). Commit: "/solar theme lists the themes and switches, for every session at once".
3. Oraklet och återställningen: `hooks/themes.ts` (`ghosttySaysBroken($, shaderPath)`), `register.tsx`, tester med `answers.set('/usr/bin/log', …)`. Commit: "A theme Ghostty cannot compile is taken back, and Ghostty's own words shown".
4. Designdokumentet (distribution, CI, `index.json`, install/update, säkerhet).
5. README "Themes".

### Workflow `community` (9 agenter)

| Fas | Agenter | Modell/effort | Gör |
|---|---|---|---|
| Bevisa | 3 parallellt | sonnet/medium: loggorakel-experimentet (Vincents Ghostty; fråga först); opus/medium: laddare/validerar-design + fs-beteende i tester; sonnet/low: `+validate-config`-prob | uppgift 0 |
| Bygg | 2 i följd + 1 parallellt | opus/high: uppgift 1–2; opus/high: uppgift 3; sonnet/medium i worktree: uppgift 4–5 (bara docs) | |
| Attackera | 2 parallellt | opus/high: namn med `..`, 4 MiB-filer, ogiltig JSON, tema som omdefinierar motorfunktioner, tema som ignorerar `WAITING`, två sessioner som växlar samtidigt; opus/high: återställningsvägen: misslyckad omladdning, saknad föregående shader, Linux utan systemd | |
| Döm | 1 | fable / high | slutgranskning och mergebeslut |

---

## Ordningen, sammanfattad

| # | Gren | Workflow | Agenter | Blockeras av | Vincent behövs för |
|---|---|---|---|---|---|
| 0 | `ljus-himmel` | – | 0 | – | commit-beslutet (2 min) |
| 1 | `auto-mode` | `auto-mode` | 4 | – | repro + två rader i `~/.claude/settings.json` + verifiering (10 min) |
| 2 | `gpu-matning` | `gpu-matning` | 4 | 0 | lämna datorn 30–40 min; nivå B-rader; 60 Hz-raden |
| 3a | `lov-faglar` | `lov-faglar` | 8 | 0 | titta på slutarket |
| 3b | `fisk` | `fisk` | 6 | 0 | välja lina/ställ på mockup-arket; titta på slutarket + GIF |
| 4 | `gpu` | `gpu` | 8 | 2 | ljusbeslutet a/b/c; lämna datorn för mätning; ev. godkänna ny molnsekvens |
| 5 | `motor-tema` | `motor-tema` | 8 | 3b (båda rör `main.ts`) | – |
| 6 | `installation` | `installation` | 5 | 5 | Mac mini-protokollet, 2–3 rundor |
| 7 | `tema-kok`, `tema-tak` | `teman` | 9 × 2 rundor | 5 | köksstycket; godkänna takstycket; granska utseendet; besluta om de blir inbyggda |
| 8 | `community` | `community` | 9 | 5 (helst 7) | tillåta orakel-experimentet; godkänna designdokumentet |

## Verifiering av helheten

- Efter varje fråga: `claude plugin test .`, `npx -y -p typescript@5.6.3 tsc -p .`, paritets-/bevisarket för frågan, och Vincents egen session i Ghostty i auto mode (från F1 och framåt) där himlen syns, uppdateras och – från F3b – visar fisken.
- Efter F4: F2-protokollet körs igen på samma scener; målen i F4 står i `docs/gpu-measurements.md` med siffror.
- Efter F5: `parity.sh check` identiskt mot baslinjen från steg 0 **och** `tools/theme/pack.mjs fyr` lintar rent.
- Efter F6: Mac mini-protokollet lyckat en gång från en ren användare.
- Efter F7: båda temana godkända två gånger i rad av domaren utan guideändring däremellan.
- Vid varje leverans: versionsbump i `.claude-plugin/plugin.json`, push som `Fiddy134` efter godkännande, README-GIF:en omrenderad när fyren eller fisken ändrats.
