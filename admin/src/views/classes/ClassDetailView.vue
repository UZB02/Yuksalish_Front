<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CalendarCheck,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  FileBarChart,
  Pencil,
  UserPlus,
  Users,
} from 'lucide-vue-next'
import { classesApi } from '@/api/classes.api'
import type { SchoolClass } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useAcademicYearLookup, useTeacherLookup } from '@/composables/useLookups'
import { useAuthStore } from '@/stores/auth'
import { groupBySubject, shortName } from '@/utils/classSubjects'
import { errorMessage } from '@/utils/errors'
import StudentsPanel from '../students/StudentsPanel.vue'
import ClassTeachersModal from './ClassTeachersModal.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const teachers = useTeacherLookup()
const years = useAcademicYearLookup()

const schoolClass = ref<SchoolClass | null>(null)
const loading = ref(true)
const error = ref('')
const assignOpen = ref(false)
const expanded = ref(false)
const VISIBLE_ROWS = 6

const classId = computed(() => String(route.params.id))
const canManage = computed(() => auth.hasPermission(PERMISSIONS.CLASSES_MANAGE))
/** "Ingliz tili — Aliyeva, G'aniyeva": bir fanning barcha o'qituvchilari birga */
const subjectGroups = computed(() => groupBySubject(schoolClass.value?.subjects))
/** O'qituvchi sahifasi (teacher-detail) faqat o'qituvchilarni boshqarish huquqi bor adminlarga ochiq */
const canOpenTeacher = computed(
  () => auth.role !== 'teacher' && auth.hasPermission(PERMISSIONS.TEACHERS_MANAGE),
)
/** Sinf DTO'sida faqat academicYearId bor: nomini o'quv yillari ro'yxatidan olamiz (yuklanmasa yashiriladi) */
const yearName = computed(
  () => years.items.value.find((y) => y.id === schoolClass.value?.academicYearId)?.name ?? '',
)
/** Fan biriktirilmagan, faqat sinfga qo'shilgan o'qituvchilar */
const subjectlessTeachers = computed(() => {
  const assigned = new Set((schoolClass.value?.subjects ?? []).map((s) => s.teacherId))
  return (schoolClass.value?.teachers ?? []).filter((tc) => !assigned.has(tc.id))
})
interface SubjectRow {
  key: string
  name: string
  teachers: { id: string; fullName: string }[]
}
const rows = computed<SubjectRow[]>(() => {
  const list: SubjectRow[] = subjectGroups.value.map((g) => ({
    key: g.subjectId,
    name: g.name,
    teachers: g.teachers,
  }))
  if (subjectlessTeachers.value.length) {
    list.push({
      key: '__none',
      name: t('classes.noSubjectRow'),
      teachers: subjectlessTeachers.value,
    })
  }
  return list
})
const visibleRows = computed(() =>
  expanded.value ? rows.value : rows.value.slice(0, VISIBLE_ROWS),
)
const hiddenCount = computed(() => Math.max(0, rows.value.length - VISIBLE_ROWS))

/** O'qituvchi o'z sinfi jadvalini ruxsatsiz ham ko'radi (server tekshiradi); admin uchun timetable.view/manage */
const canSeeTimetable = computed(
  () =>
    auth.role === 'teacher' ||
    auth.hasPermission(PERMISSIONS.TIMETABLE_VIEW) ||
    auth.hasPermission(PERMISSIONS.TIMETABLE_MANAGE),
)
const backTo = computed(() => ({ name: auth.role === 'teacher' ? 'my-classes' : 'classes' }))
/** O'qituvchi faqat o'ziga shu sinfda fan biriktirilgan bo'lsa; admin ruxsat bilan barcha sinflarda */
const canGradeSubjects = computed(() => {
  if (
    !auth.hasPermission(PERMISSIONS.GRADES_CREATE) &&
    !auth.hasPermission(PERMISSIONS.GRADES_EDIT)
  ) {
    return false
  }
  if (auth.role !== 'teacher') return true
  return !!schoolClass.value?.subjects?.some((s) => s.teacherId === auth.user?.id)
})
const canScore = computed(
  () =>
    (auth.hasPermission(PERMISSIONS.SCORES_CREATE) ||
      auth.hasPermission(PERMISSIONS.SCORES_EDIT)) &&
    (auth.role !== 'teacher' || schoolClass.value?.homeroomTeacherId === auth.user?.id) &&
    !schoolClass.value?.isArchived,
)
const canTakeAttendance = computed(
  () =>
    (auth.hasPermission(PERMISSIONS.ATTENDANCE_TAKE) ||
      auth.hasPermission(PERMISSIONS.ATTENDANCE_EDIT)) &&
    !schoolClass.value?.isArchived,
)
/** Qolgan amallar "⋮" menyusida */
const menuItems = computed<DropdownItem[]>(() => {
  const items: DropdownItem[] = []
  if (auth.hasPermission(PERMISSIONS.REPORTS_VIEW)) {
    items.push({ key: 'report', label: t('classes.classReport'), icon: FileBarChart })
  }
  if (canManage.value) {
    items.push({ key: 'edit', label: t('common.edit'), icon: Pencil })
    items.push({ key: 'assign', label: t('classes.assignTeachers'), icon: UserPlus })
  }
  return items
})

const actionBase =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 max-sm:w-full sm:px-4'
const actionPrimary = `${actionBase} bg-primary-600 text-white hover:bg-primary-700`
const actionSecondary = `${actionBase} border border-border bg-surface text-fg hover:bg-surface-muted`

/** silent: sarlavha ma'lumotlarini skeletonsiz yangilash (ochiq modallar yopilib ketmasligi uchun). */
async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    schoolClass.value = await classesApi.get(classId.value)
  } catch (e) {
    if (!silent) {
      schoolClass.value = null
      error.value = errorMessage(e, t)
    }
  } finally {
    loading.value = false
  }
}

async function openAssign() {
  assignOpen.value = true
  if (teachers.items.value.length === 0) await teachers.load()
}

function onMenuSelect(key: string) {
  const id = schoolClass.value?.id
  if (!id) return
  if (key === 'report') {
    void router.push({ name: 'reports', query: { tab: 'class', classId: id } })
  } else if (key === 'edit') {
    void router.push({ name: 'class-edit', params: { id }, query: { from: 'detail' } })
  } else if (key === 'assign') {
    void openAssign()
  }
}

onMounted(() => {
  void load()
  void years.load()
})
watch(classId, () => load())
</script>

<template>
  <header class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
    <RouterLink
      :to="backTo"
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('classes.back') }}
    </RouterLink>

    <Skeleton v-if="loading" class="h-12 w-full max-w-md" />
    <template v-else-if="schoolClass && !error">
      <span class="hidden h-10 w-px shrink-0 bg-border lg:block" aria-hidden="true" />
      <div class="min-w-0 flex-1" data-testid="class-header">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 class="min-w-0 break-words text-xl font-semibold text-fg sm:text-2xl">
            {{ schoolClass.name }}
          </h1>
          <BaseBadge v-if="schoolClass.isArchived" tone="warning">
            {{ t('classes.archived') }}
          </BaseBadge>
        </div>
        <p
          class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted"
          data-testid="class-meta"
        >
          <template v-if="yearName">
            <span data-testid="class-meta-year">{{ yearName }}</span>
            <span aria-hidden="true">·</span>
          </template>
          <span data-testid="class-meta-students">
            {{ t('classes.studentsCount', { n: schoolClass.studentsCount }) }}
          </span>
          <span aria-hidden="true">·</span>
          <span data-testid="class-meta-subjects">
            {{ t('classes.subjectsCount', { n: subjectGroups.length }) }}
          </span>
          <span aria-hidden="true">·</span>
          <span v-if="schoolClass.homeroomTeacher" data-testid="class-homeroom">
            {{ t('classes.homeroom') }}:
            <RouterLink
              v-if="canOpenTeacher"
              :to="{ name: 'teacher-detail', params: { id: schoolClass.homeroomTeacher.id } }"
              class="font-medium text-fg hover:text-primary-600 hover:underline"
            >
              {{ schoolClass.homeroomTeacher.fullName }}
            </RouterLink>
            <span v-else class="font-medium text-fg">{{
              schoolClass.homeroomTeacher.fullName
            }}</span>
          </span>
          <span v-else class="inline-flex items-center gap-2" data-testid="class-no-homeroom">
            <BaseBadge tone="warning">
              <AlertTriangle class="h-3 w-3" aria-hidden="true" />
              {{ t('classes.noHomeroomBadge') }}
            </BaseBadge>
            <button
              v-if="canManage"
              type="button"
              class="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-fg transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
              data-testid="class-homeroom-assign"
              @click="openAssign"
            >
              {{ t('classes.assignHomeroom') }}
            </button>
          </span>
        </p>
      </div>

      <div
        class="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end"
        data-testid="class-actions"
      >
        <RouterLink
          v-if="canScore"
          :to="{ name: 'class-scoring', params: { id: schoolClass.id } }"
          :class="actionPrimary"
          :aria-label="t('classes.gradeAction')"
          :title="t('classes.gradeAction')"
          data-testid="class-scoring-link"
        >
          <ClipboardCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="max-sm:hidden">{{ t('classes.gradeAction') }}</span>
        </RouterLink>
        <RouterLink
          v-if="canGradeSubjects && !schoolClass.isArchived"
          :to="{ name: 'grading', query: { tab: 'subjects', classId: schoolClass.id } }"
          :class="actionSecondary"
          :aria-label="t('classes.subjectGradeAction')"
          :title="t('classes.subjectGradeAction')"
          data-testid="class-subject-grading-link"
        >
          <BookOpenCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="max-sm:hidden">{{ t('classes.subjectGradeAction') }}</span>
        </RouterLink>
        <RouterLink
          v-if="canTakeAttendance"
          :to="{ name: 'class-attendance', params: { id: schoolClass.id } }"
          :class="actionSecondary"
          :aria-label="t('attendance.action')"
          :title="t('attendance.action')"
          data-testid="class-attendance-link"
        >
          <CalendarCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="max-sm:hidden">{{ t('attendance.action') }}</span>
        </RouterLink>
        <RouterLink
          v-if="canSeeTimetable"
          :to="{ name: 'class-timetable', params: { id: schoolClass.id } }"
          :class="actionSecondary"
          :aria-label="t('timetable.scheduleLink')"
          :title="t('timetable.scheduleLink')"
          data-testid="class-timetable-link"
        >
          <CalendarClock class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="max-sm:hidden">{{ t('timetable.scheduleLink') }}</span>
        </RouterLink>
        <DropdownMenu
          v-if="menuItems.length"
          :items="menuItems"
          :label="t('classes.moreActions')"
          :trigger-class="`${actionSecondary} sm:!w-10 sm:!px-0`"
          trigger-test-id="class-more-menu"
          @select="onMenuSelect"
        />
      </div>
    </template>
  </header>

  <div v-if="loading" class="space-y-3">
    <Skeleton class="h-40 w-full" />
    <Skeleton class="mt-6 h-64 w-full" />
  </div>

  <div v-else-if="error || !schoolClass" class="card">
    <EmptyState :title="t('classes.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load()">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <template v-else>
    <section
      class="card mb-6 p-4 sm:p-5"
      aria-labelledby="class-subjects-card-title"
      data-testid="class-subjects"
    >
      <header class="mb-3 flex items-center gap-3">
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
        >
          <BookOpenCheck class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <h2 id="class-subjects-card-title" class="min-w-0 flex-1 text-base font-semibold text-fg">
          {{ t('classes.subjectsSection') }} ({{ subjectGroups.length }})
        </h2>
        <BaseButton
          v-if="canManage && rows.length"
          variant="secondary"
          size="sm"
          data-testid="class-subjects-assign"
          @click="openAssign"
        >
          <UserPlus class="h-4 w-4" aria-hidden="true" /> {{ t('classes.assignShort') }}
        </BaseButton>
      </header>

      <div
        v-if="rows.length === 0"
        class="flex flex-col items-center gap-3 py-4 text-center"
        data-testid="class-subjects-empty"
      >
        <Users class="h-6 w-6 text-fg-muted" aria-hidden="true" />
        <p class="text-sm text-fg-muted">{{ t('classes.noSubjectsAssigned') }}</p>
        <BaseButton
          v-if="canManage"
          variant="secondary"
          size="sm"
          data-testid="class-subjects-assign"
          @click="openAssign"
        >
          <UserPlus class="h-4 w-4" aria-hidden="true" /> {{ t('classes.assignShort') }}
        </BaseButton>
      </div>
      <template v-else>
        <ul class="grid gap-x-8 lg:grid-cols-2" data-testid="class-subject-list">
          <li
            v-for="r in visibleRows"
            :key="r.key"
            class="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm"
            data-testid="class-subject-group"
          >
            <span class="min-w-0 truncate font-medium text-fg" :title="r.name">{{ r.name }}</span>
            <span
              class="min-w-0 truncate text-right text-fg-muted"
              data-testid="class-subject-teachers"
            >
              <template v-for="(tc, i) in r.teachers" :key="tc.id">
                <RouterLink
                  v-if="canOpenTeacher"
                  :to="{ name: 'teacher-detail', params: { id: tc.id } }"
                  :title="tc.fullName"
                  class="hover:text-primary-600 hover:underline"
                  >{{ shortName(tc.fullName) }}</RouterLink
                >
                <span v-else :title="tc.fullName">{{ shortName(tc.fullName) }}</span
                ><span v-if="i < r.teachers.length - 1">, </span>
              </template>
            </span>
          </li>
        </ul>
        <button
          v-if="hiddenCount > 0"
          type="button"
          class="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
          :aria-expanded="expanded"
          data-testid="class-subjects-toggle"
          @click="expanded = !expanded"
        >
          {{ expanded ? t('classes.collapse') : t('classes.showMore', { n: hiddenCount }) }}
          <ChevronDown
            class="h-4 w-4 transition-transform"
            :class="expanded ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
      </template>
    </section>

    <StudentsPanel
      :class-id="schoolClass.id"
      :class-name="schoolClass.name"
      @changed="load(true)"
    />

    <ClassTeachersModal
      v-if="canManage"
      :open="assignOpen"
      :school-class="schoolClass"
      :teachers="teachers.items.value"
      :loading="teachers.loading.value"
      @close="assignOpen = false"
      @saved="load(true)"
    />
  </template>
</template>
