# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-26 kl 20:50, session `98234c7f` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen för åtta frågor:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. Ordning F1 auto mode → F2 GPU-mätning → F3 fisk + löv/fåglar → F4 GPU-optimering → F5 motor/tema → F6 installation → F7 två teman → F8 community.
- **F1 klar** (23d36f2 på `main`).
- **F2 pågår på grenen `gpu-matning`.** Uppgift 1–3 byggda. **Uppgift 4 nivå A är körd:** `plan` 17:18–17:53, 45 rader, ett varv, i `.preview/measure/out/2026-10-26T171840/` (`report.md` är omgjord med dagens report.mjs). Nivå B och 60 Hz är delvis körda (nedan). Kvar: tre omkörningar (valfria), uppgift 5 (`docs/gpu-measurements.md`), 6 (policyfrågan).
- Commits i den här sessionen: `28eedac` (rapporten jämför varje scen med tom shader i samma läge och visar inte GPU ms/s när macOS 27 ger 0), `b85f58c` (ett försök att lägga ihop loggar, trasigt, se nedan), `eed15bd` (varje powermetrics-sträcka får en egen `powermetrics-HHMMSS.log`, rapporten läser alla `powermetrics*.log` i mappen).
- **Steg 0:** den ljusa himlen ligger på grenen `ljus-himmel` (0bae2fb); `main` har samma modd-kod som 3cef45e. Den levande himlen (spegeln) är main-himlen: `runtime/sky.glsl` saknar `SHADE_DISC`.
- **Inget är pushat** sedan 3cef45e.

## Vad nivå A visade (M1 Pro, inbyggd skärm 120 Hz, färsk instans, n = 1)

Device % mättar nära 75–100 % för scenerna; **GPU mW är måttet som skiljer dem.** Golvet: passthrough 36,8 % / 797 mW, ingen shader 0,5 % / 11 mW.

1. **`false` fokuserad ritar ändå 118–120 fps** (idle, blink, spinner); ofokuserad 0 fps. Stillahimmel- och batteriregeln sparar alltså inget medan fönstret är framme. Det här är uppgift 6:s fall (policy i `animationOf` och/eller Ghostty-ärende med proben som repro).
2. **`true` ofokuserad är gratis:** 0 fps, ~1 %; scenerna +1,5 % och +150–350 mW över ofokuserat golv.
3. **`always` ofokuserad nästan fullt pris:** probe 113,6 fps; grenen dag-klar 11,2 W mot 13,0 W fokuserad, natt-tänd 13,8 mot 15,8 W.
4. **Täckt och minimerad slutar rita under `true`/`false`; under `always` ritar täckt 114 fps**, bara minimerad stoppar. Gömd flik ritar inte, men den vanliga fliken framför betalar shadern (43 %, ~820 mW).
5. Golvet som ovan.
6. **Grenen mot main:** dag-klar 4,1 → 12,9 W, natt-tänd 5,6 → 15,8 W; över golvet 3,3 → 12,1 W, alltså ~3,7×. F4:s hypotes att kanten är 35–50 % av grenens kostnad ser för låg ut. Händelsescenerna 95–100 % och 15–18 W. Omarkerad flik: grenen +10,1 % / +219 mW, main +4,7 % (F4-målet ≤ 5 p missas av grenen).

Förbehåll: ett varv, ingen ABBA (proben fokuserad stabil 36,2–36,9 % hela körningen). **Scenerna har ingen fps**; WindowServer-CPU faller till 9 % (löven) och 6 % (milstolpen) mot ~50 % annars, vilket tyder på tappade bildrutor. Idé till nästa körning: probens bildräknare i ett hörn av scenshadern. Skärmbilderna `probe-0NN-scene.png` visar att scenerna ritades.

## Nivå B och 60 Hz (delvis, `.preview/measure/out/2026-10-26-live/` och `…-rows/`)

| rad | device % | Ghostty CPU | mW |
|---|---|---|---|
| live 1 solar-12:30 fokus (19:23) | 68,7 | 18,8 | 5306 (läst innan loggen skrevs över) |
| live 2 fråga öppen ofokus (19:26, svepet) | 67,9 | 15,7 | – |
| live 3 ballong fokus | 78,1 | 20,6 | – |
| live 4 claude arbetar fokus | 79,9 | 15,0 | 6867 (enda loggen i mappen) |
| live 5 fråga öppen ofokus (20:33, svepet) | 74,3 | 14,8 | – |
| live 6 ballong fokus | 80,1 | 20,7 | – |
| live 7 solar-12:30 ofokus (20:37:46, precis vid svepets slut) | 49,2 ± 7,0 | 5,3 | – |
| live 8 ballong ofokus (efter svepet, `false`) | 50,5 ± 7,0 | 4,8 | – |
| rows 2 probe 60 Hz (`--force`) | 19,6 ± 5,0 vid 59,8 fps | 7,0 | – |
| rows 3 ljus-himmel:day-clear 60 Hz (`--force`) | 77,9 ± 3,7 | 10,1 | – |

- Svepet (`always`, 5 min efter att en session börjat vänta) gör ofokuserat lika dyrt som fokuserat i den levande fliken.
- Efter svepet ritar Ghostty nästan inget (CPU 5 %), men GPU:n stod ändå på ~50 %. **Rad 7, 8 och 60 Hz-raderna mättes med en upptagen maskin** (`coreduetd` 95 %, `PerfPowerService` 35–67 %, tre Claude-sessioner, ett Finder-fönster) och utan mW, så resten av GPU-lasten går inte att tillskriva.
- 60 Hz: grenens dag-klar kostar nästan lika mycket som vid 120 Hz (77,9 mot 80,9 %), vilket tyder på att grenen inte når 120 fps ens vid 120 Hz. Osäker tills omkörd.
- **mW saknas för live 2, 3, 5–8 och rows 2–3.** Orsak: powermetrics-loggen skapas av root; första versionen skrev över den per rad, `b85f58c` försökte lägga till i den rotägda filen, fick "permission denied" och tog ändå bort radens del. `eed15bd` rättar det (en fil per sträcka), men är inte provkört med sudo.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode eftersom klonen inte är laddad; spegeln `~/solar-clawd-live` laddas. Ändringar når den levande himlen bara medan Vincent armerat spegeln.
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Lägg inte `"$defaults"` eller trust-rader i `autoMode.environment`.
- **Mätningen körs inte av Claude.** Vincent startar `row`, `live` och `plan` från Terminal.app. Claude kör bara `--dry-run`, `decode`, `report` och `scenes.sh`.
- **`sudo -v &&` före varje `row`/`live`**: sudo glömmer efter 5 minuter, och `live` håller den inte vid liv mellan raderna. Varje svar från Claude startar ett nytt 5-minuterssvep (`always`), så ofokus-rader efter svepet kräver 6 minuters tystnad i alla sessioner.
- `tool.check`-hooken i `hooks/register.tsx` förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning.
- Commit-ämnen beskriver världen som den nu är, specar på svenska, planer och kod på engelska. Push bara efter Vincents ja, som `Fiddy134`; versionsbump när modden ändras (F2 ändrar inte modden).

## Lösa trådar

- Två ospårade säkerhetskopior i `.claude/` (`settings.local.json.bak-20261026-*`) kan tas bort av Vincent.
- De rotägda `powermetrics.log` i `2026-10-26-live/` och `2026-10-26-rows/` är kvar och läses som vanligt.
- `tools/dev/watch.sh` kräver `fswatch` (inte installerat); valfritt.

## Nästa steg

1. **Valfritt, när Vincent har tid och datorn är lugn** (stäng övriga Claude-sessioner och Finder-fönster; förkontrollen ska gå igenom utan `--force`): ställ skärmen på 60 Hz, `sudo -v && tools/measure/gpu.sh row probe true focused idle` och `… row ljus-himmel:day-clear true focused idle`, tillbaka till 120 Hz; sedan, sex minuter efter senaste Claude-svar, med Terminal.app framme, `sudo -v && tools/measure/gpu.sh live "solar-12:30 ofokus"`. Kontrollera efteråt att `powermetrics-*.log` finns och att `gpu.sh report <mapp>` visar mW.
2. **Uppgift 5:** `docs/gpu-measurements.md` ur `2026-10-26T171840/report.md` och tabellerna ovan (agent fable/high): kontext, tabeller, svaren på fråga 1–6 i prosa, 20/75-förklaringen (per-process GPU-tid finns inte på macOS 27, så det står på device % och mW för hela maskinen), vad det betyder för `animationOf`, baslinjen F4 mäts mot, och förbehållen. Commit i husstil. Granskning opus/medium: siffrorna mot `rows.tsv`.
3. **Uppgift 6** som en fråga till Vincent: `false` fokuserad ritar vid vsync, så vad ska stillahimmel- och batteriregeln göra (lättare shader i stället för stilla?), och Ghostty-ärendet. Dessutom F4-följder: `always` ritar täckt; kanten kostar mer än planen trodde.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Skriv docs/gpu-measurements.md från körningen 2026-10-26T171840 och nivå B-raderna, med förbehållen."* (eller, om omkörningarna gjorts först: *"…omkörningarna ligger i 2026-10-2x-live och -rows."*)

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
