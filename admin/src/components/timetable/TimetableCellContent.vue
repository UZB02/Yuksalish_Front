<script setup lang="ts">
import { computed } from 'vue'
import { Ban, TriangleAlert } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { TimetableWarning } from '@/api/timetable.api'
import { severityOf, type CellValue } from '@/utils/timetable'

/** Bitta katak mazmuni: fan, o'qituvchi, xona va ogohlantirish belgisi */
const props = defineProps<{
  cell?: CellValue
  warnings?: TimetableWarning[]
  outOfRange?: boolean
}>()
const { t } = useI18n()

const severity = computed(() => severityOf(props.warnings))
const title = computed(() => (props.warnings ?? []).map((w) => w.message).join('\n'))
</script>

<template>
  <div v-if="cell" class="min-w-0 text-left" :title="title || undefined">
    <div class="flex items-start gap-1">
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-fg">
        {{ cell.subjectName ?? '?' }}
      </span>
      <Ban
        v-if="severity === 'error'"
        class="mt-0.5 h-4 w-4 shrink-0 text-danger"
        :aria-label="t('timetable.legend.doubleBooked')"
        data-testid="cell-error"
      />
      <TriangleAlert
        v-else-if="severity === 'warning'"
        class="mt-0.5 h-4 w-4 shrink-0 text-warning"
        :aria-label="t('timetable.legend.warning')"
        data-testid="cell-warning"
      />
    </div>
    <div class="truncate text-xs text-fg-muted">{{ cell.teacherName ?? '?' }}</div>
    <div v-if="cell.room" class="text-xs text-fg-muted">
      {{ t('timetable.room') }}: {{ cell.room }}
    </div>
    <div v-if="outOfRange" class="text-xs font-medium text-danger" data-testid="cell-out-of-range">
      {{ t('timetable.outOfRange') }}
    </div>
  </div>
</template>
