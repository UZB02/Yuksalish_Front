<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RatingWeights } from '@/api/types'
import BaseInput from '@/components/ui/BaseInput.vue'

// Reyting tarkibi: xulq bahosi va fan baholari ulushlari (butun sonlar, yig'indisi 100).
// Birini o'zgartirsangiz, ikkinchisi avtomatik to'ldiriladi.
const props = defineProps<{
  modelValue: RatingWeights
  disabled?: boolean
  error?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: RatingWeights] }>()
const { t } = useI18n()

function onInput(field: keyof RatingWeights, raw: string) {
  const other: keyof RatingWeights = field === 'conduct' ? 'subjects' : 'conduct'
  if (raw === '') {
    emit('update:modelValue', { ...props.modelValue, [field]: NaN })
    return
  }
  const n = Number(raw)
  const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.trunc(n))) : 0
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: clamped,
    [other]: 100 - clamped,
  })
}
const show = (v: number) => (Number.isNaN(v) ? '' : v)
</script>

<template>
  <div class="space-y-2" data-testid="rating-weights">
    <div class="grid gap-3 sm:grid-cols-2">
      <BaseInput
        :model-value="show(modelValue.conduct)"
        type="number"
        inputmode="numeric"
        min="0"
        max="100"
        :label="t('settingsRating.weights.conduct')"
        :disabled="disabled"
        @update:model-value="onInput('conduct', $event)"
      />
      <BaseInput
        :model-value="show(modelValue.subjects)"
        type="number"
        inputmode="numeric"
        min="0"
        max="100"
        :label="t('settingsRating.weights.subjects')"
        :disabled="disabled"
        @update:model-value="onInput('subjects', $event)"
      />
    </div>
    <p class="text-xs text-fg-muted">{{ t('settingsRating.weights.formula') }}</p>
    <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
  </div>
</template>
