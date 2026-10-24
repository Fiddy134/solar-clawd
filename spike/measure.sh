#!/bin/zsh
# Ghostty's CPU (and the GPU's utilization) over 6 s each: the spike shader
# focused, unfocused (Finder in front), and no shader at all.
pid=$(ps -axo pid,comm | awk '/Ghostty.app\/Contents\/MacOS\/ghostty$/ {print $1; exit}')
include=~/solar-clawd/runtime/solar-clawd.ghostty
reload='tell application id "com.mitchellh.ghostty" to perform action "reload_config" on focused terminal of selected tab of front window'

seconds() { ps -o time= -p $pid | awk -F: '{ print (NF == 3) ? $1 * 3600 + $2 * 60 + $3 : $1 * 60 + $2 }' }
gpu() { ioreg -r -c IOAccelerator -d 1 | grep -o '"Device Utilization %"=[0-9]*' | head -1 | cut -d= -f2 }

measure() {
  local a=$(seconds) g=0
  for i in 1 2 3 4 5 6; do sleep 1; g=$((g + $(gpu))); done
  local b=$(seconds)
  printf '%-24s CPU %5.1f%%   GPU %3d%%\n' "$1" $(( (b - a) / 6.0 * 100 )) $((g / 6))
}

measure 'shader, focused'
osascript -e 'tell application "Finder" to activate'
sleep 1
measure 'shader, unfocused'
osascript -e 'tell application id "com.mitchellh.ghostty" to activate'
sleep 1
saved=$(cat $include)
: > $include
osascript -e $reload > /dev/null
sleep 1
measure 'no shader, focused'
print -r -- $saved > $include
osascript -e $reload > /dev/null
