<script setup lang="ts">
import { useStore } from '../inject'

const store = useStore()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
    aria-live="polite"
  >
    <div
      v-for="t in store.state.toasts"
      :key="t.id"
      class="pointer-events-auto max-w-md rounded-xl px-4 py-3 text-base font-medium shadow-lg"
      :class="
        t.kind === 'warn'
          ? 'bg-warn text-white'
          : t.kind === 'error'
            ? 'bg-bad text-white'
            : 'bg-fg text-page'
      "
      data-testid="toast"
    >
      {{ t.message }}
    </div>
  </div>
</template>
