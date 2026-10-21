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
  LayoutDashboard,
  School as SchoolIcon,
  ShieldCheck,
  FileBarChart,
  ScrollText,
} from 'lucide-vue-next'
import type { Role } from '@/api/types'
import { PERMISSIONS } from './permissions'

export interface NavItem {
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
  { name: 'my-classes', labelKey: 'nav.myClasses', icon: BookOpenCheck, roles: ['teacher'] },
  {
    name: 'my-scores',
    labelKey: 'nav.myScores',
    icon: History,
    roles: ['teacher'],
    permission: PERMISSIONS.SCORES_CREATE,
  },
  { name: 'schools', labelKey: 'nav.schools', icon: SchoolIcon, roles: ['superadmin'] },
  { name: 'school-admins', labelKey: 'nav.schoolAdmins', icon: ShieldCheck, roles: ['superadmin'] },
  {
    name: 'academic-years',
    labelKey: 'nav.academicYears',
    icon: CalendarRange,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.CLASSES_MANAGE,
  },
  {
    name: 'classes',
    labelKey: 'nav.classes',
    icon: Layers,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.CLASSES_MANAGE, PERMISSIONS.STUDENTS_VIEW],
  },
  {
    name: 'scoring',
    labelKey: 'nav.scoring',
    icon: ClipboardCheck,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.SCORES_CREATE, PERMISSIONS.SCORES_EDIT],
  },
  {
    name: 'grading',
    labelKey: 'nav.grading',
    icon: NotebookPen,
    anyPermission: [PERMISSIONS.GRADES_CREATE, PERMISSIONS.GRADES_EDIT],
  },
  {
    name: 'scores-history',
    labelKey: 'nav.scoresHistory',
    icon: History,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.SCORES_EDIT, PERMISSIONS.STUDENTS_VIEW],
  },
  {
    name: 'attendance',
    labelKey: 'nav.attendance',
    icon: CalendarCheck,
    anyPermission: [PERMISSIONS.ATTENDANCE_TAKE, PERMISSIONS.ATTENDANCE_VIEW],
  },
  {
    name: 'attendance-history',
    labelKey: 'nav.attendanceHistory',
    icon: BarChart3,
    anyPermission: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_TAKE],
  },
  {
    name: 'students',
    labelKey: 'nav.students',
    icon: Users,
    anyPermission: [PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.STUDENTS_MANAGE],
  },
  {
    name: 'ratings',
    labelKey: 'nav.ratings',
    icon: Trophy,
    anyPermission: [PERMISSIONS.REPORTS_VIEW],
  },
  {
    name: 'reports',
    labelKey: 'nav.reports',
    icon: FileBarChart,
    anyPermission: [PERMISSIONS.REPORTS_VIEW],
  },
  {
    name: 'teachers',
    labelKey: 'nav.teachers',
    icon: GraduationCap,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.TEACHERS_MANAGE,
  },
  { name: 'behavior-types', labelKey: 'nav.behaviorTypes', icon: Palette, roles: ['superadmin'] },
  {
    name: 'subjects',
    labelKey: 'nav.subjects',
    icon: Shapes,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.SUBJECTS_MANAGE,
  },
  {
    name: 'attendance-statuses',
    labelKey: 'nav.attendanceStatuses',
    icon: ListChecks,
    roles: ['superadmin'],
  },
  {
    name: 'audit-logs',
    labelKey: 'nav.audit',
    icon: ScrollText,
    roles: ['superadmin', 'school_admin'],
    anyPermission: [PERMISSIONS.AUDIT_VIEW],
  },
  {
    name: 'settings',
    labelKey: 'nav.settings',
    icon: SettingsIcon,
    roles: ['superadmin', 'school_admin'],
    permission: PERMISSIONS.ATTENDANCE_SETTINGS,
  },
]
