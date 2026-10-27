#!/bin/zsh
# The pinned scenes the measurements run, as the sky shader a given commit
# writes for them:
#   tools/measure/scenes.sh <ref> <name>…     (or all; ref . is the working tree)
# Each lands in .preview/measure/<sha>/<name>.glsl, or dirty/ when the
# working tree has changes the commit lacks. The shader's text depends on
# the scene's flags alone, never on a window's size, so one file serves
# every screen. A commit other than the working tree is rendered from a
# temporary worktree with that commit's own preview tool. The -light scenes
# are the lighter sky of battery and away (F4 task 5b), which only a commit
# from 743d58a on can write.
set -euo pipefail
root=${0:A:h:h:h}

typeset -A scenes
scenes=(
  day-clear    '--at 2026-10-26T12:30 --weather 1,10,3,20 --stage 480'
  day-overcast '--at 2026-10-26T12:30 --weather 3,8,4,90 --stage 480'
  day-leaves   '--at 2026-10-26T12:30 --weather 1,10,3,20 --stage 480 --event leaves'
  milestone    '--at 2026-10-26T12:30 --weather 1,10,3,20 --stage 480 --event milestone'
  night-lit    '--at 2026-10-26T22:00 --weather 0,5,2,10 --stage 480 --beacon asking'
  day-clear-light '--at 2026-10-26T12:30 --weather 1,10,3,20 --stage 480 --light'
  night-lit-light '--at 2026-10-26T22:00 --weather 0,5,2,10 --stage 480 --beacon asking --light'
  night-dark   '--at 2026-10-26T22:00 --weather 3,5,2,95 --stage 480'
  comet        '--at 2026-10-26T22:00 --weather 0,5,2,10 --stage 480 --event comet'
)

if (( $# < 2 )); then
  print -u2 "usage: ${0:t} <ref> <scene>… | all    scenes: ${(ko)scenes}"
  exit 2
fi
ref=$1
shift
names=($@)
[[ $names == all ]] && names=(${(ko)scenes})
for name in $names; do
  [[ -n ${scenes[$name]-} ]] || { print -u2 "${0:t}: no scene called $name (${(ko)scenes})"; exit 2; }
done

cd $root
if [[ $ref == . ]]; then
  sha=$(git rev-parse --short=7 HEAD)
  [[ -n $(git status --porcelain -- hooks tools/preview) ]] && sha=dirty
  tree=$root
else
  sha=$(git rev-parse --short=7 "$ref^{commit}")
  tree=${TMPDIR:-/tmp}/solar-measure-$sha
  # A worktree left by a run that was stopped is taken down first.
  git worktree remove --force $tree 2>/dev/null || rm -rf $tree
  git worktree add --quiet --detach $tree $sha
  # The engine's types, which tsconfig.json extends, are not in git.
  ln -s $root/.claude-plugin/types $tree/.claude-plugin/types
  trap "git -C ${(q)root} worktree remove --force ${(q)tree} 2>/dev/null" EXIT
fi

out=$root/.preview/measure/$sha
mkdir -p $out
for name in $names; do
  print -n "$ref $sha $name … "
  $tree/tools/preview/run.sh shader ${=scenes[$name]} --out measure-$name > /dev/null
  grep -q 'void mainImage' $tree/.preview/sky.glsl || { print -u2 "${0:t}: $name gave no shader"; exit 1; }
  # An older preview tool takes --light without a word and draws the whole sky.
  if [[ $name == *-light ]] && ! grep -q 'const float LIGHT = 1.0;' $tree/.preview/sky.glsl; then
    print -u2 "${0:t}: $ref cannot write the lighter sky"
    exit 1
  fi
  cp $tree/.preview/sky.glsl $out/$name.glsl
  print $out/$name.glsl
done
