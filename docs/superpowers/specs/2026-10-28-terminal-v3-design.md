# Flygplatsen v3: gaten snett uppifrån, utsidan som den är

Vincent, 2026-10-28 eftermiddag, efter att ha sett `terminal` från runda 2 (`tema-terminal-r2`, godkänd av domaren, bench 1,06 × fyr). Den här designen ändrar insidan av "Tema 1" i `2026-10-28-tva-teman-design.md`. Allt annat gäller som där:
- Claudes aktivitet
- väntljuset
- kontextfönstret som väskor
- The Terminal med Viktor, gate 67 och KRAKOZHIA

## Vad Vincent sa

- *"Ja, här funkar utsidan perfekt tycker jag! Men det kanske behövs lite samma tänk som vi har gjort med insidan här nu på NYSE-designen. Så det känns mer levande, har djup och blir mer '3D' in lack of a better word. … Jag tror det hade passat den designen också."*
- Om skissen: *"Yes det ser bra ut så länge! Ta gärna inspiration från riktiga flygplatser!"*

Skissen ligger i `2026-10-28-terminal-v3/skiss-dag.png` och `skiss-kvall.png`. Generatorn är `2026-10-28-floor-v3/skisser.py` (`scene_airport`). Utsidan i skissen är bara en stand-in.

## Bilden

**Utsidan behålls som i runda 2:** banan med banljus, tornet och planen som lyfter och landar lågt vid horisonten bakom texten, `sky_under` som håller den inte ljusare än himlen, och planet vid jetbryggan. Den rörs bara där jetbryggan nu ska möta västra väggen.

**Insidan ses snett uppifrån, som `floor` v3** (`2026-10-28-floor-v3-design.md`). Ingen flyktpunkt: golvet ses uppifrån, och saker rakt framifrån med toppen synlig. Det som står lägre ritas över. Uppifrån och ner:
- **Innertaket:** stålfackverk och takfönster där himlen syns. På kvällen tända lampor.
- **Bakväggen** är en hel glasvägg mot plattan, med `themeWindow` > 0 så att himlen och vädret syns. Genom den syns planets nos vid gaten.
- **Framför glaset** hänger avgångstavlan med fällblad (67 CLAUDE, 12 KRAKOZHIA DELAYED och så vidare) och gate 67-skylten, där väntljuset bor.
- **Golvet:**
  - en mönstrad matta sedd uppifrån
  - stolsrader där resenärs-Clawdar sitter
  - andra som går med väskor i alla riktningar
  - Viktors hörna vid gate 67 med filten och Planters-burken
  - kaffekiosken
- **Längst fram:** bagagebandet som en slinga sedd uppifrån, där väskorna är kontextfönstret.
- **Västra väggen** är ett snitt där jetbryggan kommer in, och där resenärer kliver av och på.

**Inspiration från riktiga flygplatser** (Vincents önskan). Författaren väljer och får hitta fler:
- **Gate-disken med personal**, och en kö mellan bandspärrar med skyltar som "GROUP 1" och "GROUP 2". Boardingen kan vara det som händer när en subagent startar.
- **Rullband** och laddstolpar vid stolarna.
- **Barn med näsan mot glaset** som tittar på planen.
- **Mattor som är kända i sig**, som Portlands (PDX) mönstrade matta.
- **En inomhusträdgård** som Changis, eller TWA Flight Centers mjuka sextiotalsformer, som accent.
- **Markpersonal och fordon** syns genom glaset: bagagevagnar, en tankbil och en marshall med lysande käppar på kvällen.
- **Utrop och skyltar:** piktogram för toaletter och utgångar, och en klocka.

**Kommandot ska synas i hela bilden** (domarens fynd i runda 2: det var ett litet sken i ett hörn). Ett exempel är att bagagebandet startar och väskor åker runt, och att en utropslampa blinkar.

**Viktor** ska gå att hitta också när han sover. Han ska få en egen färg eller plats som skiljer honom från stolsryggarna.

## Bredden, motorn och processen

Som `floor` v3:
- **Bredd:** 440 pt som i runda 2, och författaren får välja 400–480.
- **Utgångspunkt:** `tema-terminal-r2`. Det som är bra där ska behållas: väntljuset, aktiviteternas platser, KRAKOZHIA-tavlan och utsidan.
- **Bygget:** en författare, en domare och en rättningsrunda, sedan arket till Vincent. Bench ≤ 1,25 × fyr.

## Icke-mål

- Att göra om utsidan.
- Riktig 3D.
- Ett blindtest av guiden. Detta är Vincents vision.
