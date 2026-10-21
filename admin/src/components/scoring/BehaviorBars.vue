<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BehaviorBreakdown } from '@/api/types'

const props = defineProps<{ items: BehaviorBreakdown[] }>()
const { t } = useI18n()

const sorted = computed(() => [...props.items].sort((a, b) => b.count - a.count))
const max = computed(() => Math.max(1, ...props.items.map((i) => i.count)))
</script>

<template>
  <p v-if="items.length === 0" class="py-6 text-center text-sm text-fg-muted">
    {{ t('profile2.noBehaviors') }}
  </p>
  <ul v-else class="space-y-3">
    <li v-for="b in sorted" :key="b.behaviorTypeId ?? 'none'">
      <div class="mb-1 flex items-center justify-between text-sm">
        <span class="text-fg">{{ b.name }}</span>
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
