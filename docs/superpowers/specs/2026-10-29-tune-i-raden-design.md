# /solar tune i raden ovanför prompten

Datum: 2026-10-29. Status: design, väntar på Vincents godkännande.
Bygger på `2026-10-28-solar-tune-design.md`. Allt där gäller fortfarande, utom
var verktyget ritas och hur det styrs.

## Avsikt

`/solar tune` öppnar i dag en panel (`Pane`). I fullskärm dockar Claude Code
den bredvid samtalet från 110 kolumner. Då blir samtalet smalare medan man
ställer in, och det är just samtalets text man vill se när man ändrar
storlek, radavstånd, font och himlens ljus bakom texten. Verktyget flyttar
därför till raden ovanför prompten (`AbovePrompt`), där samtalet behåller
hela sin bredd.

## Mål

- `/solar tune` ritar verktyget i raden ovanför prompten. Reglagen ligger till
  vänster och vädret (tid, ort, väder, sol och måne) ligger kvar till höger.
  Raden är ungefär 8 rader hög och bara medan verktyget är öppet. Skissen är
  alternativ A i `.superpowers/brainstorm/5314-1793292241/content/band-layout.html`.
- Allt flyttar dit: flikarna dawn, day, dusk, night och text, med samma
  reglage, värden, förhandsvisning, keep, reset och undo som panelen har i dag.
- Clawd-gubbarna och papperskorgen tas bort ur raden, också när verktyget är
  stängt och också utanför Ghosttys himmel (iTerm2, Terminal, Linux). Raden
  visar då bara orden (tid och aktivitet, ort och väder, sol och måne,
  händelser), överallt som den gör i Ghostty i dag.
- Samtalet behåller hela sin bredd medan verktyget är öppet.

## Icke-mål

- Inga nya reglage och inga ändrade gränser. Det som står i specen från
  2026-10-28 om reglagen, anti-målen och förhandsvisningen gäller oförändrat.
- Ingen ändring av himlen i Ghostty. Fyrvaktarens catch och grill i shadern
  är inte Clawd i raden och ligger kvar.
- Inget stöd utanför terminalen (desktop, vscode, mobil). Panelen var också
  bara för terminalen.

## Anti-mål

- Verktyget får inte stjäla tangenter från prompten utan att personen har bett
  om det. Bokstäver och pilar som skrivs i prompten ska hamna i prompten.
- Raden får inte bli högre när verktyget är stängt.
- Att verktyget finns får inte göra raden eller himlen dyrare när det är
  stängt (samma krav som för panelen).

## Det Vincent har bestämt

- Alternativ A: reglagen till vänster i raden, vädret till höger, cirka 8
  rader, bara medan verktyget är öppet (2026-10-29).
- Allt flyttar till raden: dawn, day, dusk, night och text.
- Clawd-gubbarna tas bort ur raden oavsett, eftersom de inte passar temana.
- Papperskorgen tas också bort, och Clawd tas bort ur raden även utanför
  Ghosttys himmel: raden ska vara som den är i Ghostty nu (2026-10-29,
  *"papperskorg bort, som det är här just nu och clawd ur raden också bort"*).
  Utanför Ghostty visar raden alltså inte längre hur fullt kontextfönstret är.
- Styrningen: alternativ (b) efter tangentbordsprovet, alltså klick eller
  ctrl+x tab innan verktyget tar tangenter (2026-10-29, "ja" till förslaget
  nedan).

## Tangentbordsprovet (2026-10-29)

Provmodden `band-probe` ritade en rad med en `Client` och knappar med
`hotkey`, och loggade `prompt.edit`, `prompt.change`, `ui.focus`,
`ui.message` och `ui.fault`. Claude Code 2.1.312 i Ghostty, fullskärm,
156 kolumner, `maxRows` 23.

| Läge | Vad som hände |
|---|---|
| Tom prompt, ← | Claude Code öppnar agentvyn och samtalet går till bakgrunden. Modden ser ingenting. |
| Tom prompt, ↑ ↓ | Prompthistoriken. Modden ser bara `prompt.change origin=history` och kan inte stoppa det. |
| Tom prompt, → | Når inte modden. |
| Tom prompt, siffra | Når `prompt.edit` och trycker sedan på knappen med den `hotkey` (1 och 2). Prompten töms. |
| Text i prompten, ← | Når `prompt.edit`. Modden kan hålla kvar den så att markören inte flyttar. |
| Text i prompten, bokstav | Blir text i prompten. Ingen knapp trycks. |
| Klick på `Client` | `Client` får alla tangenter (h l j k loggade som `Client onKey`). |
| Fokus på en knapp i raden (`ui.focus`, `origin=person`) | Alla knappars `hotkey` fungerar, också bokstäver. |
| Esc med fokus i raden | Fokus tillbaka till prompten. Raden stängs inte. |
| `$.ui.focus` från modden | `{"deny":"that site does not hold the keyboard"}`. Modden kan inte ta fokus till raden. |
| ctrl+x tab med bara en `Client` i raden (andra provet) | Tangenterna stannar i prompten (`h` blev text). ctrl+x tab når inte en ensam `Client`. |
| Tillbaka från agentvyn | Provmodden loggar inget mer: varken `prompt.edit`, en rad eller en ny start. En dev-modd följer inte med när samtalet går till bakgrunden och tillbaka; det förklarar "unknown command" från förra sessionen. Solar Clawd laddas på annat sätt och berörs inte på samma sätt (inte kontrollerat). |

Följder:
- Bara personen kan ge raden fokus, med ett klick eller ctrl+x tab.
- Pilarna kan inte användas utan fokus.
- Esc kan inte stänga verktyget, eftersom Esc bara lämnar tillbaka fokus.
- Solar Clawds `AbovePrompt`-hook svarar med sin bild utan `next(e)`, så en
  annan modd under den syns aldrig i raden. Verktyget måste ritas av Solar
  Clawds egen hook.

## Hur det ska fungera

**Öppna och stänga.** `/solar tune` öppnar verktyget, och `/solar tune` igen
stänger det. Verktyget har också en egen stängtangent när det har fokus.
`q` är Claudes förslag, eftersom Esc redan betyder "tillbaka till prompten".
Att stänga gör samma sak som att stänga panelen i dag: det som inte är kept
släpps, himlen går tillbaka till verklig tid och sparade värden, och Ghosttys
text går tillbaka till den sparade (`ui.close`-logiken i
`hooks/register.tsx`). En omladdning av modden stänger verktyget på samma sätt.

**Fokus.** Verktyget ritas av en `Client` (dagens `hooks/tune-pane.tsx`,
anpassad). Personen klickar på verktyget eller trycker ctrl+x tab. Då tar
verktyget samma tangenter som panelen gör i dag: ↑ ↓ rad, ← → värde, tab byter
flik, enter keep, r reset, u undo. Esc lämnar tillbaka fokus till prompten
och verktyget står kvar öppet.

**Hjälpraden** är en och samma text med och utan fokus, eftersom inget i
API:t säger när raden tappar fokus (Esc når aldrig modden, och `AbovePrompt`
har ingen `isFocused`). Den börjar med hur man tar fokus och fortsätter med
tangenterna, till exempel `click or ctrl+x tab · ↑↓ row · ←→ move · tab phase
· ⏎ keep · q close · esc prompt`. (Claudes beslut.)

**Första steget i bygget är ett andra prov** med `band-probe`, som Vincent
kör: når ctrl+x tab en `Client` i raden, når Tab och Enter den med fokus,
fungerar en knapps `hotkey` utan fokus när prompten har text. Svaren styr
bara tangenterna, inte formen (Claudes beslut):
- Når ctrl+x tab bara knappar räcker klick för att ta fokus, och hjälpraden
  säger bara `click`.
- Når Tab inte fram byter `[` och `]` flik; de gör det redan i
  `onTuneKey`.
- Når Enter inte fram keepar `s`.

**När raden lämnar plats.** Medan Claude Code ställer en fråga (`hasSurvey`)
eller personen fäller ihop raden (`[-]`, ctrl+x ctrl+a) ritas verktyget inte,
men det står kvar öppet med sin förhandsvisning och kommer tillbaka när raden
gör det. Det stängs bara med `q`, `/solar tune` eller en omladdning. (Claudes
beslut.)

**Siffrorna som genväg (Claudes förslag).** Flikarna är knappar med `hotkey`
1–5 (dawn, day, dusk, night, text), så att man kan byta flik från tom prompt
utan fokus. Det kostar att en siffra som första tecken i en tom prompt byter
flik i stället för att skrivas, medan verktyget är öppet. Är det inte värt
det tas genvägen bort; resten av designen hänger inte på den.

**Ändrat efter livetestet av 0.11.0 (2026-10-29, Vincents val).** En klick
på en flikknapp bytte flik men gav inte verktyget tangenterna: de stannade i
prompten, och ← öppnade agentvyn. Motorn kan inte flytta fokus till en
`Client` (`$.ui.focus` och en `ui.focus`-hook når bara `Button`, `Input` och
`Select`). Från 0.11.1 ritas flikarna därför i verktygets översta rad, och en
klick på en flik är en klick i verktyget, som ger det tangenterna. Raden
ritar inga knappar. Siffrorna 1–5 i tom prompt byter fortfarande flik, nu via
en `prompt.edit`-hook som sväljer siffran medan verktyget är ritat (inte
under en fråga till personen).

**Raden.** När verktyget är öppet blir raden en `Box` i rad: verktyget till
vänster (`Client`), vädrets ord till höger. Raden ritas också när himlen är
dold med `/solar`, eftersom textfliken fortfarande gör något. När verktyget är
stängt är raden som i dag men utan Clawd: samma höjd (`ROWS` 3), samma ord.

**Panelen** (`Pane` med `TUNE_PANE`) tas bort. Logiken för förhandsvisning,
keep, text och stängning i `hooks/register.tsx` flyttas från panelens
`requestId` till raden och behålls i övrigt.

## Begränsningar

- Projektets regler: tester först (`claude plugin test .`), `tsc`, paritet
  53/53 mot baslinjen (Clawd ritas inte i paritetsscenerna, men kontrollera),
  versionshöjning i `.claude-plugin/plugin.json` till 0.11.0, bygg i en
  worktree i `.worktrees/`, ingen merge till `main` förrän det sammanslagna
  resultatet testats, ingen push utan Vincents ja.
- Raden får `e.props.bodyColumns` och `e.props.maxRows` från Claude Code.
  Under `AskUserQuestion` hålls trädet till 12 rader (`reference.md`).
- En `Client` kan inte innehålla en `Raster`. Vädret ligger därför bredvid
  `Client` i hookens eget träd, inte i den.
- `tick`-arbetet från 0.10.1 gäller: inget nytt får skriva till Ghosttys tty
  under en tur.

## Claudes beslut (Vincent kan ändra dem)

- `q` stänger verktyget med fokus, och `/solar tune` växlar öppet och stängt.
- En fast hjälprad; ett andra prov först, med reservtangenter om det faller ut
  dåligt; verktyget göms men står kvar öppet när raden lämnar plats.
- Flikarna har `hotkey` 1–5 utan fokus.
- Panelen tas bort helt; ingen reserv bredvid samtalet.
- Raden ritas med verktyget också när himlen är dold.
- Utan Clawd behåller raden sina 3 rader och sin himmelsremsa (`paintBandSky`,
  regn och snö); gubben, hans reaktioner, pappershögen och papperskorgen
  försvinner.
- Utanför Ghosttys himmel svarar `/solar catch` och `/solar grill` att de
  visas i Ghosttys himmel, och gör inget mer. `/solar storm` står kvar, för
  vinden syns i himlen och i bakgrundsbilden. README och `/solar`-hjälpen
  skrivs om så att de inte längre beskriver Clawd i raden eller papperskorgen.

## Lämnat åt byggaren

- Exakt bredd för verktyget och vädret, och vad som viker först i ett smalt
  fönster (vädret före reglagen är Claudes förslag), och vad som händer när
  `maxRows` är mindre än verktygets höjd.
- Bakgrundsfärgen under verktyget (panelens `#10142a` eller himlen bakom).
- Hur mycket av `hooks/clawd.ts` som kan tas bort med gubben, och vilka tester
  som går med.
- Hur tillståndet "öppet" sparas så att `/solar tune` växlar rätt.

## Ej verifierat

- Om Tab och Enter når en `Client` i raden med fokus. Panelen får dem i dag;
  `[` `]` byter flik och `s` keepar också, så verktyget fungerar ändå.
- Om en knapps `hotkey` utan fokus fungerar när prompten har text (provet
  gjordes bara i tom prompt).
- Om `autoFocus` på en knapp i raden flyttar fokus när raden ritas första
  gången, eller bara när personen går in i raden.
- ~~Om Solar Clawds rad och verktyg finns kvar efter agentvyn.~~ Nej
  (2026-10-29): agentvyn flyttar samtalet till en kopia under
  `claude daemon` (`--fork-session`), utan `TERM_PROGRAM`, så modden där vet
  inte att den är i Ghostty och `/solar tune` svarar att den bara finns i
  Ghostty. Botemedlet är ett nytt `claude` i fliken.
- Om samma klick som ger verktyget fokus också når dess `onPointer`, så att
  en klick på en flik byter flik direkt (0.11.1).
- Om en siffra som `prompt.edit`-hooken sväljer lämnar prompten tom live
  (testerna kan inte skicka `prompt.edit`; beslutet ligger i `tabKeyOf`).
