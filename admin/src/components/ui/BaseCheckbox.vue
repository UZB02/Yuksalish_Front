<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  modelValue: boolean
  label?: string
  description?: string
  disabled?: boolean
  indeterminate?: boolean
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const id = useId()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="flex items-start gap-3">
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      :indeterminate.prop="indeterminate"
      :disabled="disabled"
      :aria-label="ariaLabel"
      class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary-600 disabled:cursor-not-allowed"
      @change="onChange"
    />
    <label
      v-if="label"
      :for="id"
      class="text-sm"
      :class="disabled ? 'cursor-not-allowed text-fg-muted' : 'cursor-pointer text-fg'"
    >
      {{ label }}
      <span v-if="description" class="block text-xs text-fg-muted">{{ description }}</span>
    </label>
  </div>
</template>
