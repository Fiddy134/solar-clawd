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
sudo -v && tools/measure/gpu.sh plan f4 --twice       # F4 phase 4: that and the same on gpu, ~105 min
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
reading, to replace the `GPU ms/s` column macOS 27 emptied. `report.mjs`
now prints MHz and residency beside the mW in every table that has mW, and
gives this run's columns as quoted here (checked on rows 1–4 and the
branch against main).

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
3. The sweep keeps `always` for five minutes and was to get an unfocused
   path in the shader (F4 post 8: `iFocus == 0` skips the rim). On the
   screenshots Claude Code's grey text faded without the rim on a bright
   day sky, in any window out of focus that redraws, so Vincent dropped
   it; see "F4 phase 2" below.
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

## Bench 2026-10-26: per-stage cost in WebGL (preview)

F4's task 0: what each stage of the sky costs, taken apart with the
preview's `--bench` on the Mac's own GPU. This is a different instrument
from the run above: it times the fragment shader alone in Chrome, not
Ghostty drawing it, so it says how the shader's own work divides between
its stages, not what Ghostty costs the machine.

### Context

- Same machine: MacBookPro18,3, Apple M1 Pro; macOS 27.0; Google Chrome
  155.0.8059.85, headless. Branch `gpu` (main with `ljus-himmel` merged),
  shader at commit `b3e9630`, in which the rim became its own stage.
- **Renderer**, as `WEBGL_debug_renderer_info` gives it and as every run
  printed it: `ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro,
  Unspecified Version)`. The flags are `--use-angle=metal --enable-gpu
  --ignore-gpu-blocklist` (`tools/preview/run.sh shader … --gpu`);
  headless Chrome 155 gives the Metal renderer even with none of them.
  Without `--gpu` the preview stays on SwiftShader.
- **Conditions:** the live sky hidden in every Ghostty window (the
  `runtime/hidden` file, written 21:27), the external display unplugged
  (`system_profiler` listing only the built-in Color LCD, Internal, at
  21:28 and again at 21:32 and 21:43), other apps and Claude sessions
  closed, AC power. `ecosystemd` still used 50–70 % of a CPU core at
  21:29–21:30; load average 3.65 at the start of the main bench, 2.58 at
  its end. Every round reported below was taken after both conditions
  held; there were no earlier rounds.
- **The bench:** `--bench 200 --gpu --width 3024 --height 1964`, i.e. one
  warm-up frame, then 200 frames each followed by a one-pixel
  `readPixels`, so a frame starts only when the one before has finished;
  ms a frame is the wall-clock mean over the 200. Scenes as in the run
  above: `day-clear` = `--at 2026-10-26T12:30 --weather 1,10,3,20 --stage
  480`, `night-lit` = `--at 2026-10-26T22:00 --weather 0,5,2,10 --beacon
  asking --stage 480`. The stand-in terminal is the preview's default
  (seven short lines and a status bar at 13 px, no `--retina`), so text
  covers little of the frame.
- **Configs:** the full shader; `--without <stage>` for each of `clouds`,
  `shaded`, `beacon`, `keeper`, `stars`, `realStars`, `events`, `basket`,
  `aurora` (it drops every line matching `sky = <stage>(`: one line each,
  two for `events`, the before- and after-clouds calls); `floor` = all nine
  dropped at once; `bare` = those and also `weather`, `iss`, `tone`,
  `sunAt`, `moonAt`, `chartLines`, which leaves the gradient, the mask,
  `glass()` and `isTextOnGlass()`; and `--passthrough`, a shader that only
  returns the terminal's texel.
- **Rounds:** four, 21:32:38–21:36:27, all 26 configs per round (13 × 2
  scenes), forward in rounds 1 and 3 and backward in 2 and 4 (ABBA).
  The runs went from a scratch script, `node .preview/shader.bundle.mjs`
  with the flags above, one Chrome per run.

### What each stage costs

**own** = full − passthrough: the shader's work over an empty one.
**cost** = full − without that stage. Mean of four rounds, ms a frame;
the range is the lowest and highest of the four.

`day-clear`: full **8.54** (8.49–8.62), passthrough **2.19** (2.11–2.34),
own **6.34**.

| without | ms a frame | range | cost | share of own |
|---|---|---|---|---|
| shaded (the rim) | 5.44 | 5.39–5.52 | 3.10 | 49 % |
| clouds | 5.59 | 5.57–5.61 | 2.95 | 47 % |
| keeper | 8.25 | 8.23–8.28 | 0.29 | 5 % |
| beacon | 8.29 | 8.25–8.31 | 0.25 | 4 % |
| stars | 8.51 | 8.49–8.53 | 0.03 | 0 % |
| events | 8.52 | 8.50–8.55 | 0.02 | 0 % |
| aurora | 8.52 | 8.49–8.54 | 0.02 | 0 % |
| realStars | 8.53 | 8.51–8.54 | 0.01 | 0 % |
| basket | 8.54 | 8.51–8.60 | −0.01 | 0 % |
| floor (all nine) | 2.27 | 2.18–2.40 | 6.27 | 99 % |
| bare | 2.26 | 2.18–2.30 | 6.28 | 99 % |

`night-lit`: full **9.97** (9.90–10.15), passthrough **2.23** (2.15–2.37),
own **7.74**.

| without | ms a frame | range | cost | share of own |
|---|---|---|---|---|
| shaded (the rim) | 6.83 | 6.79–6.85 | 3.14 | 41 % |
| clouds | 7.30 | 7.28–7.33 | 2.67 | 34 % |
| realStars | 8.34 | 8.31–8.38 | 1.63 | 21 % |
| beacon | 9.59 | 9.58–9.62 | 0.38 | 5 % |
| stars | 9.61 | 9.58–9.65 | 0.36 | 5 % |
| keeper | 9.85 | 9.84–9.86 | 0.12 | 2 % |
| events | 9.88 | 9.88–9.89 | 0.09 | 1 % |
| aurora | 9.91 | 9.88–9.96 | 0.06 | 1 % |
| basket | 9.94 | 9.91–9.96 | 0.03 | 0 % |
| floor (all nine) | 2.38 | 2.35–2.43 | 7.59 | 98 % |
| bare | 2.29 | 2.24–2.35 | 7.69 | 99 % |

The costs do not quite add up: the nine add to 6.66 ms by day against
6.27 for dropping all nine at once, and to 8.48 against 7.59 by night.
Removing one stage seems to save a little of the others' cost too
(registers, occupancy); the single-stage costs are each a little high,
by up to about 10 %, and the shares above should be read that way.

**Spread.** Every config's four rounds lie within 0.13 ms of each other
except night `full` (0.25, its first round at 10.15 against 9.90–9.92),
the two passthroughs and day `floor` (0.22–0.23; the shortest frames are
the noisiest). No drift between the forward and backward rounds.

### A screen full of text

The default stand-in has little text, and `glass()` and
`isTextOnGlass()` run only on text pixels, so a second bench used
`--retina --prose --diff` (paragraphs of 22 px text, Claude Code's dark
diff, prompt and shell fields) on the same scenes: full, passthrough,
bare, `--without shaded` and `--without clouds`, four ABBA rounds,
21:43:39–21:44:50, same conditions.

| scene | full | passthrough | own | bare − passthrough | rim cost | clouds cost |
|---|---|---|---|---|---|---|
| day-clear | 8.82 | 2.13 | 6.69 | 0.73 (11 %) | 2.60 (39 %) | 3.10 (46 %) |
| night-lit | 10.24 | 2.30 | 7.94 | 0.58 (7 %) | 2.49 (31 %) | 2.71 (34 %) |

Ranges: 0.02–0.06 ms for every config but the passthroughs (0.10 and
0.37). `bare − passthrough` is the gradient, the mask, `glass()` and
`isTextOnGlass()` together; it has no stage line of its own, so this is an
upper bound on what the glass costs. The rim costs less here because it
is skipped under glass.

### What it says about F4

- **The rim is 41–49 % of the shader's own work with little text and
  31–39 % with a screen of it** in this bench, against F4's hypothesis of
  35–50 % of the branch's own cost. Consistent, by day at the top of the
  range. Dropping the eight samples that weigh nothing (F4 change 1) is
  aimed at the right thing.
- **The clouds cost as much as the rim:** 47 % by day and 34 % by night
  at 20 % and 10 % cloud cover, which fits the per-pixel slot work F4's
  cost model describes better than the drawing of a few clouds. F4's
  order puts the glass (changes 2 and 4) before the clouds (change 5,
  −5–8 % of the upper half); by this bench the clouds belong next to the
  rim, and changes 5 and 6 may be worth more than the plan expects.
  Neither scene is overcast, so the bench says nothing about a full sky
  of clouds.
- **The glass is small:** at most 0.6–0.7 ms of 6.7–7.9 (7–11 %) even with
  a screen full of text, gradient and mask included. That is in line with
  F4's −2–3 % for change 2 and −2–4 % for change 4, but it puts the glass
  well behind the clouds, not second.
- **`realStars()` is 21 % of the night.** F4 expects at most −3 % from
  change 10 (skipping the twinkle away from the cursor), which may still
  be right for that change, but the stage as a whole is larger than the
  plan's ordering assumes. The night ranking is rim, clouds, realStars,
  then beacon and stars at 5 % each.
- **Events cost nothing when none is up** (0–1 %), as the cost model
  says; these scenes have none, so change 7 is not measured here.
  `keeper`, `beacon` and `basket` together are under 10 %.
- **The empty shader is a fixed 2.1–2.3 ms a frame** here, which is the
  readback and Chrome's own overhead rather than shading: the bare shader
  (gradient, mask, glass, and in this stand-in few text pixels) is within
  0.1 ms of it.

### Caveats

- **WebGL on ANGLE's Metal backend is not Ghostty.** Ghostty compiles
  GLSL 4.30 to SPIR-V to MSL; Chrome compiles GLSL ES 3.00 through ANGLE
  to MSL. The two compilers may inline, unroll and fold differently, so
  the shares are evidence about the shader's work, not a measurement of
  Ghostty's.
- **Not vsync-bound, and at an unknown clock.** The bench draws back to
  back with a sync per frame; the GPU's clock during it was not read
  (powermetrics needs root, and it was not run). A ms difference here is
  not a device % or mW difference in Ghostty; ms at one clock and ms at
  another are not the same work, though all configs ran under the same
  conditions, interleaved.
- **One stand-in screen.** The sparse stand-in favours the sky; the
  text-heavy one shows how the rim's share falls with more glass. Real
  Claude Code screens lie somewhere between.
- **Machine in use, lightly:** no other apps or sessions, but
  `ecosystemd` busy on the CPU and this Claude session running the
  bench. The spread above is what that left.
- **Interaction between stages** makes single-stage costs overlap by up
  to ~10 % (see above).

## F4 phase 2, 2026-10-26: the changes, each checked and benched in the preview

The changes from F4's ranked list that went into the branch `gpu`
(merge `ff85241`), what each was checked against, and what it saved in
the preview bench above (`--gpu --bench 200`, 3024×1964). Three agents
made them in parallel and benched at the same time, on a machine at load
6–18, so the per-change numbers are back-to-back pairs read through that
noise and only the large effects stand out. The merged shader was benched
once more against `cbc9a0e` afterwards, with nothing else benching.
Every change was reviewed by a fourth agent, who derived each bound from
the code, rendered the cases the authors had not, and merged the three
branches in a throwaway tree (clean, 99 tests, tsc).

### What went in

| change (F4 post) | commit | parity | bench |
|---|---|---|---|
| the rim reads 13 places, not 21, and the pixel's own mask (1) | `ce0367f` | `near` identical; `brightest` loses the 2.24 px places, so pixels within 1 px of text move up to 43/255; away from text ≤ 2/255 at 3024×1964, ≤ 5/255 at 3456×2234 | day 9.28 → 7.37 ms, night 10.68 → 8.87 (medians under load) |
| glass turns light text away by its lightness (2) | `0924b99` | identical | below the noise |
| an unmarked tab gets the terminal before any text work (3) | `32ba69c` | marked identical; unmarked equals the terminal | unmarked, text-heavy: 4.1 → 3.05 ms, the empty shader's 3.0 at the time |
| clouds are placed before their kind is chosen (5) | `fc338dd` | identical, three scenes × three times, `--ufo`, 3456×2234 | day-clear 8.93 → 7.89, overcast 10.28 → 8.72, night 10.34 → 9.48; the cloud stage by day 3.0 → 2.0 ms |
| the star chart reads a row of tiles as one run (10) | `180019e` | identical, with the cursor on a star and on a window wider than the tile grid | `realStars` about 2.5 → 1 ms at night (noisy) |
| events leave alone the pixels they cannot reach (7) | `78d6029` … `9318afb` | identical for all eight, with the cursor on a leaf, a feather and a piece of confetti, at 420×240 and 3456×2234 | during the event: leaves and confetti −15–25 % of the frame, kite −6–7 %, comet unproven |

The rim at 9 places (3×3) passed the 8/255 budget at 3024×1964 but not
at 3456×2234, where the rim is widest: 95 477 pixels away from text moved
by more than 8/255. It stays at 13. The places past 2 pixels weigh nothing
in the rim's reach, but they did feed the brightest neighbour, which sets
its strength; that is the whole visible change, and side by side it is
hard to find.

The only pixels over budget in the rim's parity sat in column 0, where
the preview's texture wraps (WebGL's default REPEAT) and picks up the
stand-in text at the right edge; cropping that column removes them all.
`tools/preview/diff.mjs` does not wrap and counts every non-background
terminal pixel as text, so changes inside diff fields never count as
away from text.

### What was tried and left out

- **The cross pretest for text on glass (post 4).** Eight places looked
  at before the sixteen gave up on text pixels that touch a field only
  diagonally or two places off, such as the inside of a bold g's tail: a
  dark speck of the field on glass, 77–128/255, with a bold 24–30 px font
  at 3024×1964. With the stand-in's 22 px font it moved 19 pixels by
  4/255, which is why the authors' check passed. Its saving did not show
  in the bench. Reverted (`52fc2dc`).
- **One hash per cloud slot (post 6).** It changes the clouds' speeds and
  heights, so the sky looks different; in the before/after pairs the
  clouds bunched behind the text in the upper left, and the saving was
  5–9 % of the sky's own cost on one or two clean rounds. Vincent said
  no; it is kept on the branch `post6-moln-avvisad`.
- **The unfocused path (post 8).** Out of focus, skipping the rim (and,
  first, the text-on-glass test) saved 30–40 % of the frame, but an
  unfocused window is drawn not only during the sweep under `always`; it
  is drawn whenever its terminal changes, under any setting. Without the
  rim Claude Code's grey text fades on a bright day sky, the case the rim
  is there for, so a session in a window beside the one in use would be
  hard to read. Vincent dropped it (`e34b2ef`); the preview's
  `--unfocused` stays for trying a cheaper rim out of focus later.

### The merged shader against where phase 2 began

`gpu` at `ff85241` against `cbc9a0e`, three rounds per scene, A B / B A,
23:3x on 2026-10-26, load 5, nothing else benching; medians in ms a
frame, the empty shader 2.28:

| scene | before | after | the sky's own cost |
|---|---|---|---|
| day-clear | 9.12 | 6.32 | 6.8 → 4.0 (−41 %) |
| day-overcast | 10.27 | 7.31 | 8.0 → 5.0 (−37 %) |
| night-lit | 10.63 | 7.04 | 8.4 → 4.8 (−43 %) |

Rounds agreed within 0.3 ms after and 1.8 ms before (one slow first
round by day).

### Where that leaves F4's target

F4 aims at the sky's own cost at or under half the branch's baseline. In
the preview the merged shader is at 57–63 % of it, so not yet there.
Whether Ghostty agrees is for phase 4: the target is measured in device
points and mW over the floor, and since power rises faster than clock,
work that lets the GPU drop a clock step may save more in mW than in ms
(an inference from the first run's clocks, not a measurement). What is
left on the table, in the plan's terms: the light decision's option (b),
the rim only where text is light and the sky bright, which would make the
night's rim free; and the rim by day, still the largest stage after the
clouds lost a third of theirs. The lighter shader for the battery and
away rules (task 5b, below) saves where it applies but does not count
towards this target, which is measured with `true`, focused.

The baseline for phase 4 is the first run's table above; the harness
runs again with `--twice` on a quiet machine, against the same scenes
written from `gpu`.

## F4 task 5b, 2026-10-26: the lighter sky on battery and away

### What was decided

The decision of 2026-10-26 (task 6, point 1 above) said the still-sky and
battery rules get "a lighter shader (no rim, no clouds, fewer samples)".
Two things came up before it was built, and Vincent narrowed it:

- **Which rules.** `!isLively` holds whenever nothing in the sky moves
  (no event, rain, fire or time-lapse), which is an ordinary clear or
  grey day, so most of the time someone sits at the computer. A lighter
  sky there would have been the everyday sky. It now applies **on battery
  and while the person is away** (five minutes without a key or the
  mouse, when nobody reads it). The still-sky rule keeps the whole sky.
- **What it leaves out.** Without the rim Claude Code's grey text faded on
  a bright day sky (post 8), and on battery the window is in front and
  read. The lighter sky leaves out **the clouds only** and keeps the rim,
  so it says nothing ahead of the light decision.

`animationOf` and its test are untouched. The shader gets a constant
`LIGHT`, and `mainImage` draws the clouds only when it is 0. Going away
or on battery changes the shader's text, so it is one reload each way,
within `SKY_MS` (10 s) and `BATTERY_MS` (60 s). Every session writes the
same text, since idleness and power are the machine's. The preview draws
it with `--light`.

### The bench

`gpu` at `743d58a`, `--bench 200 --gpu --width 3024 --height 1964`, the
scenes from `tools/measure/scenes.sh`, the full sky and `--light` in turn,
A B / B A / A B, with the empty shader once a round. 23:48–23:49 on
2026-10-26, load 3.5, nothing else benching. Medians in ms a frame, the
empty shader 2.26 (2.25–2.28):

| scene | full | light | the sky's own cost |
|---|---|---|---|
| day-clear | 6.19 | 3.90 | 3.93 → 1.64 (−58 %) |
| day-overcast | 7.09 | 3.89 | 4.83 → 1.63 (−66 %) |
| night-lit | 6.92 | 4.93 | 4.66 → 2.67 (−43 %) |

The rounds agreed within 0.07 ms. The clouds weigh more here than the
first bench's 34–47 %, because the rim, glass and text work around them
got cheaper in phase 2. The night saves less, its stars, chart and lit
lighthouse staying.

The screenshots (`--diff --gpu`, 1512×982, normal and `--light` of each
scene) are `.preview/5b-*.png` in the worktree, not committed. They show
no difference but the clouds.

### What it does not show

Whether Ghostty agrees, in device points and mW, is a row for phase 4 if
Vincent wants one: `scenes.sh` writes the scenes without `LIGHT`, so a
light row needs a scene written with it. The preview's own weak spots (see
phase 2) apply as before.

## F4 phase 4, 2026-10-27: the merged shader in Ghostty

The harness's plan `f4 --twice` on `gpu` at `d19a474`: the first run's
45 rows again as the baseline, the merged shader beside them, and the
three 60 Hz rows the morning after.

### Context

- Same machine and display as the first run: MacBookPro18,3, M1 Pro
  32 GB, macOS 27.0 (26A428), Ghostty 1.3.1, the built-in Color LCD
  alone at 3024×1964, AC power, no thermal or performance warning.
  Settle 10 s, sample 30 s.
- **The plan:** 00:21–01:59, 128 rows, the 64 of `plan f4` forward and
  then backward (ABBA). The scenes from `ljus-himmel` and `main` have the
  same sha256 as in the first run (`89272b7a0789`, `cc466523bfcf`,
  `af7c1319f745`, `70fa7b81935b`). Load average 6.82 at the start, against
  1.81 for the first run's level A. A start three minutes earlier
  (`2026-10-27T001827`) stopped after its first row and is not used.
- **The 60 Hz rows:** 08:20–08:25, the display set to 60 Hz in System
  Settings, one row each: the probe, `ljus-himmel:day-clear`,
  `gpu:day-clear`. The probe row was taken with `--force`, past a
  preflight that found PerfPowerService at 84 % of a CPU (a try before:
  48 %, with `deleted` at 47 % and `cloudd` at 32 %); the two scene rows
  passed it. `--force` leaves no trace in `context.txt`, so it is
  recorded here. Load average 2.87.
- The raw data is outside git: `.preview/measure/out/2026-10-27T002134/`
  (`rows.tsv`, `report.md`) and `.preview/measure/out/2026-10-27-rows/`.

**Busy cycles** below are mean MHz × active residency, the proxy the first
run used ("20 % against 75 %"), over the same floor: passthrough focused
idle 389 × 0.749 = 291, with the spinner 304. An inference about work,
not a measurement of it.

### F4's target

The sky's own cost, over the floor, `ljus-himmel` → `gpu`, mean of the
two passes:

| scene | setting | device points | left | mW | left | busy cycles | left | MHz |
|---|---|---|---|---|---|---|---|---|
| day-clear | true, focused, idle | 42.2 → 38.3 | 91 % | 12341 → 4925 | 40 % | 941 → 557 | 59 % | 1247 → 875 |
| day-clear | true, focused, spinner | 40.5 → 38.3 | 95 % | 12719 → 4875 | 38 % | 943 → 545 | 58 % | 1271 → 875 |
| night-lit | true, focused, idle | 48.9 → 38.6 | 79 % | 14923 → 6499 | 44 % | 1001 → 665 | 66 % | 1296 → 987 |
| night-lit | true, focused, spinner | 48.8 → 38.2 | 78 % | 14844 → 6492 | 44 % | 991 → 657 | 66 % | 1296 → 992 |

In mW the target is met: the sky's own power is 38–44 % of the
baseline's in both scenes, idle and with the spinner, and each pass alone
gives the same (day-clear 41 % and 39 %, night-lit 43 % and 44 %). In
device points it is not met, at 78–95 %. In busy cycles, the measure
nearest the work, it is not met either: 58–66 %, where the preview bench
put the merged shader at 57–63 % (phase 2).

So, read plainly: the merged shader asks about a third less work of the
GPU than the baseline, the GPU does that work a clock step lower (1247 →
875 MHz by day, 1296 → 987 by night), and since power rises faster than
clock it draws 56–62 % less power for it. The plan asks for the target to
be read with MHz and residency beside it "so that a change of clock is
not read as less work"; read that way, F4 has reached its target in
power and not in work.

Device points cannot measure this target at all. Every full `gpu` scene
but the milestone sits at 75.4–77.1 % device whatever its power (5.7 to
10.3 W), as main's two scenes do (74.5–75.9 % at 4.1 and 5.7 W), and
`gpu:day-clear` at 60 Hz reads 81.4 %, more than at 120 Hz, while drawing
a third of the power. Device % is the share of time the GPU is busy at
the clock it chose, and the GPU picks the lowest clock that keeps it busy
most of the time; a cheaper shader gives back a clock step, not idle
time. Only at the lowest step, 389 MHz (the probe, passthrough, the
unmarked tab), does device % move with the work.

### 60 Hz: is the sky held back at 120 Hz?

| row | 120 Hz (this run) | 60 Hz |
|---|---|---|
| probe, true, focused, idle | 36.3 %, 778 mW, 389 MHz, 75.1 %, 120 fps | 19.0 %, 380 mW, 390 MHz, 42.2 %, 61.9 fps |
| `ljus-himmel:day-clear` | 79.3 %, 13126 mW, 1247 MHz, 98.8 % | 75.6 %, 4248 mW, 724 MHz, 87.4 % |
| `gpu:day-clear` | 75.4 %, 5710 mW, 875 MHz, 96.9 % | 81.4 %, 1856 mW, 389 MHz, 96.1 % |

By day, no. A sky that could not finish its frames at 120 Hz would lose
less than half its work when asked for half the frames. The baseline's
own busy cycles fall from 941 to 468 (633 over the probe's 165 at
60 Hz), 0.50 of what they were, which is what a sky that drew every
frame at 120 Hz shows; the merged shader's fall to 0.38. So the
baseline's mW by day are the cost of drawing it in full, and F4's saving
shows as fewer mW, not as more frames. The first run's 80.9 → 77.9 %
was the same thing in device %; with MHz beside it, it reads as the
clock nearly halving (1247 → 724 MHz) and the power falling to a third.

At 60 Hz the merged shader's own cost is 38 % of the baseline's in mW
and 45 % in busy cycles.

What it does not settle: only day-clear was taken. The baseline's
night-lit, overcast, dark and event scenes sit at 1292–1296 MHz with
99.1–100 % residency, the top step with nothing left, so they may drop
frames at 120 Hz; if they do, their baseline mW understate what they
cost, and the night's 44 % left is, if anything, too high. One row each,
no repeat, and the proxy assumes a frame takes the same cycles at any
clock, which the merged shader's 0.38, below half, says is not exactly
so.

### The other targets

- **`true` unfocused at the no-shader level:** met. `gpu` day-clear 2.4 %,
  night-lit 2.5 % device, the first run's single-sample pattern (sd 13);
  86 and 31 mW, against 12 for no shader.
- **An unmarked visible tab within 5 points of passthrough:** on the line.
  42.2 % against 37.1, +5.1 in both passes. In mW +103, against the
  baseline's +236 and main's +167.
- **`always` unfocused within 10 points of focused:** met, 2.1 points by
  day (73.3 against 75.4) and 1.6 by night. Its power is 83 % of focused
  by day and 80 % by night (first run 87–88 %); post 8, which was to make
  it clearly lower, was dropped in phase 2.
- **The floor:** passthrough 37.1 % device and 785 mW at 120 Hz, no
  shader 1.0 % and 12 mW, the probe at 60 Hz 19.0 % and 380 mW. The
  floor halves with the frame rate and is the same for any shader: it is
  Ghostty's draw loop and the compositing of a 3024×1964 window at
  120 Hz, which no change in the shader's code reaches.

### The other scenes

| scene | device % | mW over floor | left | MHz | residency % |
|---|---|---|---|---|---|
| day-overcast | 87.0 → 75.8 | 14788 → 6592 | 45 % | 1294 → 1000 | 99.5 → 97.1 |
| night-dark | 99.3 → 75.9 | 17123 → 8659 | 51 % | 1296 → 1143 | 100.0 → 97.4 |
| day-leaves | 100.0 → 77.1 | 17572 → 9526 | 54 % | 1296 → 1265 | 100.0 → 97.9 |
| comet | 94.8 → 76.0 | 16418 → 7530 | 46 % | 1296 → 1054 | 99.9 → 97.3 |
| milestone | 100.0 → 99.9 | 15140 → 14089 | 93 % | 1296 → 1296 | 100.0 → 100.0 |

Every baseline scene here was on the top step, so its mW are a lower
bound and the share left an upper one. All but the milestone came off
it. The milestone's confetti still holds the GPU at 1296 MHz and 100 %,
with WindowServer at 7 % of a CPU against 54–59 % under the other
scenes, a sign of dropped frames on both sides; its 93 % says nothing
about what post 7 saved.

### The lighter sky against the whole one

`gpu` with `LIGHT` (no clouds, the rim kept), the sky written on battery
and away:

| scene | device points | mW over floor | left | busy cycles | left | MHz |
|---|---|---|---|---|---|---|
| day-clear | 38.3 → 34.2 | 4925 → 2303 | 47 % | 557 → 278 | 50 % | 875 → 605 |
| night-lit | 38.6 → 37.5 | 6499 → 3893 | 60 % | 665 → 449 | 68 % | 987 → 770 |

It saves 53 % of the sky's own power by day and 40 % by night, where the
bench said 58 % and 43 %. The night keeps its stars, chart and lit
lighthouse.

### What the light decision has to go on

The plan's three options: (a) `LUMINANCE` 0.8 with the rim, which the
branch has now; (b) 0.8 with the rim only where the text is light and
the sky bright, free at night and dusk; (c) 0.5–0.6 with no rim. Its
rule: (a) and (b) if the rim measures under about 5 device points,
otherwise (c) is on the table.

This run does not separate the rim in Ghostty; no row drops it. What it
separates is everything the branch added to main (the rim, glass, the
text-on-glass test, `LUMINANCE` 0.8), net of what F4 saved since. The
merged shader's own cost against main's:

| scene | device points | mW over floor | busy cycles |
|---|---|---|---|
| day-clear | 37.4 → 38.3 (+0.9) | 3287 → 4925 (1.50×) | 472 → 557 (1.18×) |
| night-lit | 38.8 → 38.6 (−0.2) | 4886 → 6499 (1.33×) | 578 → 665 (1.15×) |

In device points the rule is met many times over, but device points
are the measure shown above not to separate scenes. In power the
readable sky costs a third to a half more than main's, which was darker
and had no rim; in busy cycles 15–18 % more.

### Caveats

- **Load 6.82 at the start**, not the quiet machine asked for. The drift
  between passes says it did little: every repeated row agrees within
  0.8 points but three.
- **Those three:** `ljus-himmel:day-clear` focused, idle under `true`,
  `false` and `always`, at 81.1–81.3 % in the first pass and 77.5–77.9 in
  the second, while their power went the other way (12.8–12.9 → 13.5 W)
  and their clock rose (1221–1224 → 1266–1272 MHz). The first pass is
  where the first run was (80.9 %, 12863 mW, 1228 MHz). The share left
  is 41 % in one pass and 39 % in the other, so the target does not hang
  on it.
- **Scenes still have no frame count**; the 60 Hz answer is inferred from
  busy cycles, for day-clear only.
- **The unfocused means are a single sample**, as in the first run;
  treat them as 0.
- **Per-process GPU time is still 0.00** for every process; everything
  here is the whole GPU.

## F4, 2026-10-27: the light decision, and the rim left out where the sky is dark

Vincent took (a) and (b) on 2026-10-27, from the numbers above:
`LUMINANCE` stays at 0.8 with the rim, and the rim is left out where the
sky is dark enough not to need it.

**Where the sky is dark.** The plan's sketch of (b) put the line near
0.45 of the sky's lightness. Measured in the preview (`--gpu`, 1512×982,
`--without shaded`), a dusk sky at 16:45 is 88 % under 0.45 and 12 % under
0.2, and Claude Code's grey text (153) needs the rim there: at 0.35 it is
about 2.5 to 1 on the sky without one. The line went instead where the
rim stops mattering: under 0.2 that grey is 4.5 to 1 without a rim, and
under 0.1 the rim moves the sky's lightness by 9/255 at most. So the rim
fades out between 0.2 and 0.1 of the sky's lightness at that pixel
(`SHADE_DARK`) and its disc is not read below 0.1. A night sky is 46 %
under 0.08 and 85 % under 0.12; a clear day has nothing under 0.2.

**Parity** (`--diff --p3 --retina`, 3024×1964, before and after): day-clear
identical; dusk at 16:45, 17:15 and 17:45, night-lit and night-dark change
only within a pixel of text, the largest by 12–30/255 in a channel (a
night's blue), and nowhere more than 1/255 further out. Side by side,
with `--prose` enlarged twice, the night and the 17:45 dusk look the same.

**Bench**, `--bench 200 --gpu --width 3024 --height 1964`, four rounds
A B / B A, 08:37–08:39, load 3.7–5, medians in ms a frame, the empty
shader 2.66:

| scene | before | after | the sky's own cost |
|---|---|---|---|
| day-clear | 6.98 | 7.09 | 4.32 → 4.43, within the rounds' spread |
| dusk 17:45 | 8.57 | 8.22 | 5.91 → 5.56 (−6 %) |
| night-lit | 8.05 | 6.76 | 5.39 → 4.10 (−24 %) |
| night-dark | 9.26 | 8.27 | 6.60 → 5.61 (−15 %) |

In Ghostty this is not measured; the night's −24 % in the bench would
come off the 44 % left in mW above.
