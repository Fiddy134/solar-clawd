# Handoff

Skrivs om vid varje sessionsbyte och läses först i nästa session. Historiken finns i git. Senast: 2026-10-27 kl 09, session `8d190692` (Opus 5.5, auto mode) → nästa.

## Läge

- **Arbetsplanen för åtta frågor:** `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`. F4 gjordes före F3 (Vincent, 2026-10-26).
- **F1, F2 och F4 är klara och på `main`**, pushade som `Fiddy134` till **`818b0d4`** (sammanslagningen av `gpu`, version **0.5.0**). Ej pushad: den här handoffen.
- **Grenen `gpu`** och worktreen `~/solar-clawd/.worktrees/gpu` har gjort sitt (allt är på `main`); Vincent kan ta bort dem (`git worktree remove .worktrees/gpu && git branch -d gpu`). Grenen `post6-moln-avvisad` sparas som avvisat försök.
- **Nästa fråga är F3** (kontext-fisk och löv/fåglar). F4:s konvention gäller F3:s figurer: varje figur har ett lådtest, `events()`-anrop ett per rad, och ett steg per pixel frågar först om det kan ändra pixeln.

## Vad den här sessionen gjorde

- **Fas 4-rapporten** (`0895775`, avsnittet "F4 phase 4" i `docs/gpu-measurements.md`), från körningen `.worktrees/gpu/.preview/measure/out/2026-10-27T002134/` (128 rader, `--twice`) och 60 Hz-raderna i `…/2026-10-27-rows/`:
  - himlens egen kostnad, `ljus-himmel` → `gpu`: **38–44 % kvar i mW** (målet ≤ 50 % nått), **58–66 % i busy cycles** (MHz × residens, närmast arbetet; förhandsvisningen sa 57–63 %), 78–95 % i device-punkter;
  - **device % kan inte mäta målet**: GPU:n sänker klockan tills den är upptagen det mesta av tiden, så varje scen står vid 75–77 %; vid 60 Hz visar `gpu:day-clear` 81 % på en tredjedel av effekten;
  - **60 Hz:** baslinjens dagshimmel tappar exakt halva arbetet när bilderna halveras, alltså var den inte mättad vid 120 Hz; besparingen syns som mW, inte fler bilder. Natt- och händelsescenerna (toppklocka, 100 %) är inte prövade;
  - övriga mål: ofokuserat på `none`-nivå, `always` ofokus 2 p från fokus, omarkerad flik +5,1 p (målet 5, på gränsen); lätta himlen −53 % dag, −40 % natt i mW;
  - load 6,82 vid starten; proberaden vid 60 Hz med `--force` (PerfPowerService 84 %), noterat i dokumentet.
- **Ljusbeslutet: (a)+(b)** (Vincent, 2026-10-27). (b) byggt i `7ff414e`: kanten tonas ut där himlens ljushet går från 0,2 till 0,1 (`SHADE_DARK` i `hooks/glsl/main.ts`) och dess skiva läses inte under 0,1. **Inte planens ~0,45**: skymningens grå text (153) behöver kanten där. Paritet: dagen identisk, natt/skymning bara inom 1 px från text (upp till 30/255 i blått), längre ut ≤ 1/255. Bench: natt-tänd −24 %, natt-mörk −15 %, skymning −6 %. **Inte mätt i Ghostty.**
- **Uppgift 7** (`a36a903`): README "What it costs"; "What a scene language would and would not change" i `docs/gpu-measurements.md`.
- **Version 0.5.0** (`a6696d2`), sammanslaget och pushat efter Vincents ja.

## Regler som gäller nu

- Edit och Write i `~/solar-clawd` fungerar i auto mode eftersom klonen inte är laddad; spegeln `~/solar-clawd-live` laddas. Ändringar når den levande himlen bara medan Vincent armerat spegeln (git-hookarna kopierar efter en merge).
- **Aldrig genom Claude:** `tools/dev/bootstrap.sh`, `.claude/hooks/arm.sh`, `.claude/hooks/mirror.sh --now`, skrivningar i `~/.claude/settings.json`, `.claude/` och `.git/`. Lägg inte `"$defaults"` eller trust-rader i `autoMode.environment`.
- **Worktrees:** i `.worktrees/` (inte `EnterWorktree`). I en ny worktree: `ln -s ../../../.claude-plugin/types <wt>/.claude-plugin/types`.
- **Tester och typer:** `claude plugin test .` (99 tester) och `npx -y -p typescript@5.6.3 tsc -p . --noEmit`. Testutskriften till en fil, läs slutet.
- **Förhandsvisningen:** `SOLAR_ROOT=$PWD npx -y esbuild@0.24.0 tools/preview/shader.mjs --bundle --platform=node --format=esm --outfile=.preview/shader.bundle.mjs`, sedan `node .preview/shader.bundle.mjs <flaggor> --out <namn>`. Före/efter: kopiera bunten före ändringen (`.preview/b/before.bundle.mjs`), jämför med `tools/preview/diff.mjs a.png b.png --terminal term.png`. Två samtidigt i samma worktree krockar. Under zsh: `${=VAR}` för flaggor med flera ord.
- **Mätningen i Ghostty körs inte av Claude.** Vincent startar `row`, `live` och `plan` från Terminal.app med `sudo -v &&` före. `gpu.sh report <mapp>` skriver till stdout (bara `plan` skriver `report.md`). `--force` lämnar inget spår i `context.txt`.
- **Läs GPU-kostnad i mW och busy cycles, inte device %**; skriv MHz och residens bredvid.
- **Bench i förhandsvisningen får Claude köra**, bara växelvisa före/efter-par.
- **Utåtriktat skickas av Vincent:** Ghostty-rapporten (`docs/superpowers/ghostty-discussion-draft.md`), PR:er; push bara efter Vincents ja, som `Fiddy134` (`gh auth switch -u Fiddy134`, push, tillbaka till `Iggy-Vincent`). Versionsbump i `.claude-plugin/plugin.json` när modden ändras.
- `tool.check`-hooken i `hooks/register.tsx` förblir ren genomsläppning. Inget får göra himlen mer "lively" utan mätning.
- Commit-ämnen beskriver världen som den nu är, specar på svenska, planer och kod på engelska.

## Lösa trådar

- **(b) i Ghostty är omätt.** Vill Vincent ha det: `scenes.sh` för `main` (eller en ref från `7ff414e`) och en `row gpu:night-lit`-motsvarighet; skulle sänka nattens 44 %.
- Ghostty-rapporten ligger kvar som utkast för Vincent.
- Två ospårade säkerhetskopior i `.claude/` (`settings.local.json.bak-20261026-*`) kan tas bort av Vincent.
- **Förhandsvisningens svagheter:** texturen upprepas vid kanterna (REPEAT); `diff.mjs` räknar varje icke-bakgrundspixel som text; med `--retina` går ersättningstexten över fyrremsan.
- `tools/dev/watch.sh` kräver `fswatch` (inte installerat); valfritt.

## Nästa steg

1. **F3** enligt planen (F3a löv/blommor/fåglar, F3b fyrvaktarens kontext), med F4:s konventioner och en bench per ny figur mot `fyr`/himlen.
2. Valfritt: (b) mätt i Ghostty; ta bort worktreen `gpu`.

Första meningen i den nya sessionen kan vara: *"Läs docs/superpowers/HANDOFF.md. Börja F3."*

## Hur handoffen används

Innan en session avslutas, eller när Vincent säger "handoff": skriv om den här filen (läge med commit-id:n, regler som ändrats, lösa trådar, nästa steg med de fakta nästa session annars skulle få leta efter, och startmeningen), committa den, och säg till Vincent att den är klar. I en ny session: läs den före allt annat.
