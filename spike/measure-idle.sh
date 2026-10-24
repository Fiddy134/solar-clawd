#!/bin/zsh
# The same measure as measure.sh, with Claude idle (no spinner redrawing the
# terminal): four Ghostty set-ups, 8 s each, the window focused.
sleep ${1:-25}
pid=$(ps -axo pid,comm | awk '/Ghostty.app\/Contents\/MacOS\/ghostty$/ {print $1; exit}')
include=~/solar-clawd/runtime/solar-clawd.ghostty
reload='tell application id "com.mitchellh.ghostty" to perform action "reload_config" on focused terminal of selected tab of front window'

seconds() { ps -o time= -p $pid | awk -F: '{ print (NF == 3) ? $1 * 3600 + $2 * 60 + $3 : $1 * 60 + $2 }' }
gpu() { ioreg -r -c IOAccelerator -d 1 | grep -o '"Device Utilization %"=[0-9]*' | head -1 | cut -d= -f2 }

use() {
  if [[ -n $1 ]]; then printf 'custom-shader = %s\ncustom-shader-animation = %s\n' $1 $2 > $include; else : > $include; fi
  osascript -e $reload > /dev/null
  sleep 2
}

measure() {
  local a=$(seconds) g=0
  for i in 1 2 3 4 5 6 7 8; do sleep 1; g=$((g + $(gpu))); done
  local b=$(seconds)
  printf '%-28s CPU %5.1f%%   GPU %3d%%\n' "$1" $(( (b - a) / 8.0 * 100 )) $((g / 8))
}

dir=~/solar-clawd/spike
use '' ''; measure 'no shader'
use $dir/passthrough.glsl true; measure 'passthrough, animated'
use $dir/sky.glsl true; measure 'sky, animated'
use $dir/sky.glsl false; measure 'sky, not animated'
use $dir/sky.glsl true
