<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExamResultRow } from '@/api/types'
import AbsentChips from './AbsentChips.vue'
import ResultTile from './ResultTile.vue'
import type { ClassStat } from './resultsModel'

/** Bitta sinf kartasi: sarlavha (topshirgan/jami, o'rtacha, o'tganlar), o'tdi/o'tmadi chizig'i, o'quvchi kartalari, kirmaganlar */
const props = defineProps<{
  stat: ClassStat
  /** Saralangan, ko'rinadigan (kirgan) o'quvchilar */
  rows: ExamResultRow[]
  absent: string[]
  hasPass: boolean
}>()
const emit = defineEmits<{ open: [key: string] }>()
const { t } = useI18n()

const title = computed(() => props.stat.name || t('examResults.cards.noClass'))
const w = (n: number) => (props.stat.total ? (n / props.stat.total) * 100 : 0)
</script>

<template>
  <section class="card min-w-0 p-3" data-testid="class-card" :data-class="stat.name">
    <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 class="text-base font-semibold" data-testid="class-title">{{ title }}</h2>
      <span class="text-xs text-fg-muted" data-testid="class-submitted">{{
        t('examResults.cards.submittedOf', { n: stat.submitted, total: stat.total })
      }}</span>
      <span class="flex-1" />
      <span class="text-xs text-fg-muted"
        >{{ t('examResults.cards.avg') }}
        <b class="text-fg" data-testid="class-avg">{{
          stat.avg === null ? '—' : stat.avg + '%'
        }}</b></span
      >
      <span v-if="hasPass" class="text-xs text-fg-muted"
        >{{ t('examResults.cards.passed') }}
        <b class="text-success" data-testid="class-passed">{{ stat.passed }}</b></span
      >
    </div>
    <div
      v-if="hasPass"
      class="mb-2 flex h-2 overflow-hidden rounded-full bg-surface-muted"
      aria-hidden="true"
    >
      <span class="bg-success" :style="{ width: w(stat.passed) + '%' }" />
      <span class="bg-danger/70" :style="{ width: w(stat.failed) + '%' }" />
    </div>
    <div v-if="rows.length" class="grid gap-1.5 sm:grid-cols-2">
      <ResultTile v-for="r in rows" :key="r.key" :row="r" @open="emit('open', $event)" />
    </div>
    <AbsentChips :names="absent" :class="rows.length ? 'mt-2' : ''" />
  </section>
</template>
