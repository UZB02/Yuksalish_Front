<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ResultFilter } from './resultsModel'

/** Filtr kataklari qatori (bosilganda ro'yxatni filtrlaydi; tanlangani pastidan chiziq) */
const props = defineProps<{
  active: ResultFilter
  submitted: number
  participants: number
  ok: number
  no: number
  terminated: number
  absent: number
  essay: number
  /** O'tish bali belgilangan: "O'tdi/O'tmadi" kataklari ko'rinadi */
  hasPass: boolean
}>()
const emit = defineEmits<{ filter: [key: ResultFilter] }>()
const { t } = useI18n()

const cells = computed(() => {
  const all: { key: ResultFilter; label: string; value: string | number; tone: string }[] = [
    {
      key: 'all',
      label: 'all',
      value: `${props.submitted} / ${props.participants}`,
      tone: 'text-fg',
    },
  ]
  if (props.hasPass) {
    all.push({ key: 'ok', label: 'ok', value: props.ok, tone: 'text-success' })
    all.push({ key: 'no', label: 'no', value: props.no, tone: 'text-danger' })
  }
  all.push({ key: 't', label: 'terminated', value: props.terminated, tone: 'text-warning' })
  all.push({ key: 'n', label: 'absent', value: props.absent, tone: 'text-fg-muted' })
  all.push({ key: 'ep', label: 'essay', value: props.essay, tone: 'text-warning' })
  return all
})
</script>

<template>
  <div
    class="card mb-3 grid overflow-hidden"
    :class="cells.length === 6 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4'"
    role="group"
    :aria-label="t('examResults.strip.aria')"
    data-testid="results-strip"
  >
    <button
      v-for="c in cells"
      :key="c.key"
      type="button"
      class="-mb-px -mr-px border-b border-r border-border px-3 py-2 text-left hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 sm:px-4"
      :class="active === c.key ? 'bg-primary-50' : ''"
      :style="
        active === c.key ? { boxShadow: 'inset 0 -3px 0 rgb(var(--primary-600))' } : undefined
      "
      :aria-pressed="active === c.key"
      :data-testid="`strip-${c.key}`"
      @click="emit('filter', c.key)"
    >
      <span class="block truncate text-xs text-fg-muted">{{
        t(`examResults.strip.${c.label}`)
      }}</span>
      <span
        class="block text-xl font-semibold leading-7 tabular-nums"
        :class="c.tone"
        data-testid="strip-value"
        >{{ c.value }}</span
      >
    </button>
  </div>
</template>
