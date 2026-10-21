<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Minus } from 'lucide-vue-next'

const props = defineProps<{ change: number | null | undefined }>()
const { t } = useI18n()

const kind = computed<'up' | 'down' | 'same' | 'none'>(() => {
  const c = props.change
  if (c === null || c === undefined) return 'none'
  return c > 0 ? 'up' : c < 0 ? 'down' : 'same'
})
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5 text-sm font-medium"
    :class="{
      'text-success': kind === 'up',
      'text-danger': kind === 'down',
      'text-fg-muted': kind === 'same' || kind === 'none',
    }"
    :data-kind="kind"
    :aria-label="
      kind === 'up'
        ? t('ratings.change.up', { n: change })
        : kind === 'down'
          ? t('ratings.change.down', { n: Math.abs(change ?? 0) })
          : t('ratings.change.none')
    "
  >
    <ArrowUp v-if="kind === 'up'" class="h-4 w-4" aria-hidden="true" />
    <ArrowDown v-else-if="kind === 'down'" class="h-4 w-4" aria-hidden="true" />
    <Minus v-else class="h-4 w-4" aria-hidden="true" />
    <span v-if="kind === 'up' || kind === 'down'">{{ Math.abs(change ?? 0) }}</span>
  </span>
</template>
