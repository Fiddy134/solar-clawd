export type SolarClawdHidden = boolean

declare module 'claude-code' {
  interface PluginState {
    'solar-clawd': { isHidden: SolarClawdHidden }
  }
}
