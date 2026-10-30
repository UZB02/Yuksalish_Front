import { describe, expect, it } from 'vitest'
import uz from '@/locales/uz.json'

/**
 * Backend yozadigan barcha audit harakatlari va obyekt turlari (Yuksalish_backend: auditService.log).
 * Backendga yangi harakat qo'shilsa shu ro'yxatga ham qo'shing — tarjimasiz xom kalit ko'rinmasin.
 */
const ACTIONS = [
  'academic_year.activate',
  'academic_year.create',
  'academic_year.delete',
  'academic_year.update',
  'attendance.bulk',
  'attendance.delete',
  'attendance.update',
  'attendance_status.activate',
  'attendance_status.create',
  'attendance_status.deactivate',
  'attendance_status.update',
  'auth.locked',
  'auth.login',
  'auth.password_change',
  'auth.refresh_reuse',
  'branding.logo_deleted',
  'branding.logo_updated',
  'branding.updated',
  'behavior_type.activate',
  'behavior_type.create',
  'behavior_type.deactivate',
  'behavior_type.update',
  'class.archive',
  'class.create',
  'class.subjects',
  'class.teachers',
  'class.unarchive',
  'class.update',
  'grades.bulk',
  'grades.create',
  'grades.delete',
  'grades.update',
  'ratings.recalculate',
  'reports.export',
  'school.create',
  'school.logo_deleted',
  'school.logo_updated',
  'school.update',
  'school_admin.create',
  'school_admin.password_reset',
  'school_admin.permissions',
  'school_admin.photo_delete',
  'school_admin.photo_upload',
  'school_admin.update',
  'scores.bulk',
  'scores.create',
  'scores.delete',
  'scores.update',
  'settings.update',
  'student.create',
  'student.delete',
  'student.photo_delete',
  'student.photo_upload',
  'student.transfer',
  'student.update',
  'students.import',
  'subject.activate',
  'subject.create',
  'subject.deactivate',
  'subject.delete',
  'subject.update',
  'teacher.classes',
  'teacher.create',
  'teacher.password_reset',
  'teacher.permissions',
  'teacher.photo_delete',
  'teacher.photo_upload',
  'teacher.update',
  'teachers.import',
  'timetable.override_created',
  'timetable.override_deleted',
  'timetable.version_activate',
  'timetable.version_correct',
  'timetable.version_create',
  'timetable.version_delete',
  'timetable.version_purged',
  'timetable.version_update',
]
const ENTITIES = [
  'academic_year',
  'attendance',
  'attendance_status',
  'behavior_type',
  'class',
  'rating',
  'report',
  'school',
  'branding',
  'score',
  'settings',
  'student',
  'subject',
  'subject_grade',
  'timetable',
  'user',
]

const audit = uz.audit as unknown as {
  actions: Record<string, Record<string, string>>
  groups: Record<string, string>
  entities: Record<string, string>
}

describe('audit tarjimalari to`liq', () => {
  it('har bir harakatning tarjimasi bor', () => {
    const missing = ACTIONS.filter((a) => {
      const [g = '', v = ''] = a.split('.')
      return !audit.actions[g]?.[v]
    })
    expect(missing).toEqual([])
  })
  it('har bir guruh va obyekt turining tarjimasi bor', () => {
    const groups = [...new Set(ACTIONS.map((a) => a.split('.')[0]!))]
    expect(groups.filter((g) => !audit.groups[g])).toEqual([])
    expect(ENTITIES.filter((e) => !audit.entities[e])).toEqual([])
  })
})
