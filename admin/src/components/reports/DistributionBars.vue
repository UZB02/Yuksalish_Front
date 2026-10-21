<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface BarItem {
  key?: string
  name: string
  count: number
  color: string
}
const props = defineProps<{ items: BarItem[]; empty?: string }>()
const { t } = useI18n()

const sorted = computed(() => [...props.items].sort((a, b) => b.count - a.count))
const max = computed(() => Math.max(1, ...props.items.map((i) => i.count)))
</script>

<template>
  <p v-if="items.length === 0" class="py-6 text-center text-sm text-fg-muted">
    {{ empty ?? t('profile2.noBehaviors') }}
  </p>
  <ul v-else class="space-y-3" data-testid="distribution-bars">
    <li v-for="(b, i) in sorted" :key="b.key ?? `${b.name}-${i}`">
      <div class="mb-1 flex items-center justify-between gap-2 text-sm">
        <span class="min-w-0 truncate text-fg">{{ b.name }}</span>
        <span class="font-medium text-fg">{{ b.count }}</span>
      </div>
      <div
        class="h-2.5 overflow-hidden rounded-full bg-surface-muted"
        role="img"
        :aria-label="`${b.name}: ${b.count}`"
      >
        <div
          class="h-full rounded-full"
          :style="{ width: `${(b.count / max) * 100}%`, backgroundColor: b.color }"
        />
      </div>
    </li>
  </ul>
</template>
