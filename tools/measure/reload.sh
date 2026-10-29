#!/bin/zsh
# How fast Ghostty takes a changed shader, for /solar tune's live preview
# (docs/superpowers/plans/2026-10-28-solar-tune.md, Task 1):
#
#   tools/measure/reload.sh <interval-ms> <seconds>
#
# Copies the live shader (runtime/sky.glsl), then for <seconds> alternates
# two versions every <interval-ms>: the original, and one with the sky's
# line dimmed, `sky = tone(sky, k);` (a shader from before /solar tune) or
# `sky = sky_tuned(sky, k, tune);` (one since) with its `k` made
# `k * 0.72`. The shader must hold exactly one of them. Each is written by
# write-then-rename as hooks/ghostty.ts does and followed by the reload a Mac
# gets since 0.9.2: SIGUSR2 to the Ghostty app (the process whose parent is 1
# and whose command ends in /Ghostty.app/Contents/MacOS/ghostty). Ghostty's
# CPU is sampled with top alongside. It prints the mean CPU and how many
# signals kill reported as failed, and puts the original shader back when it
# stops, however it stops.
#
# Run it from Ghostty with the sky showing and nothing heavy running, once at
# 200 and once at 300, with one tab open and again with two: every reload may
# recompile the shader in every open tab. Say for each run whether the sky
# followed without lag you mind and without flicker.
#
# A running Solar session rewrites the shader at its next update (every 10 s)
# when the text differs; that blip is expected, and the next write here
# follows within the interval. The mod itself already reloads Ghostty every 3
# to 10 seconds (Ghostty's log, 2026-10-29).
setopt no_unset pipe_fail
zmodload zsh/datetime zsh/zselect

runtime="$HOME/Library/Application Support/solar-clawd/runtime"
shader=$runtime/sky.glsl
# The sky's line before /solar tune and since, and each dimmed.
lines_from=('  sky = tone(sky, k);' '  sky = sky_tuned(sky, k, tune);')
lines_to=('  sky = tone(sky, k * 0.72);' '  sky = sky_tuned(sky, k * 0.72, tune);')
# What restore cleans up, empty until there is something.
backup='' cpu='' top_pid=''

die() { print -u2 "reload.sh: $*"; exit 1 }

(( $# == 2 )) && [[ $1 == <-> && $2 == <-> ]] && (( $1 > 0 && $2 > 0 )) || {
  print -u2 'usage: tools/measure/reload.sh <interval-ms> <seconds>'
  exit 2
}
interval=$1 seconds=$2

[[ -f $shader ]] || die "no shader at $shader (is a Solar session running?)"
text=$(<$shader)
lines=(${(f)text})
# Exactly one sky line, of either kind, in the whole shader.
found=0 original='' changed=''
for i in 1 2; do
  n=${#${(M)lines:#${lines_from[$i]}}}
  (( n == 0 )) && continue
  (( found += n ))
  original=${lines_from[$i]} changed=${lines_to[$i]}
done
(( found == 1 )) || die "expected exactly one line '${lines_from[1]}' or '${lines_from[2]}' in the shader, found $found"

# The same text with the one line changed.
altered=${text/$original/$changed}
[[ $altered != $text ]] || die 'the changed shader equals the original'

# Written beside the shader and moved in, so Ghostty never reads half a file.
put() {
  print -r -- $1 > $shader.tmp-reload && mv -f $shader.tmp-reload $shader
}

restore() {
  trap - EXIT INT TERM HUP
  [[ -n $top_pid ]] && kill $top_pid 2>/dev/null
  [[ -n $backup && -f $backup ]] && cp $backup $shader.tmp-reload && mv -f $shader.tmp-reload $shader && reload > /dev/null
  [[ -n $backup ]] && rm -f $backup
  [[ -n $cpu ]] && rm -f $cpu
  rm -f $shader.tmp-reload
  return 0
}
trap restore EXIT
trap 'restore; exit 130' INT TERM HUP

backup=${TMPDIR:-/tmp}/solar-reload-original.$$
cp $shader $backup || die 'cannot copy the shader'

failed=0
# Signals the Ghostty app; counts the ones kill reported as failed.
reload() {
  local pid sent=0
  for pid in $(ps -axo pid=,ppid=,comm= | awk '$2 == 1 && $3 ~ /\/Ghostty\.app\/Contents\/MacOS\/ghostty$/ { print $1 }'); do
    kill -USR2 $pid 2>/dev/null && sent=1 || (( failed++ ))
  done
  (( sent )) || (( failed++ ))
  return 0
}

target=$(ps -axo pid=,ppid=,comm= | awk '$2 == 1 && $3 ~ /\/Ghostty\.app\/Contents\/MacOS\/ghostty$/ { print $1; exit }')
[[ -n $target ]] || die 'no Ghostty app is running'

cpu=${TMPDIR:-/tmp}/solar-reload-cpu.$$
top -pid $target -l $(( seconds + 1 )) -s 1 -stats pid,cpu > $cpu 2>/dev/null &
top_pid=$!

# Faults in the loop below are the point; one failed write ends the run.
flips=0 end=$(( EPOCHREALTIME + seconds ))
while (( EPOCHREALTIME < end )); do
  if (( flips % 2 )); then put $text; else put $altered; fi || die 'cannot write the shader'
  reload
  (( flips++ ))
  zselect -t $(( interval / 10 ))
done

wait $top_pid 2>/dev/null
# top's first sample is since boot; the rest are per second.
mean=$(awk -v p=$target '$1 == p { n++; if (n > 1) { s += $2; m++ } } END { if (m) printf "%.1f", s / m; else print "-" }' $cpu)
rm -f $cpu
print "interval $interval ms, $seconds s: $flips writes, mean Ghostty CPU $mean %, signals failed $failed"
