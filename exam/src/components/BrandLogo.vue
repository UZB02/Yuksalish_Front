<script setup lang="ts">
defineProps<{ size?: string }>()
/** public/brand: Vite uni qayta ishlamaydi (o'zgaruvchi orqali), testlarda ham yechilmaydi */
const SRC = '/brand/yuksalish-mark.png'
</script>

<template>
  <img :src="SRC" alt="" :class="[size ?? 'h-8 w-8', 'shrink-0 object-contain']" />
</template>
