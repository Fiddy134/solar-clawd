#!/bin/sh
# Copies what the engine loads of this clone into the folder the session
# loads as the plugin, so the mod reloads as files are saved here while the
# clone itself stays an ordinary folder. Claude Code treats a loaded plugin
# folder as a protected path: in auto mode an edit inside one is never
# approved and auto mode ends. Editing the clone and loading the mirror
# keeps auto mode on.
#
# That protection is there so that code the engine runs is not changed
# with nobody reading it, and the mirror would undo it if it copied after
# every one of Claude's tool calls. So Claude's own calls (the settings
# hooks, and git run from its shell, where CLAUDECODE is set) copy only
# while the person has armed the mirror with tools/dev/arm.sh, for a few
# hours at a time; the person's own commands (git from a terminal,
# tools/dev/watch.sh) always copy. Unarmed, with something to copy, it
# says so once an hour.
#
# It lives under .claude/, a protected path too, because the hooks run it
# after every tool call: a script the session could rewrite unasked would
# be a way round the permission system.
#   .claude/hooks/mirror.sh [--dry-run] [--hook] [mirror]
# The mirror is the argument, else $SOLAR_CLAWD_MIRROR, else ~/solar-clawd-live.
set -u
src=$(cd "$(dirname "$0")/../.." && pwd)
dry=
byhook=
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) dry=1 ;;
    --hook) byhook=1 ;;
    --) shift; break ;;
    -*) echo "solar-clawd mirror: unknown option $1" >&2; exit 2 ;;
    *) break ;;
  esac
  shift
done
dst=${1:-${SOLAR_CLAWD_MIRROR:-$HOME/solar-clawd-live}}
case $dst in /*) ;; *) dst=$PWD/$dst ;; esac
dst=${dst%/}
state=${XDG_STATE_HOME:-$HOME/.local/state}/solar-clawd/dev
[ -d "$HOME/Library/Application Support" ] && state="$HOME/Library/Application Support/solar-clawd/dev"
log=$state/mirror.log
lock=${TMPDIR:-/tmp}/solar-clawd-mirror.lock
# A worktree of the clone (its .git is a file, not a folder) is not the
# clone: git runs the hooks there too, and the mirror follows the clone alone.
[ -d "$src/.git" ] || exit 0
case $dst in
  "$src"|"$src"/*|/|"$HOME") echo "solar-clawd mirror: refusing to mirror into $dst" >&2; exit 1 ;;
esac
case $src in
  "$dst"/*) echo "solar-clawd mirror: the clone must not sit inside its mirror ($dst)" >&2; exit 1 ;;
esac
mkdir -p "$dst" "$state" 2>/dev/null

# Only what the engine loads: the manifest, the hooks module and what it
# imports, the assets it reads, the state's types, and the tsconfig the
# engine would otherwise write. A save of anything else (docs, previews,
# git's own files) would reload the mod for no reason. The engine writes
# .claude-plugin/types into the mirror; in the clone that is a link to it,
# so it stays out of the copy and --delete never touches it.
failed=
one() {
  if out=$(rsync -a --delete "$@" 2>&1); then
    [ -n "$out" ] && printf '%s\n' "$out"
  else
    failed="$failed
$out"
  fi
}
# The one file on its own is compared byte for byte: openrsync lists a lone
# file as sent on every dry run, which would make an unchanged mirror look
# behind.
copies() {
  for part in hooks assets types; do
    [ -d "$src/$part" ] && one "$@" "$src/$part/" "$dst/$part/"
  done
  one "$@" --exclude=/types "$src/.claude-plugin/" "$dst/.claude-plugin/"
  if [ -f "$src/tsconfig.json" ] && ! cmp -s "$src/tsconfig.json" "$dst/tsconfig.json"; then
    case " $* " in
      *" --dry-run "*) echo ">f tsconfig.json" ;;
      *) cp -p "$src/tsconfig.json" "$dst/tsconfig.json" 2>/dev/null || failed="$failed
tsconfig.json: could not be copied" ;;
    esac
  fi
}

if [ -n "$dry" ]; then
  copies --dry-run -i
  [ -z "$failed" ] && exit 0
  echo "solar-clawd mirror: rsync failed:$failed" >&2
  exit 1
fi

if [ -n "$byhook" ] || [ -n "${CLAUDECODE:-}" ]; then
  armed=
  if [ -f "$state/mirror-armed" ]; then
    until=$(cat "$state/mirror-armed" 2>/dev/null || echo 0)
    now=$(date +%s)
    [ "$until" -gt "$now" ] 2>/dev/null && armed=1
  fi
  if [ -z "$armed" ]; then
    pending=$(copies --dry-run -i)
    [ -z "$pending" ] && exit 0
    now=$(date +%s)
    last=$(cat "$state/mirror-notice" 2>/dev/null || echo 0)
    [ $((now - last)) -lt 3600 ] 2>/dev/null && exit 0
    echo "$now" > "$state/mirror-notice"
    echo "solar-clawd mirror: not armed, so this session's edits stay out of the live sky; to let them in for a while, run: ! tools/dev/arm.sh" >&2
    exit 1
  fi
fi

# One run at a time: parallel tool calls run this hook at once.
n=0
until mkdir "$lock" 2>/dev/null; do
  n=$((n + 1))
  if [ $n -gt 200 ]; then echo "solar-clawd mirror: another run has held $lock for 20 s" >&2; exit 1; fi
  sleep 0.1
done
trap 'rmdir "$lock" 2>/dev/null' EXIT INT TERM HUP
copies > /dev/null
[ -z "$failed" ] && exit 0
printf '%s mirror failed:%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$failed" >> "$log" 2>/dev/null
echo "solar-clawd mirror: rsync to $dst failed:$failed" >&2
exit 1
