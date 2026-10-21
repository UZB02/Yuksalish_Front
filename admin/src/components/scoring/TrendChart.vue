<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrendPoint } from '@/api/types'
import { formatDate } from '@/utils/format'
import { buildTrend } from '@/utils/trend'

const props = defineProps<{
  points: TrendPoint[]
  min?: number
  max?: number
  /** Chiziq rangi: asosiy (ball) yoki yashil (davomat) */
  tone?: 'primary' | 'success'
}>()
const toneClass = computed(() =>
  props.tone === 'success'
    ? { area: 'fill-success/10', line: 'stroke-success', dot: 'stroke-success' }
    : { area: 'fill-primary-600/10', line: 'stroke-primary-600', dot: 'stroke-primary-600' },
)
const { t } = useI18n()

const W = 600
const H = 220
const geo = computed(() =>
  buildTrend(
    props.points,
    W,
    H,
    undefined,
    props.min !== undefined && props.max !== undefined
      ? { min: props.min, max: props.max }
      : undefined,
  ),
)
const ticks = computed(() => {
  const { yMin, yMax } = geo.value
  const mid = Math.round((yMin + yMax) / 2)
  return [yMax, mid, yMin].map((v) => ({
    v,
    y: 12 + (1 - (v - yMin) / (yMax - yMin)) * (H - 36),
  }))
})
const first = computed(() => geo.value.coords[0])
const last = computed(() => geo.value.coords[geo.value.coords.length - 1])
const label = computed(() =>
  geo.value.coords.length === 0
    ? t('profile2.noTrend')
    : t('profile2.trendLabel', {
        from: formatDate(first.value!.date),
        to: formatDate(last.value!.date),
        n: geo.value.coords.length,
      }),
)
</script>

<template>
  <div>
    <p v-if="geo.coords.length === 0" class="py-10 text-center text-sm text-fg-muted">
      {{ t('profile2.noTrend') }}
    </p>
    <svg v-else :viewBox="`0 0 ${W} ${H}`" class="h-auto w-full" role="img" :aria-label="label">
      <g class="text-border">
        <line
          v-for="tk in ticks"
          :key="tk.v"
          x1="36"
          :x2="W - 16"
          :y1="tk.y"
          :y2="tk.y"
          stroke="currentColor"
          stroke-dasharray="3 4"
        />
      </g>
      <g class="fill-fg-muted text-[11px]">
        <text v-for="tk in ticks" :key="tk.v" x="30" :y="tk.y + 4" text-anchor="end">
          {{ tk.v }}
        </text>
        <text :x="first!.x" :y="H - 6" :text-anchor="geo.coords.length === 1 ? 'middle' : 'start'">
          {{ formatDate(first!.date).slice(0, 5) }}
        </text>
        <text v-if="geo.coords.length > 1" :x="last!.x" :y="H - 6" text-anchor="end">
          {{ formatDate(last!.date).slice(0, 5) }}
        </text>
      </g>
      <path v-if="geo.areaPath" :d="geo.areaPath" :class="toneClass.area" />
      <path
        v-if="geo.coords.length > 1"
        :d="geo.linePath"
        class="fill-none"
        :class="toneClass.line"
        stroke-width="2.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        v-for="c in geo.coords"
        :key="c.date"
        :cx="c.x"
        :cy="c.y"
        :r="geo.coords.length > 40 ? 2 : 4"
        class="fill-surface"
        :class="toneClass.dot"
        stroke-width="2"
      >
        <title>{{ formatDate(c.date) }}: {{ c.value }}</title>
      </circle>
    </svg>
  </div>
</template>
