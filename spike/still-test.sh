#!/bin/zsh
# With custom-shader-animation = false and Claude idle, do the clouds still
# move? Two screenshots 4 s apart; the largest pixel change between them.
sleep ${1:-20}
include=~/solar-clawd/runtime/solar-clawd.ghostty
reload='tell application id "com.mitchellh.ghostty" to perform action "reload_config" on focused terminal of selected tab of front window'
out=${2:-/tmp}
printf 'custom-shader = %s\ncustom-shader-animation = false\n' ~/solar-clawd/spike/sky.glsl > $include
osascript -e $reload > /dev/null
sleep 3
screencapture -x -o $out/still-a.png
sleep 4
screencapture -x -o $out/still-b.png
for f in a b; do
  ffmpeg -hide_banner -loglevel error -i $out/still-$f.png -vf 'crop=iw:ih*0.6:0:ih*0.1,scale=96:48' -pix_fmt rgb24 -f rawvideo -y $out/still-$f.raw
done
node -e '
const fs = require("fs"); const [a, b] = process.argv.slice(1).map(p => fs.readFileSync(p));
let changed = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 4) changed++;
console.log(`pixels changed between the shots: ${changed} of ${a.length}`)' $out/still-a.raw $out/still-b.raw
printf 'custom-shader = %s\ncustom-shader-animation = true\n' ~/solar-clawd/spike/sky.glsl > $include
osascript -e $reload > /dev/null
