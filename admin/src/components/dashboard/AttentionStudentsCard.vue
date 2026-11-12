<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { dashboardApi } from '@/api/dashboard.api'
import type { AttentionReason } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useWidget } from '@/composables/useWidget'

const { t } = useI18n()
const { data, loading, error, load } = useWidget(() => dashboardApi.attentionStudents())

const num = (v: number) => String(Math.round(v * 100) / 100)

function reasonText(r: AttentionReason): string {
  if (r.type === 'drop') {
    const delta = `${r.delta < 0 ? '−' : '+'}${num(Math.abs(r.delta))}`
    return t('dashboard.widgets.attention.drop', { from: num(r.from), to: num(r.to), delta })
  }
  if (r.type === 'negative') return t('dashboard.widgets.attention.negative', { n: r.count })
  return t('dashboard.widgets.attention.unexcused', { n: r.days })
}
</script>

<template>
  <section class="card p-5" data-testid="attention-students">
    <h2 class="text-base font-semibold text-fg">{{ t('dashboard.widgets.attention.title') }}</h2>
    <p class="mb-3 text-xs text-fg-muted">{{ t('dashboard.widgets.attention.hint') }}</p>

    <Skeleton v-if="loading" class="h-40 w-full" data-testid="widget-loading" />

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
      v-else-if="!data?.students.length"
      class="py-10 text-center text-sm text-fg-muted"
      data-testid="widget-empty"
    >
      {{ t('dashboard.widgets.attention.empty') }}
    </p>

    <template v-else>
      <ul class="divide-y divide-border">
        <li v-for="s in data.students" :key="s.studentId" class="py-3" data-testid="attention-row">
          <div class="flex items-baseline justify-between gap-2">
            <RouterLink
              :to="{ name: 'student-profile', params: { id: s.studentId } }"
              class="truncate text-sm font-medium text-fg hover:text-primary-700 hover:underline"
            >
              {{ s.fullName }}
            </RouterLink>
            <span class="shrink-0 text-xs text-fg-muted">{{ s.className }}</span>
          </div>
          <ul class="mt-1.5 flex flex-wrap gap-1.5">
            <li
              v-for="r in s.reasons"
              :key="r.type"
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="
                r.type === 'drop' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'
              "
              data-testid="attention-reason"
            >
              {{ reasonText(r) }}
            </li>
          </ul>
        </li>
      </ul>
      <p v-if="data.total > data.students.length" class="mt-2 text-xs text-fg-muted">
        {{ t('dashboard.widgets.attention.more', { n: data.total - data.students.length }) }}
      </p>
    </template>
  </section>
</template>
