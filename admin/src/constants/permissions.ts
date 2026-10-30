import type { PermissionMeta } from '@/api/types'

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  CLASSES_MANAGE: 'classes.manage',
  STUDENTS_VIEW: 'students.view',
  STUDENTS_MANAGE: 'students.manage',
  TEACHERS_MANAGE: 'teachers.manage',
  SCORES_CREATE: 'scores.create',
  SCORES_EDIT: 'scores.edit',
  GRADES_CREATE: 'grades.create',
  GRADES_EDIT: 'grades.edit',
  SUBJECTS_MANAGE: 'subjects.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  AUDIT_VIEW: 'audit.view',
  ATTENDANCE_TAKE: 'attendance.take',
  ATTENDANCE_EDIT: 'attendance.edit',
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_SETTINGS: 'attendance.settings',
  TIMETABLE_VIEW: 'timetable.view',
  TIMETABLE_MANAGE: 'timetable.manage',
  TIMETABLE_SUBSTITUTE: 'timetable.substitute',
} as const

/** O'qituvchida doim mavjud ruxsatlar (TZ 4.5.3): ro'yxatda bo'lmasa ham ruxsat beriladi. */
export const TEACHER_ALWAYS: readonly string[] = ['attendance.take']

/**
 * Zaxira: /meta/permissions javob bermasa ishlatiladi.
 * `label` va `group` - i18n kalitlari (permissions.items.*, permissions.groups.*).
 */
export const FALLBACK_PERMISSIONS: PermissionMeta[] = [
  {
    key: 'dashboard.view',
    group: 'dashboard',
    label: 'dashboard.view',
    roles: ['school_admin', 'teacher'],
  },
  { key: 'classes.manage', group: 'classes', label: 'classes.manage', roles: ['school_admin'] },
  {
    key: 'students.view',
    group: 'students',
    label: 'students.view',
    roles: ['school_admin', 'teacher'],
  },
  { key: 'students.manage', group: 'students', label: 'students.manage', roles: ['school_admin'] },
  { key: 'teachers.manage', group: 'teachers', label: 'teachers.manage', roles: ['school_admin'] },
  {
    key: 'scores.create',
    group: 'scores',
    label: 'scores.create',
    roles: ['school_admin', 'teacher'],
  },
  { key: 'scores.edit', group: 'scores', label: 'scores.edit', roles: ['school_admin', 'teacher'] },
  {
    key: 'grades.create',
    group: 'grades',
    label: 'grades.create',
    roles: ['school_admin', 'teacher'],
  },
  { key: 'grades.edit', group: 'grades', label: 'grades.edit', roles: ['school_admin', 'teacher'] },
  { key: 'subjects.manage', group: 'subjects', label: 'subjects.manage', roles: ['school_admin'] },
  {
    key: 'reports.view',
    group: 'reports',
    label: 'reports.view',
    roles: ['school_admin', 'teacher'],
  },
  {
    key: 'reports.export',
    group: 'reports',
    label: 'reports.export',
    roles: ['school_admin', 'teacher'],
  },
  { key: 'audit.view', group: 'audit', label: 'audit.view', roles: ['school_admin'] },
  {
    key: 'attendance.take',
    group: 'attendance',
    label: 'attendance.take',
    roles: ['school_admin', 'teacher'],
  },
  {
    key: 'attendance.edit',
    group: 'attendance',
    label: 'attendance.edit',
    roles: ['school_admin', 'teacher'],
  },
  {
    key: 'attendance.view',
    group: 'attendance',
    label: 'attendance.view',
    roles: ['school_admin', 'teacher'],
  },
  {
    key: 'attendance.settings',
    group: 'attendance',
    label: 'attendance.settings',
    roles: ['school_admin'],
  },
  {
    key: 'timetable.view',
    group: 'timetable',
    label: 'timetable.view',
    roles: ['school_admin', 'teacher'],
  },
  {
    key: 'timetable.manage',
    group: 'timetable',
    label: 'timetable.manage',
    roles: ['school_admin'],
  },
  {
    key: 'timetable.substitute',
    group: 'timetable',
    label: 'timetable.substitute',
    roles: ['school_admin'],
  },
]
