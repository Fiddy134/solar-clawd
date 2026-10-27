# Himlens egen takt – design (2026-10-27)

## Avsikt

Himlen ska kunna röra sig hela tiden med samma känsla som idag, till en femtedel av kostnaden. Idag ritar Ghostty 1.3.1 ett fokuserat fönster med shader vid varje vsync, 120 gånger i sekunden på en ProMotion-skärm, och himlen kostar då ~5,9 W på dagen. Mätt 2026-10-27 (`docs/gpu-measurements.md`, "The sky at a frame rate of its own"): med `custom-shader-animation = false` och `window-vsync = false` ritar Ghostty bara när något väcker fliken, och om modden skriver flikens markering 24 gånger i sekunden blir det exakt 24 bilder: 1,26 W dag (−79 %), 0,95 W tänd natt (−83 %). Vincents blindprov samma kväll: 24 och 30 Hz kändes "nästan exakt som 120", 15 Hz märktes i delfinens hopp.

Vincent vill kunna ha himlen igång jämt (också ofokuserad), och den som har en svagare dator eller många fönster ska kunna spara.

## Mål

- Himlen rör sig i **24 bilder per sekund**, drivet av modden, i stället för Ghosttys 120.
- Två lägen, sparade mellan sessioner:
  - **`full`** (Vincents val): himlen rör sig också när Ghostty inte är den främsta appen, och på batteri; står still först efter **20 minuter** utan att personen rört datorn, och rör sig igen när hen är tillbaka. Aldrig den lättare himlen (utan moln) på batteri eller borta.
  - **`spar`** (standard för andra): dagens regler, bara i 24 Hz: rör sig bara när Ghostty är den främsta appen, står still på batteri, när himlen inte har något levande (`livelyAt`) och efter 5 minuter borta; fyrens svep (`WAITING_SWEEP_MS`, fem minuter efter att Claude är klar eller frågar) rör sig som idag också med Ghostty i bakgrunden. Den lättare himlen på batteri och borta som idag. *(Min tolkning: "spar = dagens politik, billigare". Vincent sa att spar ska finnas och vara standard för andra.)*
- **Ghosttys risk kräver ett eget ja.** På Ghostty 1.3.1 kräver 24 Hz `window-vsync = false`, och Ghostty varnar att rendering utan vsync på macOS 14.4+ kan ge kernel panic (`Config.zig#L1989-L2002`). Modden skriver den raden bara efter `/solar vsync off`, och tar bort den med `/solar vsync on`.

## Inte mål

- Andra takter än 24 (30 för snabba händelser behövs inte enligt blindprovet). En konstant räcker.
- Stillbilden som `background-image` (labbcellen före F6) och nivåerna efter dator (full/lätt/minimal efter GPU): egna rundor.
- Installationens fråga om `full`/`spar` och vsync: F6 (installationen) ställer den; den här rundan ger bara kommandona den frågan behöver.
- Markeringsrundan (starttid för tillstånd, skärmskala, kontrollsumma): egen runda efter den här.

## Det som inte får hända (anti-mål)

- **Claude Codes utskrift störs.** Tickarna skriver till samma tty som Claude Code. En skrivning som hamnar mitt i en av Claude Codes escape-sekvenser skulle ge trasig text. Det får inte synas; om det gör det pausar tickarna medan Claude skriver (mellan `turn.start` och `turn.complete`), och då ritar Claude Codes egen utskrift bilderna.
- **CPU-kostnaden äter upp vinsten.** Dagens `markTab` startar en `sh`-process per skrivning (`hooks/ghostty.ts:102`); 24 sådana i sekunden är för dyrt. Tickarna får inte starta en process per bild.
- **Någon får vsync av utan att ha bett om det**, eller kan inte ta tillbaka det.
- **Himlen ändrar utseende.** Samma shader, samma pixlar per bild; bara takten ändras.
- **En session som slutar lämnar en tickare igång** som skriver till en tty som inte finns, eller en flik som tickar för evigt.

## Begränsningar och fakta

- Ghostty 1.3.1, macOS. `window-vsync` gäller bara nya flikar och fönster; gamla flikar ritar som förut tills de stängs. `custom-shader-animation` laddas om i öppna flikar.
- Utan vsync-raden (1.3.1, personen har inte sagt ja): oförändrat beteende, dagens `animationOf` (`true`/`false`/`always`), inga tickar. Tickar med vsync på hjälper inte fokuserat (1.3.1 ritar ändå varje vsync).
- Nästa Ghostty-version (main): `false` ritar bara vid ändring även med vsync på, och en OSC 4-skrivning ger en bild (kod läst, ej prövat). Där behövs inte raden; modden känner igen versionen (`ghostty +version`) och tickar utan den. Vilken version som räknas som "nästa" bestäms när den finns; till dess är regeln "1.3.x kräver raden".
- Linux: `false` ritar redan bara vid uppvakning i 1.3.1 (ingen display link), så tickar borde fungera utan raden. Oprövat; den här rundan rör inte Linux (se Mina beslut).
- Mätt: minimerade fönster och flikar i bakgrunden ritar inte trots tickar (1,5–1,9 bilder/s); ett täckt fönster ritar varje tick. Tung utskrift utan vsync gav 39 bilder/s, inte över 120.
- Vad personen gör: `idleMs` (ioreg `HIDIdleTime`, var 3:e sekund idag, `ACTIVITY_MS`), `isGhosttyInFront` (`lsappinfo`), `isOnBattery` (var 60:e sekund). Finns alla i `hooks/host.ts`.
- Markeringen som skrivs är flikens nuvarande (`markOf`), så fisken och grillen följer med varje tick.
- Inställningen sparas under `~/Library/Application Support/solar-clawd/` (Linux: modden har redan en motsvarande plats för `runtime`), som modden redan läser och skriver.
- Flera sessioner: varje session tickar sin egen flik. Inställningen är en för alla; en session som läser en ändrad inställning följer den inom några sekunder.

## Det Vincent bestämt

- 24 Hz, ingen annan takt. Gäller också snabba saker (delfinen).
- `full` för honom; himlen rör sig ofokuserad och på batteri; står still efter 20 minuter utan aktivitet.
- `spar` finns och är standard för andra; den sparar genom att stå still när Ghostty inte är främst.
- Flikar i bakgrunden behöver inget särskilt (mätningen: Ghostty ritar dem inte).
- Vsync av bara efter ett eget kommando, som går att ångra: `/solar vsync off` och `/solar vsync on`. Första gången `full` eller `spar` väljs på 1.3.1 utan raden säger modden vad som krävs och vad Ghostty varnar för. Svaret efter `/solar vsync off` säger att nya flikar och fönster får 24 Hz och att ⌘T öppnar en.
- **Raden gäller hela tiden, i alla Ghostty-fönster, från `/solar vsync off` till `/solar vsync on`** (Vincent, efter granskningen). Ghostty läser `window-vsync` bara när en flik skapas, och man öppnar oftast fliken innan Claude startar; en rad som bara fanns medan en session körde skulle nästan aldrig nå en flik. Alltså står raden kvar oavsett om himlen är dold, om någon session körs eller om fliken har Claude, och den ligger i en egen fil som moddens inkludering inte tömmer (dagens `runtime/solar-clawd.ghostty` töms när himlen döljs och när sista sessionen slutar). Svaret på `/solar vsync off` säger det rakt ut: alla Ghostty-fönster, också utan Claude, tills `/solar vsync on`. Avinstalleras modden ska raden bort med den.
- Med nästa Ghostty-version tar modden bort raden själv; kommandot blir överflödigt.
- Installationen (F6) ska kunna fråga om läget och om vsync med just de här kommandona.

## Mina beslut (Claude, efter granskningen)

- **Flikar som var öppna innan raden kom** ritar som förut tills de stängs (vsync gäller bara nya flikar). Svaret efter `/solar vsync off` säger att Ghostty bör startas om så att alla fönster får 24 Hz. Planen har en mätrad som visar att en gammal flik med vsync på inte fryser eller hackar under `false` och tickar (fokuserad, ofokuserad, under fyrens svep), och omvänt att en flik utan vsync under `true` (efter `/solar vsync on`, innan den stängts) inte ritar utan gräns. Fryser något: dagens `animationOf` tills Ghostty har startats om efter bytet.
- **Linux behåller dagens beteende den här rundan** (inga tickar, dagens `animationOf`): oprövat där, och `spar` som standard skulle annars byta alla Linux-användare utan att någon sett det. Tickarna på Linux blir en egen liten runda med en provkörning.

## Kommandona

- `/solar full`, `/solar spar`: väljer läget, sparas, gäller alla sessioner. Svaret säger vad läget gör; på 1.3.1 utan vsync-raden också vad som krävs för 24 Hz (`/solar vsync off`) och varningen.
- `/solar vsync off`: skriver `window-vsync = false` i moddens inkludering (`runtime/solar-clawd.ghostty`, inte personens config), laddar om Ghostty, sparar valet. `/solar vsync on`: tar bort raden.
- `/solar` (hjälpen) nämner de nya orden.

## Lämnat till byggaren

- **Hur tickarna skrivs utan en process per bild.** I den ordningen: (1) skriva direkt till flikens tty-enhet från moddens egen process, om motorn tillåter det (`$.fs.write` mot `/dev/ttysNNN`, sökvägen tagen en gång som `markTab` gör idag); (2) en enda långlivad hjälpprocess per session som skriver i 24 Hz och får sin markering uppdaterad när den ändras, och som dör med sessionen. Byggaren prövar (1) först och väljer; CPU-kostnaden mäts (mål: under en procent av en kärna).
- Hur takten hålls (mot klockan, som `tools/measure/term.sh` gör, så att en sen skrivning inte förskjuter resten).
- Exakt var i `register.tsx`/`ghostty.ts`/`waiting.ts` lägena lever, och hur `animationOf` utökas (troligen en ny funktion som säger "tickar eller inte" bredvid den, med samma tabelltest i `hooks/sky.test.tsx`).
- Filnamnet och formatet för inställningen.
- Tester: tabellen över när det tickar (läge × främst × borta × batteri × väntan × levande), att vsync-raden bara finns efter `vsync off`, att inställningen läses om.
- README: "What it costs" får 24 Hz-raderna och vad `full`/`spar` kostar; varningen återges.

## Verifiering

- `claude plugin test .`, `tsc`, paritet oförändrad (shadern ändras inte).
- `tools/measure/gpu.sh live` i Vincents riktiga session med `full` och vsync av: nära 1,3 W på dagen fokuserad, och Claude Codes CPU med tickarna mot utan.
- Vincent tittar på en session där Claude skriver mycket (lång utskrift, verktygsanrop) med tickarna igång: ingen trasig text.
