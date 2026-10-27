// The themes built in, by name, and the one the sky starts with.

import { FYR } from './fyr/index'
import type { Theme } from './theme'

export const THEMES = { fyr: FYR } as const satisfies Record<string, Theme>
export const BASE_THEME = 'fyr'
