<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { timetableApi } from '@/api/timetable.api'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import TeacherWeekPanel from '@/components/timetable/TeacherWeekPanel.vue'
import TimetableExportMenu from '@/components/timetable/TimetableExportMenu.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useTeacherWeek } from '@/composables/useTeacherWeek'
import { useTimetableExport } from '@/composables/useTimetableExport'
import type { ExportFormat } from '@/api/types'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'

/** O'qituvchining o'z haftalik jadvali */
const { t } = useI18n()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()
const w = useTeacherWeek((d) => timetableApi.myWeek(d))
const error = computed(() => (w.error.value ? errorMessage(w.error.value, t) : ''))

// Yuklab olish: ko'rinib turgan hafta sanasi bo'yicha
const exporter = useTimetableExport()
const exportWeek = (format: string) =>
  exporter.run(() => timetableApi.exportMine(format as ExportFormat, w.week.value?.from))

onMounted(() => {
  if (!needsSchool.value) void w.load()
})
watch(
  () => schoolCtx.schoolId,
  () => !needsSchool.value && void w.load(),
)
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <PageHeader :title="t('timetable.myTitle')" :description="t('timetable.myDescription')">
      <template #actions>
        <TimetableExportMenu :busy="exporter.busy.value" @select="exportWeek" />
      </template>
    </PageHeader>
    <TeacherWeekPanel
      :week="w.week.value"
      :loading="w.loading.value"
      :error="error"
      @prev="w.shift(-1)"
      @next="w.shift(1)"
      @today="w.goToday()"
      @retry="w.load()"
    />
  </template>
</template>
