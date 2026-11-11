import type {
  ClassRatingItem,
  RatingPeriodType,
  RatingResultClass,
  RatingResultStudent,
  RatingSettings,
  StudentRatingItem,
} from '@/api/types'

type Translate = (key: string, params?: Record<string, unknown>) => string

/** "O'tgan hafta g'oliblari" kabi sarlavha (davr turi bo'yicha) */
export function winnersTitle(t: Translate, type: RatingPeriodType): string {
  return t(`ratings.results.winners.${type}`)
}

/** Arxivdagi o'quvchi qatorini jonli jadval (StudentRatingTable) shakliga keltiradi */
export function toStudentItem(s: RatingResultStudent): StudentRatingItem {
  return {
    rank: s.rank,
    previousRank: null,
    rankChange: null,
    studentId: s.studentId,
    fullName: s.fullName,
    classId: s.classId,
    className: s.className ?? '',
    score: s.score,
    daysCount: s.daysCount,
    scoresCount: s.scoresCount,
    eligible: true,
  }
}

export function toClassItem(c: RatingResultClass): ClassRatingItem {
  return {
    rank: c.rank,
    previousRank: null,
    rankChange: null,
    classId: c.classId,
    className: c.name,
    grade: c.grade,
    score: c.score,
    ratedStudents: c.ratedStudents,
    totalStudents: c.ratedStudents,
  }
}

/** Erkin davrda tanlangan sana davrdan tashqarida (yumshoq ogohlantirish uchun) */
export function isDateOutsideCustom(s: RatingSettings): boolean {
  return (
    s.periodType === 'custom' &&
    !!s.resultsDate &&
    !!s.customFrom &&
    !!s.customTo &&
    (s.resultsDate < s.customFrom || s.resultsDate > s.customTo)
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Shakldagi sozlamalar bo'yicha joriy davr uchun e'lon sanasi va vaqti ("DD.MM.YYYY, HH:mm").
 * Faqat week, month va (sanalari kiritilgan) custom uchun; chorak/o'quv yili sanasi serverda: null.
 * Server qoidasi bilan bir xil: oy kuni yetmasa oxirgi kun, davr ichiga qisiladi.
 */
export function previewAnnounce(s: RatingSettings, today: string): string | null {
  let from: string
  let to: string
  let date: string
  if (s.periodType === 'week') {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
    from = addDays(today, -((dow + 6) % 7))
    to = addDays(from, 6)
    date = addDays(from, s.resultsWeekday - 1)
  } else if (s.periodType === 'month') {
    const y = Number(today.slice(0, 4))
    const m = Number(today.slice(5, 7))
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const day = s.resultsMonthDay > 0 ? Math.min(s.resultsMonthDay, last) : last
    from = `${y}-${pad(m)}-01`
    to = `${y}-${pad(m)}-${pad(last)}`
    date = `${y}-${pad(m)}-${pad(day)}`
  } else if (s.periodType === 'custom' && s.customFrom && s.customTo) {
    from = s.customFrom
    to = s.customTo
    date = s.resultsDate && s.resultsDate >= from && s.resultsDate <= to ? s.resultsDate : to
  } else if (s.resultsDate && (s.periodType === 'quarter' || s.periodType === 'academic_year')) {
    // Davr chegaralari serverda: tanlangan sananing o'zi ko'rsatiladi
    from = to = date = s.resultsDate
  } else return null
  if (date > to) date = to
  if (date < from) date = from
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}, ${s.resultsTime}`
}
