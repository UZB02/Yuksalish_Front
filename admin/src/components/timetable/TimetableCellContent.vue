<script setup lang="ts">
import { computed } from 'vue'
import { CircleX, Link2, TriangleAlert } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { severityOf, type CellValue } from '@/utils/timetable'
import { cellIssueSummary, issueTooltip, type TimetableIssue } from '@/utils/timetableIssues'
import { formatDate } from '@/utils/format'

/** Bitta katak mazmuni: fan, o'qituvchi, xona va muammo belgisi */
const props = defineProps<{
  /** Bitta dars (katakda bir nechta dars bo'lsa har biri uchun alohida ko'rsatiladi) */
  cell?: CellValue
  issues?: TimetableIssue[]
  outOfRange?: boolean
}>()
const { t } = useI18n()

const severity = computed(() => severityOf(props.issues))
const title = computed(() =>
  issueTooltip((props.issues ?? []).filter((i) => i.severity !== 'info')),
)
/** "Bir vaqtda o'tish ruxsat etilgan — {approver}, {date}" */
const overlapTitle = computed(() => {
  const c = props.cell
  if (!c?.overlapApproved) return ''
  if (!c.overlapApprovedBy && !c.overlapApprovedAt) return t('timetable.overlap.badge')
  return t('timetable.overlap.badgeBy', {
    approver: c.overlapApprovedBy ?? '?',
    date: c.overlapApprovedAt ? formatDate(c.overlapApprovedAt) : '',
  })
})
const summary = computed(() => cellIssueSummary(props.issues, t))
</script>

<template>
  <div v-if="cell" class="min-w-0 text-left" :title="title || undefined">
    <div class="flex items-start gap-1">
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-fg">
        {{ cell.subjectName ?? '?' }}
      </span>
      <CircleX
        v-if="severity === 'error'"
        class="mt-0.5 h-4 w-4 shrink-0 text-danger"
        aria-hidden="true"
        data-testid="cell-error"
      />
      <TriangleAlert
        v-else-if="severity === 'warning'"
        class="mt-0.5 h-4 w-4 shrink-0 text-warning"
        aria-hidden="true"
        data-testid="cell-warning"
      />
      <span
        v-if="cell.overlapApproved"
        class="mt-0.5 shrink-0"
        role="img"
        :title="overlapTitle"
        :aria-label="overlapTitle"
        data-testid="cell-overlap"
      >
        <Link2 class="h-4 w-4 text-fg-muted" aria-hidden="true" />
      </span>
    </div>
    <div class="truncate text-xs text-fg-muted">{{ cell.teacherName ?? '?' }}</div>
    <div v-if="cell.room" class="text-xs text-fg-muted">
      {{ t('timetable.room') }}: {{ cell.room }}
    </div>
    <div v-if="outOfRange" class="text-xs font-medium text-warning" data-testid="cell-out-of-range">
      {{ t('timetable.outOfRange') }}
    </div>
    <span v-if="summary" class="sr-only" data-testid="cell-summary">{{ summary }}</span>
  </div>
</template>
