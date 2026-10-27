#!/bin/sh
# A short loop of the sky for the README, rendered frame by frame by
# shader.mjs and joined by ffmpeg: a low sun over the sea, a dolphin, and
# the keeper's catch, the tab's context window, in two scenes. In the
# first a tenth fills and he lands a fish (Clawd in the band glancing out
# at it), and it hangs on his line with the rest. In the second the
# lighthouse is lit, asking, and the conversation compacts: he grills the
# catch, the smoke going up past the gallery, and the embers glow under
# two skeletons. A cross-fade joins the scenes and the loop, as a cut
# would, so he is never seen to jump from his rod to the grill.
#   tools/preview/gif.sh [out.gif]
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:-$root/assets/demo.gif}
frames=$root/.preview/gif
rm -rf "$frames"
mkdir -p "$frames/catch" "$frames/grill"

# scene <name> <frames> <first second of the story>: its frames, 8 a
# second, the tab's mark and Clawd's reaction to it second by second.
scene() {
  name=$1
  count=$2
  from=$3
  i=0
  while [ $i -lt "$count" ]; do
    t=$(awk "BEGIN { print $from + $i / 8 }")
    fish=$(awk "BEGIN { print ($t < 2.5 ? \"6,catch\" : $t < 5 ? \"6\" : $t < 9 ? \"6,grill\" : \"0,embers\") }")
    reaction=$(awk "BEGIN { print ($t < 1.8 ? \"toss,\" $t : $t < 5 ? \"reading,0\" : $t < 9 ? \"burn,\" ($t - 5) : \"embers,\" ($t - 9)) }")
    beacon=$(awk "BEGIN { print ($t < 5 ? \"\" : \"--beacon asking\") }")
    time=$(awk "BEGIN { print 3 + $t }")
    "$root/tools/preview/run.sh" shader --at 2026-10-24T15:35 --event dolphin $beacon --fish "$fish" \
      --band --paper 60 --sky-context --reaction "$reaction" --time "$time" --out "gif/$name/f$(printf %03d $i)" >/dev/null
    i=$((i + 1))
  done
}
scene catch 40 0
scene grill 44 5

# The catch from its fifth frame, faded into the grill, faded back into
# the catch's first four frames, so the loop closes on itself.
ffmpeg -y -loglevel error -framerate 8 -i "$frames/catch/f%03d.png" -framerate 8 -i "$frames/grill/f%03d.png" \
  -framerate 8 -i "$frames/catch/f%03d.png" -filter_complex \
  "[0]trim=start_frame=4,setpts=PTS-STARTPTS[catch];[2]trim=end_frame=4,setpts=PTS-STARTPTS[again];[catch][1]xfade=transition=fade:duration=0.5:offset=4[both];[both][again]xfade=transition=fade:duration=0.5:offset=9,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 "$out"
echo "$out"
