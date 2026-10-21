<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BaseInput from './BaseInput.vue'

const PALETTE = [
  '#16a34a',
  '#65a30d',
  '#d97706',
  '#ea580c',
  '#dc2626',
  '#e11d48',
  '#7c3aed',
  '#2563eb',
  '#0284c7',
  '#64748b',
]

const props = defineProps<{ modelValue: string; error?: string; label?: string }>()
// Foydalanuvchi har qanday o'zgartirishi shu hodisa orqali keladi (palitra, rang tanlagich, hex)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

const valid = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c)
const selected = (c: string) => props.modelValue.toLowerCase() === c
</script>

<template>
  <fieldset>
    <legend class="mb-1.5 text-sm font-medium text-fg">
      {{ label ?? t('behaviorTypes.color') }}
    </legend>
    <div
      class="flex flex-wrap items-center gap-2"
      role="radiogroup"
      :aria-label="label ?? t('behaviorTypes.color')"
    >
      <button
        v-for="c in PALETTE"
        :key="c"
        type="button"
        role="radio"
        :aria-checked="selected(c)"
        :aria-label="c"
        class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-transparent text-white"
        :class="selected(c) ? '!border-fg' : ''"
        :style="{ backgroundColor: c }"
        @click="emit('update:modelValue', c)"
      >
        <Check v-if="selected(c)" class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div class="mt-2 flex items-center gap-2">
      <input
        type="color"
        :value="valid(modelValue) ? modelValue : '#000000'"
        :aria-label="t('behaviorTypes.pickColor')"
        class="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface p-1"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <BaseInput
        :model-value="modelValue"
        class="w-36"
        placeholder="#16a34a"
        :aria-label="t('behaviorTypes.hex')"
        :error="error"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
  </fieldset>
</template>
