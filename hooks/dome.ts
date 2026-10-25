// The real sky drawn on the window as if lying on your back, feet to the
// south: south at the horizon line, the zenith above it, the north beyond
// at the top, east on the left and west on the right. Distances from the
// zenith are kept (an azimuthal equidistant projection), so constellations
// keep their shapes. Points are in window heights: x from the window's
// centre, y from its top, so a shader that knows the window's size can
// place them on any width.

import type { Sun } from './astro'

// Where the horizon is, as a fraction of the window's height: the same line
// the sun's arc stands on (the shader's ARC.w).
export const HORIZON = 0.62
// Heights per degree: from the south horizon up over the zenith reaches 130°,
// far enough north for Polaris and Karlavagnen.
export const DOME_SCALE = HORIZON / 130
export const ZENITH_Y = HORIZON - 90 * DOME_SCALE

export type DomePoint = { x: number; y: number }

const RAD = Math.PI / 180

export function domePoint(sky: Sun): DomePoint {
  const r = (90 - sky.elevation) * DOME_SCALE
  const az = sky.azimuth * RAD

  return { x: -r * Math.sin(az), y: ZENITH_Y - r * Math.cos(az) }
}
