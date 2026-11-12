<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dashboardApi } from '@/api/dashboard.api'
import ProgressBar from '@/components/scoring/ProgressBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useWidget } from '@/composables/useWidget'

const CAP = 10
const { t } = useI18n()
const { data, loading, error, load } = useWidget(() => dashboardApi.unscoredClasses())

const expanded = ref(false)
const isTeacher = computed(() => data.value?.scope === 'homeroom')
const rows = computed(() => data.value?.classes ?? [])
const visible = computed(() => (expanded.value ? rows.value : rows.value.slice(0, CAP)))
</script>

<template>
  <section class="card p-5" data-testid="unscored-classes">
    <h2 class="mb-3 text-base font-semibold text-fg">
      {{
        isTeacher
          ? t('dashboard.widgets.unscored.teacherTitle')
          : t('dashboard.widgets.unscored.title')
      }}
    </h2>

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
      v-else-if="data && !data.workingDay"
      class="py-10 text-center text-sm text-fg-muted"
      data-testid="widget-not-working"
    >
      {{ t('dashboard.widgets.unscored.notWorkingDay') }}
    </p>

    <p
      v-else-if="!rows.length"
      class="py-10 text-center text-sm text-fg-muted"
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
      <ul class="divide-y divide-border">
        <li v-for="c in visible" :key="c.classId" class="py-3" data-testid="unscored-row">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <RouterLink
                :to="{ name: 'class-scoring', params: { id: c.classId } }"
                class="text-sm font-medium text-fg hover:text-primary-700 hover:underline"
              >
                {{ c.className }}
              </RouterLink>
              <p
                class="truncate text-xs"
                :class="c.homeroomTeacher ? 'text-fg-muted' : 'text-warning'"
                :data-testid="c.homeroomTeacher ? undefined : 'no-homeroom'"
              >
                {{
                  c.homeroomTeacher
                    ? t('dashboard.widgets.unscored.homeroom', { name: c.homeroomTeacher.fullName })
                    : t('dashboard.widgets.unscored.noHomeroom')
                }}
              </p>
            </div>
            <RouterLink
              v-if="isTeacher"
              :to="{ name: 'class-scoring', params: { id: c.classId } }"
              class="shrink-0 rounded-lg border border-border px-3 py-1 text-sm font-medium text-fg hover:bg-surface-muted"
              data-testid="grade-button"
            >
              {{ t('dashboard.widgets.unscored.grade') }}
            </RouterLink>
          </div>
          <ProgressBar
            class="mt-2"
            label-key="dashboard.widgets.unscored.progress"
            :done="c.graded"
            :total="c.total"
          />
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
            : t('dashboard.widgets.unscored.showAll', { n: rows.length })
        }}
      </button>
    </template>
  </section>
</template>
