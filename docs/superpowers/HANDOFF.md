# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-27 kl 00:10, session `fefaaf38` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen för åtta frågor:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. **F4 före F3** (Vincent, 2026-10-26): F3 lägger till arbete per pixel, F4:s konvention med en gränskontroll per händelse ska gälla F3:s figurer, och ljusbeslutet bör vara taget innan F3:s utseende bedöms.
- **F1 och F2 är klara och på `main`**, pushade som `Fiddy134` till `83fb633`. Ej pushat på `main`: `1f43b57`, `bd564eb`, `711f575` (handoffer, `.worktrees/` ignorerad) och den här handoffen.
- **F4 pågår på grenen `gpu`** i worktreen `~/solar-clawd/.worktrees/gpu`. Grenen är `main` + `ljus-himmel` (0bae2fb) + F4, står på **`d19a474`**, är inte på `main` och inte pushad. Den levande himlen (spegeln) är fortfarande main-himlen; worktrees speglas inte.
- **Committa inget på `gpu` före fas 4-körningen.** Scenerna är förskrivna för `d19a474` i `.worktrees/gpu/.preview/measure/d19a474/`; en ny commit flyttar `gpu:` och scenerna skrivs om när körningen börjar (fungerar, men tar minuter). Handoffen ligger på `main` och rör inte `gpu`.
- **Fas 4 väntar på Vincent.** Allt är förberett, se "Nästa steg" 1.

## Vad den här sessionen gjorde (alla på `gpu`)

- **Uppgift 5b klar (`743d58a`, dokumenterad i `60616cf`).** Vincent avgränsade beslutet före bygget:
  - den lättare himlen skrivs **på batteri och när personen är borta**, inte under stilla-regeln (`!isLively`), som gäller en vanlig dag och hade gjort den till vardagshimlen;
  - den **släpper bara molnen; kanten blir kvar**, eftersom grå text bleknar utan den (post 8).
  - Konstanten `LIGHT` i shadern, `isLight` i `ShaderParams`/`SkyExtras`, `state.isOnBattery || state.isAway` i `writeGhosttySky`. `animationOf` och dess test orörda. Att gå iväg/komma tillbaka/byta till batteri ger nu en omladdning (testet som lovade "ingen omladdning" säger nu en).
  - Förhandsvisningen: `--light`. Benchen (`--gpu`, 3024×1964): himlens egen kostnad −58 % day-clear, −66 % day-overcast, −43 % night-lit. Räknas inte mot F4:s mål. Skärmbilder `.worktrees/gpu/.preview/5b-*.png` (ej committade).
- **`report.mjs` skriver MHz och residens (`00b06ed`)** bredvid mW i alla tabeller med mW; kontrollerat mot F2-körningen (rad 1–4 och grenen mot main, t.ex. 785 → 1228 MHz).
- **Fas 4 förberedd (`d19a474`):**
  - `gpu.sh plan f4 [--twice]`: F2:s 45 rader igen som baslinje, plus `gpu:` i målens lägen (day-clear/night-lit × true/always × fokus/ofokus, spinner), omarkerad flik, de fem andra scenerna, `passthrough true focused spinner` som spinner-golv, och `gpu:day-clear-light`/`gpu:night-lit-light`. 64 rader, med `--twice` 128, ~105 min. `plan` utan namn = F2 som förut.
  - `scenes.sh`: `day-clear-light`, `night-lit-light`; vägrar för en ref utan `LIGHT` (provat på `ljus-himmel`).
  - `report.mjs`: jämförelserna main → ljus-himmel, **ljus-himmel → gpu** och hel → lätt, med egen kostnad över golvet och kolumnen `kvar` (andel kvar av egen kostnad; målet ≤ 50 %). `kvar` visas bara när baslinjen ≥ 5 device-punkter eller ≥ 500 mW.
  - Alla planens scener förskrivna; baslinjens shaders har samma sha256 som i F2 (`89272b7a0789`, `cc466523bfcf`, `af7c1319f745`, `70fa7b81935b`). `main` har inte ändrat `hooks/` eller `tools/preview/` sedan F2:s `23d36f2`.

## Beslut tagna i sessionen

- **5b:s omfång** (Vincent, 2026-10-26 kväll): batteri + borta, bara molnen bort, kanten kvar. Står i planens punkt 5b och i `docs/gpu-measurements.md`, "F4 task 5b".
- **60 Hz-raderna görs**, nu tre (probe, `ljus-himmel:day-clear`, `gpu:day-clear`), med mW och MHz. Skälet, som Vincent frågade efter: scenraderna har ingen fps-räknare, och F2 kunde inte avgöra om grenen är mättad vid 120 Hz (proben halverades vid 60 Hz, grenen bara 80,9 → 77,9 %). Mättad betyder att F4:s besparing kan synas som fler bilder i stället för lägre device %. De är inte nödvändiga för målet; hoppas de över skrivs frågan som obesvarad.
- Tidigare beslut gäller: post 6 nej, post 8 bort, ljusbeslutet a/b/c tas med fas 4:s siffror. Ghostty-rapporten ligger som utkast i `docs/superpowers/ghostty-discussion-draft.md` för Vincent.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode eftersom klonen inte är laddad; spegeln `~/solar-clawd-live` laddas. Ändringar når den levande himlen bara medan Vincent armerat spegeln.
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Lägg inte `"$defaults"` eller trust-rader i `autoMode.environment`.
- **Worktrees:** i `.worktrees/` (inte `EnterWorktree`, som lägger dem i förbjudna `.claude/worktrees/`). I en ny worktree: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`.
- **Tester och typer:** `claude plugin test .` (99 tester) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit` (ingen `tsc` installerad; `--noEmit` så inga `.js` hamnar i `hooks/`). Testutskriften är enorm vid fel; skicka den till en fil och läs slutet.
- **Förhandsvisningen:** `SOLAR_ROOT=$PWD npx -y esbuild@0.24.0 tools/preview/shader.mjs --bundle --platform=node --format=esm --outfile=.preview/shader.bundle.mjs`, sedan `node .preview/shader.bundle.mjs <flaggor> --out <namn>`. Två samtidigt i samma worktree krockar (Chrome exit 21). Macens `/bin/bash` är 3.2: inga associativa arrayer. Under zsh blir `$FLAGS` med flera ord ett argument; använd `${=VAR}` eller bash.
- **Mätningen i Ghostty körs inte av Claude.** Vincent startar `row`, `live` och `plan` från Terminal.app, `sudo -v &&` före varje. Claude kör bara `--dry-run`, `decode`, `report` och `scenes.sh`. `--force` lämnar inget spår i `context.txt`.
- **Bench i förhandsvisningen får Claude köra.** Lita bara på före/efter-par körda växelvis direkt efter varandra.
- **Utåtriktat skickas av Vincent:** Ghostty-rapporten, pushar och PR:er.
- `tool.check`-hooken i `hooks/register.tsx` förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning.
- Commit-ämnen beskriver världen som den nu är, specar på svenska, planer och kod på engelska. Push bara efter Vincents ja, som `Fiddy134`. **F4 ändrar modden**: versionsbump i `.claude-plugin/plugin.json` när `gpu` går till `main`.

## Lösa trådar

- Två ospårade säkerhetskopior i `.claude/` (`settings.local.json.bak-20261026-*`) kan tas bort av Vincent.
- `gpu`:s egen kopia av `HANDOFF.md` är gammal; den på `main` gäller. Vid sammanslagningen vinner `main`:s.
- Planens lägesrad för F4 (på `gpu`) nämner 5b klar men inte fas 4-förberedelsen; uppdatera den efter körningen, i samma commit som fas 4-avsnittet.
- **Förhandsvisningens svagheter:** texturen upprepas vid kanterna (REPEAT); `diff.mjs` räknar varje icke-bakgrundspixel som text; med `--retina` går ersättningstexten över fyrremsan.
- `tools/dev/watch.sh` kräver `fswatch` (inte installerat); valfritt.

## Nästa steg

1. **Fas 4, Vincent** (datorn orörd knappt två timmar: nätström, extern skärm urkopplad, inga Finder-fönster, övriga Claude-sessioner stängda, inget över 20 % CPU). Från Terminal.app, **i worktreen** (klonen på `main` saknar `plan f4`):
   ```
   cd ~/solar-clawd/.worktrees/gpu
   tools/measure/gpu.sh plan f4 --twice --dry-run
   sudo -v && tools/measure/gpu.sh plan f4 --twice
   ```
   Sedan skärmen på 60 Hz (Systeminställningar → Skärmar), tre rader, och tillbaka till ProMotion:
   ```
   sudo -v && tools/measure/gpu.sh row probe true focused idle
   sudo -v && tools/measure/gpu.sh row ljus-himmel:day-clear true focused idle
   sudo -v && tools/measure/gpu.sh row gpu:day-clear true focused idle
   ```
   Körningen hamnar i `.worktrees/gpu/.preview/measure/out/<tid>/` (raderna i `…/2026-10-27-rows/`). Kontrollera att `powermetrics-*.log` finns och att `report` visar mW.
2. **Claude efter körningen:** `tools/measure/gpu.sh report <mapp>`, nytt avsnitt "F4 phase 4" i `docs/gpu-measurements.md` (tabellen "gpu mot baslinjen" och dess `kvar` mot målet ≤ 50 %, 60 Hz-svaret om mättnad, lätt mot hel i mW), planens lägesrad.
3. **Ljusbeslutet a/b/c** till Vincent med siffrorna; sedan uppgift 7 (domen i skrift, README "What it costs"), `gpu` till `main` med versionsbump, push efter Vincents ja. Sedan F3.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Fas 4-körningen är klar i <mapp>: skriv rapporten."* (eller, om den inte är körd: *"… Fortsätt med fas 4."*)

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
