<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  CalendarCheck,
  FileSpreadsheet,
  FileText,
  History,
  ListChecks,
  Palette,
  Star,
  TrendingUp,
} from 'lucide-vue-next'
import { studentsApi } from '@/api/students.api'
import { scoresApi } from '@/api/scores.api'
import type { Student, StudentScoreSummary } from '@/api/types'
import BehaviorBars from '@/components/scoring/BehaviorBars.vue'
import TrendChart from '@/components/scoring/TrendChart.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import StudentAttendanceSection from '@/components/attendance/StudentAttendanceSection.vue'
import StudentGradesSection from '@/components/grading/StudentGradesSection.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useAcademicYearLookup } from '@/composables/useLookups'
import { useReportExport } from '@/composables/useReportExport'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import { formatDate, toDateInput } from '@/utils/format'
import { validatePeriod } from '@/utils/reports'
import { shiftDate, todayTashkent, withAlpha } from '@/utils/scoring'

const { t } = useI18n()
const route = useRoute()
const studentId = computed(() => String(route.params.id))

const student = ref<Student | null>(null)
const summary = ref<StudentScoreSummary | null>(null)
const loadingStudent = ref(true)
const loadingSummary = ref(false)
const error = ref('')
const summaryError = ref('')

const years = useAcademicYearLookup()
const today = todayTashkent()
const period = ref('30')
const customFrom = ref(shiftDate(today, -30))
const customTo = ref(today)

const periodOptions = computed(() => [
  { value: '7', label: t('profile2.periods.7') },
  { value: '30', label: t('profile2.periods.30') },
  ...(years.activeYear.value?.periods ?? []).map((p, i) => ({
    value: `q:${i}`,
    label: p.name,
  })),
  { value: 'custom', label: t('profile2.periods.custom') },
])

const auth = useAuthStore()
// Davomat bo'limi: attendance.view|take yoki students.view bo'lsa
const canAttendance = computed(() =>
  [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_TAKE, PERMISSIONS.STUDENTS_VIEW].some((p) =>
    auth.hasPermission(p),
  ),
)

// Fan baholari bo'limi: o'quvchini ko'rish yoki baholash huquqi bor foydalanuvchilarga
const canGrades = computed(() =>
  [
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.GRADES_CREATE,
    PERMISSIONS.GRADES_EDIT,
    PERMISSIONS.REPORTS_VIEW,
  ].some((p) => auth.hasPermission(p)),
)

const range = computed(() => {
  if (period.value === '7') return { from: shiftDate(today, -6), to: today }
  if (period.value === '30') return { from: shiftDate(today, -29), to: today }
  if (period.value.startsWith('q:')) {
    const p = years.activeYear.value?.periods[Number(period.value.slice(2))]
    if (p) return { from: toDateInput(p.startDate), to: toDateInput(p.endDate) }
  }
  return { from: customFrom.value, to: customTo.value }
})
const rangeValid = computed(
  () => !!range.value.from && !!range.value.to && range.value.from <= range.value.to,
)

// Hisobot eksporti: joriy tanlangan davr bilan (reports.export kerak, davr yaroqli bo'lishi shart)
const exporter = useReportExport()
const canExport = computed(() => auth.hasPermission(PERMISSIONS.REPORTS_EXPORT))
const exportReady = computed(() => validatePeriod(range.value.from, range.value.to, today) === null)

async function loadStudent() {
  loadingStudent.value = true
  error.value = ''
  try {
    student.value = await studentsApi.get(studentId.value)
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loadingStudent.value = false
  }
}

async function loadSummary() {
  const { from, to } = range.value
  if (!from || !to || from > to) return
  loadingSummary.value = true
  summaryError.value = ''
  try {
    summary.value = await scoresApi.studentSummary(studentId.value, { from, to })
  } catch (e) {
    summaryError.value = errorMessage(e, t)
  } finally {
    loadingSummary.value = false
  }
}

onMounted(() => {
  void years.load() // chorak variantlari uchun; xato bo'lsa faqat 7/30/maxsus qoladi
  void loadStudent()
  void loadSummary()
})
watch([period, customFrom, customTo, studentId], loadSummary)

const stats = computed(() => [
  { key: 'average', icon: Star, value: summary.value?.average ?? '-' },
  { key: 'days', icon: CalendarCheck, value: summary.value?.daysCount ?? 0 },
  { key: 'count', icon: ListChecks, value: summary.value?.scoresCount ?? 0 },
])

// Avatar uchun bosh harflar (ismning birinchi ikki so'zi)
const initials = computed(() =>
  (student.value?.fullName ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join(''),
)

// Sarlavha ostidagi meta qator (sinf havolasidan keyin): kod, tug'ilgan sana, jins
const metaItems = computed(() => {
  const st = student.value
  if (!st) return []
  return [
    st.studentCode ? `${t('students.code')}: ${st.studentCode}` : '',
    st.birthDate ? formatDate(st.birthDate) : '',
    st.gender ? t(`students.genders.${st.gender}`) : '',
  ].filter(Boolean)
})
</script>

<template>
  <!-- Keng ekranda: orqaga | ajratgich | shaxs ... davr va hisobot tugmalari; kichik ekranda ustma-ust -->
  <header
    class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5"
    data-testid="profile-header"
  >
    <RouterLink
      :to="
        student ? { name: 'class-detail', params: { id: student.classId } } : { name: 'students' }
      "
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('profile2.back') }}
    </RouterLink>

    <Skeleton v-if="loadingStudent" class="h-12 w-full max-w-md" />
    <template v-else-if="student">
      <span class="hidden h-10 w-px shrink-0 bg-border lg:block" aria-hidden="true" />
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700"
          aria-hidden="true"
        >
          {{ initials }}
        </span>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 class="min-w-0 break-words text-xl font-semibold text-fg sm:text-2xl">
              {{ student.fullName }}
            </h1>
            <BaseBadge :tone="student.status === 'active' ? 'success' : 'neutral'">
              {{ t(`students.statuses.${student.status}`) }}
            </BaseBadge>
          </div>
          <p
            class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted"
            data-testid="profile-meta"
          >
            <RouterLink
              :to="{ name: 'class-detail', params: { id: student.classId } }"
              class="text-primary-700 hover:underline"
            >
              {{ student.class.name }}
            </RouterLink>
            <template v-for="m in metaItems" :key="m">
              <span aria-hidden="true">&middot;</span>
              <span>{{ m }}</span>
            </template>
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-2 lg:justify-end" data-testid="profile-controls">
        <template v-if="period === 'custom'">
          <BaseInput
            v-model="customFrom"
            type="date"
            :label="t('scores.from')"
            :max="customTo"
            class="w-40"
          />
          <BaseInput
            v-model="customTo"
            type="date"
            :label="t('scores.to')"
            :min="customFrom"
            :max="today"
            class="w-40"
          />
        </template>
        <BaseSelect
          v-model="period"
          :aria-label="t('profile2.period')"
          :title="t('profile2.period')"
          :options="periodOptions"
          class="w-44"
        />
        <div v-if="canExport" class="flex flex-wrap gap-2" data-testid="profile-export">
          <BaseButton
            size="sm"
            variant="secondary"
            :loading="exporter.busy.value === 'pdf'"
            :disabled="!exportReady || exporter.busy.value !== null"
            @click="exporter.run('student', 'pdf', range, studentId)"
          >
            <FileText class="h-4 w-4" aria-hidden="true" /> {{ t('profile2.reportPdf') }}
          </BaseButton>
          <BaseButton
            size="sm"
            variant="secondary"
            :loading="exporter.busy.value === 'xlsx'"
            :disabled="!exportReady || exporter.busy.value !== null"
            @click="exporter.run('student', 'xlsx', range, studentId)"
          >
            <FileSpreadsheet class="h-4 w-4" aria-hidden="true" /> {{ t('reports.excel') }}
          </BaseButton>
        </div>
      </div>
    </template>
  </header>

  <div v-if="loadingStudent" class="space-y-4" data-testid="profile-skeleton">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
      <Skeleton v-for="n in 3" :key="n" class="h-[4.5rem] w-full" />
    </div>
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="space-y-4 lg:col-span-2">
        <Skeleton class="h-56 w-full" />
        <Skeleton class="h-48 w-full" />
      </div>
      <div class="space-y-4">
        <Skeleton class="h-56 w-full" />
        <Skeleton class="h-40 w-full" />
      </div>
    </div>
  </div>
  <div v-else-if="error" class="card">
    <EmptyState :title="t('profile2.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="loadStudent">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <template v-else-if="student">
    <!-- Ixcham KPI kartalar: ustunlar soni kartalar soniga qarab moslashadi -->
    <dl
      v-if="!summaryError"
      class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]"
      data-testid="profile-stats"
    >
      <div
        v-for="s in stats"
        :key="s.key"
        class="card flex items-center gap-3 p-4"
        :class="loadingSummary ? 'opacity-60' : ''"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
        >
          <component :is="s.icon" class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <dd class="text-xl font-semibold leading-tight text-fg">{{ s.value }}</dd>
          <dt class="truncate text-xs text-fg-muted">{{ t(`profile2.stats.${s.key}`) }}</dt>
        </div>
      </div>
    </dl>

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="min-w-0 space-y-4 lg:col-span-2">
        <div v-if="summaryError" class="card">
          <EmptyState :title="t('errors.loadFailed')" :description="summaryError">
            <BaseButton variant="secondary" @click="loadSummary">{{
              t('common.retry')
            }}</BaseButton>
          </EmptyState>
        </div>
        <template v-else>
          <section class="card p-4 sm:p-5">
            <header class="mb-3 flex items-center gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
              >
                <TrendingUp class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
              </span>
              <h2 class="text-base font-semibold text-fg">{{ t('profile2.trend') }}</h2>
            </header>
            <Skeleton v-if="loadingSummary && !summary" class="h-44 w-full" />
            <TrendChart v-else :points="summary?.trend ?? []" class="mx-auto max-w-2xl" />
          </section>

          <section class="card p-4 sm:p-5">
            <header class="mb-2 flex items-center gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
              >
                <History class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
              </span>
              <h2 class="text-base font-semibold text-fg">{{ t('profile2.recent') }}</h2>
            </header>
            <p
              v-if="!summary || summary.recent.length === 0"
              class="py-3 text-center text-sm text-fg-muted"
            >
              {{ t('profile2.noRecent') }}
            </p>
            <ul v-else class="divide-y divide-border">
              <li v-for="s in summary.recent" :key="s.id" class="py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="min-w-0 truncate text-xs text-fg-muted">
                    {{ formatDate(s.date) }} - {{ s.teacher.fullName }}
                  </span>
                  <span class="text-lg font-semibold leading-none text-fg">{{ s.value }}</span>
                </div>
                <span
                  v-if="s.behaviorType"
                  class="mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                  :style="{
                    borderColor: s.behaviorType.color,
                    backgroundColor: withAlpha(s.behaviorType.color, 0.15),
                  }"
                >
                  {{ s.behaviorType.name }}
                </span>
                <p v-if="s.comment" class="mt-1 text-sm text-fg-muted">{{ s.comment }}</p>
              </li>
            </ul>
          </section>
        </template>

        <StudentAttendanceSection
          v-if="canAttendance && rangeValid"
          :student-id="studentId"
          :from="range.from"
          :to="range.to"
        />
      </div>

      <div class="min-w-0 space-y-4">
        <StudentGradesSection
          v-if="canGrades && rangeValid"
          :student-id="studentId"
          :from="range.from"
          :to="range.to"
        />

        <section v-if="!summaryError" class="card p-4 sm:p-5">
          <header class="mb-3 flex items-center gap-3">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
            >
              <Palette class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </span>
            <h2 class="text-base font-semibold text-fg">{{ t('profile2.behaviors') }}</h2>
          </header>
          <BehaviorBars :items="summary?.byBehaviorType ?? []" />
        </section>
      </div>
    </div>
  </template>
</template>
