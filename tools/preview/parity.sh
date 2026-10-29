#!/bin/sh
# The sky of this tree against a recorded one, scene by scene, by sha256 of
# the frame: the scenes a change should not touch must come out identical,
# the ones it does touch (leaves, blossom, birds, feathers) are expected to
# differ. Each scene has its own --time and a fixed --at (without one the
# sky is now's); the last flag wins, so a scene's time is never overridden.
#   tools/preview/parity.sh record .preview/parity-main
#   tools/preview/parity.sh check .preview/parity-main
#   tools/preview/parity.sh twice .preview/parity-now     (determinism: every scene twice)
#   tools/preview/parity.sh --large record .preview/parity-main-large
# --large renders only the scenes marked L below, at 3024x1964 with a 480
# strip, the size of a retina window.
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
large=""
if [ "$1" = --large ]; then
  large=1
  shift
fi
mode=$1
dir=$2
if { [ "$mode" != record ] && [ "$mode" != check ] && [ "$mode" != twice ]; } || [ -z "$dir" ]; then
  echo "usage: tools/preview/parity.sh [--large] record|check|twice <dir>" >&2
  exit 1
fi
case $dir in /*) ;; *) dir=$PWD/$dir ;; esac
if [ "$mode" = check ] && [ ! -f "$dir/sha256.txt" ]; then
  echo "no record in $dir" >&2
  exit 1
fi
npx -y esbuild@0.24.0 "$root/tools/preview/shader.mjs" --bundle --platform=node --format=esm \
  --log-level=warning --outfile="$root/.preview/shader.bundle.mjs"
here=$root/.preview/parity-now${large:+-large}
again=$here-twice
rm -rf "$here" "$again"
mkdir -p "$here" "$dir"
[ "$mode" = twice ] && mkdir -p "$again"
: >"$here/sha256.txt"
twice_status=0

# render <flags...> --out <path under .preview>
render() {
  SOLAR_ROOT="$root" node "$root/.preview/shader.bundle.mjs" "$@" >/dev/null
}

# scene <name> <expected: same|differs> <marked: L|-> <time> <flags>
# L scenes are the ones --large renders; the others are left out of it.
scene() {
  name=$1
  expected=$2
  marked=$3
  time=$4
  shift 4
  size=""
  if [ -n "$large" ]; then
    [ "$marked" = L ] || return 0
    size="--width 3024 --height 1964 --stage 480"
  fi
  # shellcheck disable=SC2086
  render "$@" $size --time "$time" --out "$(basename "$here")/$name"
  sha=$(shasum -a 256 <"$here/$name.png" | cut -d' ' -f1)
  echo "$sha  $name  $expected" >>"$here/sha256.txt"
  if [ "$mode" = twice ]; then
    # shellcheck disable=SC2086
    render "$@" $size --time "$time" --out "$(basename "$again")/$name"
    if [ "$sha" = "$(shasum -a 256 <"$again/$name.png" | cut -d' ' -f1)" ]; then
      printf '%-18s same twice\n' "$name"
    else
      printf '%-18s DIFFERS BETWEEN TWO RUNS  <- not deterministic\n' "$name"
      twice_status=1
    fi
  fi
}

S="--stage 240"
DAY="--at 2026-10-26T13:00"
NIGHT="--at 2026-10-24T22:00"

# The keeper's day loop: the sky at four moments of one --time clock.
scene keeper-20 same L 20 $DAY $S
scene keeper-45 same - 45 $DAY $S
scene keeper-60 same - 60 $DAY $S
scene keeper-75 same - 75 $DAY $S
# A dolphin leaps only while (t + seed) mod 7 < 1.6; at 20 none is in the air.
scene dolphin-air same L 24.8 --at 2026-10-24T15:35 --event dolphin $S
scene pinkdolphin-air same - 24.8 --at 2026-10-24T15:35 --event pinkDolphin $S
scene surf same L 20 $DAY --event surf $S
scene abduction-88 same L 88 $NIGHT --event abduction $S
scene abduction-126 same - 126 $NIGHT --event abduction $S
scene beacon-dusk same - 20 --at 2026-10-26T16:30 --beacon asking $S
scene beacon-urgent same - 20 $NIGHT --beacon asking --urgent $S
scene beacon-done same - 20 $DAY --beacon done $S
scene night-aurora same L 20 $NIGHT --aurora $S
scene night-iss same - 20 $NIGHT --iss $S
scene night-moon same - 20 --at 2026-10-26T23:00 --weather 0,5,2,10 $S
scene hammock-0400 same - 20 --at 2026-10-26T04:00 $S
scene rain-keeper same - 20 --at 2026-10-26T13:00 --weather 61,8,4,90 $S
scene snow same - 20 --at 2026-01-15T13:00 --weather 71,-2,3,90 $S
scene storm-kite same - 20 --at 2026-10-26T13:00 --weather 95,12,12,95 --event kite $S
scene fish-6 same - 20 --at 2026-10-24T15:35 --fish 6 $S
scene fish-9-grill same L 20 --at 2026-10-24T15:35 --fish 9,grill $S
scene fish-0-embers same - 20 --at 2026-10-24T15:35 --fish 0,embers $S
scene fish-7-catch same - 20 --at 2026-10-24T15:35 --fish 7,catch $S
scene comet-constellation same - 20 $NIGHT --weather 0,5,2,10 --event comet,constellation $S
scene rainbow-rained same - 20 $DAY --event rainbow --rained $S
scene balloon-plane-birds same - 20 --at 2026-10-26T09:00 --event balloon,plane,birds $S
scene christmas same - 20 --at 2026-12-24T16:00 $S
scene flag-day same - 20 --at 2026-06-06T12:00 $S
scene new-year same - 20 --at 2026-12-31T23:55 $S
scene milestone same L 20 $DAY --event milestone $S
scene demo same - 20 $DAY --demo $S
scene stage-0 same - 20 $DAY --stage 0
scene y-up same - 20 $DAY --y-up $S
scene diff-p3 same - 20 $DAY --diff --p3 $S
scene light same - 20 $DAY --light $S
scene unmarked same - 20 $DAY --unmarked $S
scene band-keeper same L 20 --at 2026-10-24T15:35 --band $S

# The sixteen scenes of the first harness, as they were.
scene dolphin same - 20 --at 2026-10-24T15:35 --event dolphin --beacon asking --basket 6
scene night same - 20 --at 2026-10-24T22:00
scene rain same - 20 --at 2026-10-26T13:00 --weather 61,8,4,90
scene kite same - 20 --at 2026-10-26T13:00 --event kite
scene balloon same - 20 --at 2026-10-26T13:00 --event balloon
scene plane same - 20 --at 2026-10-26T13:00 --event plane
scene sleigh same - 20 --at 2026-10-26T13:00 --event sleigh
scene leaves differs - 20 --at 2026-10-26T13:00 --event leaves
scene blossom differs - 20 --at 2026-05-10T12:00 --event blossom
scene birds differs - 20 --at 2026-10-26T07:40 --event birds
scene feathers differs - 20 --at 2027-03-26T12:00 --event feathers
scene fish same - 20 --at 2026-10-24T15:35 --fish 6
scene catch same - 20 --at 2026-10-24T15:35 --fish 7,catch
scene grill same - 20 --at 2026-10-24T15:35 --fish 9,grill
scene embers same - 20 --at 2026-10-24T15:35 --fish 0,embers
scene band same - 20 --at 2026-10-24T15:35 --band

if [ "$mode" = twice ]; then
  [ "$twice_status" = 0 ] && echo "all deterministic" || echo "some scenes differ between two runs" >&2
  exit "$twice_status"
fi
if [ "$mode" = record ]; then
  cp "$here"/*.png "$here/sha256.txt" "$dir/"
  echo "recorded in $dir"
  exit 0
fi
status=0
while read -r sha name expected; do
  old=$(awk -v n="$name" '$2 == n { print $1 }' "$dir/sha256.txt")
  if [ "$sha" = "$old" ]; then result=identical; else result=different; fi
  note=""
  if [ "$expected" = same ] && [ "$result" = different ]; then note="  <- should be identical"; status=1; fi
  printf '%-10s %s%s\n' "$name" "$result" "$note"
done <"$here/sha256.txt"
exit $status
