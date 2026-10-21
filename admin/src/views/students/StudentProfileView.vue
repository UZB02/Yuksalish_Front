<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, FileSpreadsheet, FileText } from 'lucide-vue-next'
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
  { key: 'average', value: summary.value?.average ?? '-' },
  { key: 'days', value: summary.value?.daysCount ?? 0 },
  { key: 'count', value: summary.value?.scoresCount ?? 0 },
])
</script>

<template>
  <RouterLink
    :to="student ? { name: 'class-detail', params: { id: student.classId } } : { name: 'students' }"
    class="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
  >
    <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('profile2.back') }}
  </RouterLink>

  <Skeleton v-if="loadingStudent" class="mb-6 h-24 w-full" />
  <div v-else-if="error" class="card">
    <EmptyState :title="t('profile2.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="loadStudent">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <template v-else-if="student">
    <section class="card mb-6 p-5">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-xl font-semibold text-fg sm:text-2xl">{{ student.fullName }}</h1>
        <BaseBadge :tone="student.status === 'active' ? 'success' : 'neutral'">
          {{ t(`students.statuses.${student.status}`) }}
        </BaseBadge>
      </div>
      <div v-if="canExport" class="mt-3 flex flex-wrap gap-2" data-testid="profile-export">
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
      <dl class="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt class="text-fg-muted">{{ t('students.class') }}</dt>
          <dd class="text-fg">
            <RouterLink
              :to="{ name: 'class-detail', params: { id: student.classId } }"
              class="text-primary-700 hover:underline"
            >
              {{ student.class.name }}
            </RouterLink>
          </dd>
        </div>
        <div>
          <dt class="text-fg-muted">{{ t('students.code') }}</dt>
          <dd class="text-fg">{{ student.studentCode || '-' }}</dd>
        </div>
        <div>
          <dt class="text-fg-muted">{{ t('students.birthDate') }}</dt>
          <dd class="text-fg">{{ formatDate(student.birthDate) || '-' }}</dd>
        </div>
        <div>
          <dt class="text-fg-muted">{{ t('students.gender') }}</dt>
          <dd class="text-fg">
            {{ student.gender ? t(`students.genders.${student.gender}`) : '-' }}
          </dd>
        </div>
      </dl>
    </section>

    <div class="mb-4 grid gap-3 sm:grid-cols-[14rem_1fr_1fr] sm:items-end">
      <BaseSelect v-model="period" :label="t('profile2.period')" :options="periodOptions" />
      <template v-if="period === 'custom'">
        <BaseInput v-model="customFrom" type="date" :label="t('scores.from')" :max="customTo" />
        <BaseInput
          v-model="customTo"
          type="date"
          :label="t('scores.to')"
          :min="customFrom"
          :max="today"
        />
      </template>
    </div>

    <div v-if="summaryError" class="card">
      <EmptyState :title="t('errors.loadFailed')" :description="summaryError">
        <BaseButton variant="secondary" @click="loadSummary">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <template v-else>
      <dl class="mb-4 grid grid-cols-3 gap-3">
        <div v-for="s in stats" :key="s.key" class="card p-4">
          <dt class="text-xs text-fg-muted">{{ t(`profile2.stats.${s.key}`) }}</dt>
          <dd
            class="mt-1 text-2xl font-semibold text-fg"
            :class="loadingSummary ? 'opacity-50' : ''"
          >
            {{ s.value }}
          </dd>
        </div>
      </dl>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="card p-5 lg:col-span-2">
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t('profile2.trend') }}</h2>
          <Skeleton v-if="loadingSummary && !summary" class="h-52 w-full" />
          <TrendChart v-else :points="summary?.trend ?? []" />
        </section>

        <section class="card p-5">
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t('profile2.behaviors') }}</h2>
          <BehaviorBars :items="summary?.byBehaviorType ?? []" />
        </section>

        <section class="card p-5">
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t('profile2.recent') }}</h2>
          <p
            v-if="!summary || summary.recent.length === 0"
            class="py-6 text-center text-sm text-fg-muted"
          >
            {{ t('profile2.noRecent') }}
          </p>
          <ul v-else class="divide-y divide-border">
            <li v-for="s in summary.recent" :key="s.id" class="py-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-fg-muted">
                  {{ formatDate(s.date) }} - {{ s.teacher.fullName }}
                </span>
                <span class="text-lg font-semibold text-fg">{{ s.value }}</span>
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
      </div>
    </template>

    <StudentGradesSection
      v-if="canGrades && range.from && range.to && range.from <= range.to"
      :student-id="studentId"
      :from="range.from"
      :to="range.to"
    />

    <StudentAttendanceSection
      v-if="canAttendance && range.from && range.to && range.from <= range.to"
      :student-id="studentId"
      :from="range.from"
      :to="range.to"
    />
  </template>
</template>
