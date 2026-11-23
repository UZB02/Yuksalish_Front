<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Download } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ExamAnalysis, ExamResultRow, ExamResultsResponse } from '@/api/types'
import BlocksView from '@/components/exams/BlocksView.vue'
import ExamBreadcrumb from '@/components/exams/ExamBreadcrumb.vue'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import ParticipantResultModal from './ParticipantResultModal.vue'

/** Imtihon ichidagi natijalar: jadval (o'rin, ball, %), tafsilot, esse baholash, e'lon qilish, tahlil va eksport */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())

const id = computed(() => String(route.params.id))
const data = ref<ExamResultsResponse | null>(null)
const analysis = ref<ExamAnalysis | null>(null)
const loading = ref(true)
const error = ref('')
const tab = ref<'results' | 'analysis'>('results')
const analysisLoading = ref(false)
const busy = ref(false)
const openKey = ref<string | null>(null)

/** Blok ustunlari faqat bir nechta blokli imtihonda (eski/yagona blokli: jadval o'zgarmaydi) */
const blockCols = computed(() => ((data.value?.blocks?.length ?? 0) > 1 ? data.value!.blocks! : []))
/** "Fayl + kalit" bloki bor imtihon: ishtirokchiga berilgan variant ustuni */
const hasVariant = computed(() => !!data.value?.rows.some((r) => r.variant))
const blockCell = (
  r: { blocks?: { blockId: string; earned: number; max: number }[] },
  id: string,
) => {
  const b = r.blocks?.find((x) => x.blockId === id)
  return b ? `${b.earned}/${b.max}` : '—'
}
const analysisGroups = computed(() => {
  const qs = analysis.value?.questions ?? []
  const heads = analysis.value?.blocks ?? []
  if (heads.length <= 1) return [{ id: '', title: '', questions: qs }]
  return heads.map((h) => ({
    id: h.id,
    title: h.title || h.subjectName || '',
    questions: qs.filter((q) => q.blockId === h.id),
  }))
})
const search = ref('')
const classFilter = ref('')
const statusFilter = ref('')
type SortKey = 'rank' | 'name' | 'percent' | 'time'
const sortKey = ref<SortKey>('rank')
const sortDir = ref<1 | -1>(1)

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await examsApi.sessionResults(id.value)
  } catch (e) {
    data.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(id, () => {
  analysis.value = null
  void load()
})
watch(schoolId, () => void router.replace({ name: 'exam-sessions' }))

async function openAnalysis() {
  tab.value = 'analysis'
  if (analysis.value || analysisLoading.value) return
  analysisLoading.value = true
  try {
    analysis.value = await examsApi.resultsAnalysis(id.value)
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    analysisLoading.value = false
  }
}

const classOptions = computed(() => {
  const names = [
    ...new Set((data.value?.rows ?? []).map((r) => r.className).filter(Boolean)),
  ] as string[]
  return [
    { value: '', label: t('examResults.filters.allClasses') },
    ...names.map((n) => ({ value: n, label: n })),
  ]
})
const statusOptions = computed(() => [
  { value: '', label: t('examResults.filters.allStatuses') },
  ...(['not_started', 'joined', 'in_progress', 'submitted', 'auto_submitted'] as const).map(
    (s) => ({
      value: s,
      label: t(`examResults.status.${s}`),
    }),
  ),
])

const cmp = (a: ExamResultRow, b: ExamResultRow): number => {
  const nz = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v)
  let r = 0
  if (sortKey.value === 'name') r = a.fullName.localeCompare(b.fullName)
  else if (sortKey.value === 'percent')
    r = (b.percent ?? -1) - (a.percent ?? -1) // yuqori foiz birinchi, baholanmaganlar oxirida (dir=1)
  else if (sortKey.value === 'time') r = nz(a.timeSpentSec) - nz(b.timeSpentSec)
  else r = nz(a.rank) - nz(b.rank)
  if (r === 0) r = a.fullName.localeCompare(b.fullName)
  return r * sortDir.value
}
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (data.value?.rows ?? [])
    .filter(
      (r) =>
        (!q || r.fullName.toLowerCase().includes(q)) &&
        (!classFilter.value || r.className === classFilter.value) &&
        (!statusFilter.value || r.status === statusFilter.value),
    )
    .sort(cmp)
})
function sortBy(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 1 ? -1 : 1
  else {
    sortKey.value = k
    sortDir.value = 1
  }
}

const fmtTime = (sec: number | null) =>
  sec === null ? '—' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const statusTone = (s: string) =>
  s === 'submitted'
    ? 'success'
    : s === 'auto_submitted'
      ? 'primary'
      : s === 'in_progress'
        ? 'warning'
        : 'neutral'

async function download(format: 'xlsx' | 'pdf') {
  busy.value = true
  try {
    await examsApi.downloadResults(id.value, format)
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

async function publish(published: boolean) {
  if (!data.value) return
  let confirmPending = false
  if (published && data.value.summary.essayPending > 0) {
    const ok = await confirm({
      title: t('examResults.publish.confirmTitle'),
      message: t('examResults.publish.confirmText', { n: data.value.summary.essayPending }),
      confirmText: t('examResults.publish.confirmButton'),
    })
    if (!ok) return
    confirmPending = true
  }
  busy.value = true
  try {
    await examsApi.publishResults(id.value, { published, confirmPending })
    toast.success(
      t(published ? 'examResults.publish.toastPublished' : 'examResults.publish.toastUnpublished'),
    )
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

const flagTone = (f: string) =>
  f === 'too_easy' ? 'info' : f === 'too_hard' ? 'danger' : 'warning'
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <div v-else-if="loading" class="space-y-3" aria-busy="true">
    <Skeleton class="h-6 w-80" />
    <Skeleton class="h-32 w-full" />
  </div>
  <div v-else-if="error || !data" class="card">
    <EmptyState :title="t('examResults.loadFailed')" :description="error">
      <BaseButton
        variant="secondary"
        @click="router.push({ name: 'exam-session', params: { id } })"
      >
        {{ t('examSessions.detail.toList') }}
      </BaseButton>
    </EmptyState>
  </div>

  <template v-else>
    <ExamBreadcrumb
      :items="[
        data.session.examDeleted
          ? { label: t('examResultsList.title'), to: { name: 'exam-results-list' } }
          : { label: t('examResults.breadcrumbRoot'), to: { name: 'exam-sessions' } },
        data.session.examDeleted
          ? { label: data.session.title }
          : { label: data.session.title, to: { name: 'exam-session', params: { id } } },
        { label: t('examResults.title') },
      ]"
    />
    <PageHeader :title="data.session.title" :description="t('examResults.title')">
      <template #actions>
        <BaseButton
          variant="secondary"
          :loading="busy"
          data-testid="export-xlsx"
          @click="download('xlsx')"
        >
          <Download class="h-4 w-4" aria-hidden="true" /> {{ t('examResults.export.xlsx') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          :loading="busy"
          data-testid="export-pdf"
          @click="download('pdf')"
        >
          <Download class="h-4 w-4" aria-hidden="true" /> {{ t('examResults.export.pdf') }}
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Umumiy ko'rsatkichlar -->
    <div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="summary">
      <div class="card p-3">
        <p class="text-xs text-fg-muted">{{ t('examResults.summary.participants') }}</p>
        <p class="text-xl font-semibold" data-testid="sum-participants">
          {{ data.summary.participants }}
        </p>
      </div>
      <div class="card p-3">
        <p class="text-xs text-fg-muted">{{ t('examResults.summary.submitted') }}</p>
        <p class="text-xl font-semibold" data-testid="sum-submitted">
          {{ data.summary.submitted }}
        </p>
      </div>
      <div class="card p-3">
        <p class="text-xs text-fg-muted">{{ t('examResults.summary.average') }}</p>
        <p class="text-xl font-semibold" data-testid="sum-average">
          {{ data.summary.averagePercent ?? '—'
          }}<span v-if="data.summary.averagePercent !== null">%</span>
        </p>
      </div>
      <div class="card p-3">
        <p class="text-xs text-fg-muted">
          {{ t('examResults.summary.max') }} / {{ t('examResults.summary.min') }}
        </p>
        <p class="text-xl font-semibold" data-testid="sum-maxmin">
          {{ data.summary.maxPercent ?? '—' }} / {{ data.summary.minPercent ?? '—' }}
        </p>
      </div>
      <div v-if="data.summary.passPercent !== null" class="card p-3">
        <p class="text-xs text-fg-muted">
          {{ t('examResults.summary.passRate', { percent: data.summary.passPercent }) }}
        </p>
        <p class="text-xl font-semibold" data-testid="sum-pass">
          {{ data.summary.passRate ?? '—' }}<span v-if="data.summary.passRate !== null">%</span>
        </p>
      </div>
      <div class="card p-3">
        <p class="text-xs text-fg-muted">{{ t('examResults.summary.essayPending') }}</p>
        <p class="text-xl font-semibold" data-testid="sum-essay">{{ data.summary.essayPending }}</p>
      </div>
    </div>

    <!-- E'lon qilish / rejim -->
    <section class="card mb-4 flex flex-wrap items-center gap-3 p-4" data-testid="publish-block">
      <template v-if="data.session.resultsMode === 'after_publish'">
        <div class="mr-auto">
          <p class="font-medium text-fg">{{ t('examResults.publish.title') }}</p>
          <p class="text-sm text-fg-muted">{{ t('examResults.publish.modeInfo') }}</p>
        </div>
        <BaseBadge
          :tone="data.session.resultsPublished ? 'success' : 'neutral'"
          data-testid="publish-state"
        >
          {{
            data.session.resultsPublished
              ? t('examResults.publish.published')
              : t('examResults.publish.notPublished')
          }}
        </BaseBadge>
        <BaseButton
          v-if="!data.session.resultsPublished"
          :loading="busy"
          data-testid="publish"
          @click="publish(true)"
        >
          {{ t('examResults.publish.publish') }}
        </BaseButton>
        <BaseButton
          v-else
          variant="secondary"
          :loading="busy"
          data-testid="unpublish"
          @click="publish(false)"
        >
          {{ t('examResults.publish.unpublish') }}
        </BaseButton>
      </template>
      <p v-else class="text-sm text-fg-muted" data-testid="immediate-info">
        {{ t(`examResults.publish.immediate.${data.session.resultsMode}`) }}
      </p>
    </section>

    <div class="mb-3 flex gap-2" role="tablist">
      <BaseButton
        :variant="tab === 'results' ? 'primary' : 'secondary'"
        size="sm"
        data-testid="tab-results"
        @click="tab = 'results'"
      >
        {{ t('examResults.tabs.results') }}
      </BaseButton>
      <BaseButton
        :variant="tab === 'analysis' ? 'primary' : 'secondary'"
        size="sm"
        data-testid="tab-analysis"
        @click="openAnalysis"
      >
        {{ t('examResults.tabs.analysis') }}
      </BaseButton>
    </div>

    <!-- Natijalar jadvali -->
    <div v-if="tab === 'results'" class="card p-4">
      <div class="mb-3 grid gap-3 sm:grid-cols-3">
        <BaseInput
          v-model="search"
          type="search"
          :label="t('examResults.filters.search')"
          data-testid="filter-search"
        />
        <BaseSelect
          v-model="classFilter"
          :label="t('examResults.filters.cls')"
          :options="classOptions"
          data-testid="filter-class"
        />
        <BaseSelect
          v-model="statusFilter"
          :label="t('examResults.filters.status')"
          :options="statusOptions"
          data-testid="filter-status"
        />
      </div>
      <p v-if="data.rows.length === 0" class="text-sm text-fg-muted">
        {{ t('examResults.empty') }}
      </p>
      <p v-else-if="shown.length === 0" class="text-sm text-fg-muted" data-testid="no-match">
        {{ t('examResults.noMatch') }}
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[860px] text-left text-sm" data-testid="results-table">
          <thead class="text-xs uppercase text-fg-muted">
            <tr>
              <th class="py-2 pr-3">
                <button
                  type="button"
                  class="inline-flex items-center gap-1"
                  data-testid="sort-rank"
                  @click="sortBy('rank')"
                >
                  {{ t('examResults.cols.rank') }}
                  <span v-if="sortKey === 'rank'" aria-hidden="true">{{
                    sortDir === 1 ? '▲' : '▼'
                  }}</span>
                </button>
              </th>
              <th class="py-2 pr-3">
                <button type="button" data-testid="sort-name" @click="sortBy('name')">
                  {{ t('examResults.cols.name') }}
                </button>
              </th>
              <th class="py-2 pr-3">{{ t('examResults.cols.cls') }}</th>
              <th v-if="hasVariant" class="py-2 pr-3" data-testid="col-variant">
                {{ t('examResults.cols.variant') }}
              </th>
              <th class="py-2 pr-3">{{ t('examResults.cols.status') }}</th>
              <th
                v-for="(h, hi) in blockCols"
                :key="h.id"
                class="py-2 pr-3"
                :data-testid="`block-col-${hi}`"
              >
                {{ h.title || h.subjectName }}
              </th>
              <th class="py-2 pr-3">{{ t('examResults.cols.score') }}</th>
              <th class="py-2 pr-3">
                <button type="button" data-testid="sort-percent" @click="sortBy('percent')">
                  {{ t('examResults.cols.percent') }}
                </button>
              </th>
              <th v-if="data.summary.passPercent !== null" class="py-2 pr-3">
                {{ t('examResults.cols.passed') }}
              </th>
              <th class="py-2 pr-3">{{ t('examResults.cols.answered') }}</th>
              <th class="py-2 pr-3">
                <button type="button" data-testid="sort-time" @click="sortBy('time')">
                  {{ t('examResults.cols.time') }}
                </button>
              </th>
              <th class="py-2 pr-3">{{ t('examResults.cols.warnings') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="r in shown"
              :key="r.key"
              class="cursor-pointer hover:bg-surface-muted"
              tabindex="0"
              data-testid="result-row"
              @click="openKey = r.key"
              @keydown.enter="openKey = r.key"
            >
              <td class="py-2 pr-3 font-semibold" data-testid="cell-rank">{{ r.rank ?? '—' }}</td>
              <td class="py-2 pr-3 font-medium text-fg" data-testid="cell-name">
                {{ r.fullName }}
              </td>
              <td class="py-2 pr-3 text-fg-muted">{{ r.className ?? '—' }}</td>
              <td v-if="hasVariant" class="py-2 pr-3 font-semibold" data-testid="cell-variant">
                {{ r.variant ?? '—' }}
              </td>
              <td class="py-2 pr-3">
                <BaseBadge :tone="statusTone(r.status)" data-testid="cell-status">{{
                  t(`examResults.status.${r.status}`)
                }}</BaseBadge>
                <p
                  v-if="r.terminated"
                  class="mt-0.5 text-xs text-danger"
                  data-testid="cell-terminated"
                >
                  {{ t('examResults.terminated', { reason: r.terminated.reason }) }}
                </p>
              </td>
              <td
                v-for="(h, hi) in blockCols"
                :key="h.id"
                class="py-2 pr-3"
                :data-testid="`cell-block-${hi}`"
              >
                {{ r.earned !== null ? blockCell(r, h.id) : '—' }}
              </td>
              <td class="py-2 pr-3" data-testid="cell-score">
                <template v-if="r.earned !== null">{{ r.earned }} / {{ r.max }}</template>
                <template v-else>—</template>
                <BaseBadge
                  v-if="r.essayPending"
                  tone="warning"
                  class="ml-1"
                  data-testid="essay-badge"
                  >{{ t('examResults.essayN', { n: r.essayPending }) }}</BaseBadge
                >
              </td>
              <td class="py-2 pr-3" data-testid="cell-percent">
                {{ r.percent ?? '—' }}<span v-if="r.percent !== null">%</span>
              </td>
              <td v-if="data.summary.passPercent !== null" class="py-2 pr-3">
                <BaseBadge
                  v-if="r.passed !== null"
                  :tone="r.passed ? 'success' : 'danger'"
                  data-testid="cell-passed"
                  >{{ r.passed ? t('examResults.yes') : t('examResults.no') }}</BaseBadge
                >
                <span v-else class="text-fg-muted">—</span>
              </td>
              <td class="py-2 pr-3 text-fg-muted">
                {{ r.total ? `${r.answered}/${r.total}` : '—' }}
              </td>
              <td class="py-2 pr-3 text-fg-muted">{{ fmtTime(r.timeSpentSec) }}</td>
              <td class="py-2 pr-3">
                <BaseBadge v-if="r.warnings > 0" tone="warning">{{ r.warnings }}</BaseBadge>
                <span v-else class="text-fg-muted">0</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Savollar tahlili -->
    <div v-else class="space-y-3" data-testid="analysis">
      <p v-if="analysisLoading" class="text-sm text-fg-muted">{{ t('common.loading') }}</p>
      <p
        v-else-if="!analysis || analysis.submittedAttempts === 0"
        class="card p-4 text-sm text-fg-muted"
        data-testid="analysis-empty"
      >
        {{ t('examResults.analysis.empty') }}
      </p>
      <template v-else>
        <template v-for="g in analysisGroups" :key="g.id">
          <h3
            v-if="g.title"
            class="pt-2 text-sm font-semibold text-fg"
            data-testid="analysis-block-title"
          >
            {{ g.title }}
          </h3>
          <article
            v-for="q in g.questions"
            :key="q.id"
            class="card space-y-2 p-4"
            data-testid="analysis-question"
          >
            <div class="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <span class="font-semibold text-fg">{{
                t('examResults.detail.question', { n: q.index })
              }}</span>
              <span>{{ t('examResults.analysis.shown') }}: {{ q.shown }}</span>
              <span v-if="q.correctPercent !== null" data-testid="q-correct"
                >{{ t('examResults.analysis.correctPercent') }}: {{ q.correctPercent }}%</span
              >
              <span v-if="q.averagePoints !== null"
                >{{ t('examResults.analysis.averagePoints') }}: {{ q.averagePoints }} /
                {{ q.points }}</span
              >
              <BaseBadge v-for="f in q.flags" :key="f" :tone="flagTone(f)" data-testid="q-flag">{{
                t(`examResults.analysis.flags.${f}`)
              }}</BaseBadge>
            </div>
            <BlocksView :blocks="q.content" />
            <ul v-if="q.options.length" class="space-y-1">
              <li v-for="o in q.options" :key="o.id" class="text-sm" data-testid="q-option">
                <div class="flex items-center gap-2">
                  <span
                    class="min-w-0 flex-1 truncate"
                    :class="o.correct ? 'font-semibold text-success' : 'text-fg'"
                  >
                    {{
                      o.content
                        .map((b) => (b.type === 'text' ? b.text : b.type === 'math' ? b.tex : ''))
                        .join(' ') || o.id
                    }}
                  </span>
                  <span class="w-24 text-right text-fg-muted"
                    >{{ o.chosen }} ({{ o.percent }}%)</span
                  >
                </div>
                <div class="h-1.5 rounded bg-surface-muted">
                  <div
                    class="h-1.5 rounded"
                    :class="o.correct ? 'bg-success' : 'bg-danger'"
                    :style="{ width: `${Math.min(100, o.percent)}%` }"
                  />
                </div>
              </li>
            </ul>
          </article>
        </template>
      </template>
    </div>

    <ParticipantResultModal
      :open="!!openKey"
      :session-id="id"
      :participant-key="openKey"
      :can-grade="true"
      @close="openKey = null"
      @changed="load"
    />
  </template>
</template>
