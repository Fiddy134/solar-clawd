#!/bin/sh
# Bundle a theme tool (the hooks are TypeScript) and run it with node.
#   tools/theme/run.sh lint fyr
#   tools/theme/run.sh pack fyr .preview/fyr-packed
#   tools/theme/run.sh stage fyr
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
name=$1
shift
mkdir -p "$root/.preview"
npx -y esbuild@0.24.0 "$root/tools/theme/$name.mjs" --bundle --platform=node --format=esm \
  --log-level=warning --outfile="$root/.preview/theme-$name.bundle.mjs"
SOLAR_ROOT="$root" exec node "$root/.preview/theme-$name.bundle.mjs" "$@"
