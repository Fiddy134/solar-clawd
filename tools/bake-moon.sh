#!/bin/sh
# Renders tools/moon.html in headless Chrome and writes assets/moon.rgba:
# 256 x 256 RGBA, the disc's edge in its alpha.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
shot=$(mktemp -d)/moon.png
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --default-background-color=00000000 --window-size=512,512 \
  --screenshot="$shot" "file://$here/tools/moon.html" 2>/dev/null
python3 -I "$here/tools/png-to-rgba.py" "$shot" "$here/assets/moon.rgba" 256
echo "$shot"
