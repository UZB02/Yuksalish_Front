<script setup lang="ts">
import { Medal } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{ rank: number | null }>()
const { t } = useI18n()
const colors = ['#f59e0b', '#94a3b8', '#b45309']
</script>

<template>
  <span class="inline-flex w-9 items-center justify-center font-semibold text-fg">
    <Medal
      v-if="rank !== null && rank <= 3"
      class="h-5 w-5"
      :style="{ color: colors[rank - 1] }"
      :aria-label="t('ratings.place', { n: rank })"
      role="img"
    />
    <template v-else>{{ rank ?? '-' }}</template>
  </span>
</template>
