import type { Component } from 'vue'
import {
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  History,
  GraduationCap,
  Layers,
  ListChecks,
  NotebookPen,
  Palette,
  Shapes,
  Trophy,
  Settings as SettingsIcon,
  Users,
  UserCheck,
  Library,
  Settings2,
  LayoutDashboard,
  School as SchoolIcon,
  ShieldCheck,
  FileBarChart,
  ScrollText,
  NotebookText,
} from 'lucide-vue-next'
import type { Role } from '@/api/types'
import { PERMISSIONS } from './permissions'

export type NavGroupKey =
  'myWork' | 'academic' | 'grading' | 'attendance' | 'results' | 'reference' | 'system'

export interface NavGroup {
  key: NavGroupKey
  labelKey: string
  icon: Component
}

/** Menyu guruhlari (ko'rsatish tartibida). Guruhsiz bandlar (dashboard) tepada turadi. */
export const NAV_GROUPS: NavGroup[] = [
  { key: 'myWork', labelKey: 'nav.groups.myWork', icon: UserCheck },
  { key: 'academic', labelKey: 'nav.groups.academic', icon: GraduationCap },
  { key: 'grading', labelKey: 'nav.groups.grading', icon: ClipboardCheck },
  { key: 'attendance', labelKey: 'nav.groups.attendance', icon: CalendarCheck },
  { key: 'results', labelKey: 'nav.groups.results', icon: Trophy },
  { key: 'reference', labelKey: 'nav.groups.reference', icon: Library },
  { key: 'system', labelKey: 'nav.groups.system', icon: Settings2 },
]

export interface NavItem {
  /** Menyu guruhi (yo'q bo'lsa - tepada, guruhsiz) */
  group?: NavGroupKey
  /** Router nomi */
  name: string
  labelKey: string
  icon: Component
  roles?: Role[]
  permission?: string
  anyPermission?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    name: 'dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    name: 'my-classes',
    group: 'myWork',
    labelKey: 'nav.myClasses',
    icon: BookOpenCheck,
    roles: ['teacher'],
  },
  {
    name: 'my-scores',
    group: 'myWork',
    labelKey: 'nav.myScores',
    icon: History,
    roles: ['teacher'],
    permission: PERMISSIONS.SCORES_CREATE,
  },
  {
    name: 'schools',
    group: 'system',
    labelKey: 'nav.schools',
    icon: SchoolIcon,
    roles: ['superadmin'],
  },
  {
    name: 'school-admins',
    group: 'system',
    labelKey: 'nav.schoolAdmins',
    icon: ShieldCheck,
    roles: ['superadmin'],
  },
  {
    name: 'academic-years',
    group: 'academic',
    labelKey: 'nav.academicYears',
    icon: CalendarRange,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.CLASSES_MANAGE,
  },
  {
    name: 'classes',
    group: 'academic',
    labelKey: 'nav.classes',
    icon: Layers,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.CLASSES_MANAGE, PERMISSIONS.STUDENTS_VIEW],
  },
  {
    name: 'scoring',
    group: 'grading',
    labelKey: 'nav.scoring',
    icon: ClipboardCheck,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.SCORES_CREATE, PERMISSIONS.SCORES_EDIT],
  },
  {
    name: 'grading',
    group: 'grading',
    labelKey: 'nav.grading',
    icon: NotebookPen,
    anyPermission: [PERMISSIONS.GRADES_CREATE, PERMISSIONS.GRADES_EDIT],
  },
  {
    name: 'scores-history',
    group: 'grading',
    labelKey: 'nav.scoresHistory',
    icon: History,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.SCORES_EDIT, PERMISSIONS.STUDENTS_VIEW],
  },
  {
    name: 'attendance',
    group: 'attendance',
    labelKey: 'nav.attendance',
    icon: CalendarCheck,
    anyPermission: [PERMISSIONS.ATTENDANCE_TAKE, PERMISSIONS.ATTENDANCE_VIEW],
  },
  {
    name: 'attendance-history',
    group: 'attendance',
    labelKey: 'nav.attendanceHistory',
    icon: BarChart3,
    anyPermission: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_TAKE],
  },
  {
    name: 'students',
    group: 'academic',
    labelKey: 'nav.students',
    icon: Users,
    anyPermission: [PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.STUDENTS_MANAGE],
  },
  {
    name: 'ratings',
    group: 'results',
    labelKey: 'nav.ratings',
    icon: Trophy,
    anyPermission: [PERMISSIONS.REPORTS_VIEW],
  },
  {
    name: 'reports',
    group: 'results',
    labelKey: 'nav.reports',
    icon: FileBarChart,
    anyPermission: [PERMISSIONS.REPORTS_VIEW],
  },
  {
    name: 'teachers',
    group: 'academic',
    labelKey: 'nav.teachers',
    icon: GraduationCap,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.TEACHERS_MANAGE,
  },
  {
    name: 'behavior-types',
    group: 'reference',
    labelKey: 'nav.behaviorTypes',
    icon: Palette,
    roles: ['superadmin'],
  },
  {
    name: 'subjects',
    group: 'reference',
    labelKey: 'nav.subjects',
    icon: Shapes,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.SUBJECTS_MANAGE,
  },
  {
    name: 'attendance-statuses',
    group: 'reference',
    labelKey: 'nav.attendanceStatuses',
    icon: ListChecks,
    roles: ['superadmin'],
  },
  {
    name: 'audit-logs',
    group: 'system',
    labelKey: 'nav.audit',
    icon: ScrollText,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.AUDIT_VIEW],
  },
  {
    name: 'settings',
    group: 'system',
    labelKey: 'nav.settings',
    icon: SettingsIcon,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.ATTENDANCE_SETTINGS,
  },
  {
    name: 'journal',
    group: 'grading',
    labelKey: 'nav.journal',
    icon: NotebookText,
    anyPermission: [PERMISSIONS.GRADES_CREATE, PERMISSIONS.GRADES_EDIT, PERMISSIONS.REPORTS_VIEW],
  },
]

/**
 * Menyuda ko'rsatish tartibi (guruh ichida). NAV_ITEMS tartibi o'zgarmaydi,
 * chunki u "birinchi ruxsat etilgan sahifa" (bosh sahifa yo'naltirishi) uchun ishlatiladi.
 */
export const NAV_DISPLAY_ORDER: string[] = [
  'dashboard',
  'my-classes',
  'my-scores',
  'classes',
  'students',
  'teachers',
  'academic-years',
  'scoring',
  'grading',
  'journal',
  'scores-history',
  'attendance',
  'attendance-history',
  'ratings',
  'reports',
  'subjects',
  'behavior-types',
  'attendance-statuses',
  'schools',
  'school-admins',
  'settings',
  'audit-logs',
]
