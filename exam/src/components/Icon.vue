<script setup lang="ts">
import { ICONS, type IconName } from './icons'

withDefaults(defineProps<{ name: IconName; size?: string }>(), { size: 'h-5 w-5' })
</script>

<!-- eslint-disable vue/no-v-html -- ICONS: ichki o'zgarmas lucide yo'llari -->
<template>
  <svg
    :class="[size, 'shrink-0']"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="ICONS[name]"
  />
</template>
