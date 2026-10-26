#!/bin/sh
# Keeps the mirror current after saves from an editor or a git command run
# outside Claude, which no hook sees: watches the parts of the clone the
# engine loads and runs the mirror when they have been quiet for a third
# of a second. Needs fswatch (brew install fswatch). Leave it running in a
# shell of its own.
#   tools/dev/watch.sh
set -u
root=$(cd "$(dirname "$0")/../.." && pwd)
mirror=$root/.claude/hooks/mirror.sh
command -v fswatch >/dev/null 2>&1 || { echo "watch: fswatch is not installed (brew install fswatch)" >&2; exit 1; }
"$mirror" || exit 1
echo "watching $root"
fswatch -o -l 0.3 --exclude '/\.claude-plugin/types' \
  "$root/hooks" "$root/assets" "$root/types" "$root/.claude-plugin" "$root/tsconfig.json" |
  while read -r _; do "$mirror"; done
