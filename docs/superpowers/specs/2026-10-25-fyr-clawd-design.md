# Fyr-Clawd: design

Datum: 2026-10-25. Bygger på Solar Clawd som det ser ut efter commit `b00a429`
(version 0.3.0).

## Avsikt

Ute vid fyren på horisonten bor en liten Clawd med ett eget liv: han springer
upp och ner i tornet, fiskar, surfar på en våg ibland och tittar på stjärnorna
om natten. Någon gång ibland kommer ett ufo, tar upp honom i en grön ljuskägla
och sparkar ut honom en stund senare.

Idén började som ett ufo som rövar bort band-Clawd, men bandet är bara sex
pixlar högt, och shadern vet inte var på skärmen bandet sitter. När allt
händer vid fyren i den stora himlen behövs ingen skarv mellan bandet och
himlen, och ufot kan vara stort och tydligt.

För att han ska synas får fyren en egen scen: en remsa längs fönstrets högra
kant där terminaltexten aldrig når. Det är också en vinst för läsningen,
eftersom raderna blir kortare.

Det ska vara roligt att få syn på. Det ska inte kräva uppmärksamhet och inte
kosta märkbart mer GPU eller batteri än i dag.

## Mål

1. **Fyr-Clawd finns alltid vid fyren** i Ghostty-himlen, i samma
   risografstil som fyren: några få tryckfärger (`INKS`), rasterpunkter och en
   nyckelplåt som ligger lite ur register.
2. **Dagrutin** (en slinga):
   - han traskar på klipporna och fiskar med spö och lina ner i vattnet,
   - han öppnar en dörr i tornets fot, går in och dörren stängs,
   - han dyker upp på galleriet högst upp, går ett varv runt lanternan och
     tittar ut,
   - han går in igen, kommer ut genom dörren och går ner till klipporna,
   - ibland (ungefär var tionde runda) paddlar han ut på en bräda och rider en
     liten våg in mot klipporna.
3. **Nattrutin**, när himlen är mörk:
   - han sitter på galleriet med en liten kikare som långsamt flyttas mellan
     stjärnorna,
   - vid ett **stjärnfall** hoppar han till och pekar dit det föll (stjärnfallen
     räknas redan fram av shadern, `shootingStars` i `hooks/glsl/events.ts`,
     så de går att synka),
   - vid en **synlig ISS-passage** (`ISS_UP`) vinkar han till den,
   - vid **norrsken** (`AURORA` över ett tröskelvärde) ligger han på rygg på
     klipporna och tittar,
   - vid **fullmåne** fiskar han i siluett i månglittret med en liten gul lykta
     som speglas i vattnet,
   - **03–06 lokal tid** sover han i en hängmatta mellan tornet och en påle,
     samtidigt som band-Clawd sover.
4. **Fyren tänds** (`BEACON != 0`, Claude väntar på personen): han går upp och
   står vid lanternan tills den släcks. Det går före allt utom ett pågående
   bortförande.
5. **Ufot**: det glider in över fyren och stannar. En grön ljuskägla
   (`INK_GREEN`, rastrerad) tänds över honom, han lyfts sakta (ungefär 5 s)
   och försvinner in. Efter ungefär 15 s öppnas en lucka och han sparkas ut,
   faller, landar med en studs där han togs och fortsätter. Ufot drar iväg.
   Det kommer oftare på natten än på dagen.
6. **Dörren** i tornets fot är en ny detalj: stängd i tornets färger, mörk när
   den står öppen.
7. **Vågen** att surfa på är en ny detalj: en liten krön som reser sig, rullar
   in mot klipporna och sjunker undan, bara medan han surfar.
8. **Förhandsvisning**: `/solar event` kan spela upp bortförandet (och gärna
   surfningen), så att man slipper vänta.
9. **Scenremsan** (testad, se nedan): `/solar ghostty` ger Ghostty en
   högermarginal på 240 pt (`window-padding-x = 2,240`) så att terminaltexten
   slutar före fyren. Fyren, fyr-Clawd och ufot står på remsan.
   Shadern ritar över hela fönstret, marginalen inräknad.

## Icke-mål

- Ufot i bandet och band-Clawd som rövas bort (den första idén). Band-Clawd
  ändras inte.
- Överlämning mellan bandet och himlen.
- Fyr-Clawd i iTerm2-tapeten eller i bandets egen himmel: fyren finns bara i
  Ghostty-shadern. Där syns han inte, och det är okej.
- Band-Clawd tittar upp när ufot kommer eller ordet "abduction" visas i bandet.
  Det går inte, eftersom bortförandet följer shaderns klocka och sessionen inte
  vet när det sker.
- Mindre text: typsnittets storlek ändras inte.
- Communityteman, `/theme` och ett eget animationsspråk (separata idéer, inte
  den här omgången).

## Anti-mål (gör det här till ett misslyckande även om det fungerar)

- Himlen animerar oftare eller dyrare än i dag, så att GPU- och
  batterikostnaden märks (se Beslut nedan).
- Han syns mitt i ett hopp: försvinner eller dyker upp utan förklaring, eller
  ett bortförande som börjar mitt i, med ufot redan på plats och Clawd borta.
- Han drar blicken till sig medan man arbetar: snabba blinkningar eller stora
  rörelser utanför ufot.
- Platta färger utanför risopaletten (som moln-ufot i bandet har i dag,
  `hooks/sky.ts:513`).
- Scenremsan tar så mycket bredd att terminalen känns trång.

## Begränsningar

- **Shaderns klocka.** Ghostty ger shadern bara `iTime`, som börjar på ett
  okänt ställe och fortsätter även över en omladdning (`hooks/shader.ts:3`).
  Därför:
  - Rutinen är en ren funktion av `iTime` och scenkonstanterna. Varje ögonblick
    ska se rimligt ut, eftersom vilket ögonblick som helst kan bli det första
    man ser.
  - Bortförandet schemaläggs av shadern själv på samma sätt som stjärnfallen:
    en lucka per period ur `floor(iTime / period)`, med slumpad chans och
    starttid. Det får **inte** göras som en vanlig händelse i `EVENTS`, för
    sådana spelas i slinga med okänd fas (`hooks/glsl/events.ts:469`) och kan
    börja mitt i.
  - Bortförandet sker bara när rutinen har honom utomhus (på klipporna eller
    galleriet) under en tillräckligt lång stund. Han landar där han togs, och
    rutinen fortsätter därifrån utan någon tidsförskjutning. Eftersom rutinen
    är en känd funktion av `iTime` kan starttiden läggas i en sådan stund.
- **Ritordning.** Fyren och havet ritas i `beacon()` (`hooks/glsl/sea.ts`), efter
  ISS och före molnen (`hooks/glsl/main.ts`). Fyr-Clawd, dörren, vågen och ufot
  hör hemma där. Moln får gärna glida framför ufot.
- **Kostnad.** Allt ska avgränsas med en tidig utgång när pixeln ligger utanför
  fyrens område (som `basket()` och molnen gör), så att resten av skärmen inte
  kostar något extra.
- **Storlek.** Fyren är ungefär `5 × 0.65 × unit` hög (`beacon()`). Clawd ritas
  i sin logoform (rutnätet i `clawdRows`, `hooks/clawd.ts`) med heltalsstora
  pixlar, ungefär en fjärdedel till en tredjedel av tornets höjd. Han måste
  kännas igen som Clawd i normal fönsterstorlek.
- **Batteriläget** och "borta"-läget låter himlen stå still
  (`animationOf`, `hooks/beacon.ts`). Han ska då se rimlig ut som stillbild.
- **Lokal tid** finns inte i shadern i dag. Hängmattan 03–06 kräver att
  sessionen bakar in timmen (eller ett "sover nu") som en konstant. Scenen
  skrivs ändå om ungefär varannan minut.
- **Scenremsan och Ghosttys config.** Marginalen gäller hela Ghostty, alla
  flikar och fönster, och en ändring biter bara på nya flikar och fönster.
  Mod:ens include-fil skrivs om när innehållet skiljer sig från det mod:en
  räknat fram (`hooks/ghostty.ts:287`), så marginalen måste in i det innehållet
  och inte läggas till för hand. Marginalen anges i punkter medan shadern
  räknar i pixlar, så fyrens placering på remsan måste räknas om därefter
  (i dag står fyren på `0.88 × iResolution.x`).
- **Tester** körs med `claude plugin test .`. Shaderns text testas i
  `hooks/sky.test.tsx`, sessionen i `hooks/session.test.tsx`. Bilder tas med
  `tools/preview/run.sh shader` (flaggor överst i `tools/preview/shader.mjs`).

## Test av scenremsan

Ett kasserbart test i Vincents egen Ghostty-config (märkt `SPIKE`, tas bort
efteråt):

- Texten, prompten och bandet slutar före marginalen, och shadern ritar i den:
  moln, regn, hav och papperskorgen går ända ut till kanten.
- Med `2,180` hamnade fyren (`0.88 × iResolution.x`) precis vid textens kant.
  För lite luft.
- Med `2,240` blev remsan cirka 16 % av fönstret, och raderna var fortfarande
  cirka 165 tecken långa. **Beslut: 240 pt till höger.**
- Skärmdumparna kom fram nedskalade (2000 px breda), men skärmen är en Retina
  med `backingScaleFactor` 2 (3024 × 1964 px, 1512 × 982 pt). Omräknat stämmer
  det: remsan är 240 pt × 2 = 480 riktiga pixlar. Shadern får därför remsans
  bredd i pixlar som `240 × skalfaktorn`, där sessionen frågar macOS efter
  skalfaktorn (på Linux räknas 1). Fyren ska stå mitt på remsan.

## Beslut: himlen animerar inte mer för hans skull

Vincent valde att behålla dagens regel (commit `ada8986`): Ghostty animerar
himlen bara när något livligt pågår (en händelse, regn, en brand, en
time-lapse eller fyrens svep). Annars ritas himlen om bara när terminalen
ändras, i praktiken medan Claude arbetar. Fyr-Clawd räknas **inte** som
livlig. Han rör sig när himlen ändå ritas om, och däremellan står han still.
Nästa gång himlen ritas om har han flyttat sig dit rutinen säger. Ett
bortförande kan ske utan att någon ser det. Det är okej och passar ett ufo.
Därför måste varje ögonblick av rutinen fungera som stillbild.

## Beslut efter granskningen

Vincents:

- **Marginalen finns jämt** när `/solar ghostty` är installerat, oberoende av
  om en Claude-session körs eller om himlen är dold med `/solar`. Annars får
  en ny flik där den första Claude-sessionen startas ingen remsa, eftersom
  marginalen bara biter på nya flikar. Priset är en tom kant på 240 pt i
  vanliga terminalflikar (himlen ritas bara där Claude körs). Marginalen ska
  alltså inte ligga bland de rader som töms när himlen tas ner. Testraden i
  Vincents egen config tas bort när mod:en tar över.
- **Fyren förstoras** nu när den har en egen remsa, så att en igenkännbar
  Clawd (logoformen, 6×4 rutor) får plats på galleriet och genom dörren.
  Fyra gånger dagens storlek provades och blev för dominerande. **Beslut: tre
  gånger** (`s = 3 × 0.65 × unit`), med fyren mitt på remsan (i provet
  `0.92 × iResolution.x`). Clawd blir då cirka 4 px per ruta vid `unit = 20`.

Claudes (kan ändras av Vincent):

- **Hopp när en scenkonstant byts.** Fyrens ljus, natt/dag, norrsken,
  fullmåne, ISS, hängmattan och regn bakas in som konstanter och kommer med en
  omladdning, vars tidpunkt i `iTime` shadern inte känner till. Han hoppar
  därför direkt till sitt nya läge i stället för att gå dit. Det accepteras:
  när fyren tänds är ljuset själv förklaringen, och skiftena mellan dag, natt
  och hängmatta sker bara några gånger per dygn. Rutinerna behöver inte dela
  tidslinje.
- **Havet sträcker sig ut till fönsterkanten**, från där det börjar i dag
  (cirka `0.62 × W`), så att fyren står i vatten mitt på remsan och delfinerna
  är kvar där de syns i dag. Vågen och fiskelinan hamnar på remsan.
- **Månglitter följer den riktiga månen**, som solglittret följer solen. Det
  blir bara glitter under fyren när månen faktiskt står över den delen av
  havet. Hans gula lykta speglas däremot alltid, så nattfisket fungerar ändå,
  och fullmånenatten är det enda som kräver att månen står rätt.

## Lämnat till byggaren

- Exakta sprites, färger ur paletten, takt och längd på varje del av rutinen.
- Hur "var tionde runda" och ufots chans per period slumpas.
- Hur dörren och luckan på ufot ser ut i detalj.
- Vad han gör i regn och snö (förslag: ingen surfing, mer tid på galleriet).
- Hur `/solar event` tvingar fram bortförandet. Förslag: som stjärnfallen, med
  en hög takt så att ett kommer inom en halv minut. Shadern kan inte veta när
  förhandsvisningen började.
- Hur stjärnfallets riktning och plats översätts till vart han pekar.
