<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from 'lucide-vue-next'

// Standart ikonka propda emas: funksiya-komponent default sifatida "fabrika" deb chaqirilib qoladi.
defineProps<{ title: string; description?: string; icon?: Component }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4 py-14 text-center">
    <div
      class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
    >
      <component :is="icon ?? Inbox" class="h-6 w-6" aria-hidden="true" />
    </div>
    <h3 class="text-base font-semibold text-fg">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-fg-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
