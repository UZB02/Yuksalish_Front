<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { BookOpen, FileQuestion, Layers, Search } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ExamSubjectsResponse } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'

/** Savollar banki: 1-daraja - FAN kartalari (o'qituvchi faqat o'z fanlarini ko'radi) */
const { t } = useI18n()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())

const data = ref<ExamSubjectsResponse | null>(null)
const loading = ref(true)
const error = ref('')
const search = ref('')

const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  const all = data.value?.subjects ?? []
  return q ? all.filter((s) => s.name.toLowerCase().includes(q)) : all
})

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await examsApi.subjects()
  } catch (e) {
    data.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(schoolId, () => {
  search.value = ''
  void load()
})
</script>

<template>
  <PageHeader :title="t('exams.bank.title')" :description="t('exams.bank.description')" />

  <NeedsSchool v-if="needsSchool" />

  <div v-else-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
    <Skeleton v-for="n in 6" :key="n" class="h-32 w-full" />
  </div>

  <div v-else-if="error" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else-if="(data?.subjects.length ?? 0) === 0" class="card" data-testid="no-subjects">
    <EmptyState
      :icon="BookOpen"
      :title="data?.scope === 'own' ? t('exams.bank.noOwnTitle') : t('exams.bank.noSubjectsTitle')"
      :description="
        data?.scope === 'own' ? t('exams.bank.noOwnText') : t('exams.bank.noSubjectsText')
      "
    />
  </div>

  <template v-else>
    <div class="relative mb-4 max-w-md">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
        aria-hidden="true"
      />
      <input
        v-model="search"
        type="search"
        :placeholder="t('exams.bank.search')"
        :aria-label="t('exams.bank.search')"
        class="block h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
        data-testid="subject-search"
      />
    </div>
    <p v-if="data?.scope === 'own'" class="mb-3 text-xs text-fg-muted">
      {{ t('exams.questions.ownScopeHint') }}
    </p>

    <p v-if="shown.length === 0" class="card p-5 text-sm text-fg-muted">
      {{ t('exams.bank.noMatch') }}
    </p>
    <ul v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="subject-grid">
      <li v-for="s in shown" :key="s.id">
        <RouterLink
          :to="{ name: 'exam-subject', params: { subjectId: s.id } }"
          class="card flex h-full flex-col gap-3 p-5 transition-colors hover:border-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          data-testid="subject-card"
        >
          <div class="flex items-start justify-between gap-2">
            <h2 class="min-w-0 break-words text-lg font-semibold text-fg">{{ s.name }}</h2>
            <BaseBadge v-if="!s.isActive" tone="warning" data-testid="subject-inactive">
              {{ t('exams.bank.inactive') }}
            </BaseBadge>
          </div>
          <div class="mt-auto flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-muted">
            <span class="inline-flex items-center gap-1.5" data-testid="subject-topics">
              <Layers class="h-4 w-4" aria-hidden="true" />
              {{ t('exams.bank.topicsCount', { n: s.topicsCount }) }}
            </span>
            <span class="inline-flex items-center gap-1.5" data-testid="subject-questions">
              <FileQuestion class="h-4 w-4" aria-hidden="true" />
              {{ t('exams.bank.questionsCount', { n: s.questionsCount }) }}
            </span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </template>
</template>
