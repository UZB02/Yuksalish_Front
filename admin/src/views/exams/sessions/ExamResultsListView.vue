<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Trophy } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ApiMeta, ExamClassOption, ExamResultListItem } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/utils/examSessions'

/**
 * "Natijalar" moduli: yopilgan imtihonlar nom va o'tkazilgan sana bo'yicha (imtihoni o'chirilgan, natijalari
 * saqlanganlar ham). Filtrlar: sana oralig'i, fan, sinf, nom qidiruvi. Bosilsa imtihon natijalari sahifasi ochiladi.
 */
const { t } = useI18n()
const router = useRouter()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())

const items = ref<ExamResultListItem[]>([])
const meta = ref<ApiMeta | null>(null)
const loading = ref(true)
const error = ref('')
const page = ref(1)
const q = ref('')
const from = ref('')
const to = ref('')
const subjectId = ref('')
const classId = ref('')
const subjects = ref<{ id: string; name: string }[]>([])
const classes = ref<ExamClassOption[]>([])

const subjectOptions = computed(() => [
  { value: '', label: t('examResultsList.allSubjects') },
  ...subjects.value.map((s) => ({ value: s.id, label: s.name })),
])
const classOptions = computed(() => [
  { value: '', label: t('examResultsList.allClasses') },
  ...classes.value.map((c) => ({ value: c.id, label: c.name })),
])

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    const r = await examsApi.listResults({
      page: page.value,
      limit: 20,
      q: q.value.trim() || undefined,
      from: from.value || undefined,
      to: to.value || undefined,
      subjectId: subjectId.value || undefined,
      classId: classId.value || undefined,
    })
    items.value = r.items
    meta.value = r.meta
  } catch (e) {
    items.value = []
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
async function loadFilters() {
  if (needsSchool.value) return
  try {
    const [s, c] = await Promise.all([examsApi.subjects(), examsApi.classOptions()])
    subjects.value = s.subjects.map((x) => ({ id: x.id, name: x.name }))
    classes.value = c
  } catch {
    /* filtrsiz ham ishlaydi */
  }
}
onMounted(() => {
  void loadFilters()
  void load()
})
let timer: ReturnType<typeof setTimeout> | undefined
watch([q, from, to, subjectId, classId], () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})
watch(schoolId, () => {
  page.value = 1
  void loadFilters()
  void load()
})
const setPage = (p: number) => {
  page.value = p
  void load()
}
const open = (r: ExamResultListItem) =>
  void router.push({ name: 'exam-session-results', params: { id: r.id } })
</script>

<template>
  <PageHeader :title="t('examResultsList.title')" :description="t('examResultsList.description')" />

  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="results-filters">
      <BaseInput
        v-model="q"
        :label="t('examResultsList.search')"
        :maxlength="100"
        data-testid="rl-search"
      />
      <BaseInput
        v-model="from"
        type="date"
        :label="t('examResultsList.from')"
        data-testid="rl-from"
      />
      <BaseInput v-model="to" type="date" :label="t('examResultsList.to')" data-testid="rl-to" />
      <BaseSelect
        v-model="subjectId"
        :label="t('examResultsList.subject')"
        :options="subjectOptions"
        data-testid="rl-subject"
      />
      <BaseSelect
        v-model="classId"
        :label="t('examResultsList.class')"
        :options="classOptions"
        data-testid="rl-class"
      />
    </div>

    <div v-if="loading" class="space-y-2" aria-busy="true">
      <Skeleton v-for="i in 4" :key="i" class="h-16 w-full" />
    </div>
    <div v-else-if="error" class="card">
      <EmptyState :title="t('errors.loadFailed')" :description="error" />
    </div>
    <div v-else-if="items.length === 0" class="card" data-testid="rl-empty">
      <EmptyState
        :title="t('examResultsList.emptyTitle')"
        :description="t('examResultsList.emptyText')"
      >
        <template #icon><Trophy class="h-8 w-8" aria-hidden="true" /></template>
      </EmptyState>
    </div>
    <div v-else class="card overflow-hidden">
      <ul class="divide-y divide-border">
        <li v-for="(r, i) in items" :key="r.id">
          <button
            type="button"
            class="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between"
            :data-testid="`rl-row-${i}`"
            @click="open(r)"
          >
            <div class="min-w-0">
              <p class="break-words font-medium text-fg" data-testid="rl-title">{{ r.title }}</p>
              <p class="mt-0.5 text-xs text-fg-muted">
                {{ r.subjects.map((s) => s.name).join(', ') }}
                <template v-if="r.classes.length">
                  · {{ r.classes.map((c) => c.name).join(', ') }}</template
                >
                <template v-if="r.blocksCount > 1">
                  · {{ t('examResultsList.blocksN', { n: r.blocksCount }) }}</template
                >
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
              <span data-testid="rl-date">{{ fmtDateTime(r.heldAt) }}</span>
              <span>{{
                t('examResultsList.submittedN', { n: r.submitted, total: r.participants })
              }}</span>
              <BaseBadge v-if="r.examDeleted" tone="neutral" data-testid="rl-deleted">
                {{ t('examResultsList.examDeleted') }}
              </BaseBadge>
            </div>
          </button>
        </li>
      </ul>
      <BasePagination
        v-if="meta && meta.totalPages > 1"
        :page="meta.page"
        :total-pages="meta.totalPages"
        :total="meta.total"
        :limit="meta.limit"
        @change="setPage"
      />
    </div>
  </template>
</template>
