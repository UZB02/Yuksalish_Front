<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { BehaviorType } from '@/api/types'
import { withAlpha } from '@/utils/scoring'

defineProps<{
  types: BehaviorType[]
  modelValue: string | null
  disabled?: boolean
  invalid?: boolean
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const { t } = useI18n()
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label ?? t('scoring.behaviorType')"
    :aria-invalid="invalid"
    class="flex flex-wrap gap-1.5"
  >
    <button
      v-for="b in types"
      :key="b.id"
      type="button"
      role="radio"
      :aria-checked="modelValue === b.id"
      :disabled="disabled"
      class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      :class="invalid && !modelValue ? 'ring-1 ring-danger' : ''"
      :style="{
        borderColor: b.color,
        backgroundColor: modelValue === b.id ? withAlpha(b.color, 0.22) : 'transparent',
      }"
      :title="t(`scoring.kinds.${b.kind}`)"
      @click="emit('update:modelValue', modelValue === b.id ? null : b.id)"
    >
      <Check v-if="modelValue === b.id" class="h-3 w-3" aria-hidden="true" />
      <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: b.color }" aria-hidden="true" />
      <span class="text-fg">{{ b.name }}</span>
    </button>
  </div>
</template>
