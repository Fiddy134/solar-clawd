// Clawd's day by the clock: what he does at an hour, and on a day with an
// occasion. The band draws him by it; the sky reads it as CLAWD_ASLEEP (and
// CLAWD_ACTIVITY), so a theme's characters can keep his hours without the
// engine importing the character.

import { occasionAt } from './astro'
import type { LocalTime } from './astro'

export type Activity = 'earlyBird' | 'coffee' | 'work' | 'vibe' | 'nightOwl' | 'sleep'

// The same day every day: up with the birds at six, coffee till noon, work
// till four, then vibing, a night owl from ten, and asleep from three.
export function activityAt({ hour }: Pick<LocalTime, 'hour'>): Activity {
  if (hour >= 3 && hour < 6) return 'sleep'
  if (hour >= 6 && hour < 8) return 'earlyBird'
  if (hour >= 8 && hour < 12) return 'coffee'
  if (hour >= 12 && hour < 16) return 'work'
  if (hour >= 16 && hour < 22) return 'vibe'

  return 'nightOwl'
}

// What Clawd does at a time: the usual hours, but up all New Year's night,
// and early for the Lucia train.
export function activityOn(time: LocalTime): Activity {
  const usual = activityAt(time)
  if (usual !== 'sleep') return usual
  const occasion = occasionAt(time)

  return occasion === 'newYear' ? 'nightOwl' : occasion === 'lucia' && time.hour >= 5 ? 'earlyBird' : usual
}
