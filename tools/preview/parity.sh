#!/bin/sh
# The sky of this tree against a recorded one, scene by scene, by sha256 of
# the frame: the scenes a change should not touch must come out identical,
# the ones it does touch (leaves, blossom, birds, feathers) are expected to
# differ. All at --time 20 and a fixed --at (without one the sky is now's).
#   tools/preview/parity.sh record .preview/parity-main
#   tools/preview/parity.sh check .preview/parity-main
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
mode=$1
dir=$2
if { [ "$mode" != record ] && [ "$mode" != check ]; } || [ -z "$dir" ]; then
  echo "usage: tools/preview/parity.sh record|check <dir>" >&2
  exit 1
fi
case $dir in /*) ;; *) dir=$PWD/$dir ;; esac
if [ "$mode" = check ] && [ ! -f "$dir/sha256.txt" ]; then
  echo "no record in $dir" >&2
  exit 1
fi
npx -y esbuild@0.24.0 "$root/tools/preview/shader.mjs" --bundle --platform=node --format=esm \
  --log-level=warning --outfile="$root/.preview/shader.bundle.mjs"
here=$root/.preview/parity-now
rm -rf "$here"
mkdir -p "$here" "$dir"
: >"$here/sha256.txt"

# scene <name> <expected: same|differs> <flags>
scene() {
  name=$1
  expected=$2
  shift 2
  SOLAR_ROOT="$root" node "$root/.preview/shader.bundle.mjs" "$@" --time 20 --out "parity-now/$name" >/dev/null
  echo "$(shasum -a 256 <"$here/$name.png" | cut -d' ' -f1)  $name  $expected" >>"$here/sha256.txt"
}

scene dolphin same --at 2026-10-24T15:35 --event dolphin --beacon asking --basket 6
scene night same --at 2026-10-24T22:00
scene rain same --at 2026-10-26T13:00 --weather 61,8,4,90
scene kite same --at 2026-10-26T13:00 --event kite
scene balloon same --at 2026-10-26T13:00 --event balloon
scene plane same --at 2026-10-26T13:00 --event plane
scene sleigh same --at 2026-10-26T13:00 --event sleigh
scene leaves differs --at 2026-10-26T13:00 --event leaves
scene blossom differs --at 2026-05-10T12:00 --event blossom
scene birds differs --at 2026-10-26T07:40 --event birds
scene feathers differs --at 2027-03-26T12:00 --event feathers

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
