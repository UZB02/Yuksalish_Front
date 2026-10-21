<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExportFormat } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ReportPeriodPicker from '@/components/reports/ReportPeriodPicker.vue'
import ReportToolbar from '@/components/reports/ReportToolbar.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useReportFilters } from '@/composables/useReportFilters'
import { useAcademicYearLookup, useClassLookup } from '@/composables/useLookups'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useReportExport } from '@/composables/useReportExport'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { visibleReportTabs, type ReportTab } from '@/utils/reports'
import BehaviorReportTab from './BehaviorReportTab.vue'
import ClassReportTab from './ClassReportTab.vue'
import SchoolReportTab from './SchoolReportTab.vue'
import SchoolsReportTab from './SchoolsReportTab.vue'
import StudentPicker from './StudentPicker.vue'
import StudentReportTab from './StudentReportTab.vue'
import TeachersReportTab from './TeachersReportTab.vue'

const { t } = useI18n()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()
const needsSchool = useNeedsSchool()
const years = useAcademicYearLookup()
const classes = useClassLookup()

const tabs = computed(() => visibleReportTabs(auth.user?.role, (p) => auth.hasPermission(p)))
const filters = useReportFilters(
  tabs,
  computed(() => years.activeYear.value),
)
const canExport = computed(() => auth.hasPermission(PERMISSIONS.REPORTS_EXPORT))

const blocked = computed(() => filters.state.tab !== 'schools' && needsSchool.value)
const classOptions = computed(() =>
  classes.items.value.map((c) => ({ value: c.id, label: c.name })),
)
const hasClassFilter = computed(() => ['class', 'teachers', 'behavior'].includes(filters.state.tab))
const classOptional = computed(() => filters.state.tab !== 'class')

const tabLabel = (tab: ReportTab) => t(`reports.tabs.${tab}`)

// ---- Eksport ----
const exporter = useReportExport()
const busy = exporter.busy
function doExport(format: ExportFormat) {
  const req = filters.request.value
  if (req) void exporter.run(req.type, format, req.params, req.studentId)
}

const print = () => window.print()

onMounted(() => {
  void years.load()
  if (!needsSchool.value) void classes.load()
})
watch(
  () => schoolCtx.schoolId,
  () => {
    filters.state.classId = ''
    filters.state.studentId = ''
    void years.load()
    void classes.load()
  },
)
</script>

<template>
  <PageHeader :title="t('reports.title')" :description="t('reports.description')">
    <template #actions>
      <ReportToolbar
        :can-export="canExport"
        :disabled="!filters.request.value || blocked"
        :busy="busy"
        @export="doExport"
        @print="print"
      />
    </template>
  </PageHeader>

  <div
    role="tablist"
    :aria-label="t('reports.title')"
    class="mb-4 flex gap-1 overflow-x-auto border-b border-border print:hidden"
  >
    <button
      v-for="x in tabs"
      :key="x"
      type="button"
      role="tab"
      :aria-selected="filters.state.tab === x"
      :data-tab="x"
      class="whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
      :class="
        filters.state.tab === x
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-fg-muted hover:text-fg'
      "
      @click="filters.state.tab = x"
    >
      {{ tabLabel(x) }}
    </button>
  </div>

  <NeedsSchool v-if="blocked" />
  <template v-else>
    <div class="card mb-4 space-y-4 p-4 print:hidden">
      <ReportPeriodPicker
        :preset="filters.state.preset"
        :from="filters.state.from"
        :to="filters.state.to"
        :year="years.activeYear.value"
        :error="filters.periodError.value"
        @update:preset="filters.setPreset"
        @update:from="filters.state.from = $event"
        @update:to="filters.state.to = $event"
      />
      <StudentPicker
        v-if="filters.state.tab === 'student'"
        v-model:class-id="filters.state.classId"
        v-model:student-id="filters.state.studentId"
        :class-options="classOptions"
      />
      <BaseSelect
        v-else-if="hasClassFilter"
        v-model="filters.state.classId"
        class="max-w-xs"
        :label="t('students.class')"
        :placeholder="classOptional ? t('students.allClasses') : t('reports.pickClassOption')"
        :options="classOptions"
      />
    </div>

    <template v-if="filters.period.value">
      <ClassReportTab
        v-if="filters.state.tab === 'class'"
        :from="filters.period.value.from"
        :to="filters.period.value.to"
        :class-id="filters.state.classId"
      />
      <StudentReportTab
        v-else-if="filters.state.tab === 'student'"
        :from="filters.period.value.from"
        :to="filters.period.value.to"
        :student-id="filters.state.studentId"
      />
      <TeachersReportTab
        v-else-if="filters.state.tab === 'teachers'"
        :from="filters.period.value.from"
        :to="filters.period.value.to"
        :class-id="filters.state.classId"
      />
      <SchoolReportTab
        v-else-if="filters.state.tab === 'school'"
        :from="filters.period.value.from"
        :to="filters.period.value.to"
      />
      <BehaviorReportTab
        v-else-if="filters.state.tab === 'behavior'"
        :from="filters.period.value.from"
        :to="filters.period.value.to"
        :class-id="filters.state.classId"
      />
      <SchoolsReportTab v-else :from="filters.period.value.from" :to="filters.period.value.to" />
    </template>
    <p v-else-if="!filters.periodError.value" class="text-sm text-fg-muted">
      {{ t('reports.pickPeriod') }}
    </p>
  </template>
</template>
