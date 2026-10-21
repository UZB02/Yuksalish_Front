<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

defineOptions({ inheritAttrs: false })

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = defineProps<{
  modelValue?: string | null
  options: SelectOption[]
  label?: string
  placeholder?: string
  error?: string
  required?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const attrs = useAttrs()
const selectAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})
const id = useId()
const describedBy = computed(() => (props.error ? `${id}-error` : undefined))

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div :class="$attrs.class" :style="$attrs.style as string">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-fg">
      {{ label }}<span v-if="required" class="ml-0.5 text-danger" aria-hidden="true">*</span>
    </label>
    <select
      v-bind="selectAttrs"
      :id="id"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :required="required"
      :aria-invalid="!!error"
      :aria-describedby="describedBy"
      class="h-10 w-full rounded-lg border bg-surface px-3 text-sm text-fg transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
      :class="error ? 'border-danger' : 'border-border'"
      @change="onChange"
    >
      <option v-if="placeholder !== undefined" value="">{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value" :disabled="o.disabled">
        {{ o.label }}
      </option>
    </select>
    <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs text-danger" role="alert">
      {{ error }}
    </p>
  </div>
</template>
