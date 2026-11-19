import type { MyBlockItem } from '@/api/types'

/** O'qituvchi vazifasining ko'rinadigan holati */
export type TaskStatus = 'collecting' | 'done' | 'approved' | 'readonly'

/**
 * Yig'ilmoqda: hali tugatmagan; Tugatdim: o'qituvchi tugatganini belgilagan;
 * Tasdiqlangan: ma'muriyat "tayyor" deb tasdiqlagan; Faqat o'qish: muddat tugagan yoki imtihon qoralamadan chiqqan.
 */
export function taskStatus(
  b: Pick<MyBlockItem, 'locked' | 'lockReason' | 'blockStatus'>,
): TaskStatus {
  if (b.locked) return b.lockReason === 'ready' ? 'approved' : 'readonly'
  return b.blockStatus === 'ready' ? 'done' : 'collecting'
}

export type DeadlineLeft =
  | { kind: 'none' }
  | { kind: 'overdue' }
  | { kind: 'soon' }
  | { kind: 'hours'; n: number }
  | { kind: 'days'; n: number }

/** Muddatgacha qolgan vaqt: kun, soat, "bir soatdan kam" yoki o'tgan */
export function deadlineLeft(deadline: string | null | undefined, now = Date.now()): DeadlineLeft {
  if (!deadline) return { kind: 'none' }
  const ms = new Date(deadline).getTime() - now
  if (!Number.isFinite(ms)) return { kind: 'none' }
  if (ms <= 0) return { kind: 'overdue' }
  const hours = ms / 3_600_000
  if (hours < 1) return { kind: 'soon' }
  if (hours < 24) return { kind: 'hours', n: Math.floor(hours) }
  return { kind: 'days', n: Math.floor(hours / 24) }
}
