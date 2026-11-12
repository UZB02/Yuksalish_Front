<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dashboardApi } from '@/api/dashboard.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useWidget } from '@/composables/useWidget'
import { formatDayMonth } from '@/utils/format'

const { t } = useI18n()
const { data, loading, error, load } = useWidget(() => dashboardApi.attendanceTrend())

const W = 720
const H = 220
const PAD = { top: 12, right: 12, bottom: 26, left: 34 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom
const yOf = (v: number) => PAD.top + (1 - v / 100) * innerH

const hover = ref<string | null>(null)

const hasDays = computed(() => (data.value?.days.length ?? 0) > 0)
const slots = computed(() => {
  const d = data.value
  if (!d) return []
  const start = Date.parse(`${d.from}T00:00:00Z`)
  const n = Math.round((Date.parse(`${d.to}T00:00:00Z`) - start) / 86_400_000) + 1
  const byDate = new Map(d.days.map((x) => [x.date, x]))
  const w = innerW / n
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10)
    const day = byDate.get(date) ?? null
    const barH = day ? Math.max(1, (day.rate / 100) * innerH) : 0
    return {
      date,
      day,
      x: PAD.left + i * w,
      w,
      barX: PAD.left + i * w + w * 0.15,
      barW: w * 0.7,
      barY: PAD.top + innerH - barH,
      barH,
      label: i % 7 === 0 || i === n - 1,
    }
  })
})
const avgY = computed(() => (data.value?.average != null ? yOf(data.value.average) : null))
const hoverSlot = computed(() => slots.value.find((s) => s.date === hover.value && s.day) ?? null)
const tooltipStyle = computed(() => {
  const s = hoverSlot.value
  if (!s) return {}
  const pct = ((s.x + s.w / 2) / W) * 100
  const shift = pct < 20 ? '0%' : pct > 80 ? '-100%' : '-50%'
  return { left: `${pct}%`, transform: `translateX(${shift})` }
})
const num = (v: number) => String(Math.round(v * 100) / 100)
const ariaLabel = computed(() =>
  data.value
    ? t('dashboard.widgets.attendanceTrend.aria', {
        from: formatDayMonth(data.value.from),
        to: formatDayMonth(data.value.to),
        n: data.value.days.length,
      })
    : '',
)
</script>

<template>
  <section class="card p-5 sm:p-6" data-testid="attendance-trend">
    <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-base font-semibold text-fg">
          {{ t('dashboard.widgets.attendanceTrend.title') }}
        </h2>
        <p class="text-xs text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.hint') }}</p>
      </div>
      <p
        v-if="!loading && !error && data?.average != null"
        class="text-sm font-medium text-fg"
        data-testid="trend-average"
      >
        {{ t('dashboard.widgets.attendanceTrend.average', { value: num(data.average) }) }}
      </p>
    </div>

    <Skeleton v-if="loading" class="h-56 w-full" data-testid="widget-loading" />

    <EmptyState
      v-else-if="error"
      :title="t('errors.loadFailed')"
      :description="error"
      data-testid="widget-error"
    >
      <BaseButton variant="secondary" data-testid="widget-retry" @click="load">
        {{ t('common.retry') }}
      </BaseButton>
    </EmptyState>

    <p
      v-else-if="!hasDays"
      class="py-12 text-center text-sm text-fg-muted"
      data-testid="widget-empty"
    >
      {{ t('dashboard.widgets.attendanceTrend.empty') }}
    </p>

    <template v-else>
      <div class="relative">
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          class="h-auto w-full"
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
          <g class="fill-fg-muted text-[11px]">
            <text
              v-for="v in [0, 50, 100]"
              :key="v"
              :x="PAD.left - 6"
              :y="yOf(v) + 4"
              text-anchor="end"
            >
              {{ v }}%
            </text>
            <template v-for="s in slots" :key="s.date">
              <text v-if="s.label" :x="s.x + s.w / 2" :y="H - 8" text-anchor="middle">
                {{ formatDayMonth(s.date) }}
              </text>
            </template>
          </g>

          <template v-for="s in slots" :key="s.date">
            <rect
              v-if="s.day"
              :x="s.barX"
              :y="s.barY"
              :width="s.barW"
              :height="s.barH"
              rx="2"
              :class="s.date === hover ? 'fill-primary-700' : 'fill-primary-600'"
              data-testid="trend-bar"
            />
            <!-- Keng urinish maydoni (sichqoncha/barmoq) -->
            <rect
              :x="s.x"
              :y="PAD.top"
              :width="s.w"
              :height="innerH"
              fill="transparent"
              :data-testid="s.day ? 'trend-hit' : undefined"
              @pointerenter="hover = s.day ? s.date : null"
              @pointerdown="hover = s.day ? s.date : null"
            />
          </template>

          <g v-if="avgY !== null" class="pointer-events-none">
            <line
              :x1="PAD.left"
              :x2="W - PAD.right"
              :y1="avgY"
              :y2="avgY"
              class="stroke-success"
              stroke-width="1.5"
              stroke-dasharray="6 4"
              data-testid="trend-avg-line"
            />
          </g>
        </svg>

        <div
          v-if="hoverSlot && hoverSlot.day"
          class="pointer-events-none absolute top-0 z-10 min-w-[10rem] rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md"
          :style="tooltipStyle"
          data-testid="trend-tooltip"
        >
          <p class="mb-1 font-medium text-fg">
            {{ formatDayMonth(hoverSlot.date) }} — {{ num(hoverSlot.day.rate) }}%
          </p>
          <dl class="space-y-0.5">
            <div class="flex justify-between gap-3">
              <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.present') }}</dt>
              <dd class="tabular-nums text-fg">{{ hoverSlot.day.present }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.late') }}</dt>
              <dd class="tabular-nums text-fg">{{ hoverSlot.day.late }}</dd>
            </div>
            <div v-if="hoverSlot.day.partial" class="flex justify-between gap-3">
              <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.partial') }}</dt>
              <dd class="tabular-nums text-fg">{{ hoverSlot.day.partial }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.excused') }}</dt>
              <dd class="tabular-nums text-fg">{{ hoverSlot.day.absentExcused }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.unexcused') }}</dt>
              <dd class="tabular-nums text-fg">{{ hoverSlot.day.absentUnexcused }}</dd>
            </div>
          </dl>
        </div>
      </div>
      <p class="mt-2 text-xs text-fg-muted">{{ t('dashboard.widgets.attendanceTrend.note') }}</p>
    </template>
  </section>
</template>
