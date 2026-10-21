<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { BarChart3 } from 'lucide-vue-next'
import { attendanceApi } from '@/api/attendance.api'
import { attendanceStatusesApi } from '@/api/attendanceStatuses.api'
import type { AttendanceStatus, AttendanceSummary } from '@/api/types'
import AttendanceSummaryTable from '@/components/attendance/AttendanceSummaryTable.vue'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useEffectiveAttendance } from '@/composables/useAttendanceSettings'
import { useClassLookup } from '@/composables/useLookups'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useSchoolContextStore } from '@/stores/school-context'
import { formatRate, presetRange, rateTone, type RangePreset } from '@/utils/attendance'
import { errorMessage } from '@/utils/errors'
import { shiftDate, todayTashkent } from '@/utils/scoring'
import AttendanceRecordsTab from './AttendanceRecordsTab.vue'

const { t } = useI18n()
const router = useRouter()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()
const classes = useClassLookup()
const effective = useEffectiveAttendance()

const today = todayTashkent()
const classId = ref('')
const initial = presetRange('month', today, shiftDate)
const from = ref(initial.from)
const to = ref(initial.to)
const preset = ref<RangePreset | ''>('month')
const tab = ref<'stats' | 'records'>('stats')

const summary = ref<AttendanceSummary | null>(null)
const statuses = ref<AttendanceStatus[]>([])
const loading = ref(false)
const error = ref('')

const classOptions = computed(() =>
  classes.items.value.map((c) => ({ value: c.id, label: c.name })),
)
const rangeValid = computed(() => !!from.value && !!to.value && from.value <= to.value)
const PRESETS: RangePreset[] = ['today', 'week', 'month', 'quarter']

function applyPreset(p: RangePreset) {
  const r = presetRange(p, today, shiftDate)
  from.value = r.from
  to.value = r.to
  preset.value = p
}
// Qo'lda sana o'zgartirilsa tezkor tanlov belgisi olinadi
watch([from, to], () => {
  if (preset.value) {
    const r = presetRange(preset.value, today, shiftDate)
    if (r.from !== from.value || r.to !== to.value) preset.value = ''
  }
})

async function loadSummary() {
  if (!classId.value || !rangeValid.value) return
  loading.value = true
  error.value = ''
  try {
    summary.value = await attendanceApi.summary({
      classId: classId.value,
      from: from.value,
      to: to.value,
    })
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

async function init() {
  if (needsSchool.value) return
  void effective.load()
  attendanceStatusesApi
    .list({ scope: 'all' })
    .then((r) => (statuses.value = r.items))
    .catch(() => undefined)
  await classes.load()
  if (!classId.value && classes.items.value[0]) classId.value = classes.items.value[0].id
}
onMounted(init)
watch(
  () => schoolCtx.schoolId,
  () => {
    classId.value = ''
    void init()
  },
)
watch([classId, from, to], loadSummary)

const openStudent = (id: string) =>
  router.push({ name: 'student-profile', params: { id }, hash: '#attendance' })
</script>

<template>
  <PageHeader
    :title="t('attendance.historyTitle')"
    :description="t('attendance.historyDescription')"
  />

  <NeedsSchool v-if="needsSchool" />
  <div v-else class="card">
    <div class="space-y-3 border-b border-border p-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <BaseSelect
          v-model="classId"
          :label="t('students.class')"
          :placeholder="t('attendance.pickClass')"
          :options="classOptions"
        />
        <BaseInput v-model="from" type="date" :label="t('scores.from')" :max="to || undefined" />
        <BaseInput v-model="to" type="date" :label="t('scores.to')" :min="from || undefined" />
      </div>
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('attendance.quickRange')">
        <button
          v-for="p in PRESETS"
          :key="p"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm transition-colors"
          :class="
            preset === p
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-border text-fg-muted hover:bg-surface-muted'
          "
          :aria-pressed="preset === p"
          data-testid="preset"
          @click="applyPreset(p)"
        >
          {{ t(`attendance.presets.${p}`) }}
        </button>
      </div>
      <p v-if="!rangeValid" class="text-xs text-warning" role="status">
        {{ t('ratings.customHint') }}
      </p>
    </div>

    <div
      role="tablist"
      :aria-label="t('attendance.historyTitle')"
      class="flex gap-1 border-b border-border px-4"
    >
      <button
        v-for="x in ['stats', 'records'] as const"
        :key="x"
        type="button"
        role="tab"
        :aria-selected="tab === x"
        class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
        :class="
          tab === x
            ? 'border-primary-600 text-primary-700'
            : 'border-transparent text-fg-muted hover:text-fg'
        "
        @click="tab = x"
      >
        {{ t(`attendance.tabs.${x}`) }}
      </button>
    </div>

    <EmptyState
      v-if="!classId"
      :icon="BarChart3"
      :title="t('attendance.pickClass')"
      :description="t('attendance.pickClassText')"
    />

    <template v-else-if="tab === 'stats'">
      <div v-if="loading && !summary" class="space-y-2 p-4">
        <Skeleton v-for="n in 5" :key="n" class="h-10 w-full" />
      </div>
      <div v-else-if="error" class="p-4">
        <EmptyState :title="t('errors.loadFailed')" :description="error">
          <BaseButton variant="secondary" @click="loadSummary">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>
      <template v-else-if="summary">
        <div
          v-if="summary.class"
          class="flex flex-wrap items-center gap-4 border-b border-border p-4"
        >
          <div>
            <p class="text-xs text-fg-muted">{{ t('attendance.summary.classRate') }}</p>
            <p
              class="text-3xl font-extrabold tabular-nums"
              :class="{
                'text-success': rateTone(summary.class.rate) === 'success',
                'text-warning': rateTone(summary.class.rate) === 'warning',
                'text-danger': rateTone(summary.class.rate) === 'danger',
                'text-fg': rateTone(summary.class.rate) === 'neutral',
              }"
              data-testid="class-rate"
            >
              {{ formatRate(summary.class.rate) }}
            </p>
          </div>
          <p class="text-sm text-fg-muted">
            {{
              t('attendance.summary.unitInfo', {
                unit: t(`attendance.units.${summary.unit}`),
                n: summary.class.total,
              })
            }}
          </p>
        </div>
        <EmptyState
          v-if="summary.students.length === 0"
          :icon="BarChart3"
          :title="t('attendance.recordsEmptyTitle')"
          :description="t('attendance.recordsEmptyText')"
        />
        <AttendanceSummaryTable
          v-else
          :rows="summary.students"
          :unit="summary.unit"
          @open="openStudent"
        />
      </template>
    </template>

    <AttendanceRecordsTab
      v-else
      :class-id="classId"
      :from="from"
      :to="to"
      :statuses="statuses"
      :settings="effective.settings.value"
    />
  </div>
</template>
