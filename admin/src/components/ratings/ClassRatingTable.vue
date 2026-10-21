<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ClassRatingItem } from '@/api/types'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import RankBadge from './RankBadge.vue'
import RankChange from './RankChange.vue'

const props = defineProps<{ items: ClassRatingItem[]; loading?: boolean }>()
const emit = defineEmits<{ open: [classId: string] }>()
const { t } = useI18n()

type Row = ClassRatingItem & { id: string }
const rows = computed<Row[]>(() => props.items.map((i) => ({ ...i, id: i.classId })))

const columns = computed<TableColumn[]>(() => [
  { key: 'rank', label: t('ratings.rank') },
  { key: 'className', label: t('students.class') },
  { key: 'score', label: t('scoring.score') },
  { key: 'rated', label: t('ratings.rated'), class: 'hidden sm:table-cell' },
  { key: 'change', label: t('ratings.changeCol'), class: 'hidden sm:table-cell' },
])
</script>

<template>
  <BaseTable
    :columns="columns"
    :rows="rows"
    :loading="loading"
    :caption="t('ratings.tabs.classes')"
  >
    <template #cell-rank="{ row }"><RankBadge :rank="row.rank" /></template>
    <template #cell-className="{ row }">
      <button
        type="button"
        class="font-medium text-primary-700 hover:underline"
        :title="t('ratings.openClassStudents')"
        @click="emit('open', row.classId)"
      >
        {{ row.className }}
      </button>
    </template>
    <template #cell-score="{ row }">
      <span class="text-base font-semibold text-fg">{{ row.score }}</span>
    </template>
    <template #cell-rated="{ row }">{{ row.ratedStudents }} / {{ row.totalStudents }}</template>
    <template #cell-change="{ row }"><RankChange :change="row.rankChange" /></template>
  </BaseTable>
</template>
