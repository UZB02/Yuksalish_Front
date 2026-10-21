<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'primary' | 'info' }>(),
  {
    tone: 'neutral',
  },
)

const tones = {
  neutral: 'bg-surface-muted text-fg-muted',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  primary: 'bg-primary-100 text-primary-700',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="tones[tone]"
  >
    <slot />
  </span>
</template>
