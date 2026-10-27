#!/bin/sh
# The proof sheets, each frame also as a 3x zoom of the window where the
# figures are, and one contact sheet:
#   tools/preview/sheet.sh q2 baseline     (writes .preview/q2-baseline/)
# the leaves, blossoms, birds and feathers (F3a), every scene at two times
# 1.3 s apart (a and b) so the motion shows; and
#   tools/preview/sheet.sh fisk i1         (writes .preview/fisk-i1/)
# the keeper's catch (F3b), the context window as the fish he has hung up
# and the grill as the conversation compacts, by day and by night, the
# zooms side by side in contact.png; and
#   tools/preview/sheet.sh theme fyr       (writes .preview/theme-fyr/)
# one theme (built in, or a folder with manifest.json and theme.glsl) in
# the parity scenes at the parity's size, its own events and previews each
# at three moments, every frame small in contact.png.
# BUNDLE=.preview/b/before.bundle.mjs draws a sheet with an earlier build
# instead of this tree's.
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
sheet=$1
variant=$2
if { [ "$sheet" != q2 ] && [ "$sheet" != fisk ] && [ "$sheet" != theme ]; } || [ -z "$variant" ]; then
  echo "usage: tools/preview/sheet.sh q2|fisk <variant>, or sheet.sh theme <name|folder>" >&2
  exit 1
fi
name=$sheet-$(basename "$variant")
dir=$root/.preview/$name
rm -rf "$dir"
mkdir -p "$dir"
bundle=${BUNDLE:-$root/.preview/shader.bundle.mjs}
case $bundle in /*) ;; *) bundle=$root/$bundle ;; esac
if [ -z "$BUNDLE" ]; then
  npx -y esbuild@0.24.0 "$root/tools/preview/shader.mjs" --bundle --platform=node --format=esm \
    --log-level=warning --outfile="$bundle"
fi

# shot <scene> <zoom x,y,w,h> <flags>: the scene at both times. The flags
# are split by the shell on purpose.
shot() {
  scene=$1
  zoom=$2
  shift 2
  for pair in a:20 b:21.3; do
    SOLAR_ROOT="$root" node "$bundle" --stage 480 "$@" --time "${pair##*:}" \
      --zoom "$zoom" --out "$name/$scene-${pair%%:*}" >/dev/null
    echo "$scene-${pair%%:*}"
  done
}

# still <scene> <flags>: one frame and its zoom on the island, from the
# rod's tip at the left to the smoke drifting off past the gallery.
still() {
  scene=$1
  shift
  render --stage 480 "$@" --zoom 1140,395,270,250 --out "$name/$scene"
  echo "$scene"
}

# render <flags>: one frame, tried a second time when headless Chrome,
# busy with another render on the machine, gives up on the first.
render() {
  SOLAR_ROOT="$root" node "$bundle" "$@" >/dev/null 2>&1 || SOLAR_ROOT="$root" node "$bundle" "$@" >/dev/null
}

# retina <scene> <flags>: one frame at a Retina window's size, the strip
# 960 px, its zoom from his rod to the post, where a fish is the 13 px it
# is in a Mac's Ghostty rather than the 6 of the frames above.
retina() {
  scene=$1
  shift
  render --width 3024 --height 1964 --stage 960 "$@" --zoom 2320,1030,400,220 --out "$name/$scene"
  echo "$scene"
}

if [ "$sheet" = q2 ]; then
  shot leaves-day 280,400,420,280 --at 2026-10-26T13:00 --weather 2,8,7,40 --event leaves
  shot leaves-dusk 280,400,420,280 --at 2026-10-26T16:10 --weather 2,8,7,40 --event leaves
  shot leaves-night 280,400,420,280 --at 2026-10-26T21:00 --weather 2,8,7,40 --event leaves
  shot blossom-noon 100,380,420,280 --at 2026-05-10T12:00 --event blossom
  shot blossom-evening 100,380,420,280 --at 2026-05-10T20:45 --event blossom
  shot birds-morning 1112,90,400,250 --at 2026-10-26T07:40 --event birds
  shot birds-afternoon 1112,90,400,250 --at 2026-10-26T16:00 --event birds
  shot feathers 540,600,420,280 --at 2027-03-26T12:00 --event feathers
  shot leaves-shy 280,400,420,280 --at 2026-10-26T13:00 --weather 2,8,7,40 --event leaves --cursor 700,500 --since 0.2

  # The contact sheet: every frame small, three across (a, b of each scene).
  ffmpeg -y -loglevel error -pattern_type glob -i "$dir/*-[ab].png" \
    -vf "scale=504:-1:flags=area,tile=3x6:padding=4:color=black" -frames:v 1 "$dir/contact.png"
  echo "$dir"
  exit 0
fi

if [ "$sheet" = theme ]; then
  # A folder is read from where the sheet was asked for.
  theme=$variant
  [ -d "$theme" ] && theme=$(cd "$theme" && pwd)
  kinds=$("$root/tools/theme/run.sh" kinds "$theme")
  S="--theme $theme --stage 240"
  DAY="--at 2026-10-26T13:00"
  NIGHT="--at 2026-10-24T22:00"
  # frame <scene> <time> <flags>: one frame at the parity's size.
  frame() {
    scene=$1
    time=$2
    shift 2
    # shellcheck disable=SC2086
    render "$@" $S --time "$time" --out "$name/$scene"
    echo "$scene"
  }
  # The engine's parity scenes, which every theme is drawn in: its day at
  # four moments, Claude waiting, the night, the weather, the context
  # window, the engine's events and days, and the engine's own paths.
  frame 01-day-20 20 $DAY
  frame 02-day-45 45 $DAY
  frame 03-day-60 60 $DAY
  frame 04-day-75 75 $DAY
  frame 05-waiting-dusk 20 --at 2026-10-26T16:30 --waiting asking
  frame 06-waiting-urgent 20 $NIGHT --waiting asking --urgent
  frame 07-waiting-done 20 $DAY --waiting done
  frame 08-night-aurora 20 $NIGHT --aurora
  frame 09-night-iss 20 $NIGHT --iss
  frame 10-night-moon 20 --at 2026-10-26T23:00 --weather 0,5,2,10
  frame 11-asleep-0400 20 --at 2026-10-26T04:00
  frame 12-rain 20 $DAY --weather 61,8,4,90
  frame 13-snow 20 --at 2026-01-15T13:00 --weather 71,-2,3,90
  frame 14-storm-kite 20 $DAY --weather 95,12,12,95 --event kite
  frame 15-fish-6 20 --at 2026-10-24T15:35 --fish 6
  frame 16-fish-9-grill 20 --at 2026-10-24T15:35 --fish 9,grill
  frame 17-fish-0-embers 20 --at 2026-10-24T15:35 --fish 0,embers
  frame 18-fish-7-catch 20 --at 2026-10-24T15:35 --fish 7,catch
  frame 19-comet-constellation 20 $NIGHT --weather 0,5,2,10 --event comet,constellation
  frame 20-rainbow 20 $DAY --event rainbow --rained
  frame 21-balloon-plane-birds 20 --at 2026-10-26T09:00 --event balloon,plane,birds
  frame 22-christmas 20 --at 2026-12-24T16:00
  frame 23-flag-day 20 --at 2026-06-06T12:00
  frame 24-new-year 20 --at 2026-12-31T23:55
  frame 25-milestone 20 $DAY --event milestone
  frame 26-demo 20 $DAY --demo
  frame 27-y-up 20 $DAY --y-up
  frame 28-diff-p3 20 $DAY --diff --p3
  frame 29-light 20 $DAY --light
  frame 30-unmarked 20 $DAY --unmarked
  frame 31-band 20 --at 2026-10-24T15:35 --band --paper 70 --sky-context --reaction toss,0.4
  # The theme's own events and previews, each by day at 24.8 s and by
  # night at 88 and 126 (fyr's dolphins leap at 24.8, its UFO beams him up
  # at 88 and sets him down at 126).
  i=32
  for kind in $kinds; do
    frame "$i-$kind-day" 24.8 --at 2026-10-24T15:35 --event "$kind"
    frame "$((i + 1))-$kind-88" 88 $NIGHT --event "$kind"
    frame "$((i + 2))-$kind-126" 126 $NIGHT --event "$kind"
    i=$((i + 3))
  done

  # The contact sheet: every frame small, six across.
  count=$(ls "$dir"/*.png | wc -l)
  rows=$(( (count + 5) / 6 ))
  ffmpeg -y -loglevel error -pattern_type glob -i "$dir/[0-9]*.png" \
    -vf "scale=378:-1:flags=area,tile=6x$rows:padding=4:color=black" -frames:v 1 "$dir/contact.png"
  echo "$dir"
  exit 0
fi

# The brief's sheet: an afternoon with 0, 3, 7 and 10 fish, a night with 7,
# a catch at two moments 0.4 s apart, the grill at three, the embers, the
# lantern lit, the UFO with him inside it, and asleep under the line.
day='--at 2026-10-24T15:35'
still 01-day0 $day --fish 0 --time 20
still 02-day3 $day --fish 3 --time 20
still 03-day7 $day --fish 7 --time 20
still 04-day10 $day --fish 10 --time 20
still 05-night7 --at 2026-10-24T22:00 --fish 7
still 06-catch-a $day --fish 7,catch --time 20
still 07-catch-b $day --fish 7,catch --time 20.4
still 08-grill-20 $day --fish 7,grill --time 20
still 09-grill-22 $day --fish 7,grill --time 22
still 10-grill-26 $day --fish 7,grill --time 26
still 11-embers $day --fish 0,embers --time 20
still 12-beacon $day --beacon asking --fish 5 --time 20
still 13-abduction $day --event abduction --fish 5 --time 15
still 14-asleep --at 2026-10-24T04:00 --fish 6
# Past the brief: a catch while he is up on the gallery (the newest fish
# blinks instead), the grill by night, while he would be asleep, and in a
# gale, and the embers with the one fish a compacted conversation keeps.
still 15-catch-gallery-a $day --fish 7,catch --time 60
still 16-catch-gallery-b $day --fish 7,catch --time 60.2
still 17-grill-night --at 2026-10-24T22:00 --fish 7,grill --time 22
still 18-grill-asleep --at 2026-10-24T04:00 --fish 6,grill --time 22
still 19-grill-gale $day --weather 2,8,14,40 --fish 7,grill --time 22
still 20-embers-1 --at 2026-10-24T22:00 --fish 1,embers --time 20
# Half full, up to the bead; the grill while his day would have him in
# the tower; and the landing by night.
still 21-day5 $day --fish 5 --time 20
still 22-grill-inside $day --fish 7,grill --time 48
still 23-catch-night --at 2026-10-24T22:00 --fish 4,catch --time 20
# And some of them at a Retina window's size.
retina r1-day7 $day --fish 7 --time 20
retina r2-catch $day --fish 7,catch --time 20
retina r3-blink $day --fish 7,catch --time 60.2
retina r4-grill $day --fish 7,grill --time 22
retina r5-embers --at 2026-10-24T22:00 --fish 1,embers --time 20
retina r6-asleep --at 2026-10-24T04:00 --fish 6
retina r7-day10 $day --fish 10 --time 20
retina r8-embers-day $day --fish 0,embers --time 20

# The contact sheet: the zooms four across, each with its scene's name, as
# a page headless Chrome lays down.
cells=''
for zoom in "$dir"/*-zoom.png; do
  scene=$(basename "$zoom" -zoom.png)
  cells="$cells<figure><img src=\"file://$zoom\"><figcaption>$scene</figcaption></figure>"
done
cat >"$dir/contact.html" <<EOF
<!doctype html><body style="margin:0;background:#111;color:#ddd;font:14px Menlo">
<style>main{display:grid;grid-template-columns:repeat(4,405px);gap:6px;padding:6px}figure{margin:0}img{width:405px;height:375px;display:block;object-fit:contain;background:#000}figcaption{padding:2px 0}</style>
<main>$cells</main></body>
EOF
count=$(ls "$dir"/*-zoom.png | wc -l)
rows=$(( (count + 3) / 4 ))
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless --hide-scrollbars \
  --user-data-dir="$root/.preview/chrome" --no-first-run --no-default-browser-check --disable-gpu \
  --virtual-time-budget=4000 --screenshot="$dir/contact.png" --window-size=$((4 * 411 + 6)),$((rows * 401 + 6)) \
  "file://$dir/contact.html" 2>/dev/null
echo "$dir"
