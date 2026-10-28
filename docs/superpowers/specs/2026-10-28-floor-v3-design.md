# Börsgolvet v3: NYSE och Wall Street, halva fönstret, en värld med djup

Vincent, 2026-10-28 eftermiddag, efter att ha sett arket för `floor` i runda 2 (`tema-floor-r2`). Den här designen ersätter "Tema 2" i `2026-10-28-tva-teman-design.md` för `floor`. Det som inte nämns här, som kurserna, Claudes aktivitet, väntljuset, kontextfönstret och filmreferenserna, gäller som där.

## Vad Vincent såg och sa

Om runda 2: *"Intressant, jag ser många ställen som behöver ändras utifrån min vision men inte dåligt alls!"* Det han saknade, med hans ord:

- *"Jag tänker att insidan ska vara hela högra sidan så att säga och att utsidan är mer av en stadsmiljö av New York, inte att man ser skyskrapor långt på distans, alltså att det känns som att utsidan är Manhattan, stadskärnan."*
- *"Det känns som att det kanske saknas lite detaljer på bägge sidorna."* och *"lite karaktär och mysighetskänsla på bäggesidorna också."*
- *"Ja ungefär halva, och kör NYSE och Wall Street. Jag kan också tänka mig att vi använder även nedre halvan på högra sidan för att kunna få mer plats för visionen. Det kanske också saknas lite djup i designen just nu."*
- *"Då kan också alla Clawd gå runt som att det är en värld i lite mer av en 3D-miljö än en 2D-miljö. Allt kändes väldigt 2D på bilderna du skickade så att säga."*

Han gav sex referensbilder. De ligger lokalt i `.preview/ref-floor/` och committas inte, eftersom de är andras foton:

1. `1-golvet-ovanifran.jpg`: NYSE:s golv snett ovanifrån från en läktare, med åttakantiga poster i rader, skärmkransar, NYSE-skyltar, flaggor, kablar och klungor av folk på ett ljust golv.
2. `2-golvet-posterna.jpg`: samma golv, nyare. Runda poster med skärmband, hängande svarta NYSE-kuber med flaggor, trägolv, barstolar och valvfönster längst bak.
3. `3-fasader-skyltar.jpg`: Beaver Street, med tegel- och sandstensfasader och skyltar (PIZZA, TRADER'S EXPRESS DELI, CHECKS CASHED, WESTERN UNION), markiser och glastorn bakom.
4. `4-gatan-perspektiv.jpg`: en gata i Financial District i perspektiv mot en flyktpunkt, med gula taxibilar, folk och en hörnbyggnad med rotunda.
5. `5-stone-street-kvall.jpg`: Stone Street en regnig kväll, med ljusslingor över gatan, kullersten som blänker, brandtrappor och varma skyltfönster. Det är mysigheten.
6. `6-wall-street-washington.jpg`: Wall Street från Federal Hall, med Washington-statyn i förgrunden, flaggor, NYSE:s kolonner och matvagnar.

## Bilden

**Halva fönstret.** Insidan syns över ungefär den högra halvan, och terminalens text får den vänstra (hur bredderna fördelas står under "Det som ändras i motorn"). Vincent sa redan i natt att texten gärna får bli mindre om världen syns mer.

**Djup, inte en remsa: en värld i 2,5D.** Båda sidorna ritas med perspektiv:
- saker blir mindre och disigare ju längre bort de är
- det närmaste överlappar det bakre
- figurerna rör sig på ett golv eller en gata som har djup och går inte bara längs en linje

Det motsvarar "snett ovanifrån" på bild 1 och gatan mot flyktpunkten på bild 4.

**Insidan, höger halva och hela höjden.**
- **Bakväggen** ligger överst och längst bort: höga valvfönster mot himlen (`themeWindow` > 0 i rutorna, så att himlen och vädret syns i dem) och en stor amerikansk flagga. Hängande NYSE-kuber med skärmar och flaggor sitter under taket.
- **Handelsposterna** står i rader som går bakåt. De är åttakantiga eller runda, med ett band av skärmar runt om och armar med skärmar uppåt, och de är numrerade som på bilderna (10, 11 och så vidare). Kurserna sitter här: på posternas skärmband, på kuberna och på tavlorna mot bakväggen. Kurstavlan är inte längre det stora elementet.
- **Golvet** är ljust trä i perspektiv och fyller nedre halvan av fönstret. Där finns papperslappar, kablar och barstolar.
- **Clawdarna** är traders i rockar i olika färger, med headset och telefoner. De går mellan posterna, står i klungor och ropar. De är större nära och mindre längre bort, och de skyms av posterna när de går bakom dem. Huvud-Clawd har en egen plats nära betraktaren, så att man hittar honom utan att leta.

**Utsidan, vänster halva bakom texten: Manhattan i gatuhöjd, låg gata och fri himmel** (Vincents val 2026-10-28: "Låg gata, fri himmel"). Fasaderna går upp till ungefär en tredjedel av vänstra halvans höjd, och glastornen bildar en låg kant mot himlen. Himlen, solen, månen och vädret hålls fria ovanför. När insidan är bred lägger motorn solens och månens bana över vänstra halvan (fyr ändras inte).
- **Wall Street i perspektiv mot en flyktpunkt vid horisonten.** Sandstens- och tegelfasader står på båda sidor, med fönster, brandtrappor, skyltar (PIZZA, DELI, CHECKS CASHED), markiser och flaggor. Glastorn syns ovanför, mot himlen.
- **Gatan:** kullersten och trottoar, gula taxibilar, matvagnar och folk som går, alla mindre ju längre in de är.
- **Washington-statyn och Federal Hall** står i förgrunden vid entrén. Charging Bull får finnas kvar om den får plats, men den står egentligen vid Bowling Green.
- **Entrén** är NYSE:s kolonnfasad med den stora flaggan. Den ligger vid gränsen mellan halvorna, och golvet syns därinne genom den.
- **Mysigheten:** ljusslingor över gatan på kvällen, varma skyltfönster och kullersten som blänker i regn (`PRECIPITATION`). Fönstren tänds med `LOCAL_HOUR`.
- **Texten måste gå att läsa.** Fasaderna bakom texten hålls mörka, disiga och lågkontrastiga, med ljusregeln från guiden. Den mest detaljrika delen av utsidan ligger nära entrén och längst ner, där texten oftast inte når.

**Karaktär överallt:** små saker som händer på båda sidor. En duva på statyn, en taxi som tutar när ett kommando körs, en matvagn som ångar på morgonen, en städare på golvet efter stängning, kaffe på posterna. Mer av det och mindre tom yta.

## Det som ändras i motorn och guiden

- **Remsans bredd och rummets bredd är två olika saker** (researchen 2026-10-28, Ghostty v1.4.0-koden).
  - **Vad researchen visade:**
    - Marginalen (`window-padding-x`) är ett heltal i punkter som varje split-ruta får för sig själv.
    - Det finns ingen procentform, ingen villkorlig config efter storlek, ingen escape-sekvens och ingen AppleScript-väg för att ändra den per ruta.
    - En ändrad marginal når bara nya terminaler, medan shadern byts i alla direkt.
    - `iResolution` är rutans hela storlek med marginalen inräknad.
  - **Vad det betyder i kolumner:** med 600 pt får en split sida vid sida eller ett halvskärmsfönster ~19 kolumner, under de ~25–40 där Claude Codes gränssnitt rapporteras gå sönder. Med 760 pt blir det 0 kolumner. Rekommendationen ~600 pt ändras alltså till det bättre, som Vincent bad om:
  - **Marginalen** blir 400 pt för `floor`, inom dagens tak på 480. Helskärm behåller ~138 kolumner och en split ~44.
  - **Rummet** ritas ut till ungefär halva rutan (`max(STAGE_PX, 0.5 × iResolution.x)`) när rutan är bred, alltså helskärm eller ett brett fönster. I en smal ruta stannar det inom marginalen.
  - **Delen av rummet som ligger under texten** (ungefär den sista sjättedelen av vänstra halvan) är entrén: NYSE:s kolonnfasad, statyn och dörrarna. Den hålls lugn och tonas ner där terminalen har text, som himlen redan gör. Golvet med posterna och folket ligger i marginalen, där ingen text når.
  - **Overifierat, domaren och Vincent avgör:** att texten går att läsa över entrén, med prosa, tabeller och kod.
  - En ändrad bredd når bara nya flikar. README säger det.

  Fyr står kvar på 240.
- **Solens och månens bana** läggs över vänstra halvan när remsan är bred. Fyrs paritet ska vara oförändrad.
- **Fonten:** M, N och W får en bredare variant som en egen funktion, så att NDX, MSFT, NVDA, AMZN och META går att läsa (domarens fynd från runda 2). Dagens 3×5 och `sky_glyph` lämnas orörda, så att `terminal` och guidens exempel inte rubbas. *(Mitt beslut.)*
- **Från domaren, om författaren behöver det:**
  - en signal för New Yorks veckodag eller handelsdag
  - en rotationsprimitiv
  - att arket har en bild med öppen börs en vardag
- **Guiden får ett avsnitt om 2,5D.** Det beskriver hur man ritar ett golv i perspektiv i en shader utan att loopa över figurer:
  - golvets celler hashas i golvkoordinater (x, djup), som man får fram genom att räkna baklänges från perspektivet
  - några djupband ritas bakifrån och fram, så att det närmaste hamnar överst
  - figurernas storlek följer djupet
  - kostnaden hålls inom bench-kvoten 1,25 × fyr

## Mina beslut efter granskarens frågor

- **Efter stängning står golvet inte tomt.** Där finns en sen trader vid en post, städare med moppar, kryptobordet som lever dygnet runt och dämpat varmt ljus. Mysigheten gäller även kvällar och helger, eftersom börsen är stängd större delen av veckan.
- **Det mest detaljrika ute** (statyn, Federal Hall, matvagnen, taxikön) står närmast entrén och längst ner, närmast gränsen mot insidan. Längre ut åt vänster, där texten alltid ligger, är fasaderna enklare och lågkontrastiga.
- **Temats tak står kvar på 80 KB**, eftersom varje flik kompilerar hela shadern. Djupet ska komma från hashade celler och djupband, inte från mer kod.
- **Bygget:** motorändringarna först, sedan en författare, en domare och en rättningsrunda. Därefter får Vincent arket.

## Mål

- Halva fönstret inne, hela höjden. Golvet ses snett ovanifrån med poster och folk i perspektiv, och Wall Street ute i gatuhöjd.
- Att det läses som NYSE och Wall Street på fem sekunder, och att det har djup, detaljer och mysighet. Vincent avgör det med ögat. Domaren bedömer det mot referensbilderna.
- Samma hårda krav som förut: lint rent, kompilerar, bench ≤ 1,25 × fyr, texten läsbar och väntljuset läsbart.
- Arket skickas till Vincent.

## Icke-mål

- Fotorealism. Det är fortfarande husstilen, med risograf, bläck och raster, bara med djup.
- Riktig 3D-rendering, alltså raymarching. 2,5D med perspektiv räcker och är billigare.
- `terminal` får inte samma behandling nu. Det tar vi efter att Vincent sett `floor` v3.

## Process

Detta är inte längre ett blindtest av guiden, utan att bygga Vincents vision. Författaren får guiden, det här dokumentet och referensbilderna, och får läsa `tema-floor-r2`:s tema som utgångspunkt. Det som är bra där ska behållas: väntljuset, kurserna på tavlor, aktivitetens BUY/SELL och agenterna i gula rockar. En domare jämför med referensbilderna och Vincents ord ovan. Motorändringarna görs före författaren, på en gren från `teman`.

## Lämnas åt byggaren

Exakt bredd, hur många poster och djupband som får plats inom kostnaden, vilka detaljer och händelser som kommer med, och hur Clawdarnas rörelse mellan posterna schemaläggs med `iTime`, så att varje ögonblick fortfarande är en stillbild.
