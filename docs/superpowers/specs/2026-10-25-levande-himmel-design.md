# Levande himmel: design

Datum: 2026-10-25. Bygger på Solar Clawd som det ser ut efter commit `3a02a2d`
(Ghostty-shadern, events, bandet, iTerm2-tapeten).

## Avsikt

Himlen bakom terminalen är vacker men står bredvid arbetet. Den här omgången
gör den levande och användbar:

- den säger till när Claude väntar på dig (det viktigaste: i dag märker
  Vincent det ofta inte på flera minuter, medan han tittar på YouTube eller
  läser något med Ghostty synligt på skärmen),
- den visar den riktiga himlen över platsen (riktiga stjärnor och
  stjärnbilder, riktiga ISS-passager),
- den firar de svenska dagar som betyder något,
- den kostar mindre på batteri,
- och det som i dag ser trasigt ut (kometen som står still) blir levande.

## Mål

1. **Fyren.** En fyr vid horisonten tänds när Claude väntar på personen, och
   syns även när Ghostty saknar fokus.
2. **Kometen lever.** Svansen strömmar, huvudet pulserar, den glider med
   stjärnhimlen. Den sveper aldrig över himlen som ett stjärnfall.
3. **Batteriläge.** På batteri skrivs en lättare shader.
4. **Riktig himmel.** Riktiga ljusa stjärnor och några kända stjärnbilder där
   de faktiskt står; ISS syns när den faktiskt passerar synligt.
5. **Svenska dagar.** Påsk, nationaldagen, midsommarafton, lucia, julafton och
   nyår syns på himlen.
6. **Clawd tittar upp** när något händer på himlen.
7. **Markören.** Himlen reagerar diskret där man skriver.
8. **Shadern läser terminalens bakgrund själv** (`iBackgroundColor`).
9. **Event som tål valfri fas**, framför allt konfettin.

## Icke-mål

- `/solar vykort`: struket av Vincent.
- Synk mot verklig tid i shadern: `iDate` finns inte (se Begränsningar).
  Demon och bandets klocka kommer även fortsättningsvis att visa olika tider.
- Ljud. Fyren säger till tyst.
- Events i iTerm2-tapeten (som tidigare: utanför). Inget i den här designen
  når iTerm2-tapeten (`sky.ts`): riktiga stjärnor, ny månplacering, kometen,
  dagarna och fyren gäller bara Ghostty. (Claudes val efter granskningen.)
- Halloween, kanelbullens dag och semmeldagen: finns redan som tillfällen i
  `occasionAt`, men får ingen himmel nu.

## Anti-mål (misslyckat även om det fungerar)

- Något som ritas ovanpå text eller gör det svårare att läsa: allt ritas bara
  där terminalen visar sin bakgrund, som i dag.
- En fyr som tjatar: den ska synas i ögonvrån, inte blinka hårt eller
  stroboskopiskt.
- Marköreffekter som gör det oroligt att skriva.
- Att grafikkortet går hårt när ingen är vid datorn: borta-läget (5 min)
  släcker allt, fyren också, precis som i dag.
- En himmel som kostar märkbart mer än i dag när fönstret har fokus på nätström.

## Begränsningar (verifierade 2026-10-25 om inget annat sägs)

- **Ghostty 1.3.1.** En testshader visade: `iDate` är alltid noll.
  `iBackgroundColor`, `iFocus` och `iCurrentCursor` fungerar. Enligt
  dokumentationen finns även `iTimeCursorChange`, `iTimeFocus`,
  `iPreviousCursor` och `iCursorVisible`; namnen finns i programfilen men
  verifierades inte en och en.
- **`iTime` nollställs inte vid omladdning** (spiken). En shader kan inte veta
  när den laddades, så allt som animeras med `iTime` får okänd fas.
- **`custom-shader-animation`** kan vara `true` (animera bara med fokus),
  `false` eller `always` (animera även utan fokus, i alla Ghostty-fönster).
  Inställningen gäller alla terminaler och kan ändras via include-filen +
  omladdning.
- Omladdning flimrar inte (spiken). Utan fokus ritar Ghostty bara om vid
  förändring, t.ex. en omladdning.
- Kostnad i dag (spiken, M1 Pro, 3024×1964, 120 Hz): processor 2,6 % utan
  shader, 17–20 % med; grafikkort 9 % → 40–75 % med fokus. Inget utan fokus.
  Mätskript: `spike/measure.sh`, `spike/measure-idle.sh`.
- Motorregler: varje funktion som tar `$` är en toppnivåfunktion i
  `register.tsx`, inga closures. Nätanrop via `$.http.fetch`, processer via
  `$.process.run`, filer via `$.fs`. Atomära skrivningar finns (`writeWhole`).
- Varje bit testas först (TDD) i `hooks/solar.test.tsx` med testvärlden
  `ghosttyWorld`; utseendet kontrolleras med `tools/preview/run.sh shader`
  (WebGL; strängare än Ghosttys GLSL 4.30, så det som kompilerar där
  kompilerar i Ghostty).

## Delarna

### 1. Shadern läser terminalens bakgrund (`iBackgroundColor`)

Konstanten `BACKGROUND` ersätts av uniformen `iBackgroundColor`.
`ghosttyBackground()` (läser `+show-config`, temafilen, `--default`) och allt
som bara finns för den tas bort. Förhandsvisningen sätter uniformen.
Fördel: rätt även när personen byter tema medan himlen är tänd. Görs först,
eftersom det förenklar resten.

### 2. Kometen lever

- **Svansen strömmar:** små ljusa partiklar rinner utåt längs stoftsvansen
  (gul) och jonsvansen (blå), animerade med `iTime` utan att någon fas syns
  (ett jämnt flöde).
- **Jonsvansen fladdrar** svagt i sidled; **huvudet pulserar** långsamt
  (några sekunders period).
- **Glider med himlen:** kometen får en fast plats på himlen (rektascension
  och deklination ur sitt frö) och projiceras som stjärnorna i del 5, så den
  följer himlens vridning under natten. Svansen pekar bort från solen.
- **Bakom molnen:** kometen ritas redan i lagret bakom molnen, men en
  förhandsbild såg ut som att huvudet låg framför ett moln. Byggaren
  kontrollerar med molnigt väder och rättar om det stämmer.
- Gäller både det schemalagda eventet (3 dygn var 60:e dag) och
  `/solar event komet`.

### 3. Fyren

- **När den tänds:**
  - *Claude frågar* (tillståndsfråga, en fråga till personen): bara
    notiser vars `notification_type` är en tillståndsfråga (och liknande
    frågor som kräver svar), samt `AskUserQuestion`. **Inte** `idle_prompt`
    (som Claude Code skickar ca 60 s efter en klar tur) och inte andra moddars
    notiser: de skulle göra varje vitt "klar" orange efter en minut, vilket är
    just tjatet anti-målen förbjuder. (Claudes beslut efter granskningen.)
  - *Claude är klar:* `turn.complete` med `reason === 'answer'` i
    huvudkonversationen (inte subagenter).
- **När den släcks:** när personen skickar en prompt eller svarar (dagens
  `prompt.submit` och `tool.call` rensar `isWaiting`), och när en ny tur
  startar.
- **Utseende** (Vincents val: båda lägena; utseendet är Claudes förslag som
  han inte invände mot):
  - En liten risografisk fyr vid horisonten i nedre högra hörnet. Den syns
    bara när den lyser.
  - *Frågar:* varmt orange sken, ljuskägla som sveper. Efter ungefär två
    minuter utan svar blir svepet snabbare och starkare, men aldrig
    stroboskopiskt.
  - *Klar:* lugnare vitt sken, långsamt svep, trappas inte upp.
  - Svepet ska se rätt ut oavsett fas (en jämn rotation).
- **Utan fokus:** medan fyren lyser skriver include-filen
  `custom-shader-animation = always`, annars `true`. Det gäller alla
  Ghostty-fönster medan Claude väntar; det är accepterat.
- **Fyren och borta-läget** (Vincents val): att titta på en video räknas
  som borta (`HIDIdleTime`), så fyren får inte följa borta-läget rakt av.
  - De första 5 minuterna efter att Claude började vänta sveper fyren
    (`custom-shader-animation = always`).
  - Därefter, eller när personen räknas som borta, står fyren kvar och
    lyser stilla: animationen stängs av (`false`), Ghostty ritar den en gång
    och den kostar inget.
  - Den släcks när personen svarar, eller senast 30 minuter efter att Claude
    började vänta.
  - Resten av himlen släcks som i dag när personen är borta; bara fyren
    (och det mörka eller tysta runt den) står kvar.
- **Flera sessioner:** varje session skriver sin egen shader och den senaste
  vinner (som i dag). Fyren ska lysa om *någon* levande session väntar.
  Byggaren väljer hur det delas mellan sessioner (t.ex. en fil per session i
  `runtime/`, som hjärtslagen), så att en session som inte väntar inte släcker
  en annans fyr.
- **Bandet:** bandets tredje rad kan visa `* väntar på dig` eller liknande;
  byggaren avgör ordet.

### 4. Batteriläge

- Modden läser strömkällan (`pmset -g batt`: "AC Power" eller
  "Battery Power") ungefär en gång i minuten, delat mellan sessionerna på
  samma sätt som borta-läget, och billigt.
- **På batteri står himlen stilla** (Vincents val): include-filen skriver
  `custom-shader-animation = false`. Himlen syns och följer solen, vädret,
  stjärnorna och dagarna, men Ghostty ritar bara om den när modden skriver en
  ny shader (var annan minut, när scenen ändras) eller när terminalen ändras.
  Spiken visade att bara en påslagen shader kostar ca 40 % grafikkort med
  animation, så en lättare shader hade inte räckt.
- Fyren sveper ändå när Claude väntar (enligt del 3), även på batteri.
- Inget kommando för att stänga av det: det sker av sig självt. Ett fel i
  `pmset` räknas som nätström.

### 5. Riktiga stjärnor och stjärnbilder

- **Projektion** (Claudes val efter granskningen): *som att ligga på rygg
  med fötterna mot söder*. Öst till vänster, väst till höger; skärmens
  horisontlinje är södra horisonten, och uppåt går man längs meridianen
  genom zenit och vidare ut över norra himlen. Så får Karlavagnen och
  Kassiopeja, som aldrig går ner på 59° N men ofta står i norr, plats högt
  upp, med Polstjärnan ungefär där. Byggaren väljer skalan.
- **Horisonten** (Claudes val efter granskningen): samma linje som solbågen
  redan möter horisonten vid (ca 62 % ner), inte skärmens nederkant, som
  ligger bakom Claude Codes inmatningsruta, bandet och statusraden. Allt som
  "står vid horisonten" (fyren, flaggan, midsommarstången, luciatåget) står på
  den linjen. Månen följer projektionen och går ner vid samma linje som solen.
- **Stjärnor:** de ljusaste riktiga stjärnorna (storleksklass ungefär ≤ 3,5),
  med position, ljusstyrka och svag färg, inbakade i modden som data. De
  slumpade stjärnorna får ligga kvar som svag fyllnad bakom. Positionerna
  räknas om vid varje scensteg (2 min), då himlen vridit sig ungefär en halv
  grad.
- **Stjärnbilder:** linjer för ett fåtal kända: Karlavagnen (Stora björnen),
  Kassiopeja, Orion, Lyran/Sommartriangeln, Svanen; byggaren får lägga till
  fler om kostnaden tillåter. Linjerna ska vara diskreta, som stjärnkartor
  ritar dem (dagens Clawd-stjärnbild är förebilden). De syns bara när det är
  mörkt och klart nog.
- **Clawd-stjärnbilden** (eventet) finns kvar som den är, ett påhitt.
- **Demo och fastlåst tid** (Claudes val): i `/solar demo` står stjärnorna,
  stjärnbilderna och kometen stilla där de står vid demons start (eller
  utelämnas, om det blir enklare), och ISS visas inte. Riktig vridning i
  demon skulle kräva projektion i shadern, vilket inte är värt kostnaden.
- **Kostnad:** att loopa över hundratals stjärnor per pixel är för dyrt.
  Byggaren väljer en uppdelning (t.ex. att modden sorterar stjärnorna i
  rutor på skärmen och shadern bara tittar i sin ruta). Krav: med fokus på
  nätström ska shadern inte kosta märkbart mer än i dag. Mät dagens shader
  och den nya under samma förhållanden, t.ex. medel över en minut med
  `spike/measure.sh`; den nya får ligga högst ungefär 10 procentenheter över.

### 6. Riktiga ISS-passager

- **Data:** ISS:s banelement från CelesTrak (`https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json`),
  hämtade högst en gång per dygn och sparade i `$.store`, så att det
  fungerar en stund utan nät.
- **Beräkning:** byggaren väljer propagator (en förenklad, Kepler med
  J2-drift, räcker troligen inom ett dygn från epoken; annars en port av
  SGP4). Den kontrolleras mot `satellite.js` i ett utvecklingsskript under
  `tools/`, inte i modden.
- **Synlig passage:** ISS högre än ca 10° över horisonten, solen lägre än
  −6° på platsen och ISS i solljus (inte i jordens skugga).
- **Ritas:** en klar, svagt gul punkt som glider längs sin riktiga bana i
  samma projektion som stjärnorna, med en kort svans. Eftersom `iTime` saknar
  fas skriver modden ISS:s aktuella position i shadern med kort intervall
  medan en passage pågår (förslag: varannan sekund, bara under passagen,
  några minuter några gånger i veckan). Byggaren mäter vad omladdningarna
  kostar och väljer intervallet.
- **Ersätter** det schemalagda satellit-eventet. `/solar event satellit`
  visar en påhittad passage som i dag.
- Bandet visar `* ISS` under passagen.

### 7. Svenska dagar

Vincents val av dagar; utseendet är Claudes förslag som han inte invände mot.
Dagarna kommer av sig själva och bandet nämner dem; `/solar event <namn>`
visar dem när som helst.

| Dag | När | Himlen |
|---|---|---|
| Påsk | Skärtorsdag kväll till annandag påsk | Skärtorsdag kväll: en påskkärring på kvast flyger förbi månen mot Blåkulla. Hela helgen: färgade fjädrar driver över himlen. |
| Nationaldagen | 6 juni | En svensk flagga vajar på en stång vid horisonten; luftballonger blir blågula. |
| Midsommarafton | Fredagen 19–25 juni | En midsommarstång vid horisonten, blomblad som driver. (Den ljusa natten finns redan.) |
| Lucia | 13 december, tidig morgon i mörker | Ett luciatåg av små fladdrande ljus vandrar längs horisonten. |
| Julafton | 24 december | En starkare julstjärna hela dagen; på kvällen åker tomten med släde förbi, och en gång runt 15:00. |
| Nyår | 31 december kväll till 1 januari ca 00:30 | Sporadiska raketer från kvällen, ett riktigt fyrverkeri kring tolvslaget som klingar av. |

`occasionAt` har i dag `newYear`, `lucia`, `christmas` (10 dec–6 jan),
`midsummer` m.fl. Byggaren lägger till det som saknas (nationaldagen, påsk,
julafton) utan att ändra hur bandet använder de befintliga.

### 8. Clawd tittar upp

När ett event eller en dag börjar synas på himlen, eller fyren tänds, tittar
Clawd i bandet upp och pekar mot himlen en kort stund (förslag: omkring tio
sekunder), sedan tillbaka till det han gjorde. Byggaren ritar posen i samma
risografiska cellstil som Clawd har i dag.

### 9. Markören

Diskret, och bara där terminalen visar bakgrund:
- stjärnor nära markören glimmar till en kort stund när den flyttar sig
  (`iTime - iTimeCursorChange`),
- fåglar och drivande blad viker undan för markören.

### 10. Event som tål valfri fas

Konfettin (milstolpen, 20 s) blir ett jämnt, kort regn som ser likadant ut
oavsett var i loopen det börjar, i stället för en smäll som kan missas. Övriga
event som korsar himlen får fortsatt dyka upp mitt i sin bana när de börjar;
det godtas.

## Besluten

**Vincents:**
- Fyren sveper de första 5 minuterna, står sedan kvar och lyser stilla
  (utan kostnad) tills personen svarar, högst 30 minuter.
- På batteri står himlen stilla; fyren sveper ändå.
- Kometen ska leva (strömma, pulsera, glida med himlen) och inte svepa som ett
  stjärnfall.
- Fyren lyser både när Claude frågar och när Claude är klar.
- Dagarna: påsk, nationaldagen, midsommar, lucia, julafton och nyår.
- Vykortet stryks.
- Allt annat från listan byggs ("låt oss göra allt").

**Claudes (kan rättas):**
- Fyrens färger (orange för fråga, vitt för klar), upptrappning efter två
  minuter, placering nere till höger.
- Utseendet på varje dag.
- Projektion mot söder; månen flyttas till samma projektion.
- Batteriläget sker av sig självt utan kommando.
- ISS ersätter den schemalagda satelliten.
- Inget ljud.

## Lämnat åt byggaren

- Hur fyrens tillstånd delas mellan sessioner.
- Vilka shaderdelar som förenklas på batteri, efter mätning.
- Stjärndata (källa, antal), uppdelning för kostnad, skala i projektionen.
- ISS-propagator och uppdateringsintervall under passage.
- Exakta ord i bandet, Clawds pose, partikelutseenden.
- Ordningen delarna byggs i, men del 1 först är att föredra.

## Hur det verifieras

- Varje beteende har ett test som först fallerar (tillstånd, include-filens
  innehåll, när fyren tänds och släcks, batteriläge, projektion av kända
  stjärnor, ISS-passager mot `satellite.js`, dagarnas datum).
- Förhandsbilder för kometen, fyren (båda lägena), stjärnbilderna, ISS och
  varje dag.
- Mätning med `spike/measure.sh` före och efter: med fokus på nätström, på
  batteri, och utan fokus med fyren tänd.
- En levande koll i Ghostty: fyren syns och sveper med Ghostty synligt men
  utan fokus.
