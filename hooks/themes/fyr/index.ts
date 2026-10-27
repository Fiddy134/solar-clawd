// fyr, the sky's first theme: the lighthouse, its sea and its keeper. Its
// parts are the GLSL a theme from elsewhere would hand in as theme.glsl.

import type { Theme } from '../theme'
import { FYR_MANIFEST } from './manifest'
import { SEA } from './glsl/sea'
import { KEEPER } from './glsl/keeper'
import { SURF } from './glsl/surf'
import { NIGHT } from './glsl/night'
import { ROUTINE } from './glsl/routine'
import { CATCH } from './glsl/catch'
import { UFO } from './glsl/ufo'

export const FYR: Theme = { manifest: FYR_MANIFEST, glsl: [SEA, KEEPER, SURF, NIGHT, ROUTINE, CATCH, UFO].join('\n') }
