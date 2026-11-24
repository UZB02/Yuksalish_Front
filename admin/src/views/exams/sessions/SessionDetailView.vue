<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { examsApi } from '@/api/exams.api'
import type {
  ExamAttemptsResponse,
  ExamResultsResponse,
  ExamSession,
  ExamSessionMeta,
} from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import BulkDialogs, { type BulkMode } from '@/components/exams/session/BulkDialogs.vue'
import ClassSection from '@/components/exams/session/ClassSection.vue'
import ExamHero from '@/components/exams/session/ExamHero.vue'
import ExamStatStrip from '@/components/exams/session/ExamStatStrip.vue'
import ExamToolbar from '@/components/exams/session/ExamToolbar.vue'
import InfoPanel from '@/components/exams/session/InfoPanel.vue'
import ResultsInsights from '@/components/exams/session/ResultsInsights.vue'
import SessionActionDialogs from '@/components/exams/session/SessionActionDialogs.vue'
import StudentDrawer from '@/components/exams/session/StudentDrawer.vue'
import SubjectCards from '@/components/exams/session/SubjectCards.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useExamLive, useVisiblePoll } from '@/composables/useExamLive'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useSessionActions } from '@/composables/useSessionActions'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import {
  buildBoardRows,
  distribution,
  groupSections,
  layoutOf,
  matchesFilter,
  matchesSearch,
  pruneSelection,
  readinessPct,
  sortRows,
  startsInParts,
  statCells,
  stageOf,
  subjectAverages,
  type BoardRow,
  type FilterKey,
} from '@/utils/examBoard'
import { blockState, blocksSummary, examFlow } from '@/utils/examFlow'
import { fmtDateTime } from '@/utils/examSessions'
import ParticipantResultModal from './ParticipantResultModal.vue'
import ParticipantsPanel from './ParticipantsPanel.vue'

/**
 * Imtihon sahifasi ("4B: sinflar yonma-yon"): sarlavha + amallar, raqamlar qatori (filtr), asboblar qatori,
 * o'quvchilar sinf bo'yicha kataklarda, fanlar va ma'lumot bo'limlari, o'quvchi paneli (drawer).
 * Ma'lumot: nazoratchida har 5 s da bitta sessionLive; boshqalarda 15 s da sessionAttempts; yopilganda bir marta.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())

const id = computed(() => String(route.params.id))
const s = ref<ExamSession | null>(null)
const meta = ref<ExamSessionMeta | null>(null)
const loading = ref(true)
const error = ref('')
const showAdd = ref(false)
const attempts = ref<ExamAttemptsResponse | null>(null)
const results = ref<ExamResultsResponse | null>(null)

const stage = computed(() => (s.value ? stageOf(s.value.status) : 'before'))

// ---- Ma'lumot yuklash ----
/** Kechikkan eski javob yangi imtihon ustiga yozilmasin: so'rov boshidagi id va ketma-ket raqam solishtiriladi */
let loadSeq = 0
async function loadAttempts() {
  const sid = id.value
  if (!s.value) return
  try {
    const r = await examsApi.sessionAttempts(sid)
    if (sid === id.value) attempts.value = r
  } catch {
    /* kataklar holat ma'lumotisiz ko'rinadi */
  }
}
const resultsState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
/** Yopilgan imtihon natijalari: bir marta (va yangilashda). Xato sahifani buzmaydi: kichik xabar + "Qayta urinish" */
async function loadResults() {
  const cur = s.value
  if (!cur || cur.status !== 'closed' || !cur.canViewResults) return
  const sid = id.value
  if (!results.value) resultsState.value = 'loading'
  try {
    const r = await examsApi.sessionResults(sid)
    if (sid !== id.value) return
    results.value = r
    resultsState.value = 'ready'
  } catch {
    if (sid === id.value) resultsState.value = 'error'
  }
}
async function load() {
  if (needsSchool.value) return
  const seq = ++loadSeq
  const sid = id.value
  loading.value = true
  error.value = ''
  attempts.value = null
  results.value = null
  resultsState.value = 'idle'
  try {
    const [x, m] = await Promise.all([examsApi.getSession(sid), examsApi.sessionMeta()])
    if (seq !== loadSeq) return
    s.value = x
    meta.value = m
    void loadClosed()
  } catch (e) {
    if (seq !== loadSeq) return
    s.value = null
    error.value = errorMessage(e, t)
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}
/** Yopilgan imtihon: natijalar; natija ko'rolmaydigan yoki natija xatosida urinishlar (bir martalik, zaxira) */
async function loadClosed() {
  if (s.value?.status !== 'closed') return
  await loadResults()
  if (!s.value?.canViewResults || resultsState.value === 'error') await loadAttempts()
}
async function refresh() {
  const sid = id.value
  try {
    const x = await examsApi.getSession(sid)
    if (sid !== id.value) return
    s.value = x
  } catch (e) {
    toast.error(errorMessage(e, t))
    return
  }
  void loadClosed()
  live.refreshNow()
  attemptsPoll.refreshNow()
}

// ---- Jonli ma'lumot (nazoratchi) yoki urinishlar (boshqalar) ----
const liveEnabled = computed(() => !!s.value?.canMonitor)
const attemptsEnabled = computed(
  () => !!s.value && !s.value.canMonitor && ['scheduled', 'open'].includes(s.value.status),
)
let reloading = false
function onLiveStatus(status: string) {
  if (!s.value || status === s.value.status || reloading) return
  reloading = true
  void refresh().finally(() => (reloading = false))
}
const live = useExamLive(id, liveEnabled, onLiveStatus)
const attemptsPoll = useVisiblePoll(loadAttempts, 15_000, attemptsEnabled)

onMounted(load)
watch(id, () => {
  // Boshqa imtihonga o'tilganda eski holat (panel, tanlov, filtr, qidiruv, kodlar) qolmasin
  s.value = null
  openKey.value = null
  resultKey.value = null
  shownCodes.value = {}
  selected.value = []
  q.value = ''
  filter.value = 'all'
  tabSel.value = null
  showAdd.value = false
  bulkMode.value = null
  void load()
})
watch(schoolId, () => void router.replace({ name: 'exam-sessions' }))
watch(stage, () => {
  tabSel.value = null
  filter.value = 'all'
  selected.value = []
})

// ---- Amallar ----
const A = useSessionActions({ id, s, results, refresh })

const realBlocks = computed(() => (s.value?.blocks ?? []).filter((b) => !b.legacy))
const hasBlocks = computed(() => realBlocks.value.length > 0)
const flow = computed(() => (s.value && hasBlocks.value ? examFlow(s.value) : null))
const pill = computed(() =>
  !s.value
    ? ''
    : flow.value
      ? t(`examFlow.pill.${flow.value.pill}`)
      : t(`examSessions.status.${s.value.status}`),
)
const contribShort = computed(() => {
  const d = s.value?.contribDeadline
  return d ? fmtDateTime(d).slice(0, 5) : null
})
/** Tasdiqlanmagan (o'qituvchisi bor) fanlar: rejalashtirishga to'sqinlik */
const missing = computed(() =>
  realBlocks.value
    .filter((b) => b.contributors.length > 0)
    .filter((b) => !(b.status === 'ready' && b.readyBy !== 'contributor')),
)
const missingNames = computed(() => missing.value.map((b) => b.subjectName ?? b.title))
/** Tasdiqlash uchun birinchi tayyor fan (o'qituvchi tugatgan) */
const reviewTarget = computed(() => {
  const b = missing.value.find((x) => blockState(x) === 'done')
  return b ? { id: b.id, name: b.subjectName ?? b.title } : null
})
const canRemind = computed(
  () =>
    s.value?.status === 'draft' &&
    !!s.value.canEdit &&
    realBlocks.value.some((b) => blockState(b) === 'collecting' && b.contributors.length > 0),
)
const canPublish = computed(
  () =>
    s.value?.status === 'closed' &&
    !!s.value.canViewResults &&
    results.value?.session.resultsMode === 'after_publish' &&
    !results.value.session.resultsPublished,
)
const openBlock = (blockId: string) =>
  void router.push({ name: 'exam-my-block', params: { sessionId: id.value, blockId } })
const reviewBlock = (blockId: string) =>
  void router.push({ name: 'exam-block-review', params: { id: id.value, blockId } })
const editSettings = () => void router.push({ name: 'exam-session-edit', params: { id: id.value } })

async function copyCode() {
  const c = s.value?.code
  if (!c) return
  try {
    await navigator.clipboard.writeText(c)
    toast.success(t('examBoard.codeCopied'))
  } catch {
    toast.info(c)
  }
}

function onHeroAction(key: string) {
  switch (key) {
    case 'submit':
      return void A.submitSession()
    case 'review':
      return reviewTarget.value ? reviewBlock(reviewTarget.value.id) : undefined
    case 'approve':
      return void A.act('approve', 'examSessions.toast.approved')
    case 'reject':
      return A.openReject()
    case 'open':
      return void A.act('open', 'examSessions.toast.opened')
    case 'extend':
      return A.openExtend()
    case 'close':
      return void A.closeNow()
    case 'results':
      return void router.push({ name: 'exam-session-results', params: { id: id.value } })
    case 'excel':
      return void A.exportExcel()
    case 'publish':
      return void A.publish()
    case 'edit':
      return editSettings()
    case 'reopen':
      return A.openReopen()
    case 'return':
      return void A.returnToDraft()
    case 'copy':
      return void A.copySession()
    case 'print':
      return A.openPrint()
    case 'remind':
      return void A.remind()
    case 'cancel':
      return void A.cancel()
    case 'delete':
      return void A.remove()
  }
}

// ---- O'quvchilar taxtasi ----
const passPercent = computed(
  () => results.value?.session.passPercent ?? results.value?.summary.passPercent ?? null,
)
/** Kataklar har soniyada emas, jonli yangilanish va sekin (5 s) tik bilan qayta hisoblanadi; sarlavha taymeri alohida 1 s */
const boardTick = ref(Date.now())
let boardTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  boardTimer = setInterval(() => {
    if (!document.hidden) boardTick.value = Date.now()
  }, 5000)
})
onBeforeUnmount(() => {
  if (boardTimer) clearInterval(boardTimer)
})
watch(
  () => live.data.value,
  () => (boardTick.value = Date.now()),
)
const boardNow = computed(() => boardTick.value + live.offset.value)
const rows = computed(() =>
  buildBoardRows(s.value?.participants ?? [], {
    live: s.value?.canMonitor ? live.data.value : null,
    attempts: attempts.value,
    results: results.value,
    nowMs: boardNow.value,
    staleMs: live.staleMs.value,
    flashUntil: live.flashUntil.value,
    tickMs: boardTick.value,
  }),
)
const startsInText = computed(() => {
  if (!s.value) return '—'
  const p = startsInParts(s.value.scheduledStart, boardNow.value)
  if (!p) return t('examBoard.startsNow')
  if (p.d > 0) return t('examBoard.startsDH', { d: p.d, h: p.h })
  if (p.h > 0) return t('examBoard.startsHM', { h: p.h, m: p.m })
  return t('examBoard.startsM', { m: p.m })
})
const cells = computed(() => {
  if (!s.value) return []
  const sum = blocksSummary(s.value.blocks)
  return statCells({
    rows: rows.value,
    stage: stage.value,
    passPercent: passPercent.value,
    results: results.value,
    readiness: readinessPct(s.value),
    approved: sum.approved,
    blocksTotal: sum.total,
    startsIn: startsInText.value,
    classesCount: s.value.classes.length,
    cancelled: s.value.status === 'cancelled',
    statusText: t(`examSessions.status.${s.value.status}`),
    resultsReady: results.value !== null,
  })
})

const filter = ref<FilterKey>('all')
/** Yaroqsiz filtr (bosqich o'zgargan va h.k.) "Hammasi" ga qaytadi */
const activeFilter = computed<FilterKey>(() =>
  cells.value.some((c) => c.filter === filter.value) ? filter.value : 'all',
)
const q = ref('')
const tabSel = ref<string | null>(null)
const tabs = computed(() => {
  const subjects = { key: 'subjects', label: t('examBoard.tabs.subjects') }
  const students = { key: 'students', label: t('examBoard.tabs.students') }
  const info = { key: 'info', label: t('examBoard.tabs.info') }
  if (!hasBlocks.value) return [students, info]
  return stage.value === 'before' ? [subjects, students, info] : [students, subjects, info]
})
const tab = computed(() =>
  tabs.value.some((x) => x.key === tabSel.value) ? tabSel.value! : tabs.value[0]!.key,
)

const visibleRows = computed(() =>
  sortRows(
    rows.value.filter(
      (r) => matchesFilter(r, activeFilter.value, stage.value) && matchesSearch(r, q.value),
    ),
    stage.value,
  ),
)
const sections = computed(() => groupSections(visibleRows.value))
const totals = computed(
  () => new Map(groupSections(rows.value).map((x) => [x.id, x.rows.length] as const)),
)
const classSections = computed(() => sections.value.filter((x) => x.kind === 'class'))
const otherSections = computed(() => sections.value.filter((x) => x.kind !== 'class'))
const layout = computed(() => layoutOf(classSections.value.length))
const FULL_GRID = 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'

// ---- Tanlov va ommaviy amallar ----
const selected = ref<string[]>([])
const selectable = computed(
  () => stage.value === 'during' && !!s.value && (s.value.canIntervene || s.value.canGrant),
)
/** Qidiruv/filtr tufayli ko'rinmay qolganlar tanlovdan chiqadi */
const visibleSig = computed(() => visibleRows.value.map((r) => r.key).join('|'))
watch(visibleSig, () => {
  selected.value = pruneSelection(
    selected.value,
    visibleRows.value.map((r) => r.key),
  )
})
const selectedRows = computed(() => visibleRows.value.filter((r) => selected.value.includes(r.key)))
function toggle(key: string) {
  selected.value = selected.value.includes(key)
    ? selected.value.filter((k) => k !== key)
    : [...selected.value, key]
}
function toggleAll(keys: string[], on: boolean) {
  const rest = selected.value.filter((k) => !keys.includes(k))
  selected.value = on ? [...rest, ...keys] : rest
}

const bulkMode = ref<BulkMode>(null)
const bulkRows = ref<BoardRow[]>([])
const bulkFromBar = ref(false)
function openBulk(mode: Exclude<BulkMode, null>, list: BoardRow[], fromBar: boolean) {
  bulkRows.value = list
  bulkFromBar.value = fromBar
  bulkMode.value = mode
}
function onBulkDone(remaining: string[]) {
  if (bulkFromBar.value) selected.value = remaining
  live.refreshNow()
  attemptsPoll.refreshNow()
}

// ---- O'quvchi paneli (drawer) ----
const openKey = ref<string | null>(null)
const drawerRow = computed(() => rows.value.find((r) => r.key === openKey.value) ?? null)
watch(drawerRow, (r) => {
  if (openKey.value && !r) openKey.value = null
})
const resultKey = ref<string | null>(null)
const shownCodes = ref<Record<string, string>>({})
const blockNames = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {}
  for (const b of realBlocks.value) out[b.id] = b.subjectName ?? b.title
  for (const b of results.value?.blocks ?? []) out[b.id] = b.subjectName ?? b.title
  return out
})

/** Shaxsiy kod: maskalangan; "Ko'rsatish" alohida endpoint (audit bilan), qayta bosilsa yashirinadi */
async function toggleCode(r: BoardRow) {
  if (shownCodes.value[r.key]) {
    const next = { ...shownCodes.value }
    delete next[r.key]
    shownCodes.value = next
    return
  }
  try {
    const res = await examsApi.participantCode(id.value, r.key)
    if (res.code) shownCodes.value = { ...shownCodes.value, [r.key]: res.code }
    else toast.info(t('examSessions.participants.codeMissingHint'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
async function regenerate(r: BoardRow) {
  const ok = await confirm({
    title: t('examSessions.participants.regenTitle'),
    message: t('examSessions.participants.regenText', { name: r.fullName }),
    confirmText: t('examSessions.participants.regen'),
  })
  if (!ok) return
  await A.run(() => examsApi.regeneratePin(id.value, r.key), 'examSessions.toast.pinRegenerated')
  const next = { ...shownCodes.value }
  delete next[r.key]
  shownCodes.value = next
}
async function removeParticipant(r: BoardRow) {
  const ok = await confirm({
    title: t('examSessions.participants.removeTitle'),
    message: t('examSessions.participants.removeText', { name: r.fullName }),
    confirmText: t('examSessions.participants.remove'),
    variant: 'danger',
  })
  if (ok) await A.run(() => examsApi.removeParticipant(id.value, r.key))
}
async function allowReentry(r: BoardRow) {
  const ok = await confirm({
    title: t('examSessions.attempt.reentryTitle'),
    message: t('examSessions.attempt.reentryText', { name: r.fullName }),
    confirmText: t('examSessions.attempt.reentry'),
  })
  if (ok) await A.run(() => examsApi.allowReentry(id.value, r.key), 'examSessions.toast.reentry')
}

const joinAlert = computed(() =>
  s.value?.canMonitor ? (live.data.value?.joinAlert ?? null) : (attempts.value?.joinAlert ?? null),
)
const avgByBlock = computed(() => subjectAverages(rows.value))
const dist = computed(() => distribution(rows.value))
const insightSubjects = computed(() =>
  Object.entries(avgByBlock.value).map(([bid, pct]) => ({
    id: bid,
    name: blockNames.value[bid] ?? '—',
    pct,
  })),
)
const showInsights = computed(
  () => stage.value === 'after' && !!s.value?.canViewResults && !!results.value,
)
const editable = computed(() => !!s.value?.canManageParticipants)
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <div v-else-if="loading" class="space-y-3" aria-busy="true">
    <Skeleton class="h-10 w-2/3" />
    <Skeleton class="h-40 w-full" />
  </div>
  <div v-else-if="error || !s" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="router.push({ name: 'exam-sessions' })">
        {{ t('examSessions.detail.toList') }}
      </BaseButton>
    </EmptyState>
  </div>

  <template v-else>
    <ExamHero
      :s="s"
      :pill="pill"
      :now-ms="live.nowMs.value"
      :busy="A.busy.value"
      :can-publish="canPublish"
      :missing-names="missingNames"
      :review-target="reviewTarget"
      :can-remind="canRemind"
      :has-blocks="hasBlocks"
      @back="router.push({ name: 'exam-sessions' })"
      @action="onHeroAction"
      @copy-code="copyCode"
    />

    <p
      v-if="meta && !meta.pinSecretConfigured && meta.isAdministration"
      class="mb-3 rounded-lg border border-warning bg-warning-soft px-4 py-2 text-sm text-warning"
    >
      {{ t('examSessions.pinSecretMissing') }}
    </p>
    <p
      v-if="s.approval.status === 'rejected' && s.status === 'draft'"
      class="mb-3 rounded-lg border border-danger bg-danger-soft px-4 py-2 text-sm text-danger"
      data-testid="rejected-note"
    >
      {{ t('examSessions.detail.rejected', { reason: s.approval.reason }) }}
    </p>
    <p
      v-if="s.status === 'pending_approval'"
      class="mb-3 rounded-lg border border-warning bg-warning-soft px-4 py-2 text-sm text-warning"
      data-testid="pending-note"
    >
      {{ t('examSessions.detail.pending') }}
    </p>
    <p
      v-if="joinAlert?.alertAt"
      class="mb-3 rounded-lg border border-danger bg-danger-soft px-4 py-2 text-sm text-danger"
      data-testid="join-alert"
    >
      {{ t('examSessions.attempt.joinAlert', { n: joinAlert.failures }) }}
    </p>
    <p
      v-if="s.canMonitor && live.loadError.value"
      class="mb-3 text-xs text-danger"
      data-testid="live-error"
    >
      {{ t('examSessions.live.loadFailed') }}
    </p>

    <p
      v-if="resultsState === 'error'"
      class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning bg-warning-soft px-4 py-2 text-sm text-warning"
      data-testid="results-error"
    >
      {{ t('examBoard.resultsError') }}
      <button
        type="button"
        class="font-medium underline"
        data-testid="results-retry"
        @click="loadClosed"
      >
        {{ t('examBoard.retry') }}
      </button>
    </p>

    <ExamStatStrip :cells="cells" :active="activeFilter" @filter="filter = $event" />

    <ExamToolbar
      :tabs="tabs"
      :tab="tab"
      :q="q"
      :show-search="tab === 'students'"
      :can-add="editable"
      :selected-count="selectedRows.length"
      :can-warn="s.canIntervene"
      :can-grant="s.canGrant"
      :can-stop="s.canIntervene"
      @update:tab="tabSel = $event"
      @update:q="q = $event"
      @add="showAdd = true"
      @warn="openBulk('warn', selectedRows, true)"
      @grant="openBulk('grant', selectedRows, true)"
      @stop="openBulk('stop', selectedRows, true)"
      @clear="selected = []"
    />

    <template v-if="tab === 'students'">
      <ResultsInsights v-if="showInsights" :bins="dist" :subjects="insightSubjects" />
      <p
        v-if="s.participants.length === 0"
        class="card p-4 text-sm text-fg-muted"
        data-testid="participants-empty"
      >
        {{ t('examBoard.section.empty') }}
      </p>
      <div
        v-else-if="visibleRows.length === 0"
        class="card p-4 text-sm text-fg-muted"
        data-testid="board-empty"
      >
        {{ t('examBoard.section.emptyFiltered') }}
        <button
          type="button"
          class="ml-2 text-primary-700 hover:underline"
          @click="((filter = 'all'), (q = ''))"
        >
          {{ t('examBoard.section.resetFilter') }}
        </button>
      </div>
      <template v-else>
        <div v-if="classSections.length" :class="layout.wrap" data-testid="class-grid">
          <ClassSection
            v-for="sec in classSections"
            :key="sec.id"
            :section="sec"
            :total="totals.get(sec.id) ?? sec.rows.length"
            :stage="stage"
            :selectable="selectable"
            :selected="selected"
            :active-key="openKey"
            :grid-class="layout.grid"
            @open="openKey = $event"
            @toggle="toggle"
            @toggle-all="toggleAll"
          />
        </div>
        <ClassSection
          v-for="sec in otherSections"
          :key="sec.id"
          :section="sec"
          :total="totals.get(sec.id) ?? sec.rows.length"
          :stage="stage"
          :selectable="selectable"
          :selected="selected"
          :active-key="openKey"
          :grid-class="FULL_GRID"
          @open="openKey = $event"
          @toggle="toggle"
          @toggle-all="toggleAll"
        />
      </template>
    </template>

    <SubjectCards
      v-else-if="tab === 'subjects'"
      :session="s"
      :stage="stage"
      :busy="A.busy.value"
      :stages="flow && s.status !== 'cancelled' ? flow.stages : null"
      :deadline="contribShort"
      :missing-names="missingNames"
      :avg-by-block="avgByBlock"
      @open="openBlock"
      @review="reviewBlock"
      @remind="A.remind"
      @settings="editSettings"
    />

    <InfoPanel v-else :s="s" :has-blocks="hasBlocks" @edit="editSettings" />

    <StudentDrawer
      v-if="drawerRow"
      :row="drawerRow"
      :stage="stage"
      :shown-code="shownCodes[drawerRow.key]"
      :block-names="blockNames"
      :can-grant="s.canGrant"
      :can-intervene="s.canIntervene"
      :can-close="s.canClose"
      :editable="editable"
      :can-view-results="s.canViewResults"
      @close="openKey = null"
      @toggle-code="toggleCode(drawerRow)"
      @regenerate="regenerate(drawerRow)"
      @remove="removeParticipant(drawerRow)"
      @grant="openBulk('grantOne', [drawerRow], false)"
      @reentry="allowReentry(drawerRow)"
      @warn="openBulk('warn', [drawerRow], false)"
      @stop="openBulk('stop', [drawerRow], false)"
      @view-answers="resultKey = drawerRow.key"
    />

    <BaseModal
      :open="showAdd && editable"
      :title="t('examBoard.toolbar.addTitle')"
      size="xl"
      @close="showAdd = false"
    >
      <ParticipantsPanel :session="s" :meta="meta" @changed="refresh" />
    </BaseModal>

    <BulkDialogs
      :mode="bulkMode"
      :rows="bulkRows"
      :session-id="id"
      @close="bulkMode = null"
      @done="onBulkDone"
      @changed="refresh"
    />
    <SessionActionDialogs :s="s" :a="A" />
    <ParticipantResultModal
      :open="!!resultKey"
      :session-id="id"
      :participant-key="resultKey"
      :can-grade="s.canViewResults"
      @close="resultKey = null"
      @changed="loadResults"
    />
  </template>
</template>
