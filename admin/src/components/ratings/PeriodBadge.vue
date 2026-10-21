<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CalendarRange } from 'lucide-vue-next'
import type { RatingPeriod } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { formatDate, formatDateTime } from '@/utils/format'

defineProps<{ period: RatingPeriod | null; calculatedAt: string | null }>()
const { t } = useI18n()
</script>

<template>
  <div v-if="period" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
    <BaseBadge tone="primary" data-testid="period-label">
      <CalendarRange class="h-3.5 w-3.5" aria-hidden="true" /> {{ period.label }}
    </BaseBadge>
    <span class="text-fg-muted">{{ formatDate(period.from) }} - {{ formatDate(period.to) }}</span>
    <span class="text-xs text-fg-muted">
      {{ t('ratings.calculatedAt') }}:
      {{ calculatedAt ? formatDateTime(calculatedAt) : t('ratings.notCalculated') }}
    </span>
    <span v-if="period.fallback" class="text-xs text-warning">{{ t('ratings.fallbackNote') }}</span>
  </div>
</template>
