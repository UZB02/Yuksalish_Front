<script setup lang="ts">
import {
  FLOW_PILL_TONE,
  LIST_STAGES,
  listPill,
  listStageOf,
  type ListStage,
} from '@/utils/examFlow'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardList, Plus } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ApiMeta, ExamSessionItem, ExamSessionMeta, MyBlockItem } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ExamResultsListView from './ExamResultsListView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { SESSION_STATUSES, SESSION_TYPES, STATUS_TONE, fmtDateTime } from '@/utils/examSessions'

/** Imtihonlar ro'yxati: holat/tur filtri, sahifalash. O'qituvchi faqat o'zinikini ko'radi (server) */
const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())

/** Bo'limlar: joriy imtihonlar (tayyorlanmoqda / rejalashtirilgan / bekor qilingan) va "O'tgan / Natijalar" */
type Tab = 'sessions' | 'results'
const tab = ref<Tab>(route.query.tab === 'results' ? 'results' : 'sessions')
function setTab(k: Tab) {
  tab.value = k
  void router.replace({ query: k === 'results' ? { tab: 'results' } : {} })
}
watch(
  () => route.query.tab,
  (v) => {
    tab.value = v === 'results' ? 'results' : 'sessions'
  },
)

const items = ref<ExamSessionItem[]>([])
const meta = ref<ApiMeta | null>(null)
const info = ref<ExamSessionMeta | null>(null)
/** Menga biriktirilgan imtihon bloklari (faqat o'z bloklarim) */
const myBlocks = ref<MyBlockItem[]>([])
const loading = ref(true)
const error = ref('')
const status = ref('')
/** Bosqich bo'yicha filtr (yuklangan sahifa ichida): tayyorlanmoqda / rejalashtirilgan / o'tgan */
const stage = ref('')
const type = ref('')
const page = ref(1)

const statusOptions = computed(() => [
  { value: '', label: t('examSessions.filters.allStatuses') },
  ...SESSION_STATUSES.map((s) => ({ value: s, label: t(`examSessions.status.${s}`) })),
])
const typeOptions = computed(() => [
  { value: '', label: t('examSessions.filters.allTypes') },
  ...SESSION_TYPES.map((s) => ({ value: s, label: t(`examSessions.type.${s}`) })),
])
const stageOptions = computed(() => [
  { value: '', label: t('examSessions.filters.allStages') },
  ...LIST_STAGES.map((k) => ({ value: k, label: t(`examSessions.stages.${k}`) })),
])
/** Guruhlangan ko'rinish: bosqich sarlavhalari ostida (bo'sh guruhlar chiqmaydi) */
const groups = computed(() =>
  LIST_STAGES.filter((k) => !stage.value || stage.value === k)
    .map((k) => ({
      key: k as ListStage,
      // Yakunlangan imtihonlar "O'tgan / Natijalar" bo'limida; bu yerda faqat bekor qilinganlar qoladi
      items: items.value.filter((x) => listStageOf(x.status) === k && x.status !== 'closed'),
    }))
    .filter((g) => g.items.length > 0),
)
const canCreate = computed(() => (info.value?.allowedTypes.length ?? 0) > 0)

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    const [r, m] = await Promise.all([
      examsApi.listSessions({
        page: page.value,
        limit: 20,
        status: status.value || undefined,
        type: type.value || undefined,
      }),
      info.value ? Promise.resolve(info.value) : examsApi.sessionMeta(),
    ])
    items.value = r.items
    meta.value = r.meta
    info.value = m
    myBlocks.value = await examsApi.myBlocks().catch(() => [] as MyBlockItem[])
  } catch (e) {
    items.value = []
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch([status, type], () => {
  page.value = 1
  void load()
})
watch(schoolId, () => {
  info.value = null
  page.value = 1
  void load()
})
function setPage(p: number) {
  page.value = p
  void load()
}
// Qoralama: asosiy amal "Davom ettirish" (ustani server ma'lumotlari bilan ochadi)
const open = (s: ExamSessionItem) =>
  void router.push(
    s.status === 'draft'
      ? { name: 'exam-session-edit', params: { id: s.id } }
      : { name: 'exam-session', params: { id: s.id } },
  )
</script>

<template>
  <PageHeader :title="t('examSessions.title')" :description="t('examSessions.description')">
    <template #actions>
      <BaseButton
        v-if="canCreate"
        data-testid="session-create"
        @click="router.push({ name: 'exam-session-new' })"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        {{ t('examSessions.create') }}
      </BaseButton>
    </template>
  </PageHeader>

  <NeedsSchool v-if="needsSchool" />

  <template v-else>
    <p
      v-if="info && !info.pinSecretConfigured && info.isAdministration"
      class="mb-4 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning"
      data-testid="pin-secret-warning"
    >
      {{ t('examSessions.pinSecretMissing') }}
    </p>

    <div
      role="tablist"
      class="mb-4 inline-flex rounded-lg border border-border bg-surface-muted p-0.5"
      data-testid="sessions-tabs"
    >
      <button
        v-for="k in ['sessions', 'results'] as const"
        :key="k"
        type="button"
        role="tab"
        :aria-selected="tab === k"
        class="rounded-md px-4 py-1.5 text-sm font-medium"
        :class="tab === k ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'"
        :data-testid="`tab-${k}`"
        @click="setTab(k)"
      >
        {{ t(`examSessions.tabs.${k}`) }}
      </button>
    </div>

    <ExamResultsListView v-if="tab === 'results'" embedded data-testid="results-tab" />

    <RouterLink
      v-if="tab === 'sessions' && myBlocks.length"
      :to="{ name: 'exam-tasks' }"
      class="card mb-5 flex flex-wrap items-center gap-3 p-4 text-sm transition-colors hover:bg-surface-muted"
      data-testid="my-blocks"
    >
      <span class="font-medium text-fg">
        {{ t('examTasks.reminderText', { n: myBlocks.length }) }}
      </span>
      <span class="ml-auto font-medium text-primary-700">{{ t('examTasks.title') }} →</span>
    </RouterLink>

    <div v-if="tab === 'sessions'" class="mb-4 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
      <BaseSelect
        v-model="status"
        :label="t('examSessions.filters.status')"
        :options="statusOptions"
        data-testid="filter-status"
      />
      <BaseSelect
        v-model="stage"
        :label="t('examSessions.filters.stage')"
        :options="stageOptions"
        data-testid="filter-stage"
      />
      <BaseSelect
        v-model="type"
        :label="t('examSessions.filters.type')"
        :options="typeOptions"
        data-testid="filter-type"
      />
    </div>

    <template v-if="tab === 'sessions'">
      <div v-if="loading" class="space-y-3" aria-busy="true">
        <Skeleton v-for="n in 4" :key="n" class="h-20 w-full" />
      </div>
      <div v-else-if="error" class="card">
        <EmptyState :title="t('errors.loadFailed')" :description="error">
          <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
        </EmptyState>
      </div>
      <div v-else-if="groups.length === 0" class="card" data-testid="sessions-empty">
        <EmptyState
          :icon="ClipboardList"
          :title="t('examSessions.emptyTitle')"
          :description="t('examSessions.emptyText')"
        />
      </div>
      <div v-else class="space-y-4" data-testid="sessions-list">
        <section
          v-for="g in groups"
          :key="g.key"
          class="card overflow-hidden"
          :data-testid="`sessions-group-${g.key}`"
        >
          <h2
            class="border-b border-border bg-surface-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted"
          >
            {{ t(`examSessions.stages.${g.key}`) }} · {{ g.items.length }}
          </h2>
          <ul class="divide-y divide-border">
            <li v-for="s in g.items" :key="s.id">
              <button
                type="button"
                class="flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 sm:flex-row sm:items-center sm:gap-4"
                data-testid="session-row"
                @click="open(s)"
              >
                <div class="min-w-0 flex-1">
                  <p class="break-words font-medium text-fg">{{ s.title }}</p>
                  <p class="mt-0.5 text-xs text-fg-muted">
                    {{ t(`examSessions.type.${s.type}`) }}
                    <template v-if="s.subjectName"> · {{ s.subjectName }}</template>
                    <template v-if="s.classes.length">
                      · {{ s.classes.map((c) => c.name).join(', ') }}</template
                    >
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
                  <span>{{ fmtDateTime(s.scheduledStart) }}</span>
                  <span>{{ t('examSessions.minutes', { n: s.durationMin }) }}</span>
                  <span>{{ t('examSessions.participantsN', { n: s.participantsCount }) }}</span>
                  <span v-if="s.code" class="font-mono text-fg">{{ s.code }}</span>
                  <BaseBadge
                    v-if="listPill(s)"
                    :tone="FLOW_PILL_TONE[listPill(s)!]"
                    data-testid="session-status"
                  >
                    {{ t(`examFlow.pill.${listPill(s)}`) }}
                  </BaseBadge>
                  <BaseBadge v-else :tone="STATUS_TONE[s.status]" data-testid="session-status">
                    {{ t(`examSessions.status.${s.status}`) }}
                  </BaseBadge>
                  <BaseBadge
                    v-if="s.status === 'draft'"
                    tone="primary"
                    data-testid="session-resume"
                  >
                    {{ t('examSessions.wizard.resume') }}
                  </BaseBadge>
                  <BaseBadge v-if="s.timeUp" tone="danger" data-testid="session-time-up">
                    {{ t('examSessions.detail.timeUp') }}
                  </BaseBadge>
                </div>
              </button>
            </li>
          </ul>
        </section>
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
</template>
