#!/bin/sh
# Bundle a preview (the hooks are TypeScript) and run it with node.
#   tools/preview/run.sh band --at 2026-10-24T09:00 --frames 4
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
name=$1
shift
mkdir -p "$root/.preview"
npx -y esbuild@0.24.0 "$root/tools/preview/$name.mjs" --bundle --platform=node --format=esm \
  --log-level=warning --outfile="$root/.preview/$name.bundle.mjs"
SOLAR_ROOT="$root" exec node "$root/.preview/$name.bundle.mjs" "$@"
