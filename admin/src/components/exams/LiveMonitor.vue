<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import type { ExamLiveResponse, ExamLiveRow } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { useToast } from '@/composables/useToast'
import { isApiError } from '@/api/errors'
import { errorMessage } from '@/utils/errors'

/**
 * Nazoratchi jonli ekrani (E5). Har 5 soniyada yangilanadi (polling): bir vaqtda faqat bitta so'rov, sahifa yashirin
 * bo'lsa to'xtaydi va ko'rinishi bilan darhol davom etadi. Oynadan chiqish har doim ajratib ko'rsatiladi (test
 * bloklanmaydi). Ogohlantirish yuborish va to'xtatish faqat ochiq imtihonda (server ham tekshiradi).
 */
const props = defineProps<{ sessionId: string; stage?: string }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()

/** Yangilanish oralig'i (ms) */
const POLL_MS = 5000
/** Yangi chiqish shuncha vaqt "Yangi!" deb miltillab turadi */
const FLASH_MS = 15_000
const WARN_MAX = 200
const REASON_MAX = 300

const data = ref<ExamLiveResponse | null>(null)
const loadError = ref(false)
const hidden = ref(typeof document !== 'undefined' ? document.hidden : false)
/** Server soati bilan mijoz soati farqi (ms): "qolgan vaqt" va "n s oldin" server vaqtiga ko'ra */
const offset = ref(0)
const tick = ref(Date.now())
const flashUntil = ref<Record<string, number>>({})
const lastLeaves = new Map<string, number>()

// ---- Filtrlar ----
const q = ref('')
const statusFilter = ref('')
const onlyProblems = ref(false)
const sortBy = ref<'problems' | 'name'>('problems')

// ---- Polling: bitta so'rov, yashirin sahifada to'xtaydi ----
let timer: ReturnType<typeof setTimeout> | null = null
let clock: ReturnType<typeof setInterval> | null = null
let inFlight = false
let alive = true

function schedule() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!alive || document.hidden) return
  timer = setTimeout(() => void poll(), POLL_MS)
}

async function poll() {
  if (inFlight || !alive || document.hidden) return
  inFlight = true
  try {
    apply(await examsApi.sessionLive(props.sessionId))
    loadError.value = false
  } catch {
    loadError.value = true
  } finally {
    inFlight = false
    schedule()
  }
}

function apply(r: ExamLiveResponse) {
  offset.value = Date.parse(r.serverNow) - Date.now()
  tick.value = Date.now()
  const first = lastLeaves.size === 0 && data.value === null
  for (const it of r.items) {
    const prev = lastLeaves.get(it.key)
    if (!first && prev !== undefined && it.leaves > prev) {
      flashUntil.value = { ...flashUntil.value, [it.key]: Date.now() + FLASH_MS }
    }
    lastLeaves.set(it.key, it.leaves)
  }
  data.value = r
}

function onVisibility() {
  hidden.value = document.hidden
  if (document.hidden) {
    if (timer) clearTimeout(timer)
    timer = null
  } else {
    tick.value = Date.now()
    void poll()
  }
}

/** Amaldan keyin darhol yangilash (navbatdagi taymerni kutmasdan) */
function refreshNow() {
  if (timer) clearTimeout(timer)
  timer = null
  void poll()
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  clock = setInterval(() => {
    if (!document.hidden) tick.value = Date.now()
  }, 1000)
  void poll()
})
onBeforeUnmount(() => {
  alive = false
  document.removeEventListener('visibilitychange', onVisibility)
  if (timer) clearTimeout(timer)
  if (clock) clearInterval(clock)
})
watch(
  () => props.sessionId,
  () => {
    data.value = null
    lastLeaves.clear()
    flashUntil.value = {}
    refreshNow()
  },
)

// ---- Qatorlar ----
type Phase =
  'not_started' | 'joined' | 'in_progress' | 'submitted' | 'auto_submitted' | 'terminated'
const nowMs = computed(() => tick.value + offset.value)
const staleMs = computed(() => (data.value?.staleAfterSec ?? 60) * 1000)

interface View {
  r: ExamLiveRow
  phase: Phase
  idleSec: number | null
  stale: boolean
  leaving: boolean
  flashing: boolean
  problem: boolean
  timeLeft: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}
function fmtClock(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function fmtAgo(sec: number): string {
  return sec < 60
    ? t('examSessions.live.agoSec', { n: sec })
    : t('examSessions.live.agoMin', { n: Math.floor(sec / 60) })
}

const views = computed<View[]>(() =>
  (data.value?.items ?? []).map((r) => {
    const phase: Phase = r.terminated ? 'terminated' : (r.status as Phase)
    const live = phase === 'in_progress'
    const idleMs =
      r.lastSeenAt && (live || phase === 'joined') ? nowMs.value - Date.parse(r.lastSeenAt) : null
    const stale = live && idleMs !== null && idleMs > staleMs.value
    const leaving = live && r.leaves > 0
    const dl = r.block?.deadline ?? r.deadline
    return {
      r,
      phase,
      idleSec: idleMs === null ? null : Math.max(0, Math.floor(idleMs / 1000)),
      stale,
      leaving,
      flashing: (flashUntil.value[r.key] ?? 0) > tick.value,
      problem: stale || leaving,
      timeLeft: live && dl ? fmtLeft(Date.parse(dl) - nowMs.value) : null,
    }
  }),
)

const RANK: Record<Phase, number> = {
  in_progress: 1,
  joined: 2,
  not_started: 3,
  submitted: 4,
  auto_submitted: 4,
  terminated: 5,
}
const shown = computed(() => {
  const needle = q.value.trim().toLowerCase()
  const list = views.value.filter((v) => {
    if (needle && !v.r.fullName.toLowerCase().includes(needle)) return false
    if (onlyProblems.value && !v.problem) return false
    const f = statusFilter.value
    if (!f) return true
    if (f === 'submitted') return v.phase === 'submitted' || v.phase === 'auto_submitted'
    return v.phase === f
  })
  const byName = (a: View, b: View) => a.r.fullName.localeCompare(b.r.fullName, 'uz')
  if (sortBy.value === 'name') return list.sort(byName)
  return list.sort((a, b) => {
    const pa = a.problem ? 0 : RANK[a.phase]
    const pb = b.problem ? 0 : RANK[b.phase]
    if (pa !== pb) return pa - pb
    if (a.problem && b.problem) {
      // yangi chiqqanlar va ko'p chiqqanlar tepada
      if (a.flashing !== b.flashing) return a.flashing ? -1 : 1
      if (a.r.leaves !== b.r.leaves) return b.r.leaves - a.r.leaves
    }
    return byName(a, b)
  })
})

const counters = computed(() => {
  const c = data.value?.counts
  if (!c) return []
  return [
    { key: 'total', n: c.total, tone: 'text-fg' },
    { key: 'notStarted', n: c.notStarted, tone: 'text-fg-muted' },
    { key: 'joined', n: c.joined, tone: 'text-info' },
    { key: 'inProgress', n: c.inProgress, tone: 'text-warning' },
    { key: 'submitted', n: c.submitted, tone: 'text-success' },
    { key: 'terminated', n: c.terminated, tone: 'text-danger' },
    { key: 'warned', n: c.warned, tone: 'text-warning' },
  ]
})

const statusOptions = computed(() => [
  { value: '', label: t('examSessions.live.filters.allStatuses') },
  ...(['not_started', 'joined', 'in_progress', 'submitted', 'terminated'] as const).map((s) => ({
    value: s,
    label: t(`examSessions.live.statuses.${s}`),
  })),
])
const sortOptions = computed(() => [
  { value: 'problems', label: t('examSessions.live.filters.sortProblems') },
  { value: 'name', label: t('examSessions.live.filters.sortName') },
])

const TONE: Record<Phase, 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'danger'> = {
  not_started: 'neutral',
  joined: 'info',
  in_progress: 'warning',
  submitted: 'success',
  auto_submitted: 'primary',
  terminated: 'danger',
}

/** Serverning aniq xabari (tezlik cheklovi, "allaqachon topshirgan"...) ko'rsatiladi; qolganlari umumiy matn */
function actionError(e: unknown): string {
  if (isApiError(e) && ['CONFLICT', 'RATE_LIMITED', 'VALIDATION_ERROR'].includes(e.code)) {
    return e.details[0]?.message ?? e.message
  }
  return errorMessage(e, t)
}

// ---- Ogohlantirish yuborish ----
const PRESETS = ['p1', 'p2', 'p3', 'p4'] as const
const warnFor = ref<ExamLiveRow | null>(null)
const warnText = ref('')
const warnError = ref('')
const busy = ref(false)
function openWarn(r: ExamLiveRow) {
  warnFor.value = r
  warnText.value = ''
  warnError.value = ''
}
async function sendWarn() {
  const r = warnFor.value
  if (!r) return
  const text = warnText.value.trim()
  if (!text) {
    warnError.value = t('examSessions.live.warnDialog.required')
    return
  }
  if (text.length > WARN_MAX) {
    warnError.value = t('examSessions.live.warnDialog.tooLong', { max: WARN_MAX })
    return
  }
  busy.value = true
  try {
    await examsApi.warnParticipant(props.sessionId, r.key, text)
    warnFor.value = null
    toast.success(t('examSessions.live.warnDialog.sent'))
    refreshNow()
  } catch (e) {
    warnError.value = actionError(e)
  } finally {
    busy.value = false
  }
}

// ---- Imtihonni to'xtatish ----
const stopFor = ref<ExamLiveRow | null>(null)
const stopReason = ref('')
const stopError = ref('')
function openStop(r: ExamLiveRow) {
  stopFor.value = r
  stopReason.value = ''
  stopError.value = ''
}
async function doStop() {
  const r = stopFor.value
  if (!r) return
  const reason = stopReason.value.trim()
  if (!reason) {
    stopError.value = t('examSessions.live.stopDialog.required')
    return
  }
  if (reason.length > REASON_MAX) {
    stopError.value = t('examSessions.live.stopDialog.tooLong', { max: REASON_MAX })
    return
  }
  busy.value = true
  try {
    const res = await examsApi.terminateParticipant(props.sessionId, r.key, reason)
    stopFor.value = null
    toast.success(
      t('examSessions.live.stopDialog.done', { earned: res.score.earned, max: res.score.max }),
    )
    refreshNow()
    emit('changed')
  } catch (e) {
    stopError.value = actionError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card mb-5 p-4" data-testid="live-monitor">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-fg">
        <span v-if="stage" class="text-fg-muted">{{ stage }}</span>
        {{ t('examSessions.live.title') }}
      </h2>
      <p class="text-xs text-fg-muted" data-testid="live-status">
        <template v-if="hidden">{{ t('examSessions.live.paused') }}</template>
        <template v-else-if="loadError"
          ><span class="text-danger">{{ t('examSessions.live.loadFailed') }}</span></template
        >
        <template v-else>{{ t('examSessions.live.hint') }}</template>
      </p>
    </div>

    <p
      v-if="data?.joinAlert.alertAt"
      class="mb-3 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
      data-testid="live-join-alert"
    >
      {{ t('examSessions.attempt.joinAlert', { n: data.joinAlert.failures }) }}
    </p>
    <p
      v-if="data && !data.canIntervene"
      class="mb-3 text-xs text-fg-muted"
      data-testid="live-readonly"
    >
      {{ t('examSessions.live.notOpen') }}
    </p>

    <div v-if="!data" class="py-6 text-center text-sm text-fg-muted" data-testid="live-loading">
      …
    </div>
    <template v-else>
      <div
        class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
        data-testid="live-counters"
      >
        <div
          v-for="c in counters"
          :key="c.key"
          class="rounded-lg border border-border bg-surface-muted px-3 py-2"
          :data-testid="`count-${c.key}`"
        >
          <p class="text-xs text-fg-muted">{{ t(`examSessions.live.counts.${c.key}`) }}</p>
          <p class="text-2xl font-semibold" :class="c.tone" data-testid="count-value">{{ c.n }}</p>
        </div>
      </div>

      <div class="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BaseInput
          v-model="q"
          type="search"
          :label="t('examSessions.live.filters.search')"
          data-testid="live-search"
        />
        <BaseSelect
          v-model="statusFilter"
          :label="t('examSessions.live.filters.status')"
          :options="statusOptions"
          data-testid="live-filter-status"
        />
        <BaseSelect
          v-model="sortBy"
          :label="t('examSessions.live.filters.sort')"
          :options="sortOptions"
          data-testid="live-sort"
        />
        <div class="flex items-end pb-1">
          <BaseSwitch
            v-model="onlyProblems"
            :label="t('examSessions.live.filters.onlyProblems')"
            data-testid="live-only-problems"
          />
        </div>
      </div>

      <p
        v-if="shown.length === 0"
        class="py-4 text-center text-sm text-fg-muted"
        data-testid="live-empty"
      >
        {{
          data.items.length ? t('examSessions.live.emptyFiltered') : t('examSessions.live.empty')
        }}
      </p>
      <ul v-else class="space-y-2" data-testid="live-list">
        <li
          v-for="v in shown"
          :key="v.r.key"
          class="rounded-lg border px-3 py-2.5 text-sm"
          :class="[
            v.flashing
              ? 'border-danger bg-danger-soft ring-2 ring-danger/40'
              : v.leaving
                ? 'border-warning bg-warning-soft'
                : v.stale
                  ? 'border-border bg-surface-muted'
                  : 'border-border',
          ]"
          data-testid="live-row"
          :data-key="v.r.key"
          :data-phase="v.phase"
          :data-problem="v.problem ? '1' : '0'"
          :data-flash="v.flashing ? '1' : '0'"
        >
          <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div class="min-w-0 flex-1 basis-48">
              <p class="break-words font-medium text-fg" data-testid="live-name">
                {{ v.r.fullName }}
              </p>
              <p class="text-xs text-fg-muted">{{ v.r.className ?? '—' }}</p>
              <p
                v-if="v.r.terminated"
                class="mt-0.5 break-words text-xs text-danger"
                data-testid="live-terminated-reason"
              >
                {{
                  t('examSessions.live.terminatedBy', {
                    name: v.r.terminated.byName,
                    reason: v.r.terminated.reason,
                  })
                }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <span data-testid="live-status-cell">
                <BaseBadge :tone="TONE[v.phase]">{{
                  t(`examSessions.live.statuses.${v.phase}`)
                }}</BaseBadge>
              </span>
              <template v-if="data.canIntervene && v.phase === 'in_progress'">
                <BaseButton
                  size="sm"
                  variant="secondary"
                  data-testid="live-warn"
                  @click="openWarn(v.r)"
                  >{{ t('examSessions.live.warn') }}</BaseButton
                >
                <BaseButton
                  size="sm"
                  variant="danger"
                  data-testid="live-stop"
                  @click="openStop(v.r)"
                  >{{ t('examSessions.live.stop') }}</BaseButton
                >
              </template>
            </div>
          </div>
          <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-5">
            <div data-testid="live-answered">
              <dt class="text-xs text-fg-muted">{{ t('examSessions.live.cols.answered') }}</dt>
              <dd class="text-fg">
                <template v-if="v.r.total > 0">{{ v.r.answered }} / {{ v.r.total }}</template>
                <template v-else>—</template>
                <span
                  v-if="v.r.block && v.phase === 'in_progress'"
                  class="block truncate text-xs text-fg-muted"
                  data-testid="live-block"
                >
                  {{
                    t('examSessions.live.block', { n: v.r.block.index + 1, total: v.r.block.total })
                  }}
                  <template v-if="v.r.block.title">· {{ v.r.block.title }}</template>
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-fg-muted">{{ t('examSessions.live.cols.timeLeft') }}</dt>
              <dd class="font-mono text-fg" data-testid="live-timeleft">{{ v.timeLeft ?? '—' }}</dd>
            </div>
            <div data-testid="live-lastseen">
              <dt class="text-xs text-fg-muted">{{ t('examSessions.live.cols.lastSeen') }}</dt>
              <dd>
                <BaseBadge
                  v-if="v.stale"
                  tone="danger"
                  :title="t('examSessions.live.noContactTitle', { n: v.idleSec ?? 0 })"
                  data-testid="live-stale"
                  >{{ t('examSessions.live.noContact') }}</BaseBadge
                >
                <span v-else-if="v.idleSec !== null" class="text-fg-muted">{{
                  fmtAgo(v.idleSec)
                }}</span>
                <span v-else class="text-fg-muted">—</span>
              </dd>
            </div>
            <div data-testid="live-leaves">
              <dt class="text-xs text-fg-muted">{{ t('examSessions.live.cols.leaves') }}</dt>
              <dd>
                <template v-if="v.r.leaves > 0">
                  <BaseBadge
                    tone="danger"
                    :title="
                      t('examSessions.live.leavesTitle', {
                        blur: v.r.leaveDetail.blur,
                        hidden: v.r.leaveDetail.hidden,
                        fullscreen: v.r.leaveDetail.fullscreen,
                      })
                    "
                    data-testid="live-leaves-count"
                    >{{ t('examSessions.live.leavesCount', { n: v.r.leaves }) }}</BaseBadge
                  >
                  <BaseBadge
                    v-if="v.flashing"
                    tone="danger"
                    class="ml-1"
                    data-testid="live-leave-new"
                    >{{ t('examSessions.live.newLeave') }}</BaseBadge
                  >
                  <span class="block text-xs text-fg-muted" data-testid="live-leaves-last">{{
                    t('examSessions.live.leavesLast', { time: fmtClock(v.r.lastLeaveAt) })
                  }}</span>
                </template>
                <span v-else class="text-fg-muted">0</span>
              </dd>
            </div>
            <div data-testid="live-warnings">
              <dt class="text-xs text-fg-muted">{{ t('examSessions.live.cols.warnings') }}</dt>
              <dd class="text-fg-muted">
                <template v-if="v.r.warningsSent > 0">
                  {{ t('examSessions.live.warnSent', { n: v.r.warningsSent }) }}
                  <span
                    v-if="v.r.warningsPending > 0"
                    class="block text-xs text-warning"
                    data-testid="live-warn-pending"
                    >{{ t('examSessions.live.warnPending', { n: v.r.warningsPending }) }}</span
                  >
                </template>
                <template v-else>—</template>
              </dd>
            </div>
          </dl>
        </li>
      </ul>
    </template>

    <BaseModal
      :open="!!warnFor"
      :title="t('examSessions.live.warnDialog.title')"
      persistent
      @close="warnFor = null"
    >
      <div class="space-y-3" data-testid="warn-dialog">
        <p class="text-sm text-fg-muted">
          {{ t('examSessions.live.warnDialog.to', { name: warnFor?.fullName ?? '' }) }}
        </p>
        <div>
          <p class="mb-1 text-xs font-medium text-fg-muted">
            {{ t('examSessions.live.warnDialog.presets') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="p in PRESETS"
              :key="p"
              type="button"
              class="rounded-full border border-border px-3 py-1 text-xs text-fg hover:bg-surface-muted"
              :data-testid="`warn-preset-${p}`"
              @click="warnText = t(`examSessions.live.warnDialog.${p}`)"
            >
              {{ t(`examSessions.live.warnDialog.${p}`) }}
            </button>
          </div>
        </div>
        <div>
          <label for="warn-text" class="mb-1 block text-sm font-medium text-fg">{{
            t('examSessions.live.warnDialog.text')
          }}</label>
          <textarea
            id="warn-text"
            v-model="warnText"
            rows="3"
            :maxlength="WARN_MAX"
            class="block w-full rounded-lg border border-border bg-surface p-2 text-sm text-fg focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            data-testid="warn-text"
          />
          <p class="mt-1 flex justify-between text-xs text-fg-muted">
            <span>{{ t('examSessions.live.warnDialog.hint', { max: WARN_MAX }) }}</span>
            <span data-testid="warn-counter">{{ warnText.length }}/{{ WARN_MAX }}</span>
          </p>
          <p v-if="warnError" class="mt-1 text-sm text-danger" data-testid="warn-error">
            {{ warnError }}
          </p>
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="warnFor = null">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton :loading="busy" data-testid="warn-send" @click="sendWarn">{{
          t('examSessions.live.warnDialog.send')
        }}</BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="!!stopFor"
      :title="t('examSessions.live.stopDialog.title')"
      persistent
      @close="stopFor = null"
    >
      <div class="space-y-3" data-testid="stop-dialog">
        <p class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {{ t('examSessions.live.stopDialog.text', { name: stopFor?.fullName ?? '' }) }}
        </p>
        <div>
          <label for="stop-reason" class="mb-1 block text-sm font-medium text-fg">{{
            t('examSessions.live.stopDialog.reason')
          }}</label>
          <textarea
            id="stop-reason"
            v-model="stopReason"
            rows="3"
            :maxlength="REASON_MAX"
            class="block w-full rounded-lg border border-border bg-surface p-2 text-sm text-fg focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            data-testid="stop-reason"
          />
          <p class="mt-1 text-xs text-fg-muted">
            {{ t('examSessions.live.stopDialog.reasonHint') }}
          </p>
          <p v-if="stopError" class="mt-1 text-sm text-danger" data-testid="stop-error">
            {{ stopError }}
          </p>
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="stopFor = null">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton variant="danger" :loading="busy" data-testid="stop-confirm" @click="doStop">{{
          t('examSessions.live.stopDialog.confirm')
        }}</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>
