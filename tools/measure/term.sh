#!/bin/zsh
# What the terminal does while it is measured (tools/measure/gpu.sh):
#   tools/measure/term.sh <marked|unmarked> <idle|blink|spinner|stream|tick<hz>> [token]
# A screen of text like a session's, so a sky that rims text has text to
# rim, then one of four things until it is killed: nothing with a steady
# cursor, a blinking cursor, a spinner ten times a second, fifty lines a
# second, or the tab's mark written again <hz> times a second and nothing
# else (what the mod would do to set the sky's frame rate). Marked, the tab carries the mark a Claude session gives it
# (palette colour 16, blue one step off black), without which the sky
# draws nothing. The token makes every tab after the first a plain one:
# what a tab opened in front of the measured one shows.
zmodload zsh/zselect zsh/datetime zsh/mathfunc
mark=$1 mode=$2 token=${3-}

if [[ -n $token ]]; then
  first=${TMPDIR:-/tmp}/solar-measure-tab-$token
  if [[ -e $first ]]; then mark=unmarked mode=idle; else : > $first; fi
fi

[[ $mark == marked ]] && printf '\e]4;16;rgb:00/00/01\e\\'
printf '\e[2J\e[H'
cat <<'TEXT'

 ✻ Welcome to Claude Code

> how much does the sky cost when the window is not in front?

● I'll measure it rather than guess. First the floor: Ghostty's own loop
  with a shader that does nothing, then the sky on top of that.

● Read(hooks/beacon.ts)
  ⎿  Read 64 lines

● Bash(tools/measure/gpu.sh plan --dry-run)
  ⎿  45 rows, about 38 minutes
     1 none true focused idle marked
     1 passthrough true focused idle marked
     1 probe true focused idle marked
     … +42 lines

● The probe counts frames, so a setting that claims to stop drawing can
  be caught drawing anyway. Unfocused, true should stop; always should not.

  ┌──────────────┬──────────┬─────────┐
  │ animation    │ focused  │ hidden  │
  ├──────────────┼──────────┼─────────┤
  │ true         │ 120 fps  │ ?       │
  │ false        │ ?        │ ?       │
  │ always       │ 120 fps  │ ?       │
  └──────────────┴──────────┴─────────┘

TEXT

case $mode in
  idle) printf '\e[2 q'; while :; do zselect -t 100000; done ;;
  blink) printf '\e[1 q'; while :; do zselect -t 100000; done ;;
  spinner)
    printf '\e[?25l'
    frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
    i=0
    while :; do
      printf '\r %s Measuring… (%ds)' $frames[$(( i % 10 + 1 ))] $(( i / 10 ))
      i=$(( i + 1 ))
      zselect -t 10
    done ;;
  stream)
    i=0
    while :; do
      i=$(( i + 1 ))
      print -r -- "  ⎿  $i  hooks/glsl/main.ts: sky = clouds(sky, p, s); the frame's cost is pixels × work × frames"
      zselect -t 2
    done ;;
  tick<->)
    # Against the clock rather than a fixed pause, so the rate holds when a
    # write or a wake-up runs late: zselect waits in hundredths.
    printf '\e[2 q'
    step=$(( 1.0 / ${mode#tick} )) next=$EPOCHREALTIME
    while :; do
      printf '\e]4;16;rgb:00/00/01\e\\'
      next=$(( next + step ))
      wait=$(( int((next - EPOCHREALTIME) * 100 + 0.5) ))
      (( wait > 0 )) && zselect -t $wait
    done ;;
  *) print -u2 "term.sh: no mode called $mode"; exit 2 ;;
esac
