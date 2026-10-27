#!/bin/zsh
# What the sky costs the GPU, measured the same way every time
# (docs/superpowers/plans/2026-10-26-arbetsplan-atta-fragor.md, F2):
#
#   tools/measure/gpu.sh context                    the machine, as a run records it
#   tools/measure/gpu.sh row <shader> <animation> <focus> <activity> [marked|unmarked]
#   tools/measure/gpu.sh live <label>               the Ghostty already running, as it is
#   tools/measure/gpu.sh plan [f2|f4|fps] [--twice] a run's list, unattended: the
#                                                   first run's (f2), or that and the
#                                                   same on gpu (f4, phase 4), or the
#                                                   sky at a frame rate of its own (fps)
#   tools/measure/gpu.sh report [dir]               a run's rows as markdown
#   tools/measure/gpu.sh decode <png>               the frame count in a screenshot of the probe
#
#   shader     none, passthrough, probe, or <ref>:<scene> (tools/measure/scenes.sh)
#   animation  true, false, always (custom-shader-animation), or false-novsync:
#              false with window-vsync off, so a focused surface draws only
#              when something wakes it (Ghostty warns that out-of-sync
#              rendering on macOS 14.4+ can cause a kernel panic)
#   focus      focused, unfocused (Finder in front), covered (a second,
#              shader-less Ghostty maximized over it), minimized, tab (a
#              plain tab in front of it)
#   activity   idle, blink, spinner, stream, tick<hz> (tools/measure/term.sh)
#
#   --settle 10 --sample 30   seconds to wait after each change, and to measure
#   --no-sudo                 no powermetrics, so no per-process GPU or power
#   --interactive             ask for covered, minimized and tab instead of
#                             making them with System Events
#   --dry-run                 say what would run, and how long it would take
#   --force                   run on battery or beside a busy process anyway
#   --out <dir>               where rows go (a run's own folder by default)
#
# A row starts a fresh Ghostty that reads no config file, with the shader and
# the animation setting on its command line, so nothing the mod writes can
# change them; and while it runs, every live session's sky is switched off
# with the same file /solar uses. Each row records the whole GPU's
# utilization (ioreg, 1 Hz) and the instance's and WindowServer's CPU; with
# sudo, a powermetrics log alongside gives the instance's own GPU time and
# the GPU's power; under the probe shader, two screenshots give the frames
# it actually drew. Needs, for the terminal it runs in: Screen Recording
# (screenshots) and Accessibility (System Events). Everything it changed is
# put back when it stops, however it stops.
setopt no_unset pipe_fail
zmodload zsh/datetime zsh/zselect zsh/mathfunc

root=${0:A:h:h:h}
app=/Applications/Ghostty.app
binary=$app/Contents/MacOS/ghostty
runtime="$HOME/Library/Application Support/solar-clawd/runtime"
measure=$root/.preview/measure

settle=10 sample=30 use_sudo=1 interactive=0 dry=0 force=0 twice=0 out=''
args=()
while (( $# )); do
  case $1 in
    --settle) settle=$2; shift ;;
    --sample) sample=$2; shift ;;
    --no-sudo) use_sudo=0 ;;
    --interactive) interactive=1 ;;
    --dry-run) dry=1 ;;
    --force) force=1 ;;
    --twice) twice=1 ;;
    --out) out=${2:A}; shift ;;
    *) args+=($1) ;;
  esac
  shift
done
set -- $args

die() { print -u2 "gpu.sh: $*"; exit 1 }
note() { print -u2 "gpu.sh: $*" }
# Swedish when the Mac has the voice, the default one when not.
speak() { { say -v Alva $1 2>/dev/null || say $1 } &! }

# --- Processes -----------------------------------------------------------

ghostty_pids() { ps -axo pid=,comm= | awk -v b=$binary '$2 == b { print $1 }' }
window_server() { ps -axo pid=,comm= | awk '$2 ~ /WindowServer$/ { print $1; exit }' }

# A process's CPU time so far, in seconds ("12:34.56" or "1:02:03.45").
cpu_seconds() {
  local t=$(ps -o time= -p $1 2>/dev/null | tr -d ' ')
  [[ -n $t ]] || { print 0; return }
  print $t | awk -F: '{ s = 0; for (i = 1; i <= NF; i++) s = s * 60 + $i; printf "%.2f\n", s }'
}

# The GPU's utilization in percent, as "device renderer tiler".
utilization() {
  ioreg -r -c IOAccelerator -d 1 | awk '
    /"PerformanceStatistics"/ {
      match($0, /"Device Utilization %"=[0-9]+/); d = substr($0, RSTART + 23, RLENGTH - 23)
      match($0, /"Renderer Utilization %"=[0-9]+/); r = substr($0, RSTART + 25, RLENGTH - 25)
      match($0, /"Tiler Utilization %"=[0-9]+/); t = substr($0, RSTART + 22, RLENGTH - 22)
      print d + 0, r + 0, t + 0; exit
    }'
}

# Mean, sample standard deviation and count of the numbers on stdin.
stats() {
  awk '{ s += $1; q += $1 * $1; n++ }
    END { if (n == 0) { printf "-\t-\t0"; exit }
          m = s / n; v = n > 1 ? (q - n * m * m) / (n - 1) : 0; if (v < 0) v = 0
          printf "%.2f\t%.2f\t%d", m, sqrt(v), n }'
}

# --- The machine ---------------------------------------------------------

context() {
  print "date: $(date '+%Y-%m-%dT%H:%M:%S%z')"
  print "machine: $(sysctl -n hw.model) $(sysctl -n machdep.cpu.brand_string) $(( $(sysctl -n hw.memsize) / 1073741824 )) GB"
  print "macos: $(sw_vers -productVersion) ($(sw_vers -buildVersion))"
  print "ghostty: $($binary +version 2>/dev/null | awk '/version:/ { print $3; exit }')"
  print "commit: $(git -C $root rev-parse --short=7 HEAD)$( [[ -n $(git -C $root status --porcelain -- hooks tools) ]] && print ' (dirty)') on $(git -C $root branch --show-current)"
  print "uptime: $(uptime | sed 's/^ *//')"
  print "power: $(pmset -g batt | head -1)"
  print "thermal:"; pmset -g therm | sed '/^$/d; s/^/  /'
  print "displays:"; system_profiler SPDisplaysDataType 2>/dev/null | awk '/^        [^ ].*:$/ || /Resolution|UI Looks like|Main Display|Connection Type/' | sed 's/^ */  /'
  print "settle: $settle s, sample: $sample s, sudo: $use_sudo"
}

external_displays() { system_profiler SPDisplaysDataType 2>/dev/null | grep -c 'Resolution:' | awk '{ print $1 - 1 }' }

# Refuse what would spoil the numbers: battery, or something else busy.
preflight() {
  local problems=()
  pmset -g batt | head -1 | grep -q 'AC Power' || problems+=('the Mac is on battery')
  local busy=$(top -l 2 -s 1 -o cpu -n 6 -stats pid,cpu,command | awk '
    /^PID/ { block++; next }
    block == 2 && $2 + 0 > 20 && $3 !~ /^(WindowServer|kernel_task|ghostty|top|screencapture|powermetrics)$/ { print $3 " " $2 "%" }' | paste -sd, -)
  [[ -n $busy ]] && problems+=("busy: $busy")
  (( $(external_displays) > 0 )) && note 'an external display is connected; unplug it, or the numbers are for both'
  # Anything macOS will ask once, asked now rather than with nobody there.
  osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' > /dev/null 2>&1 ||
    problems+=('System Events will not answer (Accessibility, and Automation for System Events, for this terminal)')
  local windows=$(osascript -e 'tell application "Finder" to count windows' 2>/dev/null) ||
    problems+=('Finder will not answer (Automation for Finder, for this terminal)')
  # Finder in front is how a row goes unfocused; its open windows would cover the instance.
  (( ${windows:-0} > 0 )) && problems+=("Finder has $windows open windows; close them")
  local test=${TMPDIR:-/tmp}/solar-measure-permission.png
  screencapture -x -R0,0,1,1 $test 2>/dev/null || problems+=('screencapture failed (Screen Recording for this terminal)')
  rm -f $test
  # Neither the display nor the Mac may sleep while it measures; caffeinate
  # lets go when this script ends.
  caffeinate -di -w $$ &!
  if (( ${#problems} )); then
    (( force )) && { note "going on anyway (--force): ${(j:; :)problems}"; return 0 }
    die "${(j:; :)problems} (--force to measure anyway)"
  fi
}

# --- Shaders -------------------------------------------------------------

# The file for a shader name; a scene is rendered once, before anything runs.
shader_file() {
  case $1 in
    none) print '' ;;
    passthrough) print $root/spike/passthrough.glsl ;;
    probe) print $root/tools/measure/probe.glsl ;;
    *:*)
      local ref=${1%%:*} scene=${1#*:} sha
      if [[ $ref == . ]]; then
        sha=$(git -C $root rev-parse --short=7 HEAD)
        [[ -n $(git -C $root status --porcelain -- hooks tools/preview) ]] && sha=dirty
      else
        sha=$(git -C $root rev-parse --short=7 "$ref^{commit}") || return 1
      fi
      local file=$measure/$sha/$scene.glsl
      [[ -f $file ]] || $root/tools/measure/scenes.sh $ref $scene >&2 || return 1
      print $file ;;
    *) die "no shader called $1" ;;
  esac
}

# --- The instance --------------------------------------------------------

pid='' bounds='' cover_pid='' token=''

# A Ghostty of its own, reading no config file: its pid in REPLY.
new_ghostty() {
  local before=(${(f)"$(ghostty_pids)"}) i p
  REPLY=''
  open -na $app --args --config-default-files=false --maximize=true --window-save-state=never \
    --confirm-close-surface=false --quit-after-last-window-closed=true --shell-integration=none \
    --background=282c34 $@
  for i in {1..100}; do
    for p in ${(f)"$(ghostty_pids)"}; do
      (( ${before[(Ie)$p]} )) || { REPLY=$p; return 0 }
    done
    zselect -t 10
  done
  die 'the new Ghostty never started'
}

end_process() {
  kill $1 2>/dev/null
  local i
  for i in {1..30}; do kill -0 $1 2>/dev/null || return 0; zselect -t 10; done
  kill -9 $1 2>/dev/null
}

launch() {
  local shader=$1 animation=$2 activity=$3 mark=$4
  local file i
  file=$(shader_file $shader) || die "no shader file for $shader"
  [[ -n $file || $shader == none ]] || die "no shader file for $shader"
  token=$RANDOM$RANDOM
  local flags=(
    --window-padding-x=2,240 --title=solar-measure
    "--command=$root/tools/measure/term.sh $mark $activity $token" --wait-after-command=true
  )
  if [[ -n $file ]]; then
    case $animation in
      false-novsync) flags+=(--custom-shader=$file --custom-shader-animation=false --window-vsync=false) ;;
      *) flags+=(--custom-shader=$file --custom-shader-animation=$animation) ;;
    esac
  fi
  new_ghostty $flags
  pid=$REPLY
  for i in {1..100}; do
    bounds=$(osascript -e "tell application \"System Events\" to tell (first process whose unix id is $pid) to get {position, size} of window 1" 2>/dev/null | tr -d ' ') && [[ -n $bounds ]] && break
    zselect -t 10
  done
  [[ -n $bounds ]] || die "no window for Ghostty $pid (does this terminal have Accessibility?)"
}

stop_instance() {
  [[ -n $cover_pid ]] && uncover
  [[ -z $pid ]] && return 0
  end_process $pid
  rm -f ${TMPDIR:-/tmp}/solar-measure-tab-$token
  pid=''
}

system_events() { osascript -e "tell application \"System Events\" to tell (first process whose unix id is $pid) to $1" > /dev/null }
to_front() { system_events 'set frontmost to true'; zselect -t 30 }
finder_to_front() { osascript -e 'tell application "Finder" to activate' > /dev/null }

ask() { speak $1; print -n "$1, sedan Enter: "; read -r < /dev/tty }

# Covered: a second Ghostty, maximized over the first, opaque and without a
# shader (a Finder window's sidebar lets the desktop through, and macOS may
# not count a window behind it as hidden).
cover() {
  if (( interactive )); then ask 'Täck mätfönstret helt med ett annat fönster'; return; fi
  new_ghostty --title=solar-cover '--command=/bin/sleep 3600'
  cover_pid=$REPLY
  sleep 1
}
uncover() {
  if (( interactive )); then ask 'Ta bort fönstret som täcker mätfönstret'; return; fi
  end_process $cover_pid
  cover_pid=''
}

# Puts the window in a state, and back.
enter() {
  case $1 in
    focused) to_front ;;
    unfocused) finder_to_front ;;
    covered) cover ;;
    minimized)
      if (( interactive )); then ask 'Minimera mätfönstret'
      else system_events 'set value of attribute "AXMinimized" of window 1 to true'; fi ;;
    tab)
      if (( interactive )); then ask 'Öppna en ny flik i mätfönstret med kommando T'
      else to_front; system_events 'keystroke "t" using command down'; fi ;;
    *) die "no focus state called $1" ;;
  esac
}
leave() {
  case $1 in
    covered) uncover ;;
    minimized)
      if (( interactive )); then ask 'Visa mätfönstret igen'
      else system_events 'set value of attribute "AXMinimized" of window 1 to false'; fi ;;
    tab)
      if (( interactive )); then ask 'Gå tillbaka till första fliken med kommando 1'
      else to_front; system_events 'keystroke "1" using command down'; fi ;;
  esac
  to_front
}

# --- The probe -----------------------------------------------------------

# The frame count a probe screenshot shows, or - when the guards are wrong.
decode() {
  local levels=(${=$(ffmpeg -v error -i $1 -vf 'crop=iw:1:0:ih/2,scale=64:1:flags=area,format=gray' -f rawvideo - | od -An -v -tu1)})
  (( ${#levels} == 64 )) || { print -r -- -; return }
  local bits=() i v
  for i in {0..15}; do
    v=$(( (levels[4 * i + 2] + levels[4 * i + 3]) / 2 ))
    bits+=$(( v > 127 ? 1 : 0 ))
  done
  [[ $bits[1] == 1 && $bits[16] == 0 ]] || { print -r -- -; return }
  print $(( 2#${(j::)bits[2,15]} ))
}

# A screenshot of the instance's window: "<epoch> <frame count>".
capture() {
  local name=$1 x y w h file fresh
  fresh=$(osascript -e "tell application \"System Events\" to tell (first process whose unix id is $pid) to get {position, size} of window 1" 2>/dev/null | tr -d ' ')
  [[ -n $fresh ]] && bounds=$fresh
  IFS=, read -r x y w h <<< $bounds
  file=$dir/probe-$(printf %03d $index)-$name.png
  local a=$EPOCHREALTIME
  screencapture -x -R$x,$y,$w,$h $file
  local b=$EPOCHREALTIME
  print "$(( (a + b) / 2 )) $(decode $file)"
}

# Frames drawn between two screenshots, and the seconds between them.
frames_between() {
  local t1=${1% *} f1=${1#* } t2=${2% *} f2=${2#* }
  [[ $f1 == - || $f2 == - ]] && { print -- "-\t$(printf %.2f $(( t2 - t1 )))\t-"; return }
  local n=$(( (f2 - f1 + 16384) % 16384 )) s=$(( t2 - t1 ))
  printf '%d\t%.2f\t%.1f\n' $n $s $(( n / s ))
}

# --- powermetrics --------------------------------------------------------

pm_pid='' keep_pid=''
powermetrics_pids() { ps -axo pid=,comm= | awk '$2 ~ /(^|\/)powermetrics$/ { print $1 }' }
start_powermetrics() {
  (( use_sudo )) || return 0
  sudo -n true 2>/dev/null || die 'run sudo -v just before (or --no-sudo for ioreg only)'
  [[ -z $(powermetrics_pids) ]] || die 'powermetrics is already running; stop it first'
  # It stops by itself after the seconds the run should take, and some. A
  # log of its own each time, since the file is root's once written and a
  # folder of live or single rows gathers several; the report reads them all.
  sudo -n /usr/bin/env LC_ALL=C /usr/bin/powermetrics --samplers tasks,gpu_power --show-process-gpu \
    -i 1000 -n $(( ${1:-3600} + 600 )) -o $dir/powermetrics-$(date +%H%M%S).log > /dev/null 2>&1 &!
  pm_pid=started
  # sudo forgets after five minutes; a long run keeps it fresh.
  { while kill -0 $$ 2>/dev/null; do sudo -n -v 2>/dev/null; sleep 60; done } &!
  keep_pid=$!
  zselect -t 200
}
stop_powermetrics() {
  [[ -n $pm_pid ]] || { [[ -n $keep_pid ]] && kill $keep_pid 2>/dev/null; keep_pid=''; return 0 }
  local signal i pids
  for signal in INT TERM KILL; do
    pids=(${(f)"$(powermetrics_pids)"})
    (( ${#pids} )) || break
    sudo -n kill -$signal $pids 2>/dev/null
    for i in {1..30}; do [[ -z $(powermetrics_pids) ]] && break; zselect -t 10; done
  done
  [[ -n $(powermetrics_pids) ]] && note 'powermetrics is still running; stop it with: sudo pkill powermetrics'
  [[ -n $keep_pid ]] && kill $keep_pid 2>/dev/null
  keep_pid='' pm_pid=''
}

# --- Putting things back -------------------------------------------------

made_hidden=0 front_pid=''
hide_live_skies() {
  [[ -e $runtime/hidden ]] && return 0
  touch $runtime/hidden || die "cannot switch the live skies off ($runtime)"
  made_hidden=1
  note 'live skies off; each session takes up to ten seconds to notice'
  sleep 12
}
remember_front() {
  front_pid=$(osascript -e 'tell application "System Events" to get unix id of first process whose frontmost is true' 2>/dev/null) || front_pid=''
}
cleanup() {
  trap - EXIT INT TERM
  [[ -n $dir ]] || return 0
  (( made_hidden )) && rm -f $runtime/hidden
  made_hidden=0
  stop_instance
  stop_powermetrics
  [[ -n $front_pid ]] && osascript -e "tell application \"System Events\" to set frontmost of (first process whose unix id is $front_pid) to true" > /dev/null 2>&1
  front_pid=''
  return 0
}

# --- A run ---------------------------------------------------------------

dir='' index=0
columns='index	pass	shader	sha256	animation	focus	activity	mark	ghostty_pid	server_pid	start	end	device_mean	device_sd	n	renderer_mean	renderer_sd	tiler_mean	tiler_sd	ghostty_cpu_mean	ghostty_cpu_sd	server_cpu_mean	server_cpu_sd	frames	frame_seconds	fps	note'

open_run() {
  dir=${out:-$measure/out/$1}
  mkdir -p $dir
  [[ -f $dir/rows.tsv ]] || print -r -- $columns > $dir/rows.tsv
  [[ -f $dir/context.txt ]] || context > $dir/context.txt
  ln -sfn $dir $measure/out/latest
  index=$(( $(wc -l < $dir/rows.tsv) - 1 ))
}

# The numbers for one stretch of $sample seconds, as the row's middle columns.
sample_now() {
  local target=$1 server=$(window_server)
  local devices=() renderers=() tilers=() cpus=() servers=()
  local start=$EPOCHREALTIME i u
  local g0=$(cpu_seconds $target) w0=$(cpu_seconds $server) g1 w1 t0=$start t1
  for i in {1..$sample}; do
    (( start + i - EPOCHREALTIME > 0.01 )) && zselect -t $(( int((start + i - EPOCHREALTIME) * 100) ))
    u=($(utilization))
    (( ${#u} == 3 )) && { devices+=$u[1]; renderers+=$u[2]; tilers+=$u[3] }
    t1=$EPOCHREALTIME g1=$(cpu_seconds $target) w1=$(cpu_seconds $server)
    cpus+=$(( (g1 - g0) / (t1 - t0) * 100 )); servers+=$(( (w1 - w0) / (t1 - t0) * 100 ))
    g0=$g1 w0=$w1 t0=$t1
  done
  local end=$EPOCHREALTIME
  local d=$(print -l $devices | stats) r=$(print -l $renderers | stats) t=$(print -l $tilers | stats)
  print -r -- "$target	$server	$(printf %.2f $start)	$(printf %.2f $end)	$d	${r%	*}	${t%	*}	$(print -l $cpus | stats | cut -f1,2)	$(print -l $servers | stats | cut -f1,2)"
}

row() {
  local shader=$1 animation=$2 focus=$3 activity=$4 mark=${5:-marked} pass=${6:-1}
  index=$(( index + 1 ))
  local file sum=-
  file=$(shader_file $shader) || die "no shader file for $shader"
  [[ -n $file ]] && sum=$(shasum -a 256 $file | cut -c1-12)
  print -u2 "$(date +%H:%M:%S) row $index: $shader $animation $focus $activity $mark"
  launch $shader $animation $activity $mark
  local before='' numbers frames="-	-	-" remark=''
  if [[ $shader == probe && $focus != (focused|unfocused) ]]; then
    to_front; sleep 2; before=$(capture before)
  fi
  enter $focus
  sleep $settle
  numbers=$(sample_now $pid)
  if [[ $shader == probe ]]; then
    if [[ -n $before ]]; then
      # A second for a window coming back from the Dock to be whole again.
      leave $focus; sleep 1
      frames=$(frames_between "$before" "$(capture after)")
      remark="frames span the hidden stretch"
    else
      local a=$(capture a); sleep 4
      frames=$(frames_between "$a" "$(capture b)")
    fi
  else
    leave $focus
    [[ $shader == *:* ]] && capture scene > /dev/null
  fi
  stop_instance
  if (( ${#${(ps:\t:)numbers}} != 15 )); then
    note "row $index: the sampling broke off; not recorded"
    print -r -- "$index $shader $animation $focus $activity $mark: sampling broke off" >> $dir/errors.txt
  else
    print -r -- "$index	$pass	$shader	$sum	$animation	$focus	$activity	$mark	$numbers	$frames	$remark" >> $dir/rows.tsv
  fi
  sleep 2
}

# The first run (plan F2): the floor and what each setting really draws,
# then what the sky costs, on the branch and on main.
first_list() {
  local a f s
  print 'none true focused idle marked'
  print 'passthrough true focused idle marked'
  print 'passthrough true unfocused idle marked'
  for a in true false always; do
    for f in focused unfocused covered minimized tab; do print "probe $a $f idle marked"; done
  done
  print 'probe false focused blink marked'
  print 'probe false focused spinner marked'
  for s in day-clear night-lit; do
    for a in 'true focused idle' 'true unfocused idle' 'false focused idle' 'always focused idle' 'always unfocused idle' 'true focused spinner'; do
      print "ljus-himmel:$s $a marked"
    done
  done
  for s in day-clear night-lit; do
    for a in 'true focused idle' 'true unfocused idle' 'always unfocused idle'; do print "main:$s $a marked"; done
  done
  print 'ljus-himmel:day-clear true focused idle unmarked'
  print 'main:day-clear true focused idle unmarked'
  for s in day-overcast night-dark day-leaves milestone comet; do print "ljus-himmel:$s true focused idle marked"; done
}

# F4's phase 4: the first run again, as the baseline, then gpu in the
# states its targets name, the passthrough under the spinner as the floor
# of the spinner rows, and the lighter sky of battery and away beside the
# whole one.
f4_list() {
  local a s
  first_list
  print 'passthrough true focused spinner marked'
  for s in day-clear night-lit; do
    for a in 'true focused idle' 'true unfocused idle' 'always focused idle' 'always unfocused idle' 'true focused spinner'; do
      print "gpu:$s $a marked"
    done
  done
  print 'gpu:day-clear true focused idle unmarked'
  for s in day-overcast night-dark day-leaves milestone comet; do print "gpu:$s true focused idle marked"; done
  for s in day-clear night-lit; do print "gpu:$s-light true focused idle marked"; done
}

# The sky at a frame rate of its own (the work plan's cell "himlens egen
# takt"): with window-vsync off and the animation false, Ghostty draws a
# focused surface only when something wakes it, and the terminal writing
# the tab's mark again at a steady rate is such a wake. First what the
# probe counts, idle, ticking, under a spinner and under fifty lines a
# second (without vsync nothing caps that), and ticking out of focus,
# covered, minimized and behind another tab (a sky that may run unfocused
# must still cost nothing where it cannot be seen); then the floor and the
# sky as they are now against the sky at 15, 24 and 30 a second, and the
# sky ticking out of focus.
fps_list() {
  local a f s hz
  print 'probe true focused idle marked'
  for a in idle tick15 tick24 tick30 spinner stream; do print "probe false-novsync focused $a marked"; done
  for f in unfocused covered minimized tab; do print "probe false-novsync $f tick24 marked"; done
  print 'passthrough true focused idle marked'
  print 'passthrough false-novsync focused idle marked'
  for hz in 15 24 30; do print "passthrough false-novsync focused tick$hz marked"; done
  for s in day-clear night-lit; do
    print "main:$s true focused idle marked"
    for hz in 15 24 30; do print "main:$s false-novsync focused tick$hz marked"; done
  done
  print 'main:day-clear false-novsync unfocused tick24 marked'
  print 'main:day-clear false-novsync focused spinner marked'
  print 'passthrough false-novsync focused spinner marked'
}

plan() {
  local list
  case ${1:-f2} in
    f2) list=(${(f)"$(first_list)"}) ;;
    f4) list=(${(f)"$(f4_list)"}) ;;
    fps) list=(${(f)"$(fps_list)"}) ;;
    *) die "no plan called $1 (f2, f4, fps)" ;;
  esac
  # Twice, the second time backwards (ABBA), so a slow drift in the
  # machine's heat falls evenly on every row.
  local order=(${(@)list/#/1 })
  (( twice )) && order+=(${(@)${(Oa)list}/#/2 })
  print -u2 "${#order} rows, about $(( ${#order} * (settle + sample + 9) / 60 + 1 )) minutes"
  (( dry )) && { print -l $order; return 0 }
  preflight
  # Every scene rendered first, so nothing heavy runs between rows.
  local line
  for line in $list; do shader_file ${line%% *} > /dev/null || die "could not render ${line%% *}"; done
  open_run $(date +%Y-%m-%dT%H%M%S)
  remember_front
  hide_live_skies
  start_powermetrics $(( ${#order} * (settle + sample + 12) ))
  speak 'Mätningen börjar. Lämna datorn.'
  local words
  for line in $order; do
    words=(${=line})
    row ${words[2,-1]} $words[1]
  done
  cleanup
  date '+%Y-%m-%dT%H:%M:%S%z' > $dir/done
  node $root/tools/measure/report.mjs $dir > $dir/report.md
  speak 'Mätningen är klar.'
  print "$dir/report.md"
}

# The Ghostty already running: its own policy, in whatever state the person
# has put it, after a pause to put it there.
live() {
  local label=$1 target=$(ghostty_pids | head -1)
  [[ -n $target ]] || die 'no Ghostty is running'
  open_run $(date +%Y-%m-%d)-live
  start_powermetrics $(( settle + sample + 30 ))
  print -u2 "measuring Ghostty $target as \"$label\" in $settle s"
  sleep $settle
  index=$(( index + 1 ))
  local numbers=$(sample_now $target)
  print -r -- "$index	1	live	-	live	$label	-	-	$numbers	-	-	-	" >> $dir/rows.tsv
  speak 'Klart.'
  cleanup
  tail -1 $dir/rows.tsv
}

# Set once, here: a trap set inside a function fires when it returns, and
# one that only tidied up after Ctrl-C would let the rows go on.
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM HUP

case ${1-} in
  context) context ;;
  decode) (( $# == 2 )) || die 'decode <png>'; decode $2 ;;
  row)
    (( $# >= 5 )) || die 'row <shader> <animation> <focus> <activity> [marked|unmarked]'
    shift
    if (( dry )); then print "$*"; exit 0; fi
    preflight
    shader_file $1 > /dev/null || die "could not render $1"
    open_run $(date +%Y-%m-%d)-rows
    remember_front
    hide_live_skies
    start_powermetrics $(( settle + sample + 60 ))
    row $@
    cleanup
    tail -1 $dir/rows.tsv ;;
  live) (( $# == 2 )) || die 'live <label>'; live $2 ;;
  plan) plan ${2-} ;;
  report) node $root/tools/measure/report.mjs ${2:-$measure/out/latest} ;;
  *) sed -n '2,/^setopt/p' $0 | sed '$d; s/^# \{0,1\}//'; exit 2 ;;
esac
