import type { AttendanceTrendDay } from '@/api/types'

export type BarLevel = 'good' | 'warn' | 'bad'

/** Davomat foizi darajasi: >=95 yaxshi, 85–95 ogohlantirish, <85 yomon */
export function barLevel(rate: number): BarLevel {
  if (rate >= 95) return 'good'
  if (rate >= 85) return 'warn'
  return 'bad'
}

/** Faqat davomat olingan kunlar (kategorik o'q): oxirgi `max` tasi, sana bo'yicha o'sish tartibida */
export function pickDays(days: AttendanceTrendDay[], max = 20): AttendanceTrendDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-max)
}

export interface BarLayout {
  slot: number
  barW: number
  /** i-ustun chap x koordinatasi (slot boshi) */
  x: (i: number) => number
}

/**
 * Ustunlar joylashuvi: bo'sh joy bo'lsa kengaymaydi (slot <= maxBar * 1.5), kam kun bo'lsa chapga tekislanadi.
 */
export function layoutBars(count: number, innerW: number, left: number, maxBar = 28): BarLayout {
  const slot = count > 0 ? Math.min(innerW / count, maxBar * 1.5) : 0
  const barW = Math.min(maxBar, slot * 0.68)
  return { slot, barW, x: (i) => left + i * slot }
}

/**
 * X o'qi yorliqlarini siyraklashtirish: yorliqlar bir-biriga tegmasligi uchun har `step`-ustun belgilanadi;
 * OXIRGI ustun doim belgilanadi, undan orqaga qarab sanaladi.
 */
export function labelIndices(count: number, slotPx: number, labelPx: number): number[] {
  if (count <= 0) return []
  const step = Math.max(1, Math.ceil((labelPx * 1.15) / Math.max(1, slotPx)))
  const out: number[] = []
  for (let i = count - 1; i >= 0; i -= step) out.push(i)
  return out.reverse()
}

/** "2026-11-12" -> "12.11" */
export function shortDate(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[2]}.${m[1]}` : iso
}
