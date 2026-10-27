<script setup lang="ts" generic="T extends { id: string }">
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-vue-next'
import Skeleton from './Skeleton.vue'

export interface TableColumn {
  key: string
  label: string
  /** th/td ga qo'shimcha klass, masalan "hidden md:table-cell" */
  class?: string
  align?: 'left' | 'right'
  /** Sarlavha bosilganda `sort` hodisasi chiqadi */
  sortable?: boolean
}

withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: T[]
    loading?: boolean
    skeletonRows?: number
    caption?: string
    sortKey?: string
    sortDir?: 'asc' | 'desc'
    /** table-fixed: ustun kengliklari klasslar bilan beriladi, matn kesiladi (gorizontal skroll yo'q) */
    fixed?: boolean
  }>(),
  { loading: false, skeletonRows: 5, fixed: false },
)
const emit = defineEmits<{ sort: [key: string] }>()

const cellValue = (row: T, key: string) => (row as Record<string, unknown>)[key] ?? ''
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-full text-left text-sm" :class="fixed ? 'table-fixed' : ''">
      <caption v-if="caption" class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr class="border-b border-border bg-surface-muted/60">
          <th
            v-for="c in columns"
            :key="c.key"
            scope="col"
            class="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted"
            :class="[c.class, c.align === 'right' ? 'text-right' : '']"
            :aria-sort="
              c.sortable
                ? sortKey === c.key
                  ? sortDir === 'desc'
                    ? 'descending'
                    : 'ascending'
                  : 'none'
                : undefined
            "
          >
            <button
              v-if="c.sortable"
              type="button"
              class="inline-flex items-center gap-1 uppercase tracking-wide hover:text-fg"
              :class="c.align === 'right' ? 'flex-row-reverse' : ''"
              @click="emit('sort', c.key)"
            >
              {{ c.label }}
              <ArrowUp
                v-if="sortKey === c.key && sortDir === 'asc'"
                class="h-3 w-3"
                aria-hidden="true"
              />
              <ArrowDown v-else-if="sortKey === c.key" class="h-3 w-3" aria-hidden="true" />
              <ChevronsUpDown v-else class="h-3 w-3 opacity-40" aria-hidden="true" />
            </button>
            <template v-else>{{ c.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <template v-if="loading && rows.length === 0">
          <tr v-for="n in skeletonRows" :key="`sk-${n}`">
            <td v-for="c in columns" :key="c.key" class="px-4 py-3.5" :class="c.class">
              <slot :name="`skeleton-${c.key}`">
                <Skeleton class="h-4 w-full max-w-[10rem]" />
              </slot>
            </td>
          </tr>
        </template>
        <template v-else>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="transition-colors hover:bg-surface-muted/50"
            :class="loading ? 'opacity-60' : ''"
          >
            <td
              v-for="c in columns"
              :key="c.key"
              class="px-4 py-3 align-middle"
              :class="[c.class, c.align === 'right' ? 'text-right' : '']"
            >
              <slot :name="`cell-${c.key}`" :row="row">
                {{ cellValue(row, c.key) }}
              </slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
