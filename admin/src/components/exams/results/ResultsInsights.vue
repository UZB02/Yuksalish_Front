<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'
import type { ExamResultsResponse } from '@/api/types'
import {
  classNames,
  classStat,
  histogram,
  initials,
  subjectColor,
  subjectStats,
  topThree,
} from './resultsModel'

/** Tepadagi 3 karta: Eng yaxshilar (podium), O'tish halqasi + taqsimot, Fanlar (+ sinflar) bo'yicha */
const props = defineProps<{ data: ExamResultsResponse; showEssayHint: boolean }>()
const emit = defineEmits<{ open: [key: string] }>()
const { t } = useI18n()

const sum = computed(() => props.data.summary)
const pass = computed(() => props.data.summary.passPercent)
const top = computed(() => topThree(props.data.rows))
// Podium tartibi: 2-o'rin, 1-o'rin, 3-o'rin (kam bo'lsa mavjudlari)
const podium = computed(() =>
  [1, 0, 2].flatMap((i) => (top.value[i] ? [{ r: top.value[i]!, i }] : [])),
)
const PODIUM_H = [70, 52, 40]
const PODIUM_BG = ['bg-primary-600', 'bg-primary-600/80', 'bg-primary-600/60']

const hist = computed(() => histogram(props.data.rows))
const histMax = computed(() => Math.max(1, ...hist.value))
const scoredCount = computed(() => hist.value.reduce((s, x) => s + x, 0))
const barTone = (j: number) =>
  pass.value === null ? 'bg-primary-600' : j * 10 + 5 >= pass.value ? 'bg-success' : 'bg-danger/70'

const ringPct = computed(() =>
  Math.round(pass.value !== null ? (sum.value.passRate ?? 0) : (sum.value.averagePercent ?? 0)),
)
const subjects = computed(() => subjectStats(props.data))
const classes = computed(() => {
  const names = classNames(props.data.rows).filter(Boolean)
  return names.length > 1 ? names.map((n) => classStat(props.data.rows, n)) : []
})
const num = (v: number | null) => (v === null ? '—' : `${v}%`)
</script>

<template>
  <div class="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="results-insights">
    <!-- Eng yaxshilar -->
    <section class="card min-w-0 p-3" data-testid="card-top">
      <h2 class="mb-2 text-sm font-semibold">{{ t('examResults.insights.top') }}</h2>
      <p v-if="!podium.length" class="py-6 text-center text-sm text-fg-muted">
        {{ t('examResults.insights.topEmpty') }}
      </p>
      <div v-else class="grid grid-cols-3 items-end gap-2 text-center" data-testid="podium">
        <button
          v-for="p in podium"
          :key="p.r.key"
          type="button"
          class="flex min-w-0 flex-col items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          :style="{ gridColumn: p.i === 0 ? 2 : p.i === 1 ? 1 : 3 }"
          :aria-label="t('examResults.cards.open', { name: p.r.fullName })"
          data-testid="podium-item"
          @click="emit('open', p.r.key)"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700"
            >{{ initials(p.r.fullName) }}</span
          >
          <span class="mt-1 block w-full truncate text-xs font-medium">{{ p.r.fullName }}</span>
          <span class="text-[11px] text-fg-muted">{{ p.r.className ?? '—' }}</span>
          <span
            class="mt-1 flex w-full items-start justify-center rounded-t-lg pt-1 text-lg font-bold text-white"
            :class="PODIUM_BG[p.i]"
            :style="{ height: PODIUM_H[p.i] + 'px' }"
            >{{ p.r.rank }}</span
          >
          <span
            class="w-full rounded-b-lg bg-surface-muted py-0.5 text-xs font-semibold tabular-nums"
            >{{ Math.round(p.r.percent ?? 0) }}%</span
          >
        </button>
      </div>
    </section>

    <!-- O'tish va taqsimot -->
    <section class="card min-w-0 p-3" data-testid="card-pass">
      <div class="mb-2 flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold">{{ t('examResults.insights.pass') }}</h2>
        <span class="text-xs text-fg-muted">{{
          t('examResults.insights.scored', { n: scoredCount })
        }}</span>
      </div>
      <div class="flex items-center gap-4">
        <span
          class="relative inline-flex h-[88px] w-[88px] shrink-0"
          role="img"
          :aria-label="`${ringPct}%`"
          data-testid="pass-ring"
        >
          <svg width="88" height="88" aria-hidden="true">
            <circle
              cx="44"
              cy="44"
              r="38"
              fill="none"
              stroke="rgb(var(--border))"
              stroke-width="8"
            />
            <circle
              v-if="ringPct > 0"
              cx="44"
              cy="44"
              r="38"
              fill="none"
              :stroke="pass !== null ? 'rgb(var(--success))' : 'rgb(var(--primary-600))'"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="`${(2 * Math.PI * 38 * Math.min(100, ringPct)) / 100} ${2 * Math.PI * 38}`"
              transform="rotate(-90 44 44)"
            />
          </svg>
          <span class="absolute inset-0 flex flex-col items-center justify-center leading-tight">
            <b class="text-lg tabular-nums">{{ ringPct }}%</b>
            <span class="text-[10px] text-fg-muted">{{
              t(pass !== null ? 'examResults.insights.passLabel' : 'examResults.insights.avgLabel')
            }}</span>
          </span>
        </span>
        <dl class="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <div>
            <dt class="text-xs text-fg-muted">{{ t('examResults.summary.average') }}</dt>
            <dd class="font-semibold tabular-nums" data-testid="sum-average">
              {{ num(sum.averagePercent) }}
            </dd>
          </div>
          <div v-if="pass !== null">
            <dt class="text-xs text-fg-muted">{{ t('examResults.insights.threshold') }}</dt>
            <dd class="font-semibold tabular-nums" data-testid="sum-threshold">{{ pass }}%</dd>
          </div>
          <div>
            <dt class="text-xs text-fg-muted">{{ t('examResults.summary.max') }}</dt>
            <dd class="font-semibold tabular-nums text-success" data-testid="sum-max">
              {{ num(sum.maxPercent) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-fg-muted">{{ t('examResults.summary.min') }}</dt>
            <dd class="font-semibold tabular-nums text-danger" data-testid="sum-min">
              {{ num(sum.minPercent) }}
            </dd>
          </div>
          <div v-if="pass !== null" class="col-span-2">
            <dt class="text-xs text-fg-muted">
              {{ t('examResults.summary.passRate', { percent: pass }) }}
            </dt>
            <dd class="font-semibold tabular-nums" data-testid="sum-pass">
              {{ num(sum.passRate) }}
            </dd>
          </div>
        </dl>
      </div>
      <div class="mt-3" data-testid="histogram">
        <div class="relative h-16">
          <div class="flex h-full items-end gap-1">
            <div
              v-for="(v, j) in hist"
              :key="j"
              class="flex h-full flex-1 flex-col items-center justify-end"
              :title="t('examResults.insights.histTitle', { from: j * 10, to: j * 10 + 9, n: v })"
              data-testid="hist-bar"
            >
              <span class="text-[10px] tabular-nums text-fg-muted">{{ v || '' }}</span>
              <div
                class="w-full rounded-t"
                :class="barTone(j)"
                :style="{ height: (v / histMax) * 80 + '%', minHeight: v ? '3px' : '0' }"
              />
            </div>
          </div>
          <div
            v-if="pass !== null"
            class="absolute inset-y-0 border-l-2 border-dashed border-fg-muted/70"
            :style="{ left: pass + '%' }"
            data-testid="hist-threshold"
          >
            <span
              class="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-surface px-1 text-[10px] text-fg-muted"
              >{{ t('examResults.insights.histThreshold', { n: pass }) }}</span
            >
          </div>
        </div>
        <div class="mt-1 flex justify-between text-[10px] text-fg-muted">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>
      <p
        v-if="showEssayHint && sum.essayPending > 0"
        class="mt-2 flex items-center gap-1.5 text-xs text-warning"
        data-testid="essay-hint"
      >
        <AlertTriangle class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{{
          t('examResults.insights.essayHint', { n: sum.essayPending })
        }}
      </p>
    </section>

    <!-- Fanlar / sinflar bo'yicha -->
    <section
      v-if="subjects.length || classes.length"
      class="card min-w-0 p-3 md:col-span-2 xl:col-span-1"
      data-testid="card-subjects"
    >
      <h2 class="mb-2 text-sm font-semibold">
        {{ t(subjects.length ? 'examResults.insights.subjects' : 'examResults.insights.classes') }}
      </h2>
      <div
        v-for="(s, j) in subjects"
        :key="s.id"
        class="mb-2.5 last:mb-0"
        data-testid="subject-row"
      >
        <p class="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span class="min-w-0 truncate font-medium">{{ s.title }}</span>
          <span class="shrink-0 text-fg-muted">
            <template v-for="c in s.byClass" :key="c.name"
              >{{ c.name }} {{ num(c.avg) }} ·
            </template>
            <b class="tabular-nums text-fg">{{ num(s.avg) }}</b>
          </span>
        </p>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            class="h-full rounded-full"
            :style="{ width: (s.avg ?? 0) + '%', background: subjectColor(j) }"
          />
        </div>
      </div>
      <div :class="subjects.length ? 'mt-2 border-t border-border pt-1' : ''">
        <div
          v-for="c in classes"
          :key="c.name"
          class="flex items-center justify-between gap-2 border-t border-border py-1.5 text-xs first:border-0"
          data-testid="class-row"
        >
          <b>{{ c.name }}</b>
          <span class="text-fg-muted">{{
            t('examResults.insights.classLine', { avg: num(c.avg), ok: c.passed, n: c.submitted })
          }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
