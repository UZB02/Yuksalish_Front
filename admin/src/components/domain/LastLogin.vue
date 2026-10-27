<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { relativeTime } from '@/utils/audit'
import { formatDateTime } from '@/utils/format'

const props = defineProps<{ value: string | null | undefined }>()
const { t } = useI18n()

const exact = computed(() => formatDateTime(props.value))
const text = computed(() => {
  if (!props.value || !exact.value) return t('common.never')
  const r = relativeTime(props.value, Date.now(), Infinity)
  return r ? t(`audit.rel.${r.unit}`, { n: r.n }) : exact.value
})
</script>

<template>
  <time
    v-if="value && exact"
    :datetime="value"
    :title="exact"
    class="whitespace-nowrap text-sm text-fg"
  >
    {{ text }}
  </time>
  <span v-else class="whitespace-nowrap text-sm text-fg-muted">{{ text }}</span>
</template>
