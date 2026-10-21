<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LiveCounts } from '@/composables/useAttendanceSheet'
import { CATEGORY_COLORS } from '@/utils/attendance'

const props = defineProps<{ counts: LiveCounts }>()
const { t } = useI18n()

const items = computed(() => [
  { key: 'present', n: props.counts.present, color: CATEGORY_COLORS.present },
  { key: 'late', n: props.counts.late, color: CATEGORY_COLORS.late },
  { key: 'absent', n: props.counts.absent, color: CATEGORY_COLORS.absent_unexcused },
  { key: 'unmarked', n: props.counts.unmarked, color: '#64748b' },
])
</script>

<template>
  <ul
    class="flex flex-wrap gap-2 text-sm"
    :aria-label="t('attendance.stats.label')"
    data-testid="stats"
  >
    <li
      v-for="i in items"
      :key="i.key"
      class="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5"
      :data-stat="i.key"
    >
      <span
        class="h-2.5 w-2.5 rounded-full"
        :style="{ backgroundColor: i.color }"
        aria-hidden="true"
      />
      <span class="text-fg-muted">{{ t(`attendance.stats.${i.key}`) }}</span>
      <b class="tabular-nums text-fg">{{ i.n }}</b>
    </li>
  </ul>
</template>
