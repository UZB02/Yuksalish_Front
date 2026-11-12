<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck } from 'lucide-vue-next'
import { dashboardApi } from '@/api/dashboard.api'
import type { AttentionReason } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useWidget } from '@/composables/useWidget'

const CAP = 6
const { t } = useI18n()
const { data, loading, error, load } = useWidget(() => dashboardApi.attentionStudents())

const expanded = ref(false)
const all = computed(() => data.value?.students ?? [])
const visible = computed(() => (expanded.value ? all.value : all.value.slice(0, CAP)))
/** Server ro'yxati (maks 10) dan tashqari belgilanganlar soni */
const hiddenTotal = computed(() => (data.value ? data.value.total - all.value.length : 0))

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
  <section class="card p-4" data-testid="attention-students">
    <h2 class="text-base font-semibold text-fg">{{ t('dashboard.widgets.attention.title') }}</h2>
    <p class="mb-2 text-xs text-fg-muted">{{ t('dashboard.widgets.attention.hint') }}</p>

    <Skeleton v-if="loading" class="h-32 w-full" data-testid="widget-loading" />

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
      v-else-if="!all.length"
      class="flex items-center gap-2 py-3 text-sm text-fg-muted"
      data-testid="widget-empty"
    >
      <CircleCheck class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      {{ t('dashboard.widgets.attention.empty') }}
    </p>

    <template v-else>
      <ul class="max-h-[19rem] divide-y divide-border overflow-y-auto overflow-x-hidden">
        <li v-for="s in visible" :key="s.studentId" data-testid="attention-row">
          <RouterLink
            :to="{ name: 'student-profile', params: { id: s.studentId } }"
            class="-mx-2 block rounded-md px-2 py-2 hover:bg-surface-muted focus-visible:bg-surface-muted"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-sm font-medium text-fg">{{ s.fullName }}</span>
              <span class="shrink-0 text-xs text-fg-muted">{{ s.className }}</span>
            </span>
            <span class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="r in s.reasons"
                :key="r.type"
                class="rounded-full px-2 py-px text-[11px] font-medium"
                :class="
                  r.type === 'drop' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'
                "
                data-testid="attention-reason"
              >
                {{ reasonText(r) }}
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
      <div class="mt-2 flex items-center gap-3 text-sm">
        <button
          v-if="all.length > CAP"
          type="button"
          class="font-medium text-primary-700 hover:underline"
          data-testid="attention-toggle"
          @click="expanded = !expanded"
        >
          {{
            expanded
              ? t('dashboard.widgets.unscored.showLess')
              : t('dashboard.widgets.attention.moreShow', { n: all.length - CAP })
          }}
        </button>
        <p v-if="hiddenTotal > 0" class="text-xs text-fg-muted">
          {{ t('dashboard.widgets.attention.more', { n: hiddenTotal }) }}
        </p>
      </div>
    </template>
  </section>
</template>
