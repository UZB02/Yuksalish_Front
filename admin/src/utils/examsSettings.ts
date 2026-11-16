import type { ExamsSettings } from '@/api/types'

/** Serverdagi (Yuksalish_backend: exams.settings.ts) kalitlar va chegaralar bilan bir xil */
export const EXAMS_KEYS = [
  'enabled',
  'teachersCanCreateQuizzes',
  'teacherQuizNeedsApproval',
  'candidateRetentionDays',
] as const
/** Maktab admini `enabled` ni o'zgartira olmaydi (faqat superadmin) */
export const EXAMS_OWN_KEYS = [
  'teachersCanCreateQuizzes',
  'teacherQuizNeedsApproval',
  'candidateRetentionDays',
] as const
export type ExamsKey = (typeof EXAMS_KEYS)[number]
export type ExamsFormErrors = Partial<Record<ExamsKey, string>>

export const RETENTION_MIN = 1
export const RETENTION_MAX = 3650

export const DEFAULT_EXAMS_FORM: ExamsSettings = {
  enabled: false,
  teachersCanCreateQuizzes: true,
  teacherQuizNeedsApproval: false,
  candidateRetentionDays: 365,
}

export function validateExamsSettings(
  v: ExamsSettings,
  t: (key: string, p?: Record<string, unknown>) => string,
): ExamsFormErrors {
  const e: ExamsFormErrors = {}
  const d = v.candidateRetentionDays
  if (!Number.isInteger(d) || d < RETENTION_MIN || d > RETENTION_MAX) {
    e.candidateRetentionDays = t('settingsExams.retentionRange', {
      min: RETENTION_MIN,
      max: RETENTION_MAX,
    })
  }
  return e
}
