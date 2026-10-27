#!/bin/sh
# A short loop of the sky for the README, rendered frame by frame by
# shader.mjs and joined by ffmpeg: a low sun over the sea, the lighthouse
# lit, a dolphin, and the keeper's catch, the tab's context window. A
# tenth fills and he lands a fish (Clawd in the band glancing out at it),
# it hangs on his line with the rest; then the conversation compacts and
# he grills them, the smoke going up past the gallery, and the embers
# glow under two skeletons before the count starts over.
#   tools/preview/gif.sh [out.gif]
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:-$root/assets/demo.gif}
frames=$root/.preview/gif
rm -rf "$frames"
mkdir -p "$frames"
count=96
i=0
while [ $i -lt $count ]; do
  t=$(awk "BEGIN { print $i / 8 }")
  # The tab's mark and Clawd's reaction to it, second by second: the catch
  # for its 2.5 s, the line, the grill, its embers, and one fish again.
  fish=$(awk "BEGIN { print ($t < 2.5 ? \"6,catch\" : $t < 5 ? \"6\" : $t < 9 ? \"6,grill\" : $t < 10.5 ? \"0,embers\" : \"1\") }")
  reaction=$(awk "BEGIN { print ($t < 1.8 ? \"toss,\" $t : $t >= 5 && $t < 9 ? \"burn,\" ($t - 5) : $t >= 9 && $t < 10.5 ? \"embers,\" ($t - 9) : \"reading,0\") }")
  time=$(awk "BEGIN { print 3 + $t }")
  "$root/tools/preview/run.sh" shader --at 2026-10-24T15:35 --event dolphin --beacon asking --fish "$fish" \
    --band --paper 60 --sky-context --reaction "$reaction" --time "$time" --out "gif/f$(printf %03d $i)" >/dev/null
  i=$((i + 1))
done
ffmpeg -y -loglevel error -framerate 8 -i "$frames/f%03d.png" \
  -vf "scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 "$out"
echo "$out"
