<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseInput from '@/components/ui/BaseInput.vue'
import { presetOptions, type PeriodError, type YearLike } from '@/utils/reports'
import { todayTashkent } from '@/utils/scoring'

const props = defineProps<{
  preset: string
  from: string
  to: string
  year: YearLike | null
  error: PeriodError | null
}>()
const emit = defineEmits<{
  'update:preset': [value: string]
  'update:from': [value: string]
  'update:to': [value: string]
}>()
const { t } = useI18n()

const today = todayTashkent()
const options = computed(() =>
  presetOptions(props.year).map((o) => ({
    value: o.value,
    label: o.labelKey ? t(`reports.presets.${o.labelKey}`) : (o.label ?? o.value),
  })),
)
</script>

<template>
  <div class="space-y-3" data-testid="period-picker">
    <div role="radiogroup" :aria-label="t('reports.periodLabel')" class="flex flex-wrap gap-2">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="radio"
        :aria-checked="preset === o.value"
        :data-preset="o.value"
        class="rounded-full border px-3 py-1.5 text-sm transition-colors"
        :class="
          preset === o.value
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-border bg-surface text-fg hover:bg-surface-muted'
        "
        @click="emit('update:preset', o.value)"
      >
        {{ o.label }}
      </button>
    </div>
    <div v-if="preset === 'custom'" class="grid max-w-md gap-3 sm:grid-cols-2">
      <BaseInput
        :model-value="from"
        type="date"
        :label="t('scores.from')"
        :max="to || today"
        data-testid="period-from"
        @update:model-value="emit('update:from', $event)"
      />
      <BaseInput
        :model-value="to"
        type="date"
        :label="t('scores.to')"
        :min="from || undefined"
        :max="today"
        data-testid="period-to"
        @update:model-value="emit('update:to', $event)"
      />
    </div>
    <p v-if="error" class="text-sm text-danger" role="alert" data-testid="period-error">
      {{ t(`reports.periodErrors.${error}`) }}
    </p>
  </div>
</template>
