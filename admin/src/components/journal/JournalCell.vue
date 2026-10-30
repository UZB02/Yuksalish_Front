<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { JournalCellData } from '@/api/journal.api'
import { ABSENCE_CLASS, GRADE_CLASS, absenceKey, fmtDate } from './journal.utils'

/**
 * Jurnal katagi (faqat ko'rish). 2-bosqichda tahrirlash uchun `interactive` va `select` hodisasi
 * tayyor: katak bosilganda sana + mavjud baho (gradeId) bilan chaqiriladi.
 */
const props = defineProps<{
  cell?: JournalCellData
  date: string
  studentName?: string
  today?: boolean
  interactive?: boolean
  /** Dars raqami (0 - ish kuni ustuni) */
  lessonNo?: number
  cancelled?: boolean
}>()
const emit = defineEmits<{
  select: [payload: { date: string; lessonNo: number; cell?: JournalCellData }]
}>()

const { t } = useI18n()

const absence = computed(() => props.cell?.absence)
const markAbsence = computed(() =>
  absence.value === 'N' || absence.value === 'B' ? absence.value : null,
)

const tooltip = computed(() => {
  const parts: string[] = [fmtDate(props.date)]
  if ((props.lessonNo ?? 0) > 0) parts.push(t('journal.lessonLong', { n: props.lessonNo }))
  if (props.cancelled) parts.push(t('journal.cancelledLesson'))
  if (props.cell?.grade !== undefined)
    parts.push(t('journal.tooltip.grade', { n: props.cell.grade }))
  if (absence.value) parts.push(t(absenceKey(absence.value)))
  return parts.join(' · ')
})

const tone = computed(() => {
  if (props.cell?.grade !== undefined) return GRADE_CLASS[props.cell.grade]
  if (markAbsence.value) return ABSENCE_CLASS[markAbsence.value]
  if (props.cancelled) return 'bg-surface-muted opacity-60'
  return props.today ? 'bg-primary-50' : ''
})
</script>

<template>
  <td
    class="relative h-9 w-9 min-w-9 border-b border-r border-border p-0 text-center align-middle text-sm"
    :class="[
      tone,
      interactive ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary-500' : '',
    ]"
    :title="tooltip"
    :data-date="date"
    :data-lesson="lessonNo || undefined"
    :data-cancelled="cancelled ? 'true' : undefined"
    :data-grade="cell?.grade"
    :data-absence="absence"
    :data-today="today ? 'true' : undefined"
    @click="interactive && emit('select', { date, lessonNo: lessonNo ?? 0, cell })"
  >
    <span v-if="cell?.grade !== undefined" class="font-semibold">{{ cell.grade }}</span>
    <span v-else-if="markAbsence" class="text-xs font-semibold">{{ markAbsence }}</span>
    <!-- Baho bilan birga yo'qlik: kichik belgi -->
    <span
      v-if="cell?.grade !== undefined && markAbsence"
      class="absolute left-0.5 top-0 text-[9px] font-bold leading-none"
      :class="ABSENCE_CLASS[markAbsence]"
      data-testid="absence-mark"
    >
      {{ markAbsence }}
    </span>
    <!-- Dars rejimida qisman yo'qlik -->
    <span
      v-if="absence === 'partial'"
      class="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-fg-muted"
      data-testid="partial-dot"
      :aria-label="t('journal.absence.partial')"
    />
  </td>
</template>
