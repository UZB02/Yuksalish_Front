<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
  <section class="mt-6" data-testid="student-grades">
    <h2 class="mb-3 text-base font-semibold text-fg">{{ t('profile2.grades.title') }}</h2>

    <div v-if="error" class="card">
      <EmptyState :title="t('errors.loadFailed')" :description="error">
        <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <Skeleton v-else-if="loading && !summary" class="h-40 w-full" />
    <template v-else-if="summary">
      <dl class="mb-4 grid grid-cols-3 gap-3">
        <div class="card p-4">
          <dt class="text-xs text-fg-muted">{{ t('profile2.grades.average') }}</dt>
          <dd class="mt-1 text-2xl font-semibold text-fg" :class="loading ? 'opacity-50' : ''">
            {{ fmtAvg(summary.average) }}
          </dd>
        </div>
        <div class="card p-4">
          <dt class="text-xs text-fg-muted">{{ t('profile2.grades.average100') }}</dt>
          <dd class="mt-1 text-2xl font-semibold text-fg" :class="loading ? 'opacity-50' : ''">
            {{ fmtAvg(summary.average100) }}
          </dd>
        </div>
        <div class="card p-4">
          <dt class="text-xs text-fg-muted">{{ t('profile2.grades.count') }}</dt>
          <dd class="mt-1 text-2xl font-semibold text-fg" :class="loading ? 'opacity-50' : ''">
            {{ summary.gradesCount }}
          </dd>
        </div>
      </dl>

      <div v-if="summary.gradesCount === 0" class="card">
        <EmptyState
          :title="t('profile2.grades.emptyTitle')"
          :description="t('profile2.grades.emptyText')"
        />
      </div>
      <div v-else class="grid gap-4 lg:grid-cols-2">
        <div class="card p-5">
          <h3 class="mb-3 text-sm font-semibold text-fg">{{ t('profile2.grades.bySubject') }}</h3>
          <ul class="divide-y divide-border" data-testid="subject-averages">
            <li
              v-for="s in summary.bySubject"
              :key="s.subjectId"
              class="flex items-center justify-between gap-3 py-2.5"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-fg">{{ s.name }}</p>
                <p class="text-xs text-fg-muted">
                  {{ t('profile2.grades.subjectCount', { n: s.count }) }}
                </p>
              </div>
              <BaseBadge :tone="gradeTone(Math.round(s.average))">
                <span class="text-sm font-semibold">{{ fmtAvg(s.average) }}</span>
              </BaseBadge>
            </li>
          </ul>
        </div>
        <div class="card p-5">
          <h3 class="mb-3 text-sm font-semibold text-fg">{{ t('profile2.grades.recent') }}</h3>
          <ul class="divide-y divide-border">
            <li v-for="g in summary.recent" :key="g.id" class="py-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-fg">{{ g.subject.name }}</span>
                <BaseBadge :tone="gradeTone(g.value)">
                  <span class="text-sm font-semibold">{{ g.value }}</span>
                </BaseBadge>
              </div>
              <p class="text-xs text-fg-muted">
                {{ formatDate(g.date) }} - {{ g.teacher.fullName }}
              </p>
              <p v-if="g.comment" class="mt-1 text-sm text-fg-muted">{{ g.comment }}</p>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
