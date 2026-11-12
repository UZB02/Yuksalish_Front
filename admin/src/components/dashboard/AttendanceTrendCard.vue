<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info } from 'lucide-vue-next'
import { dashboardApi } from '@/api/dashboard.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useWidget } from '@/composables/useWidget'
import { barLevel, labelIndices, layoutBars, pickDays, shortDate } from '@/utils/dashboardChart'
import { formatDayMonth } from '@/utils/format'

const { t } = useI18n()
const { data, loading, error, load } = useWidget(() => dashboardApi.attendanceTrend())

// SVG piksel birligida chiziladi (viewBox = haqiqiy kenglik): shrift va balandlik kengaymaydi
const H = 190
const PAD = { top: 10, right: 8, bottom: 22, left: 30 }
const LABEL_PX = 34
const MAX_DAYS = 20
const box = ref<HTMLElement | null>(null)
const W = ref(640)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(([e]) => {
    const w = Math.round(e?.contentRect.width ?? 0)
    if (w > 0) W.value = w
  })
  if (box.value) ro.observe(box.value)
})
onBeforeUnmount(() => ro?.disconnect())

const innerW = computed(() => W.value - PAD.left - PAD.right)
const innerH = H - PAD.top - PAD.bottom
const yOf = (v: number) => PAD.top + (1 - v / 100) * innerH

const days = computed(() => pickDays(data.value?.days ?? [], MAX_DAYS))
const layout = computed(() => layoutBars(days.value.length, innerW.value, PAD.left))
const shownLabels = computed(
  () => new Set(labelIndices(days.value.length, layout.value.slot, LABEL_PX)),
)
const bars = computed(() =>
  days.value.map((day, i) => {
    const h = Math.max(1.5, (day.rate / 100) * innerH)
    const x = layout.value.x(i)
    return {
      day,
      x,
      cx: x + layout.value.slot / 2,
      barX: x + (layout.value.slot - layout.value.barW) / 2,
      barY: PAD.top + innerH - h,
      h,
      level: barLevel(day.rate),
      label: shownLabels.value.has(i),
    }
  }),
)
const FILL = { good: 'fill-success', warn: 'fill-warning', bad: 'fill-danger' } as const

const average = computed(() => {
  const r = days.value.map((d) => d.rate)
  return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null
})
const last = computed(() => days.value[days.value.length - 1] ?? null)
const lowest = computed(() =>
  days.value.length ? days.value.reduce((m, d) => (d.rate < m.rate ? d : m)) : null,
)
const lastLabel = computed(() =>
  last.value && last.value.date === data.value?.to
    ? t('dashboard.widgets.attendanceTrend.today')
    : last.value
      ? shortDate(last.value.date)
      : '',
)
const avgY = computed(() => (average.value !== null ? yOf(average.value) : null))

const hover = ref<string | null>(null)
const hoverBar = computed(() => bars.value.find((b) => b.day.date === hover.value) ?? null)
const tooltipStyle = computed(() => {
  const b = hoverBar.value
  if (!b) return {}
  const shift = b.cx < 90 ? '-10%' : b.cx > W.value - 90 ? '-90%' : '-50%'
  return { left: `${b.cx}px`, transform: `translateX(${shift})` }
})
const num = (v: number) => String(Math.round(v * 100) / 100)
const ariaLabel = computed(() =>
  data.value
    ? t('dashboard.widgets.attendanceTrend.aria', {
        from: formatDayMonth(days.value[0]?.date ?? data.value.from),
        to: formatDayMonth(last.value?.date ?? data.value.to),
        n: days.value.length,
      })
    : '',
)
</script>

<template>
  <section ref="box" class="card p-4" data-testid="attendance-trend">
    <div class="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h2 class="flex items-center gap-1.5 text-base font-semibold text-fg">
          {{ t('dashboard.widgets.attendanceTrend.title') }}
          <span
            class="inline-flex text-fg-muted"
            role="img"
            :title="t('dashboard.widgets.attendanceTrend.note')"
            :aria-label="t('dashboard.widgets.attendanceTrend.note')"
            data-testid="trend-info"
          >
            <Info class="h-4 w-4" aria-hidden="true" />
          </span>
        </h2>
        <p class="text-xs text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.hint') }}</p>
      </div>
      <dl
        v-if="!loading && !error && last"
        class="flex gap-4 text-right text-xs text-fg-muted"
        data-testid="trend-stats"
      >
        <div>
          <dt>{{ lastLabel }}</dt>
          <dd class="text-base font-semibold tabular-nums text-fg" data-testid="trend-last">
            {{ num(last.rate) }}%
          </dd>
        </div>
        <div>
          <dt>{{ t('dashboard.widgets.attendanceTrend.avg') }}</dt>
          <dd class="text-base font-semibold tabular-nums text-fg" data-testid="trend-average">
            {{ num(average ?? 0) }}%
          </dd>
        </div>
        <div v-if="lowest" class="hidden sm:block">
          <dt>{{ t('dashboard.widgets.attendanceTrend.min') }}</dt>
          <dd class="text-base font-semibold tabular-nums text-fg" data-testid="trend-min">
            {{ num(lowest.rate) }}%
          </dd>
        </div>
      </dl>
    </div>

    <Skeleton v-if="loading" class="h-[190px] w-full" data-testid="widget-loading" />

    <EmptyState
      v-else-if="error"
      :title="t('errors.loadFailed')"
      :description="error"
      class="!py-6"
      data-testid="widget-error"
    >
      <BaseButton variant="secondary" data-testid="widget-retry" @click="load">
        {{ t('common.retry') }}
      </BaseButton>
    </EmptyState>

    <p
      v-else-if="!days.length"
      class="py-10 text-center text-sm text-fg-muted"
      data-testid="widget-empty"
    >
      {{ t('dashboard.widgets.attendanceTrend.empty') }}
    </p>

    <div v-else class="relative">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        :width="W"
        :height="H"
        class="block max-w-full"
        role="img"
        :aria-label="ariaLabel"
        data-testid="trend-svg"
        @pointerleave="hover = null"
      >
        <g class="text-border">
          <line
            v-for="v in [0, 50, 100]"
            :key="v"
            :x1="PAD.left"
            :x2="W - PAD.right"
            :y1="yOf(v)"
            :y2="yOf(v)"
            stroke="currentColor"
            stroke-dasharray="3 4"
          />
        </g>
        <g class="fill-fg-muted text-[10px]">
          <text
            v-for="v in [0, 50, 100]"
            :key="v"
            :x="PAD.left - 5"
            :y="yOf(v) + 3.5"
            text-anchor="end"
          >
            {{ v }}
          </text>
          <template v-for="b in bars" :key="b.day.date">
            <text
              v-if="b.label"
              :x="b.cx"
              :y="H - 6"
              text-anchor="middle"
              data-testid="trend-xlabel"
            >
              {{ shortDate(b.day.date) }}
            </text>
          </template>
        </g>

        <template v-for="b in bars" :key="b.day.date">
          <rect
            :x="b.barX"
            :y="b.barY"
            :width="layout.barW"
            :height="b.h"
            rx="2"
            :class="[FILL[b.level], hover && hover !== b.day.date ? 'opacity-50' : '']"
            data-testid="trend-bar"
          />
          <rect
            :x="b.x"
            :y="PAD.top"
            :width="layout.slot"
            :height="innerH"
            fill="transparent"
            data-testid="trend-hit"
            @pointerenter="hover = b.day.date"
            @pointerdown="hover = b.day.date"
          />
        </template>

        <g v-if="avgY !== null" class="pointer-events-none">
          <line
            :x1="PAD.left"
            :x2="W - PAD.right"
            :y1="avgY"
            :y2="avgY"
            class="stroke-fg-muted"
            stroke-width="1.2"
            stroke-dasharray="5 3"
            data-testid="trend-avg-line"
          />
          <text
            :x="W - PAD.right - 2"
            :y="avgY - 3"
            text-anchor="end"
            class="fill-fg-muted stroke-surface text-[10px]"
            stroke-width="3"
            paint-order="stroke"
          >
            {{ t('dashboard.widgets.attendanceTrend.avgShort', { value: num(average ?? 0) }) }}
          </text>
        </g>
      </svg>

      <div
        v-if="hoverBar"
        class="pointer-events-none absolute top-0 z-10 min-w-[9.5rem] rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md"
        :style="tooltipStyle"
        data-testid="trend-tooltip"
      >
        <p class="mb-1 font-medium text-fg">
          {{ formatDayMonth(hoverBar.day.date) }} — {{ num(hoverBar.day.rate) }}%
        </p>
        <dl class="space-y-0.5">
          <div class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.present') }}</dt>
            <dd class="tabular-nums text-fg">{{ hoverBar.day.present }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.late') }}</dt>
            <dd class="tabular-nums text-fg">{{ hoverBar.day.late }}</dd>
          </div>
          <div v-if="hoverBar.day.partial" class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.partial') }}</dt>
            <dd class="tabular-nums text-fg">{{ hoverBar.day.partial }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.excused') }}</dt>
            <dd class="tabular-nums text-fg">{{ hoverBar.day.absentExcused }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.unexcused') }}</dt>
            <dd class="tabular-nums text-fg">{{ hoverBar.day.absentUnexcused }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
