# Två teman i ett skott: flygplatsen och börsgolvet

Vincent, natten 2026-10-28. Det här är arbetsplanens F7 (`docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`) med Vincents två teman i stället för köket och taket. F7 säger hur temana prövas: en THEME-GUIDE som är hela prompten, en färsk författare per tema, domare, en lärfas som rättar guiden och inte temat, och sedan en runda till. Vincents instruktioner säger vad temana är.

## Varför

Vincent vill ha två nya teman, och han vill veta om metoden håller: kan en agent som bara har guiden och ett stycke text skriva ett tema i ett svep? Temana är målet och experimentet på samma gång. Om guiden räcker kan andra skriva teman utan att läsa motorn (F8).

## Vincents svar (2026-10-28, före natten)

- **Två rundor**, som F7 säger (ungefär 17 agenter i en workflow).
- **Live-kurser: ja**, byggda i motorn före temat. Datorn hämtar dem från ett gratis-API utan nyckel ungefär var 5:e minut. Börskurserna får vara fördröjda.
- **Insidan bredare än dagens 240 pt.** Med Vincents ord: *"Kanske bredare, du får avgöra själv efter hur själva bygget ser ut och blir. Jag är öppen för att texten blir mindre och att man får se mer av världen om du också tycker det blir bra med dessa teman."* Bredden bestäms per tema.
- **En ny signal för vad Claude gör just nu: ja** (verktyg och subagenter), byggd före temana.
- Från första meddelandet: *"Var kreativ och ta egna beslut där du känner att det känns logiskt och passar."*

## Gemensamt för båda: ute till vänster, inne till höger

Vincents idé: himlen, solen, månen och vädret ligger kvar till vänster, och det är utsidan. Till höger är temat, och det är insidan. Mellan dem finns en entré som är logisk för temat. Insidan syns alltid. Ute och inne syns alltid samtidigt, med en tydlig och naturlig gräns.

I motorn betyder det att scenremsan till höger är insidan och entrén står vid remsans vänstra kant. Utsidan får synas lågt vid horisonten bakom texten (stadssiluett, landningsbana), med det dis och de ljusregler som håller texten läsbar. `themeWindow` är 0 inne, utom där insidan har fönster mot himlen, och 1 ute: regnet faller utanför och inte över gaten.

## Tema 1: `terminal`, flygplatsen

Ordleken: en flygplatsterminal i Claude Codes terminal.

- **Ute:** en landningsbana vid horisonten med banljus som tänds i skymningen. Plan landar och lyfter längs horisontlinjen, och ett flygledartorn står vid entrén. På vintern avisar en avisningsbil ett plan när det är minusgrader och nederbörd.
- **Entrén:** gatens höga glasvägg mot plattan, med en jetbrygga (fingret) som går ut genom väggen till ett plan vid gaten.
- **Inne:** gateområdet med stolsrader, en avgångstavla (fällbladstavla), ett bagageband, ett fönster mot himlen, en kaffekiosk och golvglans.
- **Clawdar som väntar på olika plan.** Huvud-Clawd är temats `resident`. Fler Clawdar sitter vid gaten, olika till utseende, och deras antal och plats hashas per stol. De följer det Claude gör:
  - en subagent startar: en Clawd reser sig, går ut genom bryggan och ett plan lyfter
  - ett kommando körs: bagagebandet går
  - Claude söker eller läser: någon letar i hittegodset
  - Claude redigerar: en städare moppar
  - Claude frågar (`WAITING` asking): gatens lampa och tavlans rad blinkar orange, "NOW BOARDING"
  - Claude är klar (done): en stadigt vit "LANDED" eller "ARRIVED"
  - frågan har väntat länge (urgent): sista utropet, blinket snabbare
- **Kontextfönstret:** väskor på bagagebandet, en för varje tiondel. När konversationen kompakteras eller rensas hämtar en bagagevagn dem.
- **The Terminal (2004):** huvud-Clawd bor vid gate 67 som Viktor Navorski. Han sover på stolarna med `CLAWD_ASLEEP`, äter kex med ketchup och senap (kaffet i `CLAWD_ACTIVITY`) och har en burk Planters-nötter. På tavlan står alltid en avgång till KRAKOZHIA som DELAYED, och den slår ibland om till CANCELED. Någon gång samlar han in bagagevagnar för kvartsdollarns pant.
- **Tid och väder:** natten har få avgångar, ett nattflyg och städare. På dagen är det fullt vid gaten. I regn är plattan blöt.
- **Egna händelser (förslag, författarens val):** ett Concorde-förbiflyg (sällsynt), en A380 som landar, ett fågelsträck över banan. Previews: Viktors fontän, vagnarna.

## Tema 2: `floor`, börsgolvet

- **Ute:** New Yorks silhuett vid horisonten med fönster som tänds med `LOCAL_HOUR` och `night()`, hashade per cell och aldrig i en loop. Charging Bull får gärna stå på trottoaren.
- **Entrén:** Nasdaq MarketSites runda torn vid Times Square med sin böjda LED-vägg, som blir fasaden man kliver in genom. Tickerbandet löper runt hörnet.
- **Inne:** det klassiska handelsgolvet från filmer och dokumentärer, med pit, telefoner, skärmar, lappar som singlar ner och rockar i olika färger. Det är många trader-Clawdar som ser olika ut i rock, glasögon, headset och hållning, en folkmassa hashad per cell.
- **Riktiga kurser (nya motorsignaler):** BTC, ETH, Nasdaq-100 och Mag 7 (AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA). Temat visar dem som ett tickerband och en värmekarta i grönt och rött, med en rad per symbol där det finns plats. Börsen är öppen 09:30–16:00 i New York: då står öppningsklockan och stängningsklockan i scenen. Efter stängning är golvet tomt, men krypto-tavlan lever dygnet runt.
- **Det Claude gör:**
  - ett kommando körs: golvet ropar och armarna går upp
  - subagenter: en trader till på golvet för varje agent som är igång
  - Claude frågar: en orange haltlampa eller klockan som ringer
  - Claude är klar: vit "FILLED"
  - urgent: snabbare blink
- **Kontextfönstret:** papperslappar på golvet, en hög per tiondel. När konversationen kompakteras sopar en städare.
- **Filmreferenser:** *The Wolf of Wall Street*, en Clawd som dunkar sig i bröstet och nynnar. *Wall Street*, Gekkos tegelstenstelefon. *The Big Short*, ett Jenga-torn som rasar när Nasdaq-100 är ner mer än 2 %. Författaren väljer bland dem och kan hitta på fler.
- **Egna händelser (förslag):** öppnings- och stängningsklockan, konfetti vid ny all-time high för BTC (om signalen räcker), Jenga.

## Motorn före temana (grenen `teman`)

Det som byggs i motorn före guiden, eftersom temana annars inte kan göra det Vincent bad om. Varje nytt namn i shadern får prefixet `sky_` (kontrakt 1).

1. **Kurserna.** Motorn hämtar BTC, ETH, Nasdaq-100 och Mag 7 i `hooks/net.ts` med `$.http.fetch`, från ett API utan nyckel som researchen väljer och provar med riktiga anrop. Den hämtar högst var 5:e minut, cachar i `$.store`, och när hämtningen misslyckas får temat det senaste värdet eller ingenting, aldrig ett fel. Signalerna är pris och dygnsförändring per symbol, om börsen i New York är öppen, och om värdena är färska.
2. **Vad Claude gör.** Signalen är den senaste verktygssorten (kommando, redigering, sökning/läsning, webb, annat, inget) och hur många subagenter som är igång, satt från moddens hooks på verktygsanrop (läs `plugin-authoring`-skillen). **Kravet är kostnaden:** shadern skrivs om och laddas om i varje flik när en konstant ändras, så signalen får inte ge fler omladdningar än i dag. Researchen avgör kanalen: flikens markering (som `WAITING` redan går genom) om den bär det, annars kvantiserat så att verktygsbyten ger högst en omladdning per scen-tick som ändå sker.
3. **Bredare insida.** Manifestet får säga scenremsans bredd i punkter, inom ett tak, och `/solar ghostty` och configraden följer det aktiva temat. Fyr behåller 240.
4. **En liten glyftabell.** Båda temana vill ha text (avgångstavlan, tickerbandet). F7 räknade det som en motorlucka: en packad bitmapsfont (siffror, A–Z och några tecken) som en primitiv `sky_glyph`, med kostnaden mätt i benchen.

Det får inte ändras: fyrs paritet (`tools/preview/parity.sh check` mot baslinjen) och de 146 testerna, utom där en ändring är deklarerad. `tsc` ska vara ren. Inget av det mergas till `main` medan Vincent sover.

## Guiden och protokollet

Som F7, med följande ändringar:

- `fable` ersätts av Opus 5.5 med samma effort (modellpolicyn i HANDOFF).
- Guiden skrivs efter motorgrenen, så att signalerna, glyferna och remsbredden står i den.
- Författarna skrivs i community-form (`themes/<namn>/manifest.json` och `theme.glsl`) på var sin gren och läser bara guiden och sitt stycke (variant A).
- Domarnas rubrik är F7:s, plus att ute och inne och entrén läses på fem sekunder, och att temat svarar på kurser och verktyg i arken.

## Mål

- Båda temana lintar rent, kompilerar, ligger inom taken (80 KB tema, 224 KB shader, bench-kvot ≤ 1,25 × fyr) och har `sheet.sh`-ark som Vincent kan titta på på morgonen.
- Guiden finns med `hooks/guide.test.tsx`, och anteckningarna `docs/superpowers/notes/one-shot-round-1.md` och `-2.md` säger vad guiden behövde.
- Inget är mergat till `main` eller pushat. Temana blir inbyggda först efter att Vincent sett dem.

## Icke-mål

- `/solar theme`-växlingen och community-repot (F8).
- Push. Nya rättigheter i `.claude/` eller `~/.claude/settings.json`.

## Det som lämnas åt byggarna

API:t för kurserna, signalernas exakta form och kanal, remsans bredd per tema (författaren föreslår, domaren bedömer läsbarheten), vilka filmreferenser och händelser som kommer med, och clawdarnas utseende.
