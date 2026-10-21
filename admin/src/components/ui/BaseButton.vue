<script setup lang="ts">
import { computed } from 'vue'
import Spinner from './Spinner.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'sm' | 'md'
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button', loading: false, disabled: false },
)

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 select-none'
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm' }
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'border border-border bg-surface text-fg hover:bg-surface-muted',
    danger: 'bg-danger text-white hover:opacity-90',
    ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  }
  return [base, sizes[props.size], variants[props.variant]]
})
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading">
    <Spinner v-if="loading" class="h-4 w-4" />
    <slot />
  </button>
</template>
