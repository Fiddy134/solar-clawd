#!/bin/sh
# Lets Claude's edits reach the live sky for a while. The mirror copies
# after Claude's own tool calls only while this stamp is fresh, because
# code the engine runs would otherwise change with nobody reading it; your
# own git commands and tools/dev/watch.sh copy regardless. Run it yourself
# at the start of a session of work on the mod ("! tools/dev/arm.sh" at
# Claude's prompt), never through Claude.
#   tools/dev/arm.sh          armed for 8 hours, and the mirror brought up to date now
#   tools/dev/arm.sh 24       armed for 24 hours
#   tools/dev/arm.sh off      disarmed: edits stay in the clone until you copy them
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
state=${XDG_STATE_HOME:-$HOME/.local/state}/solar-clawd/dev
[ -d "$HOME/Library/Application Support" ] && state="$HOME/Library/Application Support/solar-clawd/dev"
case ${1:-8} in
  off) rm -f "$state/mirror-armed"; echo "disarmed: Claude's edits stay in the clone until you run .claude/hooks/mirror.sh yourself"; exit 0 ;;
  ''|*[!0-9]*) echo "arm: give the hours (8 if left out), or off" >&2; exit 2 ;;
esac
hours=${1:-8}
mkdir -p "$state"
echo $(( $(date +%s) + hours * 3600 )) > "$state/mirror-armed"
rm -f "$state/mirror-notice"
"$root/.claude/hooks/mirror.sh" ${SOLAR_CLAWD_MIRROR:+"$SOLAR_CLAWD_MIRROR"}
echo "armed for $hours hours: Claude's edits in $root now reach the live sky as they are made"
