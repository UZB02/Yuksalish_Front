<script setup lang="ts">
import type { Tone } from '@/utils/reports'

export interface StatItem {
  key: string
  label: string
  value: string | number
  tone?: Tone
  hint?: string
}
defineProps<{ items: StatItem[] }>()

const toneClass: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-fg',
}
</script>

<template>
  <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="stat-cards">
    <div v-for="i in items" :key="i.key" class="card p-4" :data-stat="i.key">
      <dt class="text-xs text-fg-muted">{{ i.label }}</dt>
      <dd class="mt-1 text-2xl font-semibold" :class="toneClass[i.tone ?? 'neutral']">
        {{ i.value }}
      </dd>
      <p v-if="i.hint" class="mt-0.5 text-xs text-fg-muted">{{ i.hint }}</p>
    </div>
  </dl>
</template>
