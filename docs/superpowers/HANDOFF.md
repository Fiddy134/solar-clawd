# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-26 kl 16:45, session `fd4f8aef` (Fable 5.1, auto mode) → nästa.

## Läge

- **Arbetsplanen för åtta frågor** är godkänd och committad: `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md` (74752e3). Ordning: F1 auto mode → F2 GPU-mätning → F3 fisk + löv/fåglar → F4 GPU-optimering → F5 motor/tema → F6 installation → F7 två teman → F8 community. Varje fråga körs som en Workflow enligt tabellen i sitt avsnitt.
- **Steg 0 gjort:** den ljusa himlen med textkant ligger på grenen `ljus-himmel` (0bae2fb); `main` är ren och visar den mörkare himlen tills F4 avgör.
- **F1 klar och verifierad** (22d0abd, a088a8d, d71c807, 618c15e; spec `docs/superpowers/specs/2026-10-26-auto-mode.md`). Rotorsak: klonen var den laddade plugin-mappen, en skyddad sökväg, så Edit fick "no verdict" i auto mode. Nu laddas modden från spegeln `~/solar-clawd-live` (`claude plugin list` visar `solar-clawd@inline`, Path `/Users/vincentrogvall/solar-clawd-live`). Verifierat i session `c8a8995c`: två Edit i klonen i auto mode utan fel, spegeln följde med.
- **Inget är pushat** sedan 3cef45e. Ingen versionsbump behövs för F1 (ändrar inget i modden).

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode. Om en session drar slutsatsen att spegeln är onödig "eftersom Edit fungerar": det är bakvänt, Edit fungerar för att klonen inte längre är laddad.
- **Armering:** ändringar når den levande himlen bara medan spegeln är armerad. Vincent kör `~/solar-clawd/.claude/hooks/arm.sh` i ett terminalfönster (skriver tillbaka fyra bokstäver), 8 timmar; `off` avarmerar. Armerad just nu till 2026-10-27 00:29. Oarmerad: en hook-notis per timme, inget kopieras.
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, eller skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Klassificeraren flaggar det som kringgående, och det är meningen. Lägg inte `"$defaults"` eller trust-rader i `autoMode.environment`.
- `tool.check`-hooken i `hooks/register.tsx` förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning (arbetsplanen, "Två regler").
- Commit-ämnen beskriver världen som den nu är, kommentarer i husets prosa, specar på svenska, planer och kod på engelska. Push bara efter Vincents ja, som `Fiddy134` (`gh auth switch -u Fiddy134`, tillbaka till `Iggy-Vincent`); versionsbump i `.claude-plugin/plugin.json` när modden ändras.
- Säkerhetsgranskningen (pluginen security-guidance) granskar varje commit och flaggar gärna hook-skript. Svara i commit-text eller spec; grinden i F1 är resultatet av tre sådana varv.

## Lösa trådar

- F1-avsnittet i arbetsplanen beskriver den första designen (`"$defaults"`, `tools/dev/mirror.sh`, `core.hooksPath`). Specen har den slutliga. Uppdatera avsnittet så de stämmer överens.
- Två ospårade säkerhetskopior i `.claude/` (`settings.local.json.bak-20261026-*`) kan tas bort.
- `tools/dev/watch.sh` kräver `fswatch` (inte installerat) och armering; valfritt.
- Scratchpaden från session `fd4f8aef` (`f1/`) är temporär; allt som behövs ligger i repot.

## Nästa steg: F2, GPU-mätning

Läs F2 i arbetsplanen och kör workflowen `gpu-matning` (4 agenter: bygg opus/high; kör sonnet/medium när Vincent lämnat datorn; tolka fable/high; granska opus/medium). Uppgifterna 1–6 där: `tools/measure/scenes.sh`, `tools/measure/probe.glsl`, `tools/measure/term.sh`, `tools/measure/gpu.sh`, `tools/measure/report.mjs`, `docs/gpu-measurements.md`. Nyckelfakta att inte tappa:

- Den levande inkluderingen ligger i `~/Library/Application Support/solar-clawd/runtime/solar-clawd.ghostty` (inte repots `runtime/`, som är gamla rester). Varje levande session skriver tillbaka sin inkludering inom 10 s; `touch …/runtime/hidden` tömmer den i alla sessioner (samma brytare som `/solar`).
- Kontrollerade rader kräver en färsk Ghostty-instans med `--config-default-files=false`; `config-file`-inkluderingar appliceras efter huvudfilen, så inget kan skrivas över via configen.
- Proben räknar bildrutor med `iFrame` i gråvärden; det är enda sättet att avgöra om `false` och ofokus verkligen slutar rita (spikens `false`-rader är misstänkta).
- Per-process-GPU kräver `sudo powermetrics --samplers tasks,gpu_power --show-process-gpu`; Aktivitetskontrollens "% GPU" ≈ GPU ms/s ÷ 10. `ioreg` är hela GPU:n; en tom passthrough-shader ligger redan på 40 % där vid 120 Hz.
- Mät på den inbyggda skärmen med den externa (165 Hz) urkopplad, på nätström, i ABBA-ordning, och spela in scener från både `main` (3cef45e) och `ljus-himmel` (0bae2fb).
- Ghosttys shader-väg är GLSL 430 → SPIR-V → MSL; precisionskvalificerare är verkningslösa; `iFocus` finns.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md, uppdatera F1-avsnittet i arbetsplanen efter specen, och starta sedan F2 med workflowen gpu-matning."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
