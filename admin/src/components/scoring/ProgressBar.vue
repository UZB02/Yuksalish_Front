<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{ done: number; total: number; labelKey?: string }>(), {
  labelKey: 'scoring.progress',
})
const { t } = useI18n()
const pct = computed(() => (props.total ? Math.round((props.done / props.total) * 100) : 0))
</script>

<template>
  <div class="space-y-1">
    <div class="flex justify-between text-xs text-fg-muted">
      <span>{{ t(labelKey, { done, total }) }}</span>
      <span>{{ pct }}%</span>
    </div>
    <div
      class="h-1.5 overflow-hidden rounded-full bg-surface-muted"
      role="progressbar"
      :aria-valuenow="pct"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="t('scoring.progressLabel')"
    >
      <div class="h-full rounded-full bg-success transition-all" :style="{ width: `${pct}%` }" />
    </div>
  </div>
</template>
