#!/bin/sh
# Lets changes in the clone reach the live sky for a while. The mirror
# copies only while this stamp is fresh, because code the engine runs would
# otherwise change with nobody reading it. Run it yourself at the start of
# a session of work on the mod, from a terminal window: it refuses a shell
# with no terminal or one a session opened (Claude's tool calls and its !
# prompt both), and asks you to type four letters back, so that arming is
# something a person did on purpose and not something a shell could do in
# passing. (A script that fakes a terminal and types the letters is a
# deliberate step round the gate, which auto mode's reviewer sees as such.)
#   .claude/hooks/arm.sh          armed for 8 hours, and the mirror brought up to date now
#   .claude/hooks/arm.sh 24       armed for 24 hours
#   .claude/hooks/arm.sh off      disarmed: changes stay in the clone until you arm again
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
[ -d "$root/.git" ] || { echo "arm: $root is not the clone" >&2; exit 1; }
stamps=$root/.git/solar-clawd
mkdir -p "$stamps"
case ${1:-8} in
  off) rm -f "$stamps/armed"; echo "disarmed: changes in $root stay out of the live sky until you arm again"; exit 0 ;;
  ''|*[!0-9]*) echo "arm: give the hours (8 if left out), or off" >&2; exit 2 ;;
esac
hours=${1:-8}
if [ -n "${CLAUDECODE:-}" ] || ! [ -t 0 ] || ! (exec 3</dev/tty) 2>/dev/null; then
  echo "arm: run this yourself from a terminal window; a session's own shell is not one, and neither is Claude's ! prompt" >&2
  exit 1
fi
nonce=$(LC_ALL=C tr -dc 'a-z' </dev/urandom | head -c 4)
printf 'Type %s to arm the mirror for %s hours: ' "$nonce" "$hours" >/dev/tty
read -r typed </dev/tty
if [ "$typed" != "$nonce" ]; then
  echo "arm: that was not it; not armed" >&2
  exit 1
fi
echo $(( $(date +%s) + hours * 3600 )) > "$stamps/armed"
rm -f "$stamps/notice"
"$root/.claude/hooks/mirror.sh" --now
echo "armed for $hours hours: changes in $root now reach the live sky as they are made"
