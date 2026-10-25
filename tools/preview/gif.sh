#!/bin/sh
# A short loop of the sky for the README, rendered frame by frame by
# shader.mjs and joined by ffmpeg: a low sun over the sea, the lighthouse
# lit, a dolphin, and Clawd throwing a ball into the wastebasket.
#   tools/preview/gif.sh [out.gif]
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:-$root/assets/demo.gif}
frames=$root/.preview/gif
rm -rf "$frames"
mkdir -p "$frames"
count=64
i=0
while [ $i -lt $count ]; do
  t=$(awk "BEGIN { print $i / 8 }")
  reaction=$(awk "BEGIN { print ($t < 1.8 ? \"toss,\" $t : \"reading,0\") }")
  balls=$(awk "BEGIN { print ($t < 1.4 ? 5 : 6) }")
  time=$(awk "BEGIN { print 3 + $t }")
  "$root/tools/preview/run.sh" shader --at 2026-10-24T15:35 --event dolphin --beacon asking --basket "$balls" \
    --band --paper 60 --sky-basket --reaction "$reaction" --time "$time" --out "gif/f$(printf %03d $i)" >/dev/null
  i=$((i + 1))
done
ffmpeg -y -loglevel error -framerate 8 -i "$frames/f%03d.png" \
  -vf "scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 "$out"
echo "$out"
