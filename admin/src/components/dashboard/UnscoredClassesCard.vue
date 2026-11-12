<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dashboardApi } from '@/api/dashboard.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useWidget } from '@/composables/useWidget'
import { formatDayMonth } from '@/utils/format'

const CAP = 6
const { t } = useI18n()
const { data, loading, error, load } = useWidget(() => dashboardApi.unscoredClasses())

const expanded = ref(false)
const isTeacher = computed(() => data.value?.scope === 'homeroom')
const rows = computed(() => data.value?.classes ?? [])
const visible = computed(() => (expanded.value ? rows.value : rows.value.slice(0, CAP)))
const pct = (g: number, tot: number) => (tot ? Math.round((g / tot) * 100) : 0)

/** Baholangan sinflar: admin javobida faqat tugallanmaganlar bor, shuning uchun jami - tugallanmagan */
const summary = computed(() => {
  const d = data.value
  if (!d) return { done: 0, total: 0 }
  const total = d.totalClasses
  const open = d.classes.filter((c) => c.graded < c.total).length
  return { done: Math.max(0, total - open), total }
})
</script>

<template>
  <section class="card p-4" data-testid="unscored-classes">
    <div class="mb-2 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-semibold text-fg">
          {{
            isTeacher
              ? t('dashboard.widgets.unscored.teacherTitle')
              : t('dashboard.widgets.unscored.title')
          }}
        </h2>
        <p v-if="data" class="text-xs text-fg-muted" data-testid="unscored-date">
          {{ formatDayMonth(data.date) }}
        </p>
      </div>
      <p
        v-if="data && data.workingDay && summary.total"
        class="shrink-0 text-right text-xs text-fg-muted"
        data-testid="unscored-summary"
      >
        {{ t('dashboard.widgets.unscored.summary', summary) }}
      </p>
    </div>
    <div
      v-if="data && data.workingDay && summary.total"
      class="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
      role="progressbar"
      :aria-valuenow="pct(summary.done, summary.total)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="t('dashboard.widgets.unscored.summary', summary)"
    >
      <div
        class="h-full rounded-full bg-success transition-all"
        :style="{ width: `${pct(summary.done, summary.total)}%` }"
      />
    </div>

    <Skeleton v-if="loading" class="h-[13.5rem] w-full" data-testid="widget-loading" />

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
      v-else-if="data && !data.workingDay"
      class="py-6 text-center text-sm text-fg-muted"
      data-testid="widget-not-working"
    >
      {{ t('dashboard.widgets.unscored.notWorkingDay') }}
    </p>

    <p
      v-else-if="!rows.length"
      class="py-6 text-center text-sm text-fg-muted"
      data-testid="widget-empty"
    >
      {{
        !isTeacher
          ? t('dashboard.widgets.unscored.allDone')
          : data?.totalClasses
            ? t('dashboard.widgets.unscored.teacherDone')
            : t('dashboard.widgets.unscored.noClasses')
      }}
    </p>

    <template v-else>
      <ul class="max-h-[19rem] divide-y divide-border overflow-y-auto overflow-x-hidden">
        <li v-for="c in visible" :key="c.classId" data-testid="unscored-row">
          <RouterLink
            :to="{ name: 'class-scoring', params: { id: c.classId } }"
            class="-mx-2 flex h-11 items-center gap-3 rounded-md px-2 text-sm hover:bg-surface-muted focus-visible:bg-surface-muted"
            :aria-label="`${c.className}: ${c.graded}/${c.total}`"
          >
            <span class="w-12 shrink-0 font-semibold text-fg">{{ c.className }}</span>
            <span
              class="min-w-0 flex-1 truncate text-xs"
              :class="c.homeroomTeacher ? 'text-fg-muted' : 'text-warning'"
              :title="c.homeroomTeacher?.fullName"
              :data-testid="c.homeroomTeacher ? undefined : 'no-homeroom'"
            >
              {{
                c.homeroomTeacher
                  ? c.homeroomTeacher.fullName
                  : t('dashboard.widgets.unscored.noHomeroom')
              }}
            </span>
            <span
              v-if="isTeacher"
              class="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-fg"
              data-testid="grade-button"
            >
              {{ t('dashboard.widgets.unscored.grade') }}
            </span>
            <span
              class="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-surface-muted"
              aria-hidden="true"
            >
              <span
                class="block h-full rounded-full bg-success"
                :style="{ width: `${pct(c.graded, c.total)}%` }"
              />
            </span>
            <span class="w-12 shrink-0 text-right text-xs tabular-nums text-fg-muted">
              {{ c.graded }}/{{ c.total }}
            </span>
          </RouterLink>
        </li>
      </ul>
      <button
        v-if="rows.length > CAP"
        type="button"
        class="mt-2 text-sm font-medium text-primary-700 hover:underline"
        data-testid="unscored-toggle"
        @click="expanded = !expanded"
      >
        {{
          expanded
            ? t('dashboard.widgets.unscored.showLess')
            : t('dashboard.widgets.unscored.more', { n: rows.length - CAP })
        }}
      </button>
    </template>
  </section>
</template>
