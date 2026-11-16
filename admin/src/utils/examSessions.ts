import type { ExamSessionStatus, ExamSessionType } from '@/api/types'

/** Imtihon vaqtlari Toshkent (UTC+5) bo'yicha kiritiladi va ko'rsatiladi */
const TZ_OFFSET_MIN = 5 * 60

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11-20T10:00" (datetime-local, Toshkent) -> "2026-11-20T10:00:00+05:00" */
export function localToIso(local: string): string {
  return `${local}:00+05:00`
}

/** ISO -> datetime-local qiymati (Toshkent vaqti) */
export function isoToLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + TZ_OFFSET_MIN * 60_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** "DD.MM.YYYY HH:mm" (Toshkent) */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const l = isoToLocal(iso)
  return `${l.slice(8, 10)}.${l.slice(5, 7)}.${l.slice(0, 4)} ${l.slice(11, 16)}`
}

/** Hozirgi Toshkent vaqti + `plusMin` daqiqa (datetime-local) */
export function nowLocal(plusMin = 0): string {
  return isoToLocal(new Date(Date.now() + plusMin * 60_000).toISOString())
}

export const STATUS_TONE: Record<
  ExamSessionStatus,
  'neutral' | 'success' | 'danger' | 'warning' | 'primary' | 'info'
> = {
  draft: 'neutral',
  pending_approval: 'warning',
  scheduled: 'info',
  open: 'success',
  closed: 'primary',
  cancelled: 'danger',
}

export const SESSION_TYPES: ExamSessionType[] = ['quiz', 'quarter', 'annual', 'trial', 'admission']
export const SESSION_STATUSES: ExamSessionStatus[] = [
  'draft',
  'pending_approval',
  'scheduled',
  'open',
  'closed',
  'cancelled',
]
