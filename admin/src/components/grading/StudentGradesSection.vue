<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GraduationCap } from 'lucide-vue-next'
import { gradesApi } from '@/api/grades.api'
import type { StudentGradeSummary } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { fmtAvg, gradeTone } from '@/utils/grades'

// O'quvchi profilidagi "Fan baholari" bo'limi: fanlar bo'yicha o'rtacha baho va so'nggi baholar.
const props = defineProps<{ studentId: string; from: string; to: string }>()
const { t } = useI18n()

const summary = ref<StudentGradeSummary | null>(null)
const loading = ref(false)
const error = ref('')
let requestId = 0

async function load() {
  const current = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await gradesApi.studentSummary(props.studentId, { from: props.from, to: props.to })
    if (current === requestId) summary.value = res
  } catch (e) {
    if (current === requestId) error.value = errorMessage(e, t)
  } finally {
    if (current === requestId) loading.value = false
  }
}
onMounted(load)
watch(() => [props.studentId, props.from, props.to], load)
</script>

<template>
  <section class="card p-4 sm:p-5" data-testid="student-grades">
    <header class="mb-3 flex items-center gap-3">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
      >
        <GraduationCap class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold text-fg">{{ t('profile2.grades.title') }}</h2>
    </header>

    <EmptyState v-if="error" :title="t('errors.loadFailed')" class="!py-6" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
    <Skeleton v-else-if="loading && !summary" class="h-40 w-full" />
    <template v-else-if="summary">
      <dl class="grid grid-cols-3 gap-2" :class="loading ? 'opacity-50' : ''">
        <div class="min-w-0 rounded-lg bg-surface-muted px-3 py-2">
          <dd class="text-lg font-semibold leading-tight text-fg">{{ fmtAvg(summary.average) }}</dd>
          <dt class="truncate text-xs text-fg-muted" :title="t('profile2.grades.average')">
            {{ t('profile2.grades.average') }}
          </dt>
        </div>
        <div class="min-w-0 rounded-lg bg-surface-muted px-3 py-2">
          <dd class="text-lg font-semibold leading-tight text-fg">
            {{ fmtAvg(summary.average100) }}
          </dd>
          <dt class="truncate text-xs text-fg-muted" :title="t('profile2.grades.average100')">
            {{ t('profile2.grades.average100') }}
          </dt>
        </div>
        <div class="min-w-0 rounded-lg bg-surface-muted px-3 py-2">
          <dd class="text-lg font-semibold leading-tight text-fg">{{ summary.gradesCount }}</dd>
          <dt class="truncate text-xs text-fg-muted" :title="t('profile2.grades.count')">
            {{ t('profile2.grades.count') }}
          </dt>
        </div>
      </dl>

      <EmptyState
        v-if="summary.gradesCount === 0"
        class="!py-6"
        :title="t('profile2.grades.emptyTitle')"
        :description="t('profile2.grades.emptyText')"
      />
      <template v-else>
        <h3 class="mb-1 mt-4 text-sm font-semibold text-fg">
          {{ t('profile2.grades.bySubject') }}
        </h3>
        <ul class="divide-y divide-border" data-testid="subject-averages">
          <li v-for="s in summary.bySubject" :key="s.subjectId" class="py-2">
            <div class="flex items-center justify-between gap-3">
              <p class="min-w-0 truncate text-sm font-medium text-fg">{{ s.name }}</p>
              <BaseBadge :tone="gradeTone(Math.round(s.average))">
                <span class="text-sm font-semibold">{{ fmtAvg(s.average) }}</span>
              </BaseBadge>
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  class="h-full rounded-full bg-primary-500"
                  :style="{ width: `${Math.min(100, Math.max(0, (s.average / 5) * 100))}%` }"
                />
              </div>
              <span class="shrink-0 text-xs text-fg-muted">
                {{ t('profile2.grades.subjectCount', { n: s.count }) }}
              </span>
            </div>
          </li>
        </ul>

        <h3 class="mb-1 mt-4 text-sm font-semibold text-fg">{{ t('profile2.grades.recent') }}</h3>
        <ul class="divide-y divide-border">
          <li v-for="g in summary.recent" :key="g.id" class="py-2">
            <div class="flex items-center justify-between gap-2">
              <span class="min-w-0 truncate text-sm text-fg">{{ g.subject.name }}</span>
              <BaseBadge :tone="gradeTone(g.value)">
                <span class="text-sm font-semibold">{{ g.value }}</span>
              </BaseBadge>
            </div>
            <p class="truncate text-xs text-fg-muted">
              {{ formatDate(g.date)
              }}<template v-if="g.lessonNo > 0"
                ><span data-testid="lesson-label">
                  · {{ t('grading.lesson.n', { n: g.lessonNo }) }}</span
                ></template
              >
              - {{ g.teacher.fullName }}
            </p>
            <p v-if="g.comment" class="mt-1 text-sm text-fg-muted">{{ g.comment }}</p>
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>
