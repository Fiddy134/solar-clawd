#!/bin/sh
# Bundles tools/iss/check.mjs with satellite.js (installed under .preview/iss,
# never in the mod) and runs it.
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p "$root/.preview/iss"
[ -d "$root/.preview/iss/node_modules/satellite.js" ] || (cd "$root/.preview/iss" && npm init -y >/dev/null && npm install --silent satellite.js@5.0.0)
NODE_PATH="$root/.preview/iss/node_modules" npx -y esbuild@0.24.0 "$root/tools/iss/check.mjs" --bundle --platform=node --format=esm \
  --log-level=warning --outfile="$root/.preview/iss/check.bundle.mjs"
exec node "$root/.preview/iss/check.bundle.mjs" "$@"
