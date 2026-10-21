import type { Role } from '@/api/types'

export const ROLES: Record<'SUPERADMIN' | 'SCHOOL_ADMIN' | 'TEACHER', Role> = {
  SUPERADMIN: 'superadmin',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
}

/** Rol nomlarining i18n kalitlari. */
export const ROLE_LABEL_KEYS: Record<Role, string> = {
  superadmin: 'roles.superadmin',
  school_admin: 'roles.school_admin',
  teacher: 'roles.teacher',
}
