// The constellations drawn on the real sky: lines between stars, each star
// by its Yale Bright Star Catalogue (HR) number. tools/stars/build.mjs reads
// these numbers so hooks/stars.ts always holds them.
export const CONSTELLATIONS: Record<string, readonly (readonly [number, number])[]> = {
  karlavagnen: [[4301, 4295], [4295, 4554], [4554, 4660], [4660, 4301], [4660, 4905], [4905, 5054], [5054, 5191]],
  kassiopeja: [[21, 168], [168, 264], [264, 403], [403, 542]],
  orion: [[2061, 1790], [1790, 1852], [2061, 1948], [1852, 1903], [1903, 1948], [1948, 2004], [1852, 1713]],
  lyran: [[7001, 7056], [7056, 7106], [7106, 7178], [7178, 7139], [7139, 7056]],
  sommartriangeln: [[7001, 7924], [7924, 7557], [7557, 7001]],
  svanen: [[7924, 7796], [7796, 7417], [7949, 7796], [7796, 7528]],
}
