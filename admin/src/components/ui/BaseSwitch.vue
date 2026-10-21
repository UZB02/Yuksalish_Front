<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const id = useId()
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      :class="modelValue ? 'bg-primary-600' : 'bg-border'"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        class="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
        :class="modelValue ? 'translate-x-5' : 'translate-x-0.5'"
      />
    </button>
    <label v-if="label" :for="id" class="cursor-pointer text-sm text-fg">{{ label }}</label>
  </div>
</template>
