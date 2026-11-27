<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { LayoutGrid, List, Search } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ExamAnalysis, ExamResultsResponse } from '@/api/types'
import AnalysisGrid from '@/components/exams/results/AnalysisGrid.vue'
import ClassResults from '@/components/exams/results/ClassResults.vue'
import ResultsHero from '@/components/exams/results/ResultsHero.vue'
import ResultsInsights from '@/components/exams/results/ResultsInsights.vue'
import ResultsStrip from '@/components/exams/results/ResultsStrip.vue'
import ResultsTable from '@/components/exams/results/ResultsTable.vue'
import {
  classNames,
  classStat,
  filterCounts,
  matchFilter,
  sortRows,
  type ResultFilter,
  type SortKey,
} from '@/components/exams/results/resultsModel'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { fmtDateTime } from '@/utils/examSessions'
import ParticipantResultModal from './ParticipantResultModal.vue'

/**
 * Imtihon natijalari ("B: reyting + sinflar yonma-yon"): gradient sarlavha, filtr kataklari (STRIP), 3 ta tahlil kartasi,
 * asboblar qatori, sinflar kartalari yoki jadval, savollar tahlili. O'quvchini bosish tafsilot oynasini ochadi (esse baholash).
 *
 * Eski amal -> yangi joy: Excel/PDF -> sarlavha; e'lon qilish -> sarlavhaning asosiy tugmasi; e'londan olish -> sarlavha menyusi;
 * ko'rsatkichlar -> STRIP + "O'tish va taqsimot" kartasi; holat filtri -> STRIP kataklari; qidiruv/sinf/saralash -> asboblar qatori.
 */
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
const view = ref<'cards' | 'table'>('cards')

/** Blok ustunlari faqat bir nechta blokli imtihonda (eski/yagona blokli: jadval o'zgarmaydi) */
const blockCols = computed(() => ((data.value?.blocks?.length ?? 0) > 1 ? data.value!.blocks! : []))
/** "Fayl + kalit" bloki bor imtihon: ishtirokchiga berilgan variant ustuni */
const hasVariant = computed(() => !!data.value?.rows.some((r) => r.variant))
const hasPass = computed(() => data.value?.summary.passPercent != null)

const search = ref('')
const classFilter = ref('')
const filter = ref<ResultFilter>('all')
const absentOpen = ref(false)
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

const rows = computed(() => data.value?.rows ?? [])
const classes = computed(() => classNames(rows.value))
const classOptions = computed(() => [
  { value: '', label: t('examResults.filters.allClasses') },
  ...classes.value.filter(Boolean).map((n) => ({ value: n, label: n })),
])
const sortOptions = computed(() =>
  (['rank', 'name', 'percent', 'time'] as const).map((k) => ({
    value: k,
    label: t(`examResults.toolbar.sort_${k}`),
  })),
)
const counts = computed(() => filterCounts(rows.value))

const matchesText = (r: { fullName: string; className: string | null }) => {
  const q = search.value.trim().toLowerCase()
  return (
    (!q || r.fullName.toLowerCase().includes(q)) &&
    (!classFilter.value || r.className === classFilter.value)
  )
}
/** Filtr (STRIP) + qidiruv + sinf bo'yicha ko'rinadigan qatorlar */
const visible = computed(() =>
  rows.value.filter((r) => matchesText(r) && matchFilter(r, filter.value, absentOpen.value)),
)
/** Kirmaganlar (chiplar uchun): qidiruv va sinfga mos */
const absentRows = computed(() =>
  rows.value.filter((r) => r.status === 'not_started' && matchesText(r)),
)
const showAbsent = computed(() => filter.value === 'all' || filter.value === 'n')

const tableRows = computed(() => sortRows(visible.value, sortKey.value, sortDir.value))
const tableAbsent = computed(() =>
  filter.value === 'all' && !absentOpen.value ? absentRows.value.map((r) => r.fullName) : [],
)
/** Sinflar kartalari: har sinfning kirgan o'quvchilari saralangan + kirmaganlar chiplari */
const classCards = computed(() => {
  const entered = sortRows(
    visible.value.filter((r) => r.status !== 'not_started'),
    sortKey.value,
    sortDir.value,
  )
  return classes.value
    .filter((c) => !classFilter.value || c === classFilter.value)
    .map((c) => ({
      stat: classStat(rows.value, c),
      rows: entered.filter((r) => (r.className ?? '') === c),
      absent: showAbsent.value
        ? absentRows.value.filter((r) => (r.className ?? '') === c).map((r) => r.fullName)
        : [],
    }))
    .filter((c) => c.rows.length || c.absent.length)
})
const hasResults = computed(() =>
  view.value === 'table'
    ? tableRows.value.length > 0 || tableAbsent.value.length > 0
    : classCards.value.length > 0,
)

function setFilter(f: ResultFilter) {
  filter.value = f
  absentOpen.value = false
  tab.value = 'results'
}
function setSort(k: string) {
  sortKey.value = k as SortKey
  sortDir.value = 1
}
function sortBy(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 1 ? -1 : 1
  else {
    sortKey.value = k
    sortDir.value = 1
  }
}
function gradeEssays() {
  setFilter('ep')
  tab.value = 'results'
}

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

const afterPublish = computed(() => data.value?.session.resultsMode === 'after_publish')
const pill = computed(() => {
  const s = data.value?.session
  if (!s) return ''
  if (s.resultsMode !== 'after_publish') return t(`examResults.publish.immediate.${s.resultsMode}`)
  return t(
    s.resultsPublished ? 'examResults.publish.published' : 'examResults.publish.notPublished',
  )
})
const meta = computed(() =>
  [classes.value.filter(Boolean).join(', '), fmtDateTime(data.value?.session.scheduledStart)]
    .filter(Boolean)
    .join(' · '),
)
const goBack = () =>
  void router.push(
    data.value?.session.examDeleted
      ? { name: 'exam-results-list' }
      : { name: 'exam-session', params: { id: id.value } },
  )

const field =
  'h-9 min-w-0 rounded-lg border border-border bg-surface px-2 text-sm text-fg focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20'
const views = [
  { key: 'cards', icon: LayoutGrid },
  { key: 'table', icon: List },
] as const
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
    <ResultsHero
      :title="data.session.title"
      :meta="meta"
      :pill="pill"
      :pill-test-id="afterPublish ? 'publish-state' : 'immediate-info'"
      :busy="busy"
      :can-publish="afterPublish && !data.session.resultsPublished"
      :can-unpublish="afterPublish && data.session.resultsPublished"
      :has-exam-page="!data.session.examDeleted"
      @back="goBack"
      @excel="download('xlsx')"
      @pdf="download('pdf')"
      @publish="publish(true)"
      @unpublish="publish(false)"
      @exam-page="router.push({ name: 'exam-session', params: { id } })"
    />

    <ResultsStrip
      :active="filter"
      :submitted="data.summary.submitted"
      :participants="data.summary.participants"
      :ok="counts.ok"
      :no="counts.no"
      :terminated="counts.t"
      :absent="counts.n"
      :essay="counts.ep"
      :has-pass="hasPass"
      @filter="setFilter"
    />

    <ResultsInsights
      v-if="tab === 'results'"
      :data="data"
      :show-essay-hint="afterPublish && !data.session.resultsPublished"
      @open="openKey = $event"
    />

    <!-- Asboblar qatori -->
    <div
      class="mb-3 flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1"
    >
      <div class="flex gap-1" role="tablist" :aria-label="t('examResults.toolbar.tabsAria')">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'results'"
          class="h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium"
          :class="
            tab === 'results' ? 'bg-primary-100 text-primary-700' : 'text-fg-muted hover:text-fg'
          "
          data-testid="tab-results"
          @click="tab = 'results'"
        >
          {{ t('examResults.tabs.results') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'analysis'"
          class="h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium"
          :class="
            tab === 'analysis' ? 'bg-primary-100 text-primary-700' : 'text-fg-muted hover:text-fg'
          "
          data-testid="tab-analysis"
          @click="openAnalysis"
        >
          {{ t('examResults.tabs.analysis') }}
        </button>
      </div>
      <span class="flex-1" />
      <template v-if="tab === 'results'">
        <label class="relative block w-full sm:w-52">
          <Search
            class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-fg-muted"
            aria-hidden="true"
          />
          <input
            v-model="search"
            type="search"
            :class="[field, 'w-full pl-8 placeholder:text-fg-muted']"
            :placeholder="t('examResults.filters.search')"
            :aria-label="t('examResults.filters.search')"
            data-testid="filter-search"
          />
        </label>
        <span class="flex gap-2 max-sm:w-full [&>select]:max-sm:flex-1">
          <select
            v-model="classFilter"
            :class="field"
            :aria-label="t('examResults.filters.cls')"
            data-testid="filter-class"
          >
            <option v-for="o in classOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <select
            :value="sortKey"
            :class="field"
            :aria-label="t('examResults.toolbar.sort')"
            data-testid="sort-select"
            @change="setSort(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="o in sortOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </span>
        <span
          class="inline-flex rounded-lg border border-border p-0.5"
          role="group"
          :aria-label="t('examResults.toolbar.viewAria')"
        >
          <button
            v-for="v in views"
            :key="v.key"
            type="button"
            class="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium"
            :class="view === v.key ? 'bg-primary-100 text-primary-700' : 'text-fg-muted'"
            :aria-pressed="view === v.key"
            :aria-label="t(`examResults.toolbar.view_${v.key}`)"
            :data-testid="`view-${v.key}`"
            @click="view = v.key"
          >
            <component :is="v.icon" class="h-4 w-4" aria-hidden="true" />
            <span class="hidden md:inline">{{ t(`examResults.toolbar.view_${v.key}`) }}</span>
          </button>
        </span>
      </template>
    </div>

    <!-- Natijalar -->
    <template v-if="tab === 'results'">
      <p v-if="rows.length === 0" class="card p-8 text-center text-sm text-fg-muted">
        {{ t('examResults.empty') }}
      </p>
      <p
        v-else-if="!hasResults"
        class="card p-8 text-center text-sm text-fg-muted"
        data-testid="no-match"
      >
        {{ t('examResults.noMatch') }}
      </p>
      <ResultsTable
        v-else-if="view === 'table'"
        :rows="tableRows"
        :block-cols="blockCols"
        :has-variant="hasVariant"
        :has-pass="hasPass"
        :sort-key="sortKey"
        :sort-dir="sortDir"
        :absent="tableAbsent"
        @sort="sortBy"
        @open="openKey = $event"
        @expand-absent="absentOpen = true"
      />
      <div
        v-else
        class="grid items-start gap-3"
        :class="classFilter ? '' : 'xl:grid-cols-2'"
        data-testid="class-cards"
      >
        <ClassResults
          v-for="c in classCards"
          :key="c.stat.name"
          :stat="c.stat"
          :rows="c.rows"
          :absent="c.absent"
          :has-pass="hasPass"
          @open="openKey = $event"
        />
      </div>
    </template>

    <!-- Savollar tahlili -->
    <div v-else data-testid="analysis">
      <p v-if="analysisLoading" class="text-sm text-fg-muted">{{ t('common.loading') }}</p>
      <p
        v-else-if="!analysis || analysis.submittedAttempts === 0"
        class="card p-4 text-sm text-fg-muted"
        data-testid="analysis-empty"
      >
        {{ t('examResults.analysis.empty') }}
      </p>
      <AnalysisGrid v-else :analysis="analysis" @grade-essays="gradeEssays" />
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
