<script setup lang="ts" generic="T extends { id: string }">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import { sortRows, type SortDir } from '@/utils/reports'

export interface ReportColumn<R> extends TableColumn {
  /** Saralash qiymati; berilmasa ustun saralanmaydi */
  sortValue?: (row: R) => string | number | null | undefined
}

const props = withDefaults(
  defineProps<{
    columns: ReportColumn<T>[]
    rows: T[]
    loading?: boolean
    caption?: string
    defaultSort?: { key: string; dir: SortDir }
    pageSize?: number
  }>(),
  { pageSize: 50 },
)
const { t } = useI18n()

const sortKey = ref(props.defaultSort?.key ?? '')
const sortDir = ref<SortDir>(props.defaultSort?.dir ?? 'asc')
const shown = ref(props.pageSize)

const tableColumns = computed<TableColumn[]>(() =>
  props.columns.map((c) => ({ ...c, sortable: !!c.sortValue })),
)
const sorted = computed(() => {
  const col = props.columns.find((c) => c.key === sortKey.value)
  return col?.sortValue ? sortRows(props.rows, col.sortValue, sortDir.value) : props.rows
})
const visible = computed(() => sorted.value.slice(0, shown.value))

const cellOf = (row: T, key: string) => (row as Record<string, unknown>)[key] ?? ''

function onSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}
</script>

<template>
  <div>
    <BaseTable
      :columns="tableColumns"
      :rows="visible"
      :loading="loading"
      :caption="caption"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      @sort="onSort"
    >
      <template v-for="c in columns" :key="c.key" #[`cell-${c.key}`]="{ row }">
        <slot :name="`cell-${c.key}`" :row="row">{{ cellOf(row, c.key) }}</slot>
      </template>
    </BaseTable>
    <div
      v-if="sorted.length > shown"
      class="flex items-center justify-between gap-2 border-t border-border p-3 text-sm print:hidden"
    >
      <span class="text-fg-muted">{{
        t('reports.shown', { n: shown, total: sorted.length })
      }}</span>
      <BaseButton variant="secondary" size="sm" @click="shown += pageSize">
        {{ t('reports.showMore') }}
      </BaseButton>
    </div>
  </div>
</template>
