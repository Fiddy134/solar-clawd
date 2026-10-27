#!/bin/sh
# The proof sheet for the leaves, blossoms, birds and feathers (F3a): every
# scene at two times 1.3 s apart (a and b) so the motion shows, each also as
# a 3x zoom of the window where the figures are, and one contact sheet.
#   tools/preview/sheet.sh q2 baseline     (writes .preview/q2-baseline/)
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
sheet=$1
variant=$2
if [ "$sheet" != q2 ] || [ -z "$variant" ]; then
  echo "usage: tools/preview/sheet.sh q2 <variant>" >&2
  exit 1
fi
name=$sheet-$variant
dir=$root/.preview/$name
rm -rf "$dir"
mkdir -p "$dir"
npx -y esbuild@0.24.0 "$root/tools/preview/shader.mjs" --bundle --platform=node --format=esm \
  --log-level=warning --outfile="$root/.preview/shader.bundle.mjs"

# shot <scene> <zoom x,y,w,h> <flags>: the scene at both times. The flags
# are split by the shell on purpose.
shot() {
  scene=$1
  zoom=$2
  shift 2
  for pair in a:20 b:21.3; do
    SOLAR_ROOT="$root" node "$root/.preview/shader.bundle.mjs" --stage 480 "$@" --time "${pair##*:}" \
      --zoom "$zoom" --out "$name/$scene-${pair%%:*}" >/dev/null
    echo "$scene-${pair%%:*}"
  done
}

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
