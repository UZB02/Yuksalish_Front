<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  School as SchoolIcon,
  CalendarCheck,
  ShieldAlert,
  Users,
} from 'lucide-vue-next'
import { isApiError } from '@/api/errors'
import { attendanceApi } from '@/api/attendance.api'
import { scoresApi } from '@/api/scores.api'
import ProgressBar from '@/components/scoring/ProgressBar.vue'
import TodayLessons from '@/components/timetable/TodayLessons.vue'
import TopRatings from '@/components/ratings/TopRatings.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { PERMISSIONS } from '@/constants/permissions'
import { dashboardApi } from '@/api/dashboard.api'
import type { AttendanceProgress, DashboardSummary, TodayProgress } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'

const { t } = useI18n()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const error = ref('')
const forbidden = ref(false)
let requestId = 0
const progress = ref<TodayProgress[]>([])
const attendanceProgress = ref<AttendanceProgress[]>([])
const isTeacher = computed(() => auth.role === 'teacher')
const needsSchool = useNeedsSchool()
const canRatings = computed(() => auth.hasPermission(PERMISSIONS.REPORTS_VIEW))

const scopeText = computed(() => {
  if (!auth.isSuperadmin) return t('dashboard.ownSchool')
  return schoolCtx.selectedSchool
    ? t('dashboard.schoolScope', { name: schoolCtx.selectedSchool.name })
    : t('dashboard.allSchools')
})

const cards = computed(() => {
  const list = [
    { key: 'students', icon: Users },
    { key: 'classes', icon: BookOpen },
    { key: 'teachers', icon: GraduationCap },
    { key: 'scoresToday', icon: ClipboardCheck },
  ]
  // Global ko'rinishda (maktab tanlanmagan) maktablar soni ham keladi.
  if (summary.value?.schools !== undefined) list.unshift({ key: 'schools', icon: SchoolIcon })
  if (summary.value?.unscoredClassesToday !== undefined) {
    list.push({ key: 'unscoredClassesToday', icon: ClipboardList })
  }
  return list
})

async function load() {
  const current = ++requestId
  loading.value = true
  error.value = ''
  forbidden.value = false
  try {
    const data = await dashboardApi.summary()
    if (current === requestId) summary.value = data
  } catch (e) {
    if (current === requestId) {
      if (isApiError(e) && e.code === 'FORBIDDEN') forbidden.value = true
      else error.value = errorMessage(e, t)
    }
  } finally {
    if (current === requestId) loading.value = false
  }
}

onMounted(() => {
  void load()
  if (isTeacher.value) {
    scoresApi
      .todayProgress()
      .then((p) => (progress.value = p))
      .catch(() => undefined)
    attendanceApi
      .todayProgress()
      .then((p) => (attendanceProgress.value = p))
      .catch(() => undefined)
  }
})
watch(() => schoolCtx.schoolId, load)
</script>

<template>
  <PageHeader
    :title="t('dashboard.greeting', { name: auth.user?.fullName ?? '' })"
    :description="scopeText"
  />

  <div v-if="forbidden" class="card">
    <EmptyState
      :icon="ShieldAlert"
      :title="t('dashboard.noAccessTitle')"
      :description="t('dashboard.noAccessText')"
    />
  </div>

  <div v-else-if="error" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <!-- Ixcham kartalar: ustunlar soni kartalar soniga qarab o'zi moslashadi (bitta qatorga sig'adi) -->
  <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
    <template v-if="loading && !summary">
      <Skeleton v-for="n in 4" :key="n" class="h-[4.5rem] w-full" />
    </template>
    <template v-else>
      <div
        v-for="c in cards"
        :key="c.key"
        class="card flex items-center gap-3 p-4"
        :class="loading ? 'opacity-60' : ''"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
        >
          <component :is="c.icon" class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <p class="text-xl font-semibold leading-tight text-fg">
            {{ summary?.[c.key as keyof DashboardSummary] ?? 0 }}
          </p>
          <p
            class="truncate text-xs text-fg-muted sm:text-sm"
            :title="t(`dashboard.cards.${c.key}`)"
          >
            {{ t(`dashboard.cards.${c.key}`) }}
          </p>
        </div>
      </div>
    </template>
  </div>

  <section
    v-if="summary?.attendanceToday"
    class="card mt-6 p-6"
    data-testid="attendance-today"
    :aria-label="t('dashboard.attendanceTitle')"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 text-base font-semibold text-fg">
        <CalendarCheck class="h-5 w-5 text-primary-600" aria-hidden="true" />
        {{ t('dashboard.attendanceTitle') }}
      </h2>
      <RouterLink
        :to="{ name: 'attendance' }"
        class="text-sm font-medium"
        :class="summary.attendanceToday.unmarkedClasses > 0 ? 'text-warning' : 'text-primary-700'"
        data-testid="unmarked-link"
      >
        {{ t('dashboard.attendanceUnmarked', { n: summary.attendanceToday.unmarkedClasses }) }}
      </RouterLink>
    </div>
    <dl class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
      <div>
        <dt class="text-xs text-fg-muted">{{ t('attendance.stats.present') }}</dt>
        <dd class="text-2xl font-semibold tabular-nums text-success">
          {{ summary.attendanceToday.present }}
        </dd>
      </div>
      <div>
        <dt class="text-xs text-fg-muted">{{ t('attendance.stats.late') }}</dt>
        <dd class="text-2xl font-semibold tabular-nums text-warning">
          {{ summary.attendanceToday.late }}
        </dd>
      </div>
      <div data-testid="attendance-partial">
        <dt class="text-xs text-fg-muted">{{ t('attendance.stats.partial') }}</dt>
        <dd class="text-2xl font-semibold tabular-nums text-orange-600">
          {{ summary.attendanceToday.partial ?? 0 }}
        </dd>
      </div>
      <div>
        <dt class="text-xs text-fg-muted">{{ t('attendance.stats.absent') }}</dt>
        <dd class="text-2xl font-semibold tabular-nums text-danger">
          {{ summary.attendanceToday.absent }}
        </dd>
      </div>
    </dl>
    <p class="mt-3 text-xs text-fg-muted">
      {{ t('dashboard.attendanceTotal', { n: summary.attendanceToday.total }) }}
    </p>
  </section>

  <TodayLessons v-if="isTeacher && !needsSchool && !forbidden" class="mt-6" />

  <section v-if="isTeacher && attendanceProgress.length" class="card mt-6 p-6">
    <h2 class="mb-4 text-base font-semibold text-fg">{{ t('dashboard.attendanceProgress') }}</h2>
    <ul class="grid gap-4 sm:grid-cols-2">
      <li v-for="p in attendanceProgress" :key="p.classId">
        <RouterLink
          :to="{ name: 'class-attendance', params: { id: p.classId } }"
          class="mb-1 block text-sm font-medium text-fg hover:text-primary-700"
        >
          {{ p.className }}
        </RouterLink>
        <ProgressBar
          label-key="attendance.progress"
          :done="p.markedStudents"
          :total="p.totalStudents"
        />
      </li>
    </ul>
  </section>

  <TopRatings v-if="canRatings && !needsSchool && !forbidden" :key="schoolCtx.schoolId ?? 'own'" />

  <section v-if="isTeacher && progress.length" class="card mt-6 p-6">
    <h2 class="mb-4 text-base font-semibold text-fg">{{ t('dashboard.todayProgress') }}</h2>
    <ul class="grid gap-4 sm:grid-cols-2">
      <li v-for="p in progress" :key="p.classId">
        <RouterLink
          :to="{ name: 'class-scoring', params: { id: p.classId } }"
          class="mb-1 block text-sm font-medium text-fg hover:text-primary-700"
        >
          {{ p.className }}
        </RouterLink>
        <ProgressBar :done="p.scored" :total="p.total" />
      </li>
    </ul>
  </section>

  <div class="card mt-6 p-6">
    <h2 class="text-base font-semibold text-fg">{{ t('dashboard.chartTitle') }}</h2>
    <p class="mt-1 text-sm text-fg-muted">{{ t('dashboard.chartPlaceholder') }}</p>
    <div
      class="mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-fg-muted"
    >
      {{ t('common.comingSoon') }}
    </div>
  </div>
</template>
