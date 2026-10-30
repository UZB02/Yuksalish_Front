import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ATTENDANCE_FORM,
  ratingImpactBeingEnabled,
  validateAttendanceSettings,
} from './attendanceForm'
import { visibleSettingsTabs } from './settingsTabs'

const t = (k: string) => k
const base = () => structuredClone(DEFAULT_ATTENDANCE_FORM)

describe('validateAttendanceSettings', () => {
  it("standart qiymatlar to'g'ri", () => {
    expect(validateAttendanceSettings(base(), t)).toEqual({})
  })
  it('dars soni faqat dars rejimida tekshiriladi', () => {
    const v = { ...base(), lessonsPerDay: 99 }
    expect(validateAttendanceSettings(v, t).lessonsPerDay).toBeUndefined()
    expect(validateAttendanceSettings({ ...v, mode: 'lesson' }, t).lessonsPerDay).toBeTruthy()
  })
  it("ish kunlari bo'sh bo'lmasligi kerak", () => {
    expect(
      validateAttendanceSettings({ ...base(), workingWeekdays: [] }, t).workingWeekdays,
    ).toBeTruthy()
  })
})

describe('ratingImpactBeingEnabled', () => {
  it("faqat o'chiqdan yoqilganda ogohlantiradi", () => {
    const off = base()
    const on = { ...base(), ratingImpact: { ...off.ratingImpact, enabled: true } }
    expect(ratingImpactBeingEnabled(off, on)).toBe(true)
    expect(ratingImpactBeingEnabled(on, on)).toBe(false)
    expect(ratingImpactBeingEnabled(on, off)).toBe(false)
  })
})

describe('visibleSettingsTabs', () => {
  it("superadmin hammasini ko'radi", () => {
    expect(visibleSettingsTabs(true, () => false)).toEqual([
      'scoring',
      'rating',
      'public',
      'attendance',
      'timetable',
    ])
  })
  it("attendance.settings maktab admini faqat Davomat va Dars jadvali tablarini ko'radi", () => {
    expect(visibleSettingsTabs(false, (p) => p === 'attendance.settings')).toEqual([
      'attendance',
      'timetable',
    ])
  })
  it('ruxsatsiz hech narsa', () => {
    expect(visibleSettingsTabs(false, () => false)).toEqual([])
  })
})
