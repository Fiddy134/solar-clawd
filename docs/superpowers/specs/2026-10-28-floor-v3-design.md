# Börsgolvet v3: NYSE snett uppifrån, med himlen kvar till vänster

Vincent, 2026-10-28 eftermiddag, efter att ha sett arket för `floor` i runda 2 (`tema-floor-r2`) och sju omgångar skisser. Den här designen ersätter "Tema 2" i `2026-10-28-tva-teman-design.md` för `floor`. Det som inte nämns här, som kurserna, Claudes aktivitet, väntljuset, kontextfönstret och filmreferenserna, gäller som där.

## Vad Vincent sa, i ordning

Om runda 2: *"Intressant, jag ser många ställen som behöver ändras utifrån min vision men inte dåligt alls!"*

- *"Jag tänker att insidan ska vara hela högra sidan så att säga och att utsidan är mer av en stadsmiljö av New York … Det känns som att det kanske saknas lite detaljer på bägge sidorna … lite karaktär och mysighetskänsla."*
- *"Ja ungefär halva, och kör NYSE och Wall Street. … Det kanske också saknas lite djup i designen just nu."*
- *"Då kan också alla Clawd gå runt som att det är en värld i lite mer av en 3D-miljö än en 2D-miljö. Allt kändes väldigt 2D."*
- Om skisserna med flyktpunkt: *"Jag tror perspektivet kanske blir lite fel nu."* Om en gata i perspektiv bakom texten: *"i detta perspektiv så blir det nog alldeles för svårt att läsa. Ett exempel på perspektiv jag kom att tänka på är mer som Stardew Valley eller Pokémon Ruby."*
- **Det slutliga beslutet:** *"Kanske är det faktiskt bättre att bara fokusera på den högra sidan som vi har i temat just nu och att det andra blir mer 'tomt' som det är just nu. Jag tänker som versionen nu som du gjorde och att man har kvar lite trottoar bredvid byggnaden och det perspektivet samt där inne men att man tar bort det vi tänkte som 'utsida', det kanske blir för mycket som händer och blir svårt att faktiskt fokusera på Claude Code då."*

**Referenser:**
- Vincents sex foton ligger lokalt i `.preview/ref-floor/` och committas inte, eftersom de är andras: NYSE:s golv från läktaren, posterna och kuberna, Beaver Street, en gata i Financial District, Stone Street en kväll och Wall Street med Washington.
- Den skiss han valde är version 8 (version 7 med innertak): `2026-10-28-floor-v3/skiss-dag.png` och `skiss-kvall.png`. Generatorn ligger i `skisser.py`.
- Skisserna är kompositionen, inte stilen. Husstilen gäller.

## Bilden

**Vänstra delen är himlen som i dag.** Ingen gata, inga fasader och ingen silhuett bakom texten. Claude Codes text ska vara det man fokuserar på där.

**Högra delen är NYSE snett uppifrån, som i Stardew Valley och Pokémon Ruby.**
- **Vinkeln:** ingen flyktpunkt. Marken och golvet ses uppifrån, och väggar och saker rakt framifrån med toppen synlig.
- **Djupet** kommer av att det som är närmare står lägre och ritas över det bakre.
- **Clawdarna** går på golvet i alla riktningar, som i en värld och inte längs en linje. Det är svaret på "för 2D".

Uppifrån och ner:
- **Innertaket:** salens förgyllda kassettak, sett inifrån, når ända upp till fönstrets överkant. Det är ingen gavel eller utsida (Vincent: *"jag tänker att vi försöker göra mer av ett innertak istället för att behöva visa det som en utsida. Man har kvar fönster som det är men att toppen blir som ett innertak"*). På kvällen hänger tända lampor i taket.
- **En fris med NEW YORK STOCK EXCHANGE** på bakväggen, precis under taket.
- **Bakväggen inifrån:**
  - höga valvfönster mot himlen (`themeWindow` > 0 i rutorna, så att vädret syns där)
  - den stora flaggan
  - NYSE-kuber som hänger i vajrar och ritas som lådor med topp och front
  - ett tickerband i fotlisten
  - väntljuset (HALT och FILLED) mitt på väggen
- **Golvet:**
  - **Plankor sedda uppifrån**, i ett rutnät.
  - **Handelsposterna** i rader med topp och front: skärmar på toppen, ett band av skärmar runt fronten och nummerskyltar. Kurserna sitter på posternas skärmar och kuberna.
  - **Traders** i rockar som står i klungor och går mellan posterna, och papperslappar på golvet.
  - **Huvud-Clawd** vid sin pulpet med grön bankirlampa längst fram, så att man hittar honom.
- **Västra väggen** är en tjock mur i snitt, med en dörröppning ut mot trottoaren.
- **Trottoaren** är en smal remsa längs muren, utanför byggnaden:
  - plattor, lyktor (tända på kvällen) och flaggor på stänger
  - Washington-statyn
  - Clawdar som går till och från dörren, och en som just går in

**Mysigheten:**
- **På kvällen:** varmt ljus i salen, tända lyktor och en dörr som lyser ut på trottoaren.
- **Efter stängning** står golvet inte tomt. Där finns en sen trader vid en post, städare med moppar, kryptobordet som lever dygnet runt och dämpat ljus.
- **Detaljer som händer:** kaffe på posterna, en duva på statyn, en budbärare i dörren.

## Läses som

Föreslagen av Claude ur skisserna och designen, godtagen av Vincent 2026-10-29 ("Känns som en rimlig lista"). Domaren dömer efter den, byggaren bygger mot den, och vid en senare ändring prövas den igen. **Bärande** rader underkänner temat om de inte håller; de övriga är rättningspunkter. Vilka rader som är bärande är Claudes förslag och ännu inte prövat av Vincent. *(design)* betyder att raden kommer ur designen och inte syns i skissen.

**Hela bilden, på fem sekunder (ram 01)**
1. **Bärande.** Högra halvan läses som NYSE:s handelsgolv, inifrån och snett uppifrån. Inte ett kontor eller en lagerlokal.
2. Vänstra delen läses som himlen, orörd. Inget drar blicken dit från texten.
3. **Bärande.** Salen har djup: det som är närmare står lägre och framför det bakre. Den känns inte som 2D.
4. Det känns levande och mysigt, inte tomt eller sterilt.

**Salen, uppifrån och ner**
5. Taket är ett förgyllt kassettak sett inifrån. Ingen gavel och ingen fasad.
6. Frisen säger NEW YORK STOCK EXCHANGE och går att läsa.
7. Valvfönstren är höga fönster mot himlen, och vädret syns i dem.
8. Flaggan är den amerikanska och hänger på bakväggen.
9. **Bärande.** Kuberna är NYSE:s hängande kuber, lådor med topp och front. De ska inte se ut som platta skyltar.
10. Tickerbandet är ett kursband längs fotlisten, med pilar upp och ner.
11. HALT och FILLED är Claudes väntljus och får inte kunna förväxlas med tickerbandet.
12. Golvet är ett trägolv i plankor, sett uppifrån.
13. **Bärande.** Posterna är handelsposter med skärmar, inte skrivbord, och kurserna syns på dem.
14. **Bärande.** Folket är traders i klungor som rör sig mellan posterna åt alla håll, inte längs en linje.
15. Lapparna är papper slängda på golvet, inte brus.
16. **Bärande.** Huvud-Clawd står vid pulpeten längst fram med den gröna bankirlampan, och man hittar honom först av alla.

**Väster om salen**
17. Muren är en tjock vägg i genomskärning, med en dörröppning.
18. Trottoaren är en gångväg utanför byggnaden och läses inte som en del av salen.
19. Flaggorna sitter på stänger ut från fasaden, och lyktorna är gatlyktor.
20. Statyn är Washington på sin sockel.
21. Clawdarna vid dörren är på väg in eller ut.

**Kvällen och efter stängning**
22. Lamporna i taket är tända och salen har varmt ljus.
23. Lyktorna är tända och dörren lyser ut på trottoaren.
24. Golvet står inte tomt efter stängning: där finns en sen trader, städare och kryptobordet *(design)*.

**Öppna frågor till Vincent:**
- I skissen är folket koralla Clawdar med färgade rockar. Är traderna Clawdar i rockar, eller ska det finnas andra figurer också?
- Den lilla NYSE-skylten nere på muren: är det en skylt vid dörren, eller bara skissens markering?
- Clawden längst ner till vänster på trottoaren: står han där med avsikt?

## Bredden

Researchen 2026-10-28, i Ghostty v1.4.0-koden, visade:
- Marginalen (`window-padding-x`) är ett heltal i punkter som varje split-ruta får för sig själv.
- Det finns ingen procentform, ingen villkorlig config efter storlek och ingen väg att ändra den per ruta.
- En ändrad marginal når bara nya flikar.

Med 600 pt skulle en split få ~19 kolumner, och med 400 pt ~44. Nu när vänsterdelen är tom behövs inget rum som ritas ut under texten. **Hela byggnaden står i marginalen**, och trottoarremsan ligger precis vid marginalens kant, under de sista kolumnerna av texten, där plattorna är lugna. Bredden blir 400 pt, och författaren får gå upp till 480 om salen behöver det. Fyr står kvar på 240. En ändrad bredd når bara nya flikar, och README säger det.

## Motorn och guiden

- **Fonten:** M, N och W får en bredare variant som en egen funktion, så att NDX, MSFT, NVDA, AMZN och META går att läsa (domarens fynd från runda 2). Dagens 3×5 och `sky_glyph` lämnas orörda, så att `terminal` och guidens exempel inte rubbas. *(Mitt beslut.)*
- **Från domaren, om författaren behöver det:**
  - en signal för New Yorks veckodag eller handelsdag
  - en rotationsprimitiv
  - att arket har en bild med öppen börs en vardag
- **Guiden får ett avsnitt om vyn snett uppifrån:**
  - golvet som ett rutnät som hashas per ruta
  - saker som lådor med topp och front
  - att det som står lägre ritas över, genom några rader som ritas bakifrån och fram utan att loopa över figurer
  - att den här vyn är billigare än perspektiv, eftersom den inte kräver någon perspektivräkning

  Kostnaden ska hållas inom bench-kvoten 1,25 × fyr.

## Mål

- NYSE snett uppifrån i marginalen, med trottoaren längs muren och Clawdar som rör sig i salen och genom dörren. Himlen är orörd till vänster.
- Att det läses som NYSE på fem sekunder, och att det har djup, detaljer och mysighet. Vincent avgör det med ögat. Domaren bedömer det mot skissen, Vincents ord och listan under "Läses som".
- Samma hårda krav som förut: lint rent, kompilerar, bench ≤ 1,25 × fyr, texten läsbar och väntljuset läsbart.
- Arket skickas till Vincent.

## Icke-mål

- En utsida, gata eller stad bakom texten. Vincent valde bort det.
- Fotorealism och riktig 3D. Det är fortfarande husstilen, med risograf, bläck och raster.
- `terminal` får inte samma behandling nu. Det tar vi efter att Vincent sett `floor` v3.

## Process

Detta är inte längre ett blindtest av guiden, utan att bygga Vincents vision.
- **Författaren** får guiden, det här dokumentet, skissen och Vincents foton, och får läsa `tema-floor-r2`:s tema som utgångspunkt. Det som är bra där ska behållas: väntljuset, kurserna, aktivitetens BUY/SELL och agenterna i gula rockar.
- **Motorändringarna** görs först, på en gren från `teman`.
- **Sedan** en författare, en domare och en rättningsrunda. Därefter får Vincent arket.
- **Temats tak står kvar på 80 KB**, eftersom varje flik kompilerar hela shadern.

## Lämnas åt byggaren

Exakt bredd mellan 400 och 480, hur många poster och rader som får plats inom kostnaden, vilka detaljer och händelser som kommer med, och hur Clawdarnas rörelse på golvet schemaläggs med `iTime`, så att varje ögonblick fortfarande är en stillbild.
