# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-26 kl 17:20, session efter `ecb98de8` (Opus 5.5, high, auto mode) → nästa.

## Läge

- **Arbetsplanen för åtta frågor:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. Ordning F1 auto mode → F2 GPU-mätning → F3 fisk + löv/fåglar → F4 GPU-optimering → F5 motor/tema → F6 installation → F7 två teman → F8 community.
- **F1 klar.** F1-avsnittet i planen och specen beskriver nu det som byggdes (23d36f2 på `main`).
- **F2 pågår på grenen `gpu-matning`** (1bdf11a), utgrenad från `main` 23d36f2. Uppgift 1–3 är byggda: `tools/measure/{scenes.sh, probe.glsl, term.sh, gpu.sh, report.mjs}`. Kvar: uppgift 3:s riktiga rad medan Vincent tittar, uppgift 4 (körningen), 5 (`docs/gpu-measurements.md`), 6 (policyfrågan).
- **Steg 0:** den ljusa himlen ligger på grenen `ljus-himmel` (0bae2fb); `main` har samma modd-kod som 3cef45e (kontrollerat med `git diff`).
- **Inget är pushat** sedan 3cef45e.

## Vad som är verifierat i F2, och vad som inte är det

- **Verifierat utan fönster:** alla fjorton scenfiler finns i `.preview/measure/23d36f2/` (main) och `.preview/measure/0bae2fb/` (grenen), är deterministiska, dag och natt skiljer sig, bara grenen har `SHADE_DISC`, och händelserna syns som konstanter. Proben avkodas exakt ur WebGL-renderingar (0, 1, 4097, 12345, 16383, och 20000 slår runt till 3616), och andra bilder ger `-`. `plan --dry-run` ger 45 rader, cirka 37 minuter (`--twice`: 90 rader, andra varvet baklänges). Provtagningen mot den levande Ghostty ger rimliga tal. Rapporten fungerar på en syntetisk körning.
- **Granskad** av en Opus-agent före körningen. Rättat: att stoppa powermetrics kunde hänga för evigt (sudo 1.9.17 kör den som rot i egen pty, så skalet kan inte signalera den; nu `sudo -n kill` med gränser och `-n` så den slutar själv), en scen som inte renderas blev en rad utan shader, WindowServers CPU-tid tappade decimalerna, tillstånd som macOS frågar om frågas nu i förflygningen, öppna Finder-fönster vägras eftersom "ofokuserad" är Finder framme, städningen tar tillbaka himlarna först och tål att köras två gånger, och HUP städar också.
- **Första riktiga raden (17:14, `probe true focused idle`) fungerade:** 119,8 fps, 38,4 % device, 834 mW, Ghostty 18 % och WindowServer 61 % CPU; start, System Events och skärmbilder fungerar. `GPU Power: N mW` tolkas rätt. **Men powermetrics på macOS 27 ger `GPU ms/s` 0.00 för alla processer, även `ALL_TASKS`,** fast GPU:n är aktiv 77 %. Rapporten läser rätt; källan är tom. Ghosttys egen GPU-tid finns alltså inte; himlens kostnad får stå på device % och mW över golvet (hela maskinen) plus fps. Kolumnerna Ghostty/WindowServer GPU ms/s ska bort ur rapporten och dokumentet.
- **Fallgropar från första försöket:** en powermetrics från ett avbrutet försök (fönstret stängdes) blev kvar som rot och fick nästa rad att vägra (`sudo pkill powermetrics`). Förkontrollen kan säga `busy: duetexpertd` en stund; vänta en minut. Claude-sessionen själv drar ~20 % CPU även i vila, så den ska vara stängd under `plan`.
- **Fortfarande overifierat:** täckt/minimerad/flik; det visar `plan`.
- Täckt görs med en andra, ogenomskinlig Ghostty över mätfönstret, inte med ett Finder-fönster vars sidopanel släpper igenom skrivbordet.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode eftersom klonen inte är laddad; spegeln `~/solar-clawd-live` laddas. Ändringar når den levande himlen bara medan Vincent armerat spegeln (`~/solar-clawd/.claude/hooks/arm.sh` i ett terminalfönster, 8 timmar).
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Lägg inte `"$defaults"` eller trust-rader i `autoMode.environment`.
- **Mätningen körs inte av Claude.** `gpu.sh row` och `plan` öppnar fönster, tar fokus, släcker de levande himlarna och behöver sudo, Skärminspelning och Hjälpmedel. Vincent startar dem från ett eget terminalfönster. Claude kör bara `--dry-run`, `decode`, `report` och `scenes.sh`.
- `tool.check`-hooken i `hooks/register.tsx` förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning.
- Commit-ämnen beskriver världen som den nu är, specar på svenska, planer och kod på engelska. Push bara efter Vincents ja, som `Fiddy134`; versionsbump i `.claude-plugin/plugin.json` när modden ändras (F2 ändrar inte modden).

## Lösa trådar

- Två ospårade säkerhetskopior i `.claude/` (`settings.local.json.bak-20261026-*`) kan tas bort av Vincent; Claude skriver inte i `.claude/`.
- `tools/dev/watch.sh` kräver `fswatch` (inte installerat); valfritt.
- Den inbyggda skärmens bildfrekvens syns inte i `system_profiler`; kontexten visar bara den externa (165 Hz). Proben ger den faktiska.

## Nästa steg: F2 uppgift 3 och 4, för Vincent

Förbered, i ett vanligt terminalfönster (inte i Claude): ge det fönstrets app Skärminspelning och Hjälpmedel i Systeminställningar, koppla ur den externa skärmen, nätström, stäng Finder-fönster och Claude-appen (den låg på 27 % CPU och vägras annars).

```
cd ~/solar-clawd && git switch gpu-matning
sudo -v
tools/measure/gpu.sh row probe true focused idle
tools/measure/gpu.sh report
```

Den raden är körd (se ovan).

Sedan själva körningen, när Vincent lämnar datorn i 40 minuter (75 med `--twice`):

```
sudo -v && tools/measure/gpu.sh plan
```

Efteråt, med Claude: nivå B-raderna (`gpu.sh live "<läge>"` från terminalen medan Vincent ställt den levande fliken i läget) och 60 Hz-raden, sedan uppgift 5: läs `.preview/measure/out/latest/report.md` och skriv `docs/gpu-measurements.md` (agentroll fable/high enligt planen), granskning (opus/medium) och uppgift 6 som en fråga till Vincent.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Planen är körd; tolka rapporten och skriv docs/gpu-measurements.md."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
