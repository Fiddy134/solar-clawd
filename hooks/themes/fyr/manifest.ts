// fyr's manifest: the island with its lighthouse and its keeper, a small
// Clawd, the sky's first theme.

import type { ThemeManifest } from '../theme'

export const FYR_MANIFEST: ThemeManifest = {
  engine: 1,
  name: 'fyr',
  title: 'The lighthouse',
  description: 'A striped lighthouse on its rocks in the sea at the right, and its keeper, a small Clawd: fishing, walking the gallery, surfing, asleep in his hammock at night, his catch the context window on a line, grilled as the conversation compacts. Dolphins leap now and then, and a UFO comes for him.',
  author: 'Solar Clawd',
  version: '1.0.0',
  license: 'GPL-3.0',
  stage: 'wanted',
  waits: 'The lantern lit, its beam turning: orange while Claude asks, white when it is done, hurrying once a question has waited; the keeper on the gallery beside it.',
  context: 'resident',
  // The salts are the dolphins' places in the engine's list before the
  // island was a theme, so they keep the schedule they had.
  events: [
    { kind: 'dolphin', word: 'dolphin', slotMinutes: 30, chance: 1, minutes: 1, layer: 'front', when: { sun: 'day', windBelow: 12, dry: true }, salt: 7 },
    // Rarer: a pink one, as the Amazon's river dolphins are.
    { kind: 'pinkDolphin', word: 'pink dolphin', slotMinutes: 360, chance: 0.5, minutes: 1, layer: 'front', when: { sun: 'day', windBelow: 12, dry: true }, salt: 8 },
  ],
  // The keeper's own: the shader schedules them from iTime.
  previews: [
    { kind: 'abduction', word: 'ufo abduction' },
    { kind: 'surf', word: 'surf' },
  ],
  aliases: { delfin: 'dolphin', 'rosa delfin': 'pinkDolphin' },
}
