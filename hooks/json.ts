// Reading JSON from elsewhere (the network, files another session wrote)
// without trusting its shape: a field of an object, a finite number.

type Json = Record<string, unknown>

export function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Json)[key] : undefined
}

export function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
