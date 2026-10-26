# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-26 kväll, session `98234c7f` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen för åtta frågor:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. Ordning F1 auto mode → F2 GPU-mätning → F3 fisk + löv/fåglar → F4 GPU-optimering → F5 motor/tema → F6 installation → F7 två teman → F8 community.
- **F1 klar** (23d36f2 på `main`).
- **F2 klar på grenen `gpu-matning`**, inte sammanslagen med `main` och inte pushad. Commits i sessionen:
  - `9b8fa29`: `docs/gpu-measurements.md`, mätdokumentet.
  - `0e4c2d2`: Vincents beslut i uppgift 6, skrivna i dokumentet och i F4-planen, plus Ghostty-utkastet.
  - Före dem: `28eedac`, `b85f58c` och `eed15bd` (mätverktygen), och `721e0bc` (förra handoffen).
- `docs/gpu-measurements.md` är skrivet av fable/high och granskat av opus/medium. Varje tabellcell är kontrollerad mot `rows.tsv` och powermetrics-loggarna, med 0 avvikelser. Prosans fynd (ett tjugotal) är rättade. Dokumentet är levande, med en sektion per körning; avsnitten "How the numbers are made" och "How to rerun" ligger överst.
- **Steg 0:** den ljusa himlen ligger på grenen `ljus-himmel` (0bae2fb). `main` har samma modd-kod som 3cef45e. Den levande himlen (spegeln) är main-himlen.
- **Inget är pushat** sedan 3cef45e.

## Vad F2 visade (kort; detaljerna och förbehållen står i dokumentet)

- `false` fokuserad ritar vid vsync, 118–120 fps. Ofokuserad ritar den 0 fps.
- `true` ofokuserad är gratis.
- `always` ofokuserad kostar 87–88 % av fokuserad mW, och ritar ett täckt fönster i 114 fps.
- Golvet: passthrough ger 36,8 % och 797 mW; utan shader 0,5 % och 11 mW.
- **Grenen mot main**, över golvet i mW: 3,7× på dagen och 3,1× på natten. Mätt som cykler (residens × MHz, en tolkning) är det 1,9× och 1,8×.
- **F4:s antagande om kanten** (35–50 %) kan inte prövas av körningen. Skillnaden mellan main och grenen (kant + glas + textkontroll + LUMINANCE) är ett tak för kantens andel: 73/68 % i mW och 48/43 % i cykler. Bara F4:s `--without shaded` kan skilja ut kanten.
- **Device % mättas** för scenerna, så mW är måttet som skiljer dem. Per-process GPU-tid är 0 på macOS 27.

## Vincents beslut (uppgift 6, 2026-10-26)

1. `animationOf` lämnas som den är. Stilla- och batteriregeln får en lättare shader i F4 (ny uppgift 5b; ändrar modden, alltså versionsbump).
2. Ghostty-rapporten ligger som utkast i `docs/superpowers/ghostty-discussion-draft.md`, enligt deras mall för "Issue Triage"-diskussioner och deras AI-policy (måste prövas och redigeras av en människa, och AI-hjälpen anges). **Vincent kör den korta reprorutan själv först:** pulserar den röda tonen under `false` står rapporten. Står den still skickas inget, och probe-raderna behöver ses över. Sedan redigerar och skickar han den. Inget befintligt ärende eller diskussion om felet hittades vid sökningen.
3. Svepet behåller `always` i fem minuter och får post 8 (ofokuserad väg) i F4 uppgift 5. Vincent godkänner på skärmbilder.
4. F4 börjar från det enda varvet. Före F4 uppgift 6 (jämförelsen) kör Vincent om selen med `--twice` på en lugn dator, och 60 Hz-raderna med mW. F4:s mål står i device-punkter och mW över golvet, med medel-MHz och residens bredvid.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode eftersom klonen inte är laddad; spegeln `~/solar-clawd-live` laddas. Ändringar når den levande himlen bara medan Vincent armerat spegeln.
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Lägg inte `"$defaults"` eller trust-rader i `autoMode.environment`.
- **Mätningen körs inte av Claude.** Vincent startar `row`, `live` och `plan` från Terminal.app. Claude kör bara `--dry-run`, `decode`, `report` och `scenes.sh`. `sudo -v &&` före varje `row`/`live`. `--force` lämnar inget spår i `context.txt`, så notera det i handoffen när det används.
- **Utåtriktat skickas av Vincent:** Ghostty-rapporten, pushar och PR:er.
- `tool.check`-hooken i `hooks/register.tsx` förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning.
- Commit-ämnen beskriver världen som den nu är, specar på svenska, planer och kod på engelska. Push bara efter Vincents ja, som `Fiddy134`; versionsbump när modden ändras (F2 ändrade inte modden).

## Lösa trådar

- Två ospårade säkerhetskopior i `.claude/` (`settings.local.json.bak-20261026-*`) kan tas bort av Vincent.
- `tools/measure/report.mjs` läser redan in MHz och residens men skriver inte ut dem. Dokumentets MHz-, residens- och mW-sd-kolumner kommer från ett skript i skrapytan. Det är värt att lägga till dem i rapporten före omkörningen (liten ändring, gärna i F4 uppgift 0).
- Idé till nästa körning: probens bildräknare i ett hörn av scenshadern, så att scenerna också får fps.
- `tools/dev/watch.sh` kräver `fswatch` (inte installerat); valfritt.

## Nästa steg

1. **Vincent:** pröva reprorutan i Ghostty-utkastet. Säg sedan om `gpu-matning` ska slås ihop med `main` och pushas (finishing-a-development-branch; push som `Fiddy134`). F2 ändrade inte modden, så ingen versionsbump behövs.
2. **F3 enligt planen** (kontext-fisk och löv/fåglar, planens rad 136 och framåt, workflow `fisk-lov`): börja med att läsa F3-avsnittet och husreceptet. Alternativt F4 först, om Vincent vill byta ordning; F4 har nu baslinjen och besluten den behövde.
3. Före F4 uppgift 6: Vincents omkörning med `--twice` och 60 Hz-raderna med mW. Kontrollera efteråt att `powermetrics-*.log` finns och att `gpu.sh report <mapp>` visar mW.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. F2 är klar; börja F3 enligt arbetsplanen."* (eller *"…börja F4 uppgift 0, benchen på riktig GPU."*)

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
