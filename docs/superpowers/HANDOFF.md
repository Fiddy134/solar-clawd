# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-26 kl 23:45, session `98234c7f` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen för åtta frågor:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. Ordningen ändrades i den här sessionen: **F4 före F3** (Vincent, 2026-10-26). Skälen: F3 lägger till arbete per pixel; F4:s konvention med en gränskontroll per händelse ska gälla för F3:s nya figurer; ljusbeslutet bör vara taget innan F3:s utseende bedöms.
- **F1 och F2 är klara och på `main`**, pushade som `Fiddy134` till `83fb633`. Efter det finns två lokala commits på `main` som inte är pushade: `1f43b57` (handoffen) och `bd564eb` (`.worktrees/` git-ignorerad), och nu den här handoffen.
- **F4 pågår på grenen `gpu`**, som ligger i worktreen `~/solar-clawd/.worktrees/gpu`. Grenen är `main` plus den ljusa himlen (`ljus-himmel`, 0bae2fb) plus F4. Den står på `eb319e9`, är inte på `main` och inte pushad. Den levande himlen (spegeln) är fortfarande main-himlen, eftersom worktrees inte speglas.
- **Läget i planen och siffrorna:** F4-avsnittet har en lägesrad under "Uppgifter" (bara på grenen `gpu`). `docs/gpu-measurements.md` på `gpu` har tre sektioner: F2-körningen, "Bench 2026-10-26" (kostnad per steg) och "F4 phase 2".

## Vad F4 har gjort

- **Uppgift 0 (`b3e9630`, `cbc9a0e`):**
  - förhandsvisningen kör på Macens GPU med `--gpu` (ANGLE Metal, headless) och skriver ut renderaren;
  - nya flaggor: `--passthrough`, och senare `--unmarked` och `--unfocused`;
  - kanten är ett eget steg (`sky = shaded(`), så att `--without shaded` fungerar.
- **Benchen per steg** (andel av himlens egen kostnad): kanten 41–49 %, molnen 34–47 %, stjärnkartan 21 % av natten, glaset högst 7–11 %, händelser ingenting när ingen är uppe.
- **Fas 2, granskad och sammanslagen (`ff85241`):**
  - post 1: kanten läser 13 grannar (9 sprack vid 3456×2234);
  - post 2: ljushetsavvisning i glaset;
  - post 3: fliktestet först, så en omarkerad flik kostar som en tom shader;
  - post 5: molnen placeras innan sorten väljs;
  - post 10: stjärnkartan läser en rad av rutor i ett svep;
  - post 7: gränskontroller för sju händelser.
  - Alla ger identiska bilder, utom kanten, som rör pixlar inom 1 px från text.
- **Utelämnat:**
  - post 4 (korstestet gav mörka prickar i feta bokstäver, backad i `52fc2dc`);
  - post 6 (Vincent sa nej; den ligger på grenen `post6-moln-avvisad`);
  - post 8, den ofokuserade vägen. Ett ofokuserat fönster ritas också när terminalen ändras, och då bleknade Claude Codes grå text på ljus dag. Vincent tog bort den (`e34b2ef`), men `--unfocused` finns kvar.
- **Samlat i förhandsvisningen** (`ff85241` mot `cbc9a0e`): himlens egen kostnad −41 % dag-klar, −37 % dag-mulen, −43 % natt-tänd. Det motsvarar 57–63 % av baslinjen, mot målet ≤ 50 %, som avgörs i Ghostty (fas 4).

## Beslut tagna i sessionen

- **F2 uppgift 6:** `animationOf` lämnas som den är. Stilla- och batteriregeln får en lättare shader (F4 uppgift 5b). F4:s mål står i device-punkter och mW över golvet. Omkörningen med `--twice` görs före F4:s jämförelse.
- **Ghostty-rapporten** ligger som utkast i `docs/superpowers/ghostty-discussion-draft.md`. Vincent provar reprorutan själv först: pulserar den röda tonen under `false` står rapporten. Sedan redigerar och skickar han den, enligt Ghosttys AI-policy.
- **Post 6 nej. Post 8 bort. Ljusbeslutet a/b/c behövs inte än:** det tas med siffror från fas 4.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode eftersom klonen inte är laddad; spegeln `~/solar-clawd-live` laddas. Ändringar når den levande himlen bara medan Vincent armerat spegeln.
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Lägg inte `"$defaults"` eller trust-rader i `autoMode.environment`.
- **Worktrees:**
  - Lägg dem i `.worktrees/`. Det inbyggda verktyget `EnterWorktree` lägger dem i `.claude/worktrees/`, som är förbjudet.
  - I en ny worktree: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`. Annars hittar `tsc` inte typernas tsconfig och skriver ut `.js`-filer i `hooks/`, och de ska tas bort.
  - Förhandsvisningen byggs med `SOLAR_ROOT=$PWD npx -y esbuild@0.24.0 tools/preview/shader.mjs --bundle --platform=node --format=esm --outfile=.preview/shader.bundle.mjs` och körs med `node .preview/shader.bundle.mjs <flaggor> --out <namn>`.
  - Två förhandsvisningar samtidigt i samma worktree krockar (Chrome exit 21).
  - Under zsh blir `$FLAGS` med flera ord ett enda argument; använd bash eller `${=VAR}`.
- **Mätningen i Ghostty körs inte av Claude.** Vincent startar `row`, `live` och `plan` från Terminal.app. Claude kör bara `--dry-run`, `decode`, `report` och `scenes.sh`. `sudo -v &&` före varje `row`/`live`. `--force` lämnar inget spår i `context.txt`.
- **Bench i förhandsvisningen får Claude köra.** Den är brusig när annat körs: lita bara på före/efter-par som körs direkt efter varandra, växelvis.
- **Utåtriktat skickas av Vincent:** Ghostty-rapporten, pushar och PR:er.
- `tool.check`-hooken i `hooks/register.tsx` förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning.
- Commit-ämnen beskriver världen som den nu är, specar på svenska, planer och kod på engelska. Push bara efter Vincents ja, som `Fiddy134`. Versionsbump i `.claude-plugin/plugin.json` när modden ändras: **F4 ändrar modden**, så bumpen görs när `gpu` går till `main`.

## Lösa trådar

- Två ospårade säkerhetskopior i `.claude/` (`settings.local.json.bak-20261026-*`) kan tas bort av Vincent.
- `tools/measure/report.mjs` läser redan in MHz och residens men skriver inte ut dem. Lägg till dem före fas 4.
- **Förhandsvisningens svagheter** (från granskningen):
  - texturen upprepas vid kanterna (REPEAT), så kolumn 0 får text från högerkanten;
  - `diff.mjs` räknar varje pixel som inte är bakgrund som text;
  - med `--retina` går ersättningstexten ända till högerkanten och över fyrremsan.
- `tools/dev/watch.sh` kräver `fswatch` (inte installerat); valfritt.

## Nästa steg

1. **F4 uppgift 5b, den lättare shadern för stilla- och batteriregeln**, på `gpu`. När `isLively` är falskt eller datorn går på batteri skrivs en himmel utan kant och moln, med färre samplingar, i stället för en stilla. `animationOf` och dess test lämnas orörda. Benchen mot den vanliga himlen, och skärmbilder till Vincent. Börja med att läsa var shadern skrivs (`hooks/shader.ts`, `hooks/sky.ts`) och hur `isLively` och batteriet når dit.
2. **Lägg till MHz och residens i `report.mjs`** (liten ändring), så att fas 4 visar klockan bredvid mW.
3. **Fas 4, Vincent:** omkörning med `--twice` av baslinjen plus `gpu`-scenerna, och 60 Hz-raderna med mW. Det tar 1,5–2 timmar som datorn ska stå orörd: extern skärm urkopplad, övriga sessioner stängda, nätström. Ge exakta kommandon i god tid. Scenerna skrivs med `tools/measure/scenes.sh gpu <namn>…`. Gör först en `--dry-run`.
4. Därefter: ljusbeslutet a/b/c med siffror, uppgift 7 (domen i skrift, README "What it costs"), `gpu` till `main` med versionsbump, push efter Vincents ja. Sedan F3.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Fortsätt F4 med uppgift 5b på grenen gpu."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
