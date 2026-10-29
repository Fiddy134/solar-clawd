export type SolarClawdHidden = boolean
// Whether /solar tune's tool is open in the band, so a reload can close it.
export type SolarClawdTuning = boolean

// What the sky is drawn from, kept by the host for the session so that a
// hot reload of the mod's code draws the sky it left, not one from nothing;
// null in a process that never wrote it. The contract stands alone, so the
// shapes of the hooks' own types are spelled out here: a place, the
// weather (sky.ts), the ISS's elements (iss.ts), a wait (waiting.ts).
export type SolarClawdCarried = {
  where: {
    place: { name: string; lat: number; lon: number }
    isChosen: boolean
    weather: { temperature: number; code: number; cloudCover: number; wind: number } | null
    offsetMs: number | null
    kp: number | null
    lastRainAt: number | null
  }
  fill: number | null
  // The subagents at work by id, each with the moment it was last heard of.
  agents: [string, number][]
  // The kind of work shown on the tab (activity.ts), its moment null where
  // it is -Infinity, which JSON has not.
  shown: { tool: 'none' | 'command' | 'edit' | 'read' | 'web' | 'other'; since: number | null }
  waiting: { mode: 'asking' | 'done'; since: number } | null
  activity: { idleMs: number | null; isGhosttyInFront: boolean | null; pace: 'full' | 'spar' }
  issOrbit: {
    epochMs: number
    meanMotion: number
    meanMotionDot: number
    eccentricity: number
    inclination: number
    raan: number
    argPerigee: number
    meanAnomaly: number
  } | null
  pinnedAt: number | null
  demoFrom: number | null
  forced: { kind: string; at: number }[]
  // The tab the mark was last written to, the mark, the heartbeat's file
  // (named by the session's id) and its moment; and a Ghostty reload still
  // owed.
  tty: string | null
  mark: string
  heartbeat: string | null
  heartbeatAt: number | null
  isReloadOwed: boolean
} | null

declare module 'claude-code' {
  interface PluginState {
    'solar-clawd': { isHidden: SolarClawdHidden; isTuning: SolarClawdTuning; carried: Shaped<SolarClawdCarried> }
  }
}
