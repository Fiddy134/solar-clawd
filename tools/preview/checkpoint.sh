#!/bin/sh
# The pictures for a checkpoint, put where /solar look and show.py show
# them: .preview/checkpoint/, emptied of pictures and notes first, each
# picture numbered in the order given. By default each is cut to the stage,
# the right <stage> points of a window 1512 points wide (a Retina frame's
# twice that), since the stage is what a checkpoint looks at; --whole keeps
# the whole frame. A picture is written beside its place and moved there
# whole, so the pane never reads one half written.
#   tools/preview/checkpoint.sh [--whole] [--stage 400] sketch.png frame.png …
set -e
cd "$(dirname "$0")/../.."
whole=0
stage=400
while [ $# -gt 0 ]; do
  case "$1" in
    --whole) whole=1; shift ;;
    --stage) stage=$2; shift 2 ;;
    *) break ;;
  esac
done
[ $# -gt 0 ] || { echo "usage: tools/preview/checkpoint.sh [--whole] [--stage <pt>] <png>…" >&2; exit 2; }
dir=.preview/checkpoint
mkdir -p "$dir"
find "$dir" -maxdepth 1 -type f \( -name '*.png' -o -name '*.md' -o -name '*.txt' -o -name '*.part' \) -delete
i=1
for picture in "$@"; do
  out="$dir/$i-$(basename "$picture")"
  if [ "$whole" = 1 ]; then
    cp "$picture" "$out.part"
  else
    ffmpeg -loglevel error -y -i "$picture" -vf "crop=trunc($stage*iw/1512):ih:iw-trunc($stage*iw/1512):0" -f image2 -c:v png "$out.part"
  fi
  mv "$out.part" "$out"
  i=$((i + 1))
done
ls "$dir"
