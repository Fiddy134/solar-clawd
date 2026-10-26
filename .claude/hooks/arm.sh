#!/bin/sh
# Lets changes in the clone reach the live sky for a while. The mirror
# copies only while this stamp is fresh, because code the engine runs would
# otherwise change with nobody reading it. Run it yourself at the start of
# a session of work on the mod, from a terminal window: it refuses a shell
# with no terminal, which is what a session's own tool calls have, and
# Claude's ! prompt too.
#   .claude/hooks/arm.sh          armed for 8 hours, and the mirror brought up to date now
#   .claude/hooks/arm.sh 24       armed for 24 hours
#   .claude/hooks/arm.sh off      disarmed: changes stay in the clone until you arm again
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
[ -d "$root/.git" ] || { echo "arm: $root is not the clone" >&2; exit 1; }
if ! (exec 3</dev/tty) 2>/dev/null; then
  echo "arm: run this yourself from a terminal window; a session's own shell has no terminal, and Claude's ! prompt has none either" >&2
  exit 1
fi
stamps=$root/.git/solar-clawd
mkdir -p "$stamps"
case ${1:-8} in
  off) rm -f "$stamps/armed"; echo "disarmed: changes in $root stay out of the live sky until you arm again"; exit 0 ;;
  ''|*[!0-9]*) echo "arm: give the hours (8 if left out), or off" >&2; exit 2 ;;
esac
hours=${1:-8}
echo $(( $(date +%s) + hours * 3600 )) > "$stamps/armed"
rm -f "$stamps/notice"
"$root/.claude/hooks/mirror.sh" --now
echo "armed for $hours hours: changes in $root now reach the live sky as they are made"
