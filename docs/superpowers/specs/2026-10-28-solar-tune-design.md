# /solar tune: himlen efter eget öga

Datum: 2026-10-28. Status: design, väntar på Vincents godkännande.

## Avsikt

En ljus dag blev terminalens text svårare att läsa mot himlen. Att be Claude
ändra siffror i koden för en sådan sak är onödigt; Vincent vill ha reglagen
själv. Lika viktigt: andra som använder Solar har andra skärmar, ögon och rum,
och ska kunna göra samma sak utan att röra koden.

`/solar tune` öppnar en ruta i Claude Code där man drar i några reglage, ett
set per läge av dygnet (dawn, day, dusk, night), och ser himlen bakom texten
ändras medan man drar.

Vincent ställer först in sina egna värden med verktyget. Hans sparade värden
blir sedan de inbyggda grundvärdena som alla får från början. Researchen nedan
säger att fem procent eller färre av användare någonsin ändrar en inställning,
så grundvärdena är det som betyder mest för andra.

## Mål

- Fyra reglage per läge: **brightness**, **text shade**, **colour**, **warmth**.
- Fyra lägen, **dawn**, **day**, **dusk**, **night**, var med egna värden.
  Ändrar man day blir bara dagen annorlunda; kvällen behåller sina värden.
  Mellan lägena glider värdena mjukt med solens höjd, som himlens färger redan
  gör, utan hopp vid ett klockslag.
- Himlen följer reglaget medan man drar, så nära direkt som Ghostty tillåter.
- Inställningarna sparas och överlever omstart, uppdatering av modden och
  nya sessioner.
- Rutan har en risografkänsla: rosa och gult på mörkblått, prickiga staplar,
  sådant terminalens tecken och färger kan bära.

## Icke-mål

- Inget kontrastreglage (se research: mer kontrast i bakgrunden gör texten
  svårare att läsa, och det enda nyttiga hållet ner täcks av brightness och
  text shade).
- Ingen oskärpa (himlen är redan mjuk).
- Ingen webbsida och inget eget fönster; rutan bor i Claude Code.
- Inga reglage per tema. Samma värden gäller ovanpå vilket tema som helst.
- Ingen automatisk "håll texten läsbar"-brytare i den här omgången.

## Anti-mål: det får inte hända

- Reglagen får inte kunna göra texten oläsligare än i dag, var för sig eller
  tillsammans. Brightness kan bara sänkas från dagens nivå; text shade kan bara
  stärkas från dagens nivå; colour och warmth hålls inom gränser där ljus text
  fortfarande får minst dagens 4,9:1 mot den ljusaste tillåtna himlen, med ett
  test för ytterlägena i kombination. (Claudes beslut.)
- Temats eget utseende får inte förstöras: väntelampan, lamporna och temats
  egna färger (scenen) rörs inte. Reglagen verkar bara på himlens gradient
  och kanten runt texten; brightness också på stjärnor och måne, som redan
  tonas med gradienten. Molnen, vädret och händelserna behåller dagens ljus.
- Med grundvärdena ska himlen se exakt ut som i dag: paritet 53/53 identisk
  mot baslinjen tills Vincents värden bakas in som nya grundvärden.
- Två sessioner får inte skriva över varandras himmel med olika värden.
- Verktyget får inte göra himlen dyrare att visa när rutan är stängd.

## Det Vincent har bestämt

- Plats: en ruta i Claude Code (alternativ A), inte en webbsida.
- Namn: engelskt, `/solar tune`.
- Lägen: per tid på dygnet, med egna värden per läge.
- Dra i reglage och se himlen ändras direkt, om möjligt.
- Risografdesign på rutan, om möjligt.
- Reglagen: Vincent bad om research och sa att Claudes rekommendation gäller om
  inget objektivt bättre dyker upp. Researchen ändrade förslaget till det som
  står under Mål.
- Grundvärden: dagens utseende tills Vincent ställt in sina; sedan blir hans
  värden standard.
- Brightness dämpar bara himlen själv, inte molnen, vädret, händelserna eller
  temats landskap. Vincent valde det efter en jämförelse renderad med den
  riktiga shadern (fyr, 13:00, halvmolnigt, 72 %): med bara himlen dämpad står
  molnen ut som ljusare fält mot den mörkare himlen; med allt dämpat mörknar de
  med. Han valde det första. I koden betyder det en egen faktor vid
  `sky = tone(sky, k)` i `hooks/glsl/main.ts`, inte en ändring av `k`, som
  molnen, händelserna och landskapet också får.

## Reglagen

| Reglage | Vad det gör | Gränser |
|---|---|---|
| brightness | Skalar hur ljus himlen får bli i läget. I dag dämpas middagshimlen inte alls: taket på 0.8 biter bara nära horisonten (3–8°) och i glöden, eftersom horisonten mitt på dagen ligger på 0.69–0.72. Därför är det här reglaget det som löser problemet med ljus dag. | Bara nedåt; 100 % = dagens utseende, alltid, också sedan Vincents värden blivit grundvärden (så andra kan gå tillbaka upp). `sky.json` sparar faktorer mot dagens utseende, inte mot grundvärdena; `r` återställer till grundvärdet. |
| text shade | Styrkan på den mörka kanten himlen redan lägger runt varje tecken (`SHADE`, `SHADE_NEAR` i `hooks/glsl/main.ts`). Gör man den starkare blir texten lättare att läsa utan att hela himlen mörknar. | Bara uppåt; "normal" = som i dag. Radien rörs inte (fler pixlar = fler texturläsningar per pixel). |
| colour | Mättnaden på himlens gradient. Smaksak. | "normal" = dagens `SATURATION` 1.35. |
| warmth | Varmare eller kallare himmel, som Night Shift. Smaksak. | "normal" = ingen förskjutning. |

## Rutan

Öppnas med `/solar tune`. Ritas ovanför prompten med himlen synlig bakom.

```
› /solar tune
┌───────────────────────────────────────────────────────────┐
│  dawn  [day]  dusk  night                  tab next phase  │
│ › brightness  ▓▓▓▓▓▓▓▓▓▓▓▓▓●░░░░░░   85 %                   │
│   text shade  ▓▓▓▓▓▓▓▓▓▓▓▓●░░░░░░░   normal                │
│   colour      ▓▓▓▓▓▓▓▓▓▓●░░░░░░░░░   normal                │
│   warmth      ▓▓▓▓▓▓▓▓▓▓●░░░░░░░░░   normal                │
│ ↑ ↓ pick   ← → move   ⏎ keep   r reset   u undo   esc close │
└───────────────────────────────────────────────────────────┘
```

- Börjar på läget som gäller just nu.
- Tab byter läge; ↑ ↓ väljer reglage; ← → flyttar det; ⏎ sparar; `r` sätter
  det valda reglaget till grundvärdet; `u` ångrar allt sedan rutan öppnades;
  Escape stänger (modd-API:t släpper aldrig fram Escape, den lämnar fokus,
  `ClientKeyEvent` i typerna). Vad som händer med osparade ändringar vid
  stängning är byggarens sak att föreslå (se nedan).
- Etiketter på engelska, som resten av Solars text.
- När man drar i ett läge som inte gäller just nu, visar himlen det läget
  medan rutan är öppen, så man ser vad man ändrar. När rutan stängs går
  himlen tillbaka till verklig tid.

## Hur det hänger ihop (det som redan finns)

- Shadern är text med allt inbakat som konstanter (`hooks/shader.ts`). En
  ändring är en omskrivning plus `reload_config` till Ghostty, som Ghostty tar
  utan flimmer (`hooks/ghostty.ts`). Det finns ingen inmatning till shadern
  under körning utom paletten (OSC 4), där färg 16 redan används för
  kontextfönstret.
- Lägena räknas lämpligast i TS bredvid `sceneAt` (`hooks/shader.ts`): en vikt
  för dawn/day/dusk/night ur solens höjd och om det är kväll, de fyra
  uppsättningarna blandade till en, inbakad som konstanter. Shadern behöver då
  ingen faslogik. `nightness` (`smoothstep(-5, -13, elev)`) finns i båda
  målarna; `isEvening` finns i `hooks/sky.ts` och i GLSL (`hooks/glsl/sky.ts`)
  men inte vid `sceneAt`, där den får räknas ur `isDay` och `progress` som
  `Scene` redan bär.
- `/solar demo` spelar hela dygnet inne i shadern ur sina `DEMO_*`-arrayer;
  värden inbakade en gång skulle stå still på ett läge genom hela demot.
  Tune-värdena behöver därför följa med per scen i demots arrayer.
- Det finns en himmel för alla flikar och fönster, och alla sessioner skriver
  samma text. Inställningarna ska därför bo i den delade filen `sky.json`
  (bredvid `runtime/` under `~/Library/Application Support/solar-clawd/`), där
  `pace` redan bor. I dag skriver `/solar full|spar` om hela filen
  (`JSON.stringify({ pace })` i `hooks/register.tsx`); det måste bli en
  sammanslagning så att `pace` och `tune` inte raderar varandra.
- Bakgrundsbilden (wallpaper) målas av TS-målaren i `hooks/sky.ts` med egna
  kopior (`WALLPAPER_LUMINANCE`, `WALLPAPER_SATURATION`); samma värden måste nå
  den, annars är bakgrundsbild och shader oense.
- Temanamnen `LUMINANCE`, `SATURATION`, `SHADE` är reserverade och lintade;
  teman får bara `k` via `tone`/`lift`. Det skyddar mot att teman och reglage
  slåss.

## Hur snabbt "direkt" kan bli: mät först

Ingen har mätt hur lång tid en omladdning och omkompilering av den ~180 KB
stora shadern tar per flik i Ghostty 1.4.0. En tidigare spik med omladdning
var 2:a sekund kostade ungefär +2 procentenheter CPU. Första steget i bygget är
därför en mätning:

1. Skriv om shadern och ladda om med 150–300 ms mellanrum medan ett reglage
   hålls nere; mät tiden från omskrivning till ny bild, och CPU.
2. Räcker det (bilden hänger med handen, utan flimmer), används den vägen:
   omskrivning och omladdning, avstudsad.
3. Räcker det inte: förhandsvisning genom palettfärger (OSC 4, färg 17 och
   uppåt, per flik och utan omkompilering) medan man drar, och en enda
   omladdning med inbakade värden när man släpper. Risk: färg 17+ kan synas som
   konstiga färger i program som använder 256 färger.

Mätningar i Ghostty är Vincents (projektregel); byggaren förbereder skript och
ber honom köra dem.

## Begränsningar

- Projektets regler gäller: tester (`claude plugin test .`), `tsc`, paritet mot
  baslinjen, versionshöjning i `.claude-plugin/plugin.json`, ingen merge till
  main förrän det mergade resultatet testats i en worktree, ingen push utan
  Vincents ja.
- Bygget utgår från `main`. Grenen `teman` (0.9.0) ändrar också
  `hooks/glsl/common.ts` och kan behöva slås ihop med detta; den som mergar
  sist löser det.
- Rutan får inte märkas i kostnad när den är stängd; himlen ska inte ticka
  oftare för att verktyget finns.

## Claudes beslut (Vincent kan ändra dem)

- Förhandsvisningen är gemensam. Det finns en shader för alla flikar, så när
  någon ställer in syns det i alla Claude-flikar. Den osparade förhandsvisningen
  ligger i `sky.json` med en tidsstämpel, så att andra sessioner ritar den i
  stället för att skriva över den. Den slocknar av sig själv om sessionen som
  ställer in dör, till exempel efter en minut utan livstecken.
- När man ställer in ett läge som inte gäller just nu, visar himlen det läget
  medan rutan är öppen. När rutan stängs går himlen tillbaka till verklig tid.
- Rutan finns bara i Ghostty. I iTerm2 följer bakgrundsbilden de sparade
  värdena för brightness, colour och warmth; text shade finns inte där,
  eftersom bakgrundsbilden inte ser texten.
- Rutan har en egen mörkblå bakgrund och är därför ogenomskinlig. Himlen syns
  runt den och ovanför, i chatten, men inte genom den. Rosa och gult på ljus
  dagshimmel skulle inte gå att läsa.

## Lämnat åt byggaren

- Exakta kurvor för lägenas vikter ur solens höjd (var dawn slutar och day
  börjar) så länge övergångarna är mjuka och dawn/dusk skiljs åt.
- Reglagens skalor och steg, och exakt hur warmth färgar (förskjutning mot
  orange/blå före `tone`).
- Rutans exakta utseende inom risografkänslan och terminalens färger.
- Vad som händer med osparade ändringar när rutan stängs med Escape.
- Avstudsningen och om live-vägen blir omladdning eller palett, efter mätningen.
- Hur Vincents värden blir grundvärden: ett enkelt sätt att läsa ut dem ur
  `sky.json` till koden.

## Research som ändrade förslaget

Tre spår, 2026-10-28.

- Liknande verktyg (Windows Terminal, iTerm2, kitty, WezTerm, Ghostty) har ett
  huvudreglage för hur starkt bakgrunden syns; inget har kontrast för
  bakgrundsbild. WCAG-teknik G18 mäter mot den sämsta delen bakom texten och
  åtgärdar genom att dämpa just där. Mönstrade bakgrunder med hög kontrast gör
  läsningen sämre (Scharff & Ahumada). Fem procent eller färre ändrar någonsin
  inställningar (Spool).
- Ghosttys `minimum-contrast` ser inte shaderns utdata, bara cellens bakgrund;
  `background-opacity` kräver omstart på macOS. Allt fyra reglagen gör är
  därför shaderns sak.
- Projektet: middagshimlen dämpas inte i dag; kanten runt texten är redan
  textmedveten (ca 4,9:1) och den naturliga platsen för "veil", som därför
  heter text shade.

## Ej verifierat

- Omladdningens tid och CPU vid 150–300 ms takt i Ghostty 1.4.0, och om den
  förblir flimmerfri.
- Om omladdning når alla öppna flikar (dokumentationen säger ja).
- Om en OSC 4-skrivning ritar om shadern när himlen står still.
- Om palettfärger 17+ syns i Claude Codes utdata.
- Om temana floor/terminal på `teman` ser fel ut med dämpad dagshimmel.
- Om text över ett ljust moln på dämpad himmel får sämre kontrast än i dag
  (molnet är oförändrat, så det borde vara samma; text shade täcker resten).
