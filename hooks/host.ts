import type { EngineInterface } from 'claude-code'

// What the computer says: which system it is, its power, the person's
// idleness and the app in front.

// Whether the session runs on Linux, as uname says; anything it does not
// say plainly counts as the Mac.
export async function isLinuxHost($: EngineInterface): Promise<boolean> {
  const answer = await $.process.run(['uname', '-s'], { timeoutMs: 5_000 }).catch(() => null)

  return answer?.stdout.trim() === 'Linux'
}

// Whether the computer runs on battery: on battery the Ghostty sky stands
// still, without its clouds. Anything pmset (or Linux's power supplies)
// does not say plainly counts as mains power.
export async function isOnBattery($: EngineInterface, isOnLinux: boolean): Promise<boolean> {
  try {
    if (isOnLinux) {
      const { stdout } = await $.process.run(['sh', '-c', 'cat /sys/class/power_supply/*/status 2>/dev/null'], { timeoutMs: 5_000 })

      return stdout.split('\n').some(line => line.trim() === 'Discharging')
    }
    const { stdout } = await $.process.run(['/usr/bin/pmset', '-g', 'batt'], { timeoutMs: 5_000 })

    return stdout.includes("'Battery Power'")
  } catch {
    return false
  }
}

// How long since the person last touched a key or the mouse; null on
// Linux, which has no one way to ask.
export async function idleMs($: EngineInterface, isOnLinux: boolean): Promise<number | null> {
  if (isOnLinux) return null
  try {
    const { stdout } = await $.process.run(['/usr/sbin/ioreg', '-c', 'IOHIDSystem', '-d', '4'], { timeoutMs: 5_000 })
    const ns = /"HIDIdleTime" = (\d+)/.exec(stdout)?.[1]

    return ns ? Number(ns) / 1e6 : null
  } catch {
    return null
  }
}

// Whether Ghostty is the app in front, as lsappinfo says (it needs no
// permissions); null when it could not say, as on Linux.
export async function isGhosttyInFront($: EngineInterface, isOnLinux: boolean): Promise<boolean | null> {
  if (isOnLinux) return null
  try {
    const { stdout: front } = await $.process.run(['/usr/bin/lsappinfo', 'front'], { timeoutMs: 5_000 })
    if (front.trim() === '') return null
    const { stdout } = await $.process.run(['/usr/bin/lsappinfo', 'info', '-only', 'bundleid', front.trim()], { timeoutMs: 5_000 })
    const id = /bundleID="([^"]+)"/.exec(stdout)?.[1]

    return id ? id === 'com.mitchellh.ghostty' : null
  } catch {
    return null
  }
}
