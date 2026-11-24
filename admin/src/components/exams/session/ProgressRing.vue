<script setup lang="ts">
import { computed } from 'vue'

/** Kichik halqa ko'rsatkich (36 px): foiz doirasi + markazda yozuv. Rang: CSS o'zgaruvchi (yorug'/qorong'i mavzuga mos). */
const props = withDefaults(
  defineProps<{ pct: number; color?: string; label?: string; size?: number }>(),
  { color: 'rgb(var(--primary-600))', label: undefined, size: 36 },
)
const stroke = 4
const r = computed(() => props.size / 2 - stroke / 2 - 1)
const len = computed(() => 2 * Math.PI * r.value)
const dash = computed(
  () => `${(len.value * Math.min(100, Math.max(0, props.pct))) / 100} ${len.value}`,
)
</script>

<template>
  <span
    class="relative inline-flex shrink-0"
    :style="{ width: size + 'px', height: size + 'px' }"
    data-testid="ring"
  >
    <svg :width="size" :height="size" aria-hidden="true">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        stroke="rgb(var(--border))"
        :stroke-width="stroke"
      />
      <circle
        v-if="pct > 0"
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="dash"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <b
      class="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-fg"
      >{{ label ?? pct + '%' }}</b
    >
  </span>
</template>
