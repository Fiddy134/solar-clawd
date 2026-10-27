#!/bin/zsh
# The sky at a frame rate of its own, to look at rather than measure (the
# work plan's cell "himlens egen takt"):
#   tools/measure/try.sh <hz|full> [scene]    one window: the sky at <hz>, or as today
#   tools/measure/try.sh blind [scene]        full, 30, 24 and 15 in an order you are
#                                             not told, one window after the other
# A fresh Ghostty that reads no config file, as gpu.sh starts one, with the
# scene (tools/measure/scenes.sh, day-dolphin unless named) from this
# checkout. At a rate, window-vsync is off and the animation false, so
# Ghostty draws only when the terminal writes, and the terminal writes the
# tab's mark <hz> times a second; full is the animation true with vsync, as
# the sky runs now. Ghostty warns that out-of-sync rendering on macOS 14.4+
# can cause a kernel panic: save your work in other apps first. The live
# skies are left alone, and nothing here touches your own config.
setopt no_unset pipe_fail
root=${0:A:h:h:h}
app=/Applications/Ghostty.app

die() { print -u2 "try.sh: $*"; exit 1 }

(( $# >= 1 )) || { sed -n '2,/^setopt/p' $0 | sed '$d; s/^# \{0,1\}//'; exit 2 }
mode=$1 scene=${2:-day-dolphin}
sha=$(git -C $root rev-parse --short=7 HEAD)
[[ -n $(git -C $root status --porcelain -- hooks tools/preview) ]] && sha=dirty
file=$root/.preview/measure/$sha/$scene.glsl
[[ -f $file ]] || $root/tools/measure/scenes.sh . $scene >&2 || die "could not render $scene"

# One window, until it is closed.
show() {
  local rate=$1 title=$2 flags
  if [[ $rate == full ]]; then
    flags=(--custom-shader-animation=true "--command=$root/tools/measure/term.sh marked idle")
  else
    flags=(--custom-shader-animation=false --window-vsync=false "--command=$root/tools/measure/term.sh marked tick$rate")
  fi
  open -naW $app --args --config-default-files=false --maximize=true --window-save-state=never \
    --confirm-close-surface=false --quit-after-last-window-closed=true --shell-integration=none \
    --background=282c34 --window-padding-x=2,240 --title=$title --custom-shader=$file $flags
}

case $mode in
  full|<->) print "the sky at $mode; close the window to end"; show $mode "solar-try $mode" ;;
  blind)
    rates=(full 30 24 15) order=() i=0
    # A shuffle with zsh's own random numbers, so the order is not told.
    while (( ${#rates} )); do i=$(( RANDOM % ${#rates} + 1 )); order+=$rates[i]; rates[i]=(); done
    key=$root/.preview/measure/try-blind-$(date +%H%M%S).txt
    print -l $order > $key
    for i in {1..4}; do
      print -n "window $i of 4: look as long as you like, close it, and say how it felt (1-5): "
      show $order[i] "solar-try $i" &
      wait
      read -r score < /dev/tty
      print "$i ${order[i]} $score" >> $key.scores
    done
    print '\nwhat each window was:'
    awk '{ printf "  window %s: %s, you said %s\n", $1, $2, $3 }' $key.scores ;;
  *) die "give a rate (15, 24, 30…), full, or blind" ;;
esac
