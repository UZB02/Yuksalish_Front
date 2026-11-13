<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { GRADE_VALUES } from '@/utils/grades'

// Tezkor 2/3/4/5 tugmalari: telefonda bosish oson bo'lishi uchun katta (h-12) va 4 ustunli.
const props = defineProps<{
  modelValue: number | null
  disabled?: boolean
  invalid?: boolean
  name?: string
}>()
// Tanlangan bahoni qayta bosish uni bekor qiladi (null).
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()
const pick = (v: number) => emit('update:modelValue', props.modelValue === v ? null : v)
const { t } = useI18n()

const ACTIVE: Record<number, string> = {
  5: 'border-success bg-success-soft text-success ring-1 ring-success',
  4: 'border-primary-600 bg-primary-100 text-primary-700 ring-1 ring-primary-600',
  3: 'border-warning bg-warning-soft text-warning ring-1 ring-warning',
  2: 'border-danger bg-danger-soft text-danger ring-1 ring-danger',
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="name ? t('grading.gradeFor', { name }) : t('grading.grade')"
    class="grid grid-cols-4 gap-2"
  >
    <button
      v-for="v in GRADE_VALUES"
      :key="v"
      type="button"
      role="radio"
      :aria-checked="modelValue === v"
      :disabled="disabled"
      class="h-12 rounded-lg border text-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      :class="
        modelValue === v
          ? ACTIVE[v]
          : invalid
            ? 'border-danger/60 text-fg hover:bg-surface-muted'
            : 'border-border text-fg hover:bg-surface-muted'
      "
      :data-grade="v"
      :title="modelValue === v ? t('grading.clearHint') : undefined"
      @click="pick(v)"
    >
      {{ v }}
    </button>
  </div>
</template>
