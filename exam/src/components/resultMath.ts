/** Natija ekrani uchun sof funksiyalar: foiz va rang chegaralari */
export type Tone = 'ok' | 'warn' | 'bad'

/** 0..100 oralig'ida butun foiz; max <= 0 bo'lsa 0 */
export function percentOf(earned: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(earned)) return 0
  return Math.max(0, Math.min(100, Math.round((earned / max) * 100)))
}

/** >=70 ok, >=40 warn, aks holda bad */
export function toneOf(pct: number): Tone {
  return pct >= 70 ? 'ok' : pct >= 40 ? 'warn' : 'bad'
}

export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
}
export const TONE_BG: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }

export const RING_R = 52
export const RING_C = 2 * Math.PI * RING_R
/** Halqaning to'lmagan qismi (stroke-dashoffset) */
export function ringOffset(pct: number): number {
  return RING_C * (1 - Math.max(0, Math.min(100, pct)) / 100)
}
