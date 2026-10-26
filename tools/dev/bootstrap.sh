#!/bin/sh
# Sets a clone up for developing with the session loading a mirror of it:
# makes the mirror, hands the engine's type declarations over to it, points
# CLAUDE_CODE_PLUGIN_DIRS in ~/.claude/settings.json at it, adds the hooks
# in .claude/settings.local.json that keep it current, and gives git hooks
# that do the same. Run it yourself from a shell (or as
# "! tools/dev/bootstrap.sh" at Claude's prompt), never through Claude in
# auto mode: the settings files and .git are protected paths on purpose.
# Safe to run again; it changes only what is not yet as it should be, and
# keeps a copy of each settings file it changes.
#   tools/dev/bootstrap.sh            the mirror at ~/solar-clawd-live
#   SOLAR_CLAWD_MIRROR=<folder> tools/dev/bootstrap.sh   elsewhere (baked into the hooks)
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
mirror=${SOLAR_CLAWD_MIRROR:-$HOME/solar-clawd-live}
case $mirror in /*) ;; *) mirror=$PWD/$mirror ;; esac
mirror=${mirror%/}
settings=${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json
local_settings=$root/.claude/settings.local.json
script=$root/.claude/hooks/mirror.sh
command -v rsync >/dev/null 2>&1 || { echo "bootstrap: rsync is needed" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "bootstrap: node is needed to edit the settings files" >&2; exit 1; }
[ -x "$script" ] || { echo "bootstrap: $script is missing or not executable" >&2; exit 1; }
[ -d "$root/.git" ] || { echo "bootstrap: $root is a worktree, not the clone; run this from the clone" >&2; exit 1; }

echo "1. The mirror at $mirror"
env -u CLAUDECODE "$script" "$mirror"

echo "2. The engine's type declarations"
if [ -d "$root/.claude-plugin/types" ] && [ ! -L "$root/.claude-plugin/types" ]; then
  if [ ! -d "$mirror/.claude-plugin/types" ]; then
    mkdir -p "$mirror/.claude-plugin"
    cp -R "$root/.claude-plugin/types" "$mirror/.claude-plugin/types"
  fi
  rm -rf "$root/.claude-plugin/types"
fi
if [ ! -e "$root/.claude-plugin/types" ] && [ ! -L "$root/.claude-plugin/types" ]; then
  mkdir -p "$root/.claude-plugin" "$mirror/.claude-plugin/types"
  ln -s "$mirror/.claude-plugin/types" "$root/.claude-plugin/types"
  echo "   .claude-plugin/types in the clone now points at the mirror's (the engine writes them there)"
else
  echo "   already as it should be"
fi

echo "3. git's hooks"
hooks=$(git -C "$root" rev-parse --git-path hooks)
case $hooks in /*) ;; *) hooks=$root/$hooks ;; esac
mkdir -p "$hooks"
mark='# solar-clawd: the mirror follows the working tree'
for name in post-checkout post-merge post-rewrite post-index-change; do
  hook=$hooks/$name
  if [ -e "$hook" ] && ! grep -q "$mark" "$hook"; then
    echo "   $name exists and is not ours; left alone. Add to it: \"$script\" \"$mirror\""
    continue
  fi
  printf '#!/bin/sh\n%s\nexec "%s" "%s"\n' "$mark" "$script" "$mirror" > "$hook"
  chmod +x "$hook"
done
echo "   post-checkout, post-merge, post-rewrite and post-index-change run the mirror (a switch, a merge, a rebase, a stash, a reset)"

echo "4. $settings"
stamp=$(date '+%Y%m%d-%H%M%S')
node - "$settings" "$root" "$mirror" "$stamp" <<'JS'
const fs = require('fs')
const [file, root, mirror, stamp] = process.argv.slice(2)
const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}'
const s = JSON.parse(text)
const changed = []
s.env = s.env ?? {}
const home = process.env.HOME
const real = p => { try { return fs.realpathSync(p) } catch { return p } }
const same = (a, b) => real(a.replace(/^~(?=\/|$)/, home).replace(/\/+$/, '')) === real(b.replace(/\/+$/, ''))
const dirs = String(s.env.CLAUDE_CODE_PLUGIN_DIRS ?? '').split(':').filter(Boolean)
const next = dirs.filter(d => !same(d, root))
if (!next.some(d => same(d, mirror))) next.push(mirror)
if (next.join(':') !== dirs.join(':')) {
  s.env.CLAUDE_CODE_PLUGIN_DIRS = next.join(':')
  changed.push('CLAUDE_CODE_PLUGIN_DIRS = ' + next.join(':'))
}
// The classifier's picture of what is trusted is left as it is: a line an
// earlier bootstrap added about this repo and its mirror is taken out again,
// so that writes touching the mod's code keep their ordinary review.
if (s.autoMode && Array.isArray(s.autoMode.environment)) {
  const before = s.autoMode.environment.length
  s.autoMode.environment = s.autoMode.environment.filter(e => !String(e).startsWith(`Trusted repo (personal project): ${root}`))
  if (s.autoMode.environment.length !== before) changed.push('autoMode.environment no longer names this repo and its mirror')
}
if (changed.length) {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-${stamp}`)
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n')
  for (const c of changed) console.log('   ' + c)
  console.log(`   (the previous file is kept as ${file}.bak-${stamp})`)
} else console.log('   already as it should be')
JS

echo "5. $local_settings"
node - "$local_settings" "$script" "$mirror" "$stamp" <<'JS'
const fs = require('fs')
const path = require('path')
const [file, script, mirror, stamp] = process.argv.slice(2)
const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}'
const s = JSON.parse(text)
const command = `"${script}" --hook "${mirror}"`
s.hooks = s.hooks ?? {}
let changed = false
// After a tool call that succeeded, and after one that failed (a shell
// command may have written files before it failed): PostToolUse does not
// fire for failures, PostToolUseFailure does.
for (const event of ['PostToolUse', 'PostToolUseFailure']) {
  const list = s.hooks[event] = s.hooks[event] ?? []
  const ours = h => (h.hooks ?? []).some(x => typeof x.command === 'string' && x.command.includes(script))
  if (list.some(h => ours(h) && h.hooks.some(x => x.command === command))) continue
  s.hooks[event] = list.filter(h => !ours(h))
  s.hooks[event].push({ matcher: 'Edit|Write|NotebookEdit|Bash', hooks: [{ type: 'command', command, timeout: 30 }] })
  changed = true
}
if (!changed) console.log('   already as it should be')
else {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-${stamp}`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n')
  console.log("   PostToolUse and PostToolUseFailure hooks run .claude/hooks/mirror.sh after Claude's edits and shell commands")
}
JS

echo
echo "Done. Start a new Claude session in $root: it loads the mod from $mirror, and in auto mode"
echo "edits in the clone go through. They reach the live sky while the mirror is armed: run"
echo "  ! tools/dev/arm.sh"
echo "at the start of a session of work on the mod (8 hours; give a number of hours, or off)."
echo "For saves from an editor, run tools/dev/watch.sh (needs fswatch)."
