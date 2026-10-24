#!/bin/zsh
# A second Ghostty with the sky shader and custom-shader-animation set on
# its command line (so no reload is involved), sitting at an idle shell:
# its CPU and the GPU over 8 s, for false and for true.
main=$(ps -axo pid,comm | awk '/Ghostty.app\/Contents\/MacOS\/ghostty$/ {print $1; exit}')
gpu() { ioreg -r -c IOAccelerator -d 1 | grep -o '"Device Utilization %"=[0-9]*' | head -1 | cut -d= -f2 }
seconds() { ps -o time= -p $1 | awk -F: '{ print (NF == 3) ? $1 * 3600 + $2 * 60 + $3 : $1 * 60 + $2 }' }

for animation in false true; do
  open -na Ghostty.app --args --custom-shader=$HOME/solar-clawd/spike/sky.glsl --custom-shader-animation=$animation
  sleep 4
  pid=$(ps -axo pid,comm | awk -v main=$main '/Ghostty.app\/Contents\/MacOS\/ghostty$/ && $1 != main {print $1; exit}')
  a=$(seconds $pid) g=0
  for i in 1 2 3 4 5 6 7 8; do sleep 1; g=$((g + $(gpu))); done
  b=$(seconds $pid)
  printf 'second instance, animation=%-5s CPU %5.1f%%   GPU %3d%%\n' $animation $(( (b - a) / 8.0 * 100 )) $((g / 8))
  kill $pid
  sleep 2
done
