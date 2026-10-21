<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StudentRatingItem } from '@/api/types'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import RankBadge from './RankBadge.vue'
import RankChange from './RankChange.vue'

const props = defineProps<{
  items: StudentRatingItem[]
  loading?: boolean
  minDays?: number
}>()
const { t } = useI18n()

type Row = StudentRatingItem & { id: string }
const rows = computed<Row[]>(() => props.items.map((i) => ({ ...i, id: i.studentId })))

// Jarima ustuni faqat kamida bitta qatorda jarima > 0 bo'lsa ko'rinadi
const hasPenalty = computed(() => props.items.some((i) => (i.penalty ?? 0) > 0))

const columns = computed<TableColumn[]>(() => [
  { key: 'rank', label: t('ratings.rank') },
  { key: 'fullName', label: t('common.fullName') },
  { key: 'className', label: t('students.class'), class: 'hidden sm:table-cell' },
  { key: 'score', label: t('scoring.score') },
  ...(hasPenalty.value
    ? [{ key: 'penalty', label: t('ratings.penalty'), class: 'hidden sm:table-cell' }]
    : []),
  { key: 'daysCount', label: t('ratings.daysCount'), class: 'hidden md:table-cell' },
  { key: 'change', label: t('ratings.changeCol'), class: 'hidden sm:table-cell' },
])
</script>

<template>
  <BaseTable
    :columns="columns"
    :rows="rows"
    :loading="loading"
    :caption="t('ratings.tabs.students')"
  >
    <template #cell-rank="{ row }">
      <RankBadge :rank="row.eligible ? row.rank : null" />
    </template>
    <template #cell-fullName="{ row }">
      <RouterLink
        :to="{ name: 'student-profile', params: { id: row.studentId } }"
        class="font-medium hover:underline"
        :class="row.eligible ? 'text-fg' : 'text-fg-muted'"
      >
        {{ row.fullName }}
      </RouterLink>
      <p v-if="!row.eligible" class="text-xs text-fg-muted" data-testid="ineligible">
        {{ t('ratings.notEnough', { n: row.daysCount, m: minDays ?? '?' }) }}
      </p>
    </template>
    <template #cell-className="{ row }">{{ row.className }}</template>
    <template #cell-penalty="{ row }">
      <span
        v-if="(row.penalty ?? 0) > 0"
        class="font-medium text-danger"
        :title="t('ratings.penaltyHint')"
        data-testid="penalty"
      >
        -{{ row.penalty }}
      </span>
      <span v-else class="text-fg-muted">-</span>
    </template>
    <template #cell-score="{ row }">
      <span class="text-base font-semibold" :class="row.eligible ? 'text-fg' : 'text-fg-muted'">
        {{ row.score }}
      </span>
    </template>
    <template #cell-daysCount="{ row }">{{ row.daysCount }}</template>
    <template #cell-change="{ row }">
      <RankChange v-if="row.eligible" :change="row.rankChange" />
      <span v-else class="text-fg-muted">-</span>
    </template>
  </BaseTable>
</template>
