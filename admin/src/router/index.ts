import { createRouter, createWebHistory } from 'vue-router'
import { PERMISSIONS } from '@/constants/permissions'
import { installGuards } from './guards'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/login',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { public: true, guestOnly: true },
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/views/auth/LoginView.vue'),
          meta: { public: true, guestOnly: true, titleKey: 'auth.title' },
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          // Guard foydalanuvchining birinchi ruxsat etilgan sahifasiga yo'naltiradi.
          component: () => import('@/views/errors/ForbiddenView.vue'),
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { permission: PERMISSIONS.DASHBOARD_VIEW, titleKey: 'nav.dashboard' },
        },
        {
          path: 'my-classes',
          name: 'my-classes',
          component: () => import('@/views/teacher/MyClassesView.vue'),
          meta: { roles: ['teacher'], titleKey: 'nav.myClasses' },
        },
        {
          path: 'schools',
          name: 'schools',
          component: () => import('@/views/schools/SchoolsView.vue'),
          meta: { roles: ['superadmin'], titleKey: 'nav.schools' },
        },
        {
          path: 'school-admins',
          name: 'school-admins',
          component: () => import('@/views/school-admins/SchoolAdminsView.vue'),
          meta: { roles: ['superadmin'], titleKey: 'nav.schoolAdmins' },
        },
        {
          path: 'academic-years',
          name: 'academic-years',
          component: () => import('@/views/academic-years/AcademicYearsView.vue'),
          meta: {
            roles: ['superadmin', 'school_admin'],
            permission: PERMISSIONS.CLASSES_MANAGE,
            titleKey: 'nav.academicYears',
          },
        },
        {
          path: 'classes',
          name: 'classes',
          component: () => import('@/views/classes/ClassesView.vue'),
          meta: {
            roles: ['superadmin', 'school_admin'],
            anyPermission: [PERMISSIONS.CLASSES_MANAGE, PERMISSIONS.STUDENTS_VIEW],
            titleKey: 'nav.classes',
          },
        },
        {
          path: 'classes/:id',
          name: 'class-detail',
          component: () => import('@/views/classes/ClassDetailView.vue'),
          meta: {
            anyPermission: [
              PERMISSIONS.CLASSES_MANAGE,
              PERMISSIONS.STUDENTS_VIEW,
              PERMISSIONS.SCORES_CREATE,
            ],
            titleKey: 'nav.classes',
          },
        },
        {
          path: 'classes/:id/scoring',
          name: 'class-scoring',
          component: () => import('@/views/scoring/ScoringView.vue'),
          meta: {
            anyPermission: [PERMISSIONS.SCORES_CREATE, PERMISSIONS.SCORES_EDIT],
            titleKey: 'scoring.title',
          },
        },
        {
          path: 'scoring',
          name: 'scoring',
          component: () => import('@/views/teacher/MyClassesView.vue'),
          meta: {
            roles: ['superadmin', 'school_admin'],
            anyPermission: [PERMISSIONS.SCORES_CREATE, PERMISSIONS.SCORES_EDIT],
            titleKey: 'nav.scoring',
          },
        },
        {
          path: 'my-scores',
          name: 'my-scores',
          component: () => import('@/views/scores/MyScoresView.vue'),
          meta: {
            roles: ['teacher'],
            permission: PERMISSIONS.SCORES_CREATE,
            titleKey: 'nav.myScores',
          },
        },
        {
          path: 'scores',
          name: 'scores-history',
          component: () => import('@/views/scores/MyScoresView.vue'),
          meta: {
            roles: ['superadmin', 'school_admin'],
            anyPermission: [
              PERMISSIONS.REPORTS_VIEW,
              PERMISSIONS.SCORES_EDIT,
              PERMISSIONS.STUDENTS_VIEW,
            ],
            titleKey: 'nav.scoresHistory',
          },
        },
        {
          path: 'students/:id',
          name: 'student-profile',
          component: () => import('@/views/students/StudentProfileView.vue'),
          meta: {
            anyPermission: [
              PERMISSIONS.STUDENTS_VIEW,
              PERMISSIONS.STUDENTS_MANAGE,
              PERMISSIONS.SCORES_CREATE,
              PERMISSIONS.SCORES_EDIT,
              PERMISSIONS.REPORTS_VIEW,
            ],
            titleKey: 'nav.students',
          },
        },
        {
          path: 'ratings',
          name: 'ratings',
          component: () => import('@/views/ratings/RatingsView.vue'),
          meta: { anyPermission: [PERMISSIONS.REPORTS_VIEW], titleKey: 'nav.ratings' },
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/views/reports/ReportsView.vue'),
          meta: { anyPermission: [PERMISSIONS.REPORTS_VIEW], titleKey: 'nav.reports' },
        },
        {
          path: 'audit-logs',
          name: 'audit-logs',
          component: () => import('@/views/audit/AuditLogView.vue'),
          meta: { anyPermission: [PERMISSIONS.AUDIT_VIEW], titleKey: 'nav.audit' },
        },
        {
          path: 'classes/:id/attendance',
          name: 'class-attendance',
          component: () => import('@/views/attendance/AttendanceView.vue'),
          meta: {
            anyPermission: [PERMISSIONS.ATTENDANCE_TAKE, PERMISSIONS.ATTENDANCE_EDIT],
            titleKey: 'attendance.title',
          },
        },
        {
          path: 'attendance',
          name: 'attendance',
          component: () => import('@/views/teacher/MyClassesView.vue'),
          meta: {
            anyPermission: [PERMISSIONS.ATTENDANCE_TAKE, PERMISSIONS.ATTENDANCE_VIEW],
            titleKey: 'nav.attendance',
          },
        },
        {
          path: 'attendance/history',
          name: 'attendance-history',
          component: () => import('@/views/attendance/AttendanceHistoryView.vue'),
          meta: {
            anyPermission: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_TAKE],
            titleKey: 'nav.attendanceHistory',
          },
        },
        {
          path: 'attendance-statuses',
          name: 'attendance-statuses',
          component: () => import('@/views/attendance-statuses/AttendanceStatusesView.vue'),
          meta: { roles: ['superadmin'], titleKey: 'nav.attendanceStatuses' },
        },
        {
          path: 'behavior-types',
          name: 'behavior-types',
          component: () => import('@/views/behavior-types/BehaviorTypesView.vue'),
          meta: { roles: ['superadmin'], titleKey: 'nav.behaviorTypes' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/settings/SettingsView.vue'),
          meta: {
            roles: ['superadmin', 'school_admin'],
            permission: PERMISSIONS.ATTENDANCE_SETTINGS,
            titleKey: 'nav.settings',
          },
        },
        {
          path: 'students',
          name: 'students',
          component: () => import('@/views/students/StudentsView.vue'),
          meta: {
            anyPermission: [PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.STUDENTS_MANAGE],
            titleKey: 'nav.students',
          },
        },
        {
          path: 'teachers',
          name: 'teachers',
          component: () => import('@/views/teachers/TeachersView.vue'),
          meta: {
            roles: ['superadmin', 'school_admin'],
            permission: PERMISSIONS.TEACHERS_MANAGE,
            titleKey: 'nav.teachers',
          },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/profile/ProfileView.vue'),
          meta: { titleKey: 'nav.profile' },
        },
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('@/views/errors/ForbiddenView.vue'),
          meta: { titleKey: 'errors.forbiddenTitle' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/errors/NotFoundView.vue'),
      meta: { public: true, titleKey: 'errors.notFoundTitle' },
    },
  ],
})

installGuards(router)

export default router
