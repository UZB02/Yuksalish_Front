<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string
  min: number
  max: number
  quick: number[]
  disabled?: boolean
  invalid?: boolean
  /** Enter bilan keyingi o'quvchiga o'tish uchun tartib raqami */
  index?: number
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; enter: [] }>()
const { t } = useI18n()

const sliderValue = computed(() => {
  const n = Number(props.modelValue)
  return props.modelValue.trim() !== '' && Number.isFinite(n)
    ? Math.min(props.max, Math.max(props.min, n))
    : props.min
})
const filled = computed(() => props.modelValue.trim() !== '')
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-3">
      <input
        type="number"
        inputmode="numeric"
        :min="min"
        :max="max"
        step="1"
        :value="modelValue"
        :disabled="disabled"
        :data-score-input="index"
        :aria-label="label ?? t('scoring.score')"
        :aria-invalid="invalid"
        placeholder="-"
        class="h-11 w-20 shrink-0 rounded-lg border bg-surface px-2 text-center text-lg font-semibold text-fg focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
        :class="invalid ? 'border-danger' : 'border-border'"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('enter')"
      />
      <input
        type="range"
        :min="min"
        :max="max"
        step="1"
        :value="sliderValue"
        :disabled="disabled"
        :aria-label="`${label ?? t('scoring.score')} (${t('scoring.slider')})`"
        class="h-2 min-w-0 flex-1 cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
        :class="filled ? '' : 'opacity-50'"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="q in quick"
        :key="q"
        type="button"
        :disabled="disabled"
        class="h-8 min-w-[2.5rem] rounded-md border border-border px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
        :class="
          modelValue.trim() === String(q)
            ? '!border-primary-500 !bg-primary-50 !text-primary-700'
            : ''
        "
        @click="emit('update:modelValue', String(q))"
      >
        {{ q }}
      </button>
    </div>
  </div>
</template>
