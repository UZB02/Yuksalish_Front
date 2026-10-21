<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SchoolRatingItem } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import RankBadge from './RankBadge.vue'

const props = defineProps<{ items: SchoolRatingItem[]; loading?: boolean }>()
const { t } = useI18n()

type Row = SchoolRatingItem & { id: string }
const rows = computed<Row[]>(() => props.items.map((i) => ({ ...i, id: i.schoolId })))

const columns = computed<TableColumn[]>(() => [
  { key: 'rank', label: t('ratings.rank') },
  { key: 'name', label: t('ratings.school') },
  { key: 'score', label: t('scoring.score') },
  { key: 'rated', label: t('ratings.rated'), class: 'hidden sm:table-cell' },
  { key: 'enabled', label: t('ratings.inPublic') },
])
</script>

<template>
  <BaseTable
    :columns="columns"
    :rows="rows"
    :loading="loading"
    :caption="t('ratings.tabs.schools')"
  >
    <template #cell-rank="{ row }"><RankBadge :rank="row.rank" /></template>
    <template #cell-name="{ row }"
      ><span class="font-medium text-fg">{{ row.name }}</span></template
    >
    <template #cell-score="{ row }">
      <span class="text-base font-semibold text-fg">{{ row.score }}</span>
    </template>
    <template #cell-rated="{ row }">{{ row.ratedStudents }} / {{ row.totalStudents }}</template>
    <template #cell-enabled="{ row }">
      <BaseBadge :tone="row.enabled ? 'success' : 'neutral'">
        {{ row.enabled ? t('settings.yes') : t('settings.no') }}
      </BaseBadge>
    </template>
  </BaseTable>
</template>
