# What the sky costs the GPU

A living record of the measurements made with `tools/measure/gpu.sh`
(protocol: F2 in `docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md`).
The method and the rerun instructions come first; then one section per
run, and a new run (the F4 shader, a Mac mini) is appended at the end. The
earlier, rougher numbers are in `spike/RESULTS.md`.

Every number in a run's section comes from that run's `rows.tsv`, from its
`report.md` (`tools/measure/gpu.sh report <dir>`, which cuts the
powermetrics log into the rows and gives the mW column and the deltas), or,
for the MHz, residency and mW-sd columns, from the same powermetrics log
read over the same window as `report.md` uses (`report.mjs` parses those
two lines but does not print them; the script that did is noted under the
run). Where two numbers are combined, the arithmetic is shown. Raw data
lives under `.preview/measure/out/`, which git ignores, so the tables here
are the lasting copy.

## How the numbers are made

- **device %** is ioreg's `Device Utilization %` for the `IOAccelerator`,
  read once a second for the row's sample window (30 s by default) and
  given as mean ± sample standard deviation. It is the whole GPU: every
  process, WindowServer's compositing included. It is read at whatever
  clock the GPU happens to run, so the same device % at two different
  clocks is not the same amount of work.
- **GPU mW**, **MHz** and **residency** come from `powermetrics --samplers
  gpu_power` (one sample a second, root): `GPU Power`, `GPU HW active
  frequency` and `GPU HW active residency`, averaged over the samples whose
  timestamp falls in `(start + 0.5 s, end + 0.5 s]` of the row's sample
  window. Also the whole machine's GPU. The M1 Pro's GPU steps 389, 486,
  648, 778, 972 and 1296 MHz; a row's MHz is a mean over the second-by-
  second readings, not a step.
- **Per-process GPU time** (`GPU ms/s` in powermetrics' task table, which
  divided by ten is what Activity Monitor is believed to show as "% GPU";
  see the 2026-10-26 run) **is 0.00 for every process in every sample on
  macOS 27.0** (checked in the log: the `ghostty` and `WindowServer` rows
  end in `0.00` throughout). So nothing here says what Ghostty alone used;
  everything stands on device % and mW for the whole GPU, and the empty
  shader in the same state is the floor they are read against.
- **Ghostty CPU %** and **WindowServer CPU %** are per-second deltas of the
  two processes' CPU time (`ps -o time`), averaged.
- **fps** exists only for the **probe** shader (`tools/measure/probe.glsl`):
  it paints sixteen vertical bands, a white and a black guard at the edges
  and between them the low fourteen bits of Ghostty's `iFrame`, so a
  screenshot reads as a frame count. For focused and unfocused rows two
  screenshots 4 s apart give frames ÷ seconds. For **covered, minimized and
  tab** the first screenshot is taken before the window is hidden and the
  second after it is shown again, about 43 s apart, so the count also holds
  the visible moments at either end, about 2.3 s in total (the time between
  the first screenshot and the hiding, and between the showing and the
  second screenshot). A count equal to ~2.3 s × 120 fps is a window that
  drew nothing while hidden; `report.md` still prints count ÷ span for such
  rows, which is not a rate. Scenes have no fps: only the probe counts
  frames.
- **A level A row** starts a fresh Ghostty with `--config-default-files=false`,
  the shader and `custom-shader-animation` on its command line, a screen of
  Claude-like text from `tools/measure/term.sh`, the tab marked with
  palette colour 16 (`OSC 4;16;rgb:00/00/01`, without which the sky draws
  nothing) unless the row says unmarked; then the focus state, 10 s settle,
  the sample window, and the instance is killed. Unfocused = Finder
  activated in front; covered = a second, shader-less Ghostty maximized
  over it; minimized = the Dock, via Accessibility; tab = cmd-T, which
  opens a plain unmarked tab in front of the measured one, in the same
  window and under the same shader. While a level A run goes, every live
  session's sky is switched off with the `runtime/hidden` file `/solar`
  uses.
- **A level B row** (`gpu.sh live <label>`) samples the Ghostty already
  running, with the mod's own policy and whatever Vincent put on screen; the
  label is the only description of the state, and `rows.tsv` records no
  animation setting for it.
- **Scenes** are the sky rendered once per commit and scene by
  `tools/measure/scenes.sh` into `.preview/measure/<sha>/<scene>.glsl`;
  the GLSL depends only on the scene flags. The row records the file's
  sha256 prefix.
- **`--force`** lets a row run past a failed preflight (battery, a busy
  process, Finder windows). It leaves no trace in `context.txt` or
  `rows.tsv`; the preflight's complaint goes to stderr only, so a run's
  notes have to say when it was used.

## How to rerun

The measurement runs from Vincent's own terminal (Terminal.app with Screen
Recording and Accessibility), never from a Claude session: it takes focus,
opens windows and hides the live skies. `sudo -v` first, since powermetrics
needs root and sudo forgets after five minutes; the preflight refuses on
battery, beside a process over 20 % CPU, or with Finder windows open.

```
sudo -v && tools/measure/gpu.sh plan --twice          # the whole list, ABBA, ~75 min, leave the Mac
sudo -v && tools/measure/gpu.sh row probe true focused idle          # one controlled row
sudo -v && tools/measure/gpu.sh row ljus-himmel:day-clear true focused spinner
sudo -v && tools/measure/gpu.sh live "solar-12:30 ofokus"            # the running Ghostty, as it is
tools/measure/gpu.sh report .preview/measure/out/<folder>            # markdown from rows.tsv + powermetrics*.log
tools/measure/gpu.sh plan --dry-run                                  # the list and the minutes, nothing run
tools/measure/gpu.sh decode <probe-NNN-a.png>                        # the frame count in a screenshot
```

For unfocused live rows after the sweep, six minutes of silence in every
Claude session first (each answer starts a new five-minute `always`). For
the 60 Hz rows, set the display to 60 Hz, run the two rows, set it back.
Check afterwards that `powermetrics-*.log` exists in the folder and that
`report` shows mW. Write down in the run's section whether `--force` was
needed and what else the machine was doing.

For the next run: give the scene shaders the probe's frame counter in a
corner (sixteen small bands behind the text area, or a strip along the
bottom edge), so scenes get an fps column and the dropped-frames inference
in the first run becomes a measurement. The second improvement is the
Metal HUD (`MTL_HUD_ENABLED=1` on a direct exec) or another per-process
reading, to replace the `GPU ms/s` column macOS 27 emptied. Printing MHz
and residency from `report.mjs` (it already parses them) would make those
columns reproducible with `gpu.sh report`.

## Run 2026-10-26: M1 Pro, built-in display, level A, B and 60 Hz

### Context

- MacBookPro18,3, Apple M1 Pro, 32 GB; macOS 27.0 (26A428); Ghostty 1.3.1;
  built-in Color LCD 3024 × 1964 at 120 Hz, no external display; AC power,
  no thermal warning; uptime 41 days.
- Level A: `gpu.sh plan` at commit `f347d94` on `gpu-matning`, 17:19–17:53,
  45 rows, one pass (no ABBA), settle 10 s, sample 30 s, with sudo. Load
  average 1.81 at start. Folder `.preview/measure/out/2026-10-26T171840/`.
- Scenes: `ljus-himmel` = commit `0bae2fb` (the brighter sky with the rim
  round the text; `day-clear` sha `89272b7a0789`, `night-lit`
  `cc466523bfcf`), `main` = commit `23d36f2` (`day-clear` `af7c1319f745`,
  `night-lit` `70fa7b81935b`). `day-clear` is `--at 2026-10-26T12:30
  --weather 1,10,3,20 --stage 480`; `night-lit` is `--at 2026-10-26T22:00
  --weather 0,5,2,10 --beacon asking --stage 480`. The screenshots
  `probe-0NN-scene.png` show each scene was drawn.
- Level B: `gpu.sh live`, two batches in one folder (`…/2026-10-26-live/`;
  `context.txt` is written once per folder, at the first row): live 1–4
  at 19:23–19:29 at commit `28eedac`, load average 6.55 and four users at
  the first row; live 5–8 at 20:33–20:39 after `b85f58c` (20:32).
- Single rows (`gpu.sh row`, folder `…/2026-10-26-rows/`): a probe check
  at 17:15 (commit `fb4b4bf`, 120 Hz), and the two 60 Hz rows at
  20:40–20:42, after `b85f58c`, run with `--force` past a failed preflight
  (the handoff's note; `--force` leaves no trace in the files).
- The mod's policy at the time (`hooks/beacon.ts`, `animationOf`): `always`
  while the lighthouse beam sweeps (the first 5 minutes after any session
  starts waiting, unless the person is away), `false` when the lighthouse
  is lit but no longer sweeping, when the person is away, on battery, or
  when nothing in the sky is lively (`livelyAt` in `hooks/register.tsx`:
  an event, rain or snow, forced wind, a fire, or a demo), and `true`
  otherwise.
- MHz, residency and the mW sd quoted below were read from
  `powermetrics.log` with a scratch script using `report.mjs`'s window;
  they are not in `rows.tsv` or `report.md`.

### The floor and what each setting really draws (rows 1–20, probe)

| # | shader | animation | focus | activity | device % | Ghostty CPU % | WS CPU % | GPU mW | MHz | resid. % | frames / s | fps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | none | true | focused | idle | 0.5 ± 0.8 | 1.8 | 3.6 | 11 | 473 | 1.7 | – | – |
| 2 | passthrough | true | focused | idle | 36.8 ± 0.4 | 16.9 | 62.9 | 797 | 389 | 75.6 | – | – |
| 3 | passthrough | true | unfocused | idle | 1.1 ± 5.8 | 0.0 | 1.4 | 8 | 43 | 0.9 | – | – |
| 4 | probe | true | focused | idle | 36.3 ± 0.6 | 16.3 | 62.9 | 781 | 389 | 74.6 | 543 / 4.53 | 119.8 |
| 5 | probe | true | unfocused | idle | 1.2 ± 6.6 | 0.0 | 1.2 | 1 | 13 | 0.8 | 0 / 4.51 | 0.0 |
| 6 | probe | true | covered | idle | 1.4 ± 6.0 | 0.0 | 5.5 | 21 | 434 | 3.0 | 274 / 43.50 | 6.3 * |
| 7 | probe | true | minimized | idle | 1.3 ± 6.8 | 0.0 | 1.5 | 0 | 54 | 0.1 | 273 / 42.56 | 6.4 * |
| 8 | probe | true | tab | idle | 43.4 ± 0.7 | 17.2 | 60.4 | 817 | 389 | 74.2 | 345 / 43.62 | 7.9 * |
| 9 | probe | false | focused | idle | 36.5 ± 0.6 | 17.4 | 63.0 | 783 | 389 | 75.1 | 545 / 4.62 | 118.1 |
| 10 | probe | false | unfocused | idle | 1.2 ± 6.6 | 0.0 | 1.1 | 0 | 0 | 0.0 | 0 / 4.51 | 0.0 |
| 11 | probe | false | covered | idle | 1.5 ± 6.0 | 0.0 | 2.9 | 14 | 431 | 2.1 | 273 / 43.46 | 6.3 * |
| 12 | probe | false | minimized | idle | 1.2 ± 6.6 | 0.0 | 1.4 | 16 | 54 | 1.6 | 270 / 42.49 | 6.4 * |
| 13 | probe | false | tab | idle | 43.2 ± 1.8 | 16.3 | 58.0 | 831 | 389 | 73.2 | 340 / 43.53 | 7.8 * |
| 14 | probe | always | focused | idle | 36.2 ± 0.5 | 17.5 | 62.7 | 782 | 389 | 75.1 | 542 / 4.53 | 119.7 |
| 15 | probe | always | unfocused | idle | 32.3 ± 0.6 | 15.1 | 57.2 | 730 | 398 | 65.8 | 509 / 4.48 | 113.6 |
| 16 | probe | always | covered | idle | 26.1 ± 0.6 | 13.0 | 56.4 | 526 | 389 | 62.0 | 4973 / 43.48 | 114.4 * |
| 17 | probe | always | minimized | idle | 1.2 ± 6.6 | 0.3 | 1.5 | 13 | 27 | 1.3 | 271 / 42.53 | 6.4 * |
| 18 | probe | always | tab | idle | 43.0 ± 0.7 | 16.6 | 60.0 | 816 | 389 | 74.0 | 339 / 43.60 | 7.8 * |
| 19 | probe | false | focused | blink | 36.9 ± 0.4 | 16.3 | 63.1 | 788 | 389 | 75.9 | 545 / 4.55 | 119.9 |
| 20 | probe | false | focused | spinner | 36.6 ± 0.5 | 17.0 | 63.0 | 788 | 389 | 75.4 | 545 / 4.54 | 120.1 |

\* frames span the hidden stretch (see the method): ~270 frames in ~43 s
is the ~2.3 visible seconds at 120 fps and nothing while hidden; 4973 is
drawing throughout.

The unfocused means are one sample, not a level: mean 1.07 % with sd 5.84
over 30 samples (row 3) is exactly one sample at 32 % and 29 at 0, and the
same arithmetic holds for rows 5, 10, 22, 28, 34 and 37 (one sample at the
focused level, 29 at 0). The mW column on those rows is the same kind of
thing (row 22: 165 mW with sd 873), and there the sample can be placed: it
sits 30.2–30.4 s after the row's `start`, past its `end` (30.05–30.08 s),
and is pulled in by `report.mjs`'s `(start + 0.5, end + 0.5]` window; it is
the refocus, when the harness brings the window back to front to end the
row. The ioreg sample lies inside the 30 s window and cannot be placed from
the data. The steady unfocused state under `true` and `false` is 0 % and
0 mW.

Read as a semantics table (fps, device %):

| animation | focused | unfocused | covered | minimized | hidden tab |
|---|---|---|---|---|---|
| true | 119.8, 36.3 % | 0.0, 1.2 % | 0 *, 1.4 % | 0 *, 1.3 % | 0 *, 43.4 % |
| false | 118.1, 36.5 % | 0.0, 1.2 % | 0 *, 1.5 % | 0 *, 1.2 % | 0 *, 43.2 % |
| always | 119.7, 36.2 % | 113.6, 32.3 % | 114.4, 26.1 % | 0 *, 1.2 % | 0 *, 43.0 % |

\* "0" here is the inference from ~270–345 frames in ~43 s; `report.md`
prints these cells as 6.3–7.9 fps, the count divided by the whole span.

### The scenes (rows 21–45) and what they cost over the empty shader

"Over floor" is the scene minus the empty shader (passthrough, or the
probe, which costs the same) with the same animation and focus. No floor
was measured with a spinner, so the spinner rows (26, 32) are read against
the idle passthrough. The deltas are `report.md`'s, computed from unrounded
means, so they can differ by 1 mW from subtracting the rounded columns.
MHz and residency are the whole GPU's during the row.

| # | scene | animation | focus | activity | device % | over floor | GPU mW | over floor | MHz | resid. % | Ghostty CPU % | WS CPU % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 21 | ljus-himmel:day-clear | true | focused | idle | 80.9 ± 1.1 | +44.1 | 12863 | +12066 | 1228 | 99.5 | 10.7 | 52.2 |
| 22 | ljus-himmel:day-clear | true | unfocused | idle | 2.6 ± 14.2 | +1.5 | 165 | +157 | 57 | 1.4 | 0.0 | 1.3 |
| 23 | ljus-himmel:day-clear | false | focused | idle | 81.3 ± 0.7 | +44.9 | 12816 | +12033 | 1222 | 99.6 | 10.5 | 52.0 |
| 24 | ljus-himmel:day-clear | always | focused | idle | 81.0 ± 0.6 | +44.9 | 12999 | +12217 | 1228 | 99.6 | 10.8 | 52.2 |
| 25 | ljus-himmel:day-clear | always | unfocused | idle | 76.9 ± 1.5 | +44.6 | 11247 | +10516 | 1150 | 95.8 | 10.2 | 53.7 |
| 26 | ljus-himmel:day-clear | true | focused | spinner | 77.6 ± 0.7 | +40.8 | 13451 | +12654 | 1267 | 97.3 | 12.0 | 53.5 |
| 27 | ljus-himmel:night-lit | true | focused | idle | 86.0 ± 0.2 | +49.2 | 15797 | +15001 | 1296 | 99.9 | 4.9 | 51.1 |
| 28 | ljus-himmel:night-lit | true | unfocused | idle | 2.8 ± 15.5 | +1.8 | 354 | +346 | 43 | 2.4 | 0.0 | 1.3 |
| 29 | ljus-himmel:night-lit | false | focused | idle | 86.2 ± 0.4 | +49.7 | 15678 | +14894 | 1296 | 99.9 | 5.6 | 49.9 |
| 30 | ljus-himmel:night-lit | always | focused | idle | 86.0 ± 0.0 | +49.8 | 15769 | +14987 | 1296 | 99.8 | 5.0 | 50.0 |
| 31 | ljus-himmel:night-lit | always | unfocused | idle | 78.9 ± 0.6 | +46.6 | 13799 | +13069 | 1273 | 96.9 | 10.2 | 52.7 |
| 32 | ljus-himmel:night-lit | true | focused | spinner | 86.0 ± 0.0 | +49.2 | 15849 | +15052 | 1296 | 100.0 | 4.9 | 51.0 |
| 33 | main:day-clear | true | focused | idle | 75.5 ± 1.0 | +38.7 | 4097 | +3300 | 785 | 98.5 | 13.1 | 56.6 |
| 34 | main:day-clear | true | unfocused | idle | 2.4 ± 13.3 | +1.4 | 0 | −8 | 14 | 0.0 | 0.0 | 1.5 |
| 35 | main:day-clear | always | unfocused | idle | 71.8 ± 1.8 | +39.6 | 3472 | +2741 | 743 | 90.3 | 13.1 | 57.4 |
| 36 | main:night-lit | true | focused | idle | 76.0 ± 1.1 | +39.2 | 5629 | +4832 | 892 | 96.4 | 12.6 | 55.5 |
| 37 | main:night-lit | true | unfocused | idle | 2.5 ± 13.5 | +1.4 | 163 | +155 | 44 | 2.8 | 0.0 | 1.1 |
| 38 | main:night-lit | always | unfocused | idle | 73.0 ± 2.0 | +40.8 | 4794 | +4064 | 835 | 91.7 | 12.7 | 56.3 |
| 39 | ljus-himmel:day-clear, unmarked tab | true | focused | idle | 46.9 ± 0.9 | +10.1 | 1016 | +219 | 389 | 85.8 | 16.0 | 62.6 |
| 40 | main:day-clear, unmarked tab | true | focused | idle | 41.5 ± 0.5 | +4.7 | 935 | +138 | 389 | 82.2 | 16.7 | 64.2 |
| 41 | ljus-himmel:day-overcast | true | focused | idle | 87.0 ± 0.2 | +50.2 | 15545 | +14748 | 1296 | 100.0 | 3.7 | 50.3 |
| 42 | ljus-himmel:night-dark | true | focused | idle | 99.2 ± 0.4 | +62.4 | 17864 | +17067 | 1296 | 100.0 | 3.2 | 50.5 |
| 43 | ljus-himmel:day-leaves | true | focused | idle | 100.0 ± 0.2 | +63.2 | 18420 | +17624 | 1296 | 100.0 | 2.6 | 9.3 |
| 44 | ljus-himmel:milestone | true | focused | idle | 100.0 ± 0.2 | +63.2 | 16046 | +15250 | 1296 | 100.0 | 1.5 | 5.7 |
| 45 | ljus-himmel:comet | true | focused | idle | 95.0 ± 0.0 | +58.2 | 17237 | +16441 | 1293 | 99.3 | 3.1 | 49.6 |

Floors used: rows 21, 26, 27, 32, 33, 36, 39–45 against passthrough true
focused (row 2); rows 22, 28, 34, 37 against passthrough true unfocused
(row 3); rows 23 and 29 against probe false focused (row 9); rows 24 and 30
against probe always focused (row 14); rows 25, 31, 35, 38 against probe
always unfocused (row 15).

Branch against main, same state (from the table):

| scene, state | device % main → branch | mW main → branch | mean MHz main → branch |
|---|---|---|---|
| day-clear, true focused idle | 75.5 → 80.9 | 4097 → 12863 | 785 → 1228 |
| day-clear, always unfocused idle | 71.8 → 76.9 | 3472 → 11247 | 743 → 1150 |
| night-lit, true focused idle | 76.0 → 86.0 | 5629 → 15797 | 892 → 1296 |
| night-lit, always unfocused idle | 73.0 → 78.9 | 4794 → 13799 | 835 → 1273 |
| day-clear, unmarked tab, true focused | 41.5 → 46.9 | 935 → 1016 | 389 → 389 |

### Level B (the live Claude tab, the mod's own policy) and the 60 Hz rows

Live rows have no animation column. The "policy" column is inferred from
the label, the time and `animationOf`: `/solar 12:30` pins a clear noon,
which is not lively, so with no session waiting it gives `false`; a
balloon is an event, so `true`; an open question gives `always` for five
minutes and `false` after, and a wait in any session counts. The numbers
do not depend on getting this right for the focused rows, since `false`
and `true` draw the same while focused (question 1 below).

mW exists for one row only. For live 1–4 the first version of `gpu.sh
live` wrote one `powermetrics.log` per row over the previous one, and the
file is root's, so only row 4's survived. For live 5–8 and the 60 Hz rows,
`b85f58c` tried to append to that root-owned file, got "permission denied"
and still cut the row's part out (the handoff's account). `eed15bd` gives
each stretch its own `powermetrics-HHMMSS.log`; not yet run with sudo. The
5306 mW for live 1 in the handoff was read off a log since overwritten and
is not in any file; it is listed as such.

| row | time | label | policy at the time (inferred) | device % | Ghostty CPU % | WS CPU % | GPU mW |
|---|---|---|---|---|---|---|---|
| live 1 | 19:23 | solar-12:30 fokus | `false` (pinned clear noon, nothing lively), focused | 68.7 ± 1.5 | 18.8 | 51.0 | 5306 (hand-read, log overwritten) |
| live 2 | 19:26 | fråga öppen ofokus | `always` (sweep), unfocused | 67.9 ± 1.7 | 15.7 | 56.5 | – |
| live 3 | 19:27 | ballong fokus | `true` (event), focused | 78.1 ± 2.2 | 20.6 ± 12.2 | 55.3 | – |
| live 4 | 19:28 | claude arbetar fokus | `false` (as live 1; working is not a wait), focused, terminal busy | 79.9 ± 1.4 | 15.0 | 51.3 | 6867 (1008 MHz, 94.8 % resid.) |
| live 5 | 20:33 | fråga öppen ofokus | `always` (sweep), unfocused | 74.3 ± 1.6 | 14.8 | 55.7 | – |
| live 6 | 20:34 | ballong fokus | `true` (event), focused | 80.1 ± 1.9 | 20.7 ± 14.5 | 54.7 | – |
| live 7 | 20:37 | solar-12:30 ofokus (at the sweep's end) | `false` (sweep over), unfocused | 49.2 ± 7.0 | 5.3 | 10.3 | – |
| live 8 | 20:38 | ballong ofokus | `false` or `true` (after the sweep), unfocused | 50.5 ± 7.0 | 4.8 | 27.4 ± 29.1 | – |
| rows 1 | 17:15 | probe true focused idle, 120 Hz | – | 38.4 ± 1.4 | 18.4 | 60.9 | 834 (389 MHz, 76.1 %), 119.8 fps |
| rows 2 | 20:40 | probe true focused idle, **60 Hz**, `--force` | – | 19.6 ± 5.0 | 7.0 | 43.6 | –, 59.8 fps |
| rows 3 | 20:42 | ljus-himmel:day-clear true focused idle, **60 Hz**, `--force` | – | 77.9 ± 3.7 | 10.1 | 46.6 | – |

The live sky at the time was main's sky (the mirror runs main's code), with
Vincent's real terminal content and other sessions open; the live rows are
not comparable with the controlled rows number for number, only in shape.

### The six questions

1. **Does `false` draw at vsync while focused?** Yes. The probe under
   `false` focused drew 118.1 fps idle (row 9), 119.9 blinking (19) and
   120.1 with a spinner (20), the same as `true` (119.8, row 4) and
   `always` (119.7, row 14), at the same device % (36.2–36.9) and mW
   (781–788). The scenes agree: `false` focused costs what `true` focused
   costs (day 12816 vs 12863 mW, night 15678 vs 15797). Unfocused, `false`
   drew 0 frames (row 10), as `true` did. In Ghostty 1.3.1 on macOS,
   `custom-shader-animation = false` behaves as `true` while the window is
   in front, with a steady, non-blinking cursor on screen and the terminal
   otherwise quiet (row 9); whether a terminal with no cursor at all would
   differ was not measured.
2. **`true` unfocused (the missing row).** Free: 0 frames (row 5) and, for
   29 of 30 seconds, 0 % and 0 mW (the one-sample arithmetic above). The
   scenes' unfocused means, +1.4 to +1.8 points and −8 to +346 mW over the
   unfocused floor (rows 22, 28, 34, 37), are the same single sample and
   are best read as 0.
3. **`always` unfocused against focused, for the branch.** Nearly the full
   price. The probe keeps drawing at 113.6 fps (row 15). Branch day-clear
   11247 mW unfocused against 12999 focused (rows 25, 24: 87 %, 1752 mW
   less), night-lit 13799 against 15769 (rows 31, 30: 88 %, 1970 mW less);
   in device % 76.9 against 81.0 and 78.9 against 86.0. For main there is
   no `always` focused row; its `always` unfocused rows stand against
   `true` focused: 3472 against 4097 (rows 35, 33) and 4794 against 5629
   (38, 36). What the 12–15 % saved unfocused is, the data does not say:
   the probe saves only 52 mW (782 → 730, 6.6 %), so it is not just the
   compositing of an unseen window; the probe also drew fewer frames
   (113.6 against 119.7) and the branch's mean clock fell (1228 → 1150
   MHz by day, 1296 → 1273 by night). Fewer frames, a lower clock and no
   compositing are the candidates; n = 1 for each.
4. **Hidden tab, minimized, covered.** Under `true` and `false` all three
   stop drawing (rows 6, 7, 8, 11, 12, 13: 270–345 frames over 42–44 s,
   the visible moments at either end), but that is the unfocused rule
   doing it: a covered or tabbed-away surface is also unfocused. Only the
   `always` rows test occlusion itself. There, minimized stops (row 17,
   271 frames) and the hidden tab stops (row 18, 339), but **covered keeps
   drawing at 114.4 fps** (row 16, 4973 frames) at 26.1 % and 526 mW.
   Inference: macOS did not report the window as occluded under the
   opaque, maximized cover Ghostty; whether the cover left any part of the
   measured window showing (a title bar, a corner) was not checked, so the
   row says "a window covered this way keeps drawing under `always`", not
   more. A hidden tab draws nothing under any setting, but the plain tab
   in front of it runs the same shader: 43.0–43.4 % and 816–831 mW (rows
   8, 13, 18), about 7 points more than the single focused probe window
   (36.3 %, 781 mW); the extra is unexplained (inference: the second
   surface's own buffers, or the tab bar).
5. **The floor.** No shader: 0.5 % and 11 mW (row 1). The passthrough
   shader, focused, idle: 36.8 % and 797 mW at the GPU's lowest step
   (389 MHz, 75.6 % residency), with Ghostty at 16.9 % CPU and WindowServer
   at 62.9 % (row 2). The probe costs the same (36.3 %, 781 mW). So any
   custom shader at all, even one that copies the terminal through, puts
   the GPU at ~37 % device at 120 Hz; that is Ghostty's draw loop plus
   compositing, and no shader code reaches it. Unfocused the floor is
   1.1 % / 8 mW (row 3), which is again one sample and 0.
6. **Branch against main, day and night.** Focused, `true`, idle:
   day-clear 4097 → 12863 mW and 75.5 → 80.9 %; night-lit 5629 → 15797 mW
   and 76.0 → 86.0 % (rows 33, 21, 36, 27). Over the floor (row 2): day
   3300 → 12066 mW, **3.7×**; night 4832 → 15001 mW, **3.1×**. In device
   points the ratio is 38.7 → 44.1 (1.14×) and 39.2 → 49.2 (1.25×), but
   device % is at its ceiling for these rows, see below. The branch also
   raises the GPU's mean clock: main day-clear 785 MHz, the branch 1228;
   main night 892, the branch 1296, which is the top step, with 99.9 %
   active residency. Unmarked tab: branch +10.1 points and +219 mW over
   passthrough, main +4.7 and +138 (rows 39, 40). The event and dark
   scenes on the branch (rows 41–45): day-overcast 87.0 % / 15545 mW,
   night-dark 99.2 / 17864, day-leaves 100.0 / 18420, milestone 100.0 /
   16046, comet 95.0 / 17237, all at 1293–1296 MHz and 99.3–100 %
   residency.

### 20 % against 75 %: two measures of different things

The "~20 % GPU" in the plan was Vincent's quick reading the day before,
"probably Activity Monitor" (plan, "Vad vi vet"); the spike itself recorded
Ghostty at 17–20 % **CPU** and 73–76 % Device Utilization, not a
per-process GPU figure. The explanation the plan gives, and which this run
could not verify, is that Activity Monitor's "% GPU" per process is
powermetrics' per-process GPU time, `GPU ms/s`, divided by ten: the share
of GPU time that process's command buffers took. ioreg's Device
Utilization is the whole GPU, Ghostty and WindowServer and everything
else, and the empty passthrough shader is already at 36.8 % of it at
120 Hz. If that is what the two numbers are, they never measured the same
thing and neither is wrong.

There is a tension in it: on macOS 27.0 the per-process column is 0.00 for
every process in every sample, so if Activity Monitor draws on the same
source it would show 0 % for Ghostty today, and the 20 % was either read
on a different source or before whatever changed it. Nobody checked
Activity Monitor during this run. Either way this run cannot give
Ghostty's own share at all. Everything in this document is the whole GPU,
read as scene minus empty shader in the same state. For F4 this means the
target written as "Ghostty's GPU ms/s ≤ 50 % of the branch's baseline"
has no instrument until powermetrics reports per-process time again, or
another one is found (Metal's HUD, `MTL_HUD_ENABLED=1`, or Xcode's GPU
report, both unmeasured here); until then the F4 comparison has to be
made in the two measures this harness has, device points and mW over the
floor, with MHz and residency alongside so a change in clock is not
mistaken for a change in work.

Two further things about the measures, from this run:

- **Device % saturates.** Every focused branch scene sits at 77.6–100 %
  device (80.9–100.0 idle), the event and dark scenes at 95–100 % with
  99.3–100 % active residency at 1293–1296 MHz. At that point device %
  cannot rise further whatever the shader costs; mW still moves (milestone
  16046, leaves 18420 at the same 100 %), so **mW is the measure that
  separates heavy scenes**. A GPU at 100 % residency on its top step has
  no headroom, which by inference means frames are being dropped (see the
  caveats); the frame count that would settle it does not exist for
  scenes.
- **mW is not linear in work either.** Power rises faster than clock
  (roughly frequency × voltage²), and the branch runs the GPU at a higher
  mean clock than main. An inference, not a measurement: using active
  residency × mean MHz as a proxy for busy GPU cycles, passthrough is
  0.756 × 389 = 294, main day-clear 0.985 × 785 = 773, branch day-clear
  0.995 × 1228 = 1222; over the floor that is 479 against 928, **1.9×** in
  cycles against 3.7× in mW. Night: main 0.964 × 892 = 860, branch
  0.999 × 1296 = 1295, over floor 566 against 1001, **1.8×** against
  3.1×. The night branch figure is a lower bound, since at 99.9 %
  residency on the top step the GPU had nothing more to give. The truth
  about how much more work the branch does lies between the two ratios,
  probably nearer the cycle one.

### What this means for `animationOf`

Findings and their implications; the policy itself is task 6, a question
for Vincent.

- **`false` saves nothing while the window is in front.** The still-sky
  rule (`!isLively`), the battery rule and the "lit but not sweeping"
  lighthouse all return `false`, and in Ghostty 1.3.1 that draws at vsync
  exactly like `true` (question 1). Those rules change nothing on this
  machine as long as the window is focused. They are not wrong, they are
  inert; what they would need to save GPU is a lighter shader, not a still
  one, or a Ghostty that honours `false` (the probe is a ready repro for an
  issue: `false`, focused, a steady cursor, 118 fps).
- **`true` unfocused is free, as the spike said without numbers.** The
  default branch of the policy costs nothing when the window is not in
  front, hidden, covered or minimized (questions 2 and 4).
- **`always` is the only setting that costs anything unfocused, and it
  costs nearly everything**: 87–88 % of the focused mW for the branch,
  and it draws a window covered the way this run covered it at full frame
  rate (questions 3 and 4). The mod uses it for the five-minute beam sweep
  after a session starts waiting. The live rows point the same way, with
  the reservation that they were taken on a busy machine (load 6.55) and
  that live 7–8 show ~50 % device belonging to something other than
  Ghostty: with a question open and the window unfocused the live tab
  stood at 67.9 % (live 2) and 74.3 % (live 5), in the range of the
  focused rows (68.7 for the same pinned scene, 78–80 for the busier
  states), not at the ~0 % an unfocused `true` window would give. As a
  usage inference: every answer from Claude starts a new wait, so a person
  who keeps several sessions going may be inside a sweep much of the time.
- **A plain tab in front of the sky pays for the shader** (43 % against
  37 %, rows 8, 13, 18), and an unmarked visible tab on the branch pays
  +10.1 points and +219 mW over passthrough (row 39), main +4.7 and +138
  (row 40). F4's "within 5 points of passthrough" is missed by the branch
  and met by main by 0.3 of a point with n = 1, which is not a margin. F4
  post 3 (return `term.rgb` before any glass or text work when the tab is
  unmarked) addresses it.
- **The focused price is the whole price.** Everything the mod can decide
  about animation only matters unfocused, where `true` already costs
  nothing. What the sky costs while someone looks at it is set by the
  shader, the window's pixels and 120 Hz, and that is F4's ground.

What Vincent decided (task 6, 2026-10-26):

1. `animationOf` stays as it is. In F4 the still-sky and battery rules get
   a lighter shader (no rim, no clouds, fewer samples) instead of a still
   one, measured with the same harness, since that is what saves GPU while
   the window is in front.
2. A report to Ghostty (an "Issue Triage" discussion) is drafted in
   `docs/superpowers/ghostty-discussion-draft.md`; Vincent checks the repro
   himself, edits it and posts it.
3. The sweep keeps `always` for five minutes and gets an unfocused path in
   the shader (F4 post 8: `iFocus == 0` skips the rim and the text test);
   Vincent approves the visible difference on screenshots.
4. F4 starts now from this single pass. Its bench and rim work (tasks 0–1)
   use the preview and need no new run; the harness is run again with
   `--twice` on a quiet machine, the 60 Hz rows with mW, before F4's
   merged shader is compared. F4's targets are stated in device points and
   mW over the floor, with mean MHz and residency alongside.

### The baseline F4 measures against

The branch `ljus-himmel` (commit `0bae2fb`), level A, this machine at
120 Hz, from the rows named: focused idle, focused with the spinner,
`always` unfocused and `true` unfocused, and the unmarked tab. F4's work is
measured as the same rows on the changed shader, scene minus the empty
shader in the same state (the spinner rows against the idle passthrough,
as above).

| scene | setting | device % | over floor | GPU mW | over floor | MHz | resid. % | row |
|---|---|---|---|---|---|---|---|---|
| day-clear | true, focused, idle | 80.9 | +44.1 | 12863 | +12066 | 1228 | 99.5 | 21 |
| day-clear | true, focused, spinner | 77.6 | +40.8 | 13451 | +12654 | 1267 | 97.3 | 26 |
| day-clear | always, unfocused, idle | 76.9 | +44.6 | 11247 | +10516 | 1150 | 95.8 | 25 |
| day-clear | true, unfocused, idle | 2.6 (one sample; 0) | +1.5 | 165 | +157 | 57 | 1.4 | 22 |
| day-clear, unmarked tab | true, focused, idle | 46.9 | +10.1 | 1016 | +219 | 389 | 85.8 | 39 |
| night-lit | true, focused, idle | 86.0 | +49.2 | 15797 | +15001 | 1296 | 99.9 | 27 |
| night-lit | true, focused, spinner | 86.0 | +49.2 | 15849 | +15052 | 1296 | 100.0 | 32 |
| night-lit | always, unfocused, idle | 78.9 | +46.6 | 13799 | +13069 | 1273 | 96.9 | 31 |
| night-lit | true, unfocused, idle | 2.8 (one sample; 0) | +1.8 | 354 | +346 | 43 | 2.4 | 28 |

And main (commit `23d36f2`), the same way:

| scene | setting | device % | over floor | GPU mW | over floor | MHz | resid. % | row |
|---|---|---|---|---|---|---|---|---|
| day-clear | true, focused, idle | 75.5 | +38.7 | 4097 | +3300 | 785 | 98.5 | 33 |
| day-clear | always, unfocused, idle | 71.8 | +39.6 | 3472 | +2741 | 743 | 90.3 | 35 |
| day-clear, unmarked tab | true, focused, idle | 41.5 | +4.7 | 935 | +138 | 389 | 82.2 | 40 |
| night-lit | true, focused, idle | 76.0 | +39.2 | 5629 | +4832 | 892 | 96.4 | 36 |
| night-lit | always, unfocused, idle | 73.0 | +40.8 | 4794 | +4064 | 835 | 91.7 | 38 |

The floor (row 2): 36.8 % and 797 mW at 389 MHz; no shader (row 1) 0.5 %
and 11 mW.

On F4's hypothesis that the rim (`shade()`) is 35–50 % of the branch's own
cost: this run cannot test it. What it separates is the whole difference
between main and the branch, which is the rim, `glass()`,
`isTextOnGlass()` and `LUMINANCE` 0.8 together, so the share it gives is an
upper bound on the rim's. That whole difference is 12066 − 3300 = 8766 mW
of the branch's 12066 over the floor by day, **73 %**, and 15001 − 4832 =
10169 of 15001 by night, **68 %**, in mW; in the busy-cycle proxy above it
is 928 − 479 = 449 of 928, **48 %**, by day and 1001 − 566 = 435 of 1001,
**43 %**, by night, with the night branch figure a lower bound. So the
hypothesis is consistent with the cycle proxy, which puts everything the
branch added at a little less than the rest of the sky (449 against 479,
435 against 566), and smaller than the mW share, which puts it at two to
three times the rest. Which of the two is nearer the work is the open
point above; F4's own per-part bench (`--without shaded`) is what says how
much of the difference is the rim.

Against F4's other targets, as they stand today: `true` + unfocused is at
the no-shader level already (0 for 29 of 30 s); `always` + unfocused is
within 10 device points of focused (4.2 by day, 7.1 by night) but 12–14 %
lower in mW; the unmarked visible tab is 10.1 points from passthrough on
the branch, against a target of 5.

### Caveats

- **n = 1, one pass, no ABBA.** The only repeated state is the focused
  probe, 36.2–36.9 % in rows 4, 9, 14, 19 and 20, which span 17:21–17:34;
  the scene half of the run (17:35–17:53) has no repeated row, so drift
  there is unmeasured.
- **Scenes have no frame count.** Only the probe reads `iFrame`. Three
  signs say the heavier scenes do not reach 120 fps: WindowServer CPU falls
  from ~63 % under the probe to ~50 % under most scenes and to 9.3 %
  (leaves) and 5.7 % (milestone); Ghostty's CPU falls with the shader's
  weight (probe 16–17 %, main scenes 12.6–13.1, branch day 10.7, branch
  night 4.9, events 1.5–3.7), as a process waiting on the GPU would; and the
  GPU sits at 99.3–100 % active residency at 1293–1296 MHz for every
  branch night and event scene (rows 27, 29, 30, 32, 41–45; main's night
  is at 892 MHz / 96.4 %). That is an inference. If it holds, the mW of the
  saturated rows understate the cost of drawing them in full, and a cheaper
  shader may show up first as more frames and only then as fewer mW.
- **Device % saturates near 75–100 %** for the scenes, and does not follow
  the clock; mW separates them, and mW is itself convex in clock. Read the
  MHz and residency columns with both.
- **The unfocused means are a single sample.** 1.07–2.83 % with sd 5.8–15.5
  over 30 samples is one sample at the focused level and 29 at 0; the mW
  sample is the refocus after `end`. Treat them as 0, not as a small cost.
- **Level B and the 60 Hz rows were taken on a busy machine and without
  mW.** Load average 6.55 at 19:23 against 1.81 for level A; the handoff
  notes `coreduetd` at 95 % and `PerfPowerService` at 35–67 % during rows
  7–8 and the 60 Hz rows, three Claude sessions and a Finder window, and
  the 60 Hz rows needed `--force` past the preflight. Live 7 and 8 (49–50 %
  device with Ghostty at ~5 % CPU and WindowServer at 10–27 %) therefore
  cannot be attributed: under `false` unfocused the controlled probe draws
  nothing, so most of that GPU load is something else's. mW is missing for
  live 1–3 and 5–8 and both 60 Hz rows, for the two reasons given with the
  table.
- **The 60 Hz comparison is inconclusive.** The probe halved as expected
  (38.4 % and 834 mW at 120 Hz, 19.6 % at 60 Hz, 59.8 fps). The branch's
  day-clear fell only from 80.9 to 77.9 %. The handoff read that as the
  branch not reaching 120 fps at 120 Hz; it may be, but device % at an
  unknown clock cannot show it: the probe runs at the lowest step and
  cannot clock down further, while a scene at a 1228 MHz mean can halve
  its clock and keep its device % when the frames halve. It needs the row
  again with mW and MHz on a quiet machine.
- **The live rows are not the controlled scene.** They are whatever the
  mod drew at that hour with Vincent's terminal content; the labels are
  the only record of the state, and the policy column above is inferred
  from them.
- **Hidden-stretch rows mix visible and hidden time** (method), so their
  fps cells in `report.md` (6.3–7.9) are not a rate; the frame counts are.
- **The raw data is outside git** (`.preview/` is ignored); the tables here
  are the record, and `rows.tsv` for this run is 45 rows at
  `.preview/measure/out/2026-10-26T171840/`.
