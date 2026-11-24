<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { GRANT_MAX, grantPlan, warnTargets, type BoardRow } from '@/utils/examBoard'

/**
 * Ogohlantirish, vaqt berish va to'xtatish oynalari: bir o'quvchi (panel) ham, tanlanganlar (ommaviy) ham.
 * So'rovlar KETMA-KET yuboriladi (server har o'quvchiga ogohlantirishni 10 s da bir martaga cheklaydi), oxirida
 * "X ta yuborildi, Y ta o'tkazildi" va sababi ko'rsatiladi. Oynada qatorlar ochilgan paytdagi nusxada saqlanadi.
 * Vaqt: server extraMinutes ni MUTLAQ qiymat deb qabul qiladi, shuning uchun "+N" har kimning hozirgi qiymatiga
 * qo'shiladi (avval sessiya qayta o'qiladi), 240 dan oshsa o'tkaziladi, "to'liq vaqt" belgisi saqlanadi.
 */
export type BulkMode = 'warn' | 'grant' | 'stop' | 'grantOne' | null
const props = defineProps<{ mode: BulkMode; rows: BoardRow[]; sessionId: string }>()
const emit = defineEmits<{ close: []; done: [remaining: string[]]; changed: [] }>()
const { t } = useI18n()
const toast = useToast()

const WARN_MAX = 200
const REASON_MAX = 300
const PRESETS = ['p1', 'p2', 'p3', 'p4'] as const

const snap = ref<BoardRow[]>([])
/** Ichki qulf: so'rovlar ketayotganda oyna yopilmaydi va ikkinchi sikl boshlanmaydi (mode dan mustaqil) */
const busy = ref(false)
const progress = ref({ done: 0, total: 0 })
let alive = true
onBeforeUnmount(() => (alive = false))
/** Band paytida yopish (X, Esc, "Bekor qilish") butunlay e'tiborsiz */
function requestClose() {
  if (busy.value) return
  emit('close')
}
const text = ref('')
const reason = ref('')
const minutes = ref('15')
const error = ref('')
const grantFull = ref(false)
const grantExtra = ref('0')
interface Line {
  name: string
  reason: string
}
const result = ref<{ title: string; lines: Line[] } | null>(null)

watch(
  () => props.mode,
  (m) => {
    if (!m || busy.value) return
    snap.value = [...props.rows]
    text.value = ''
    reason.value = ''
    minutes.value = '15'
    error.value = ''
    result.value = null
    const p = props.rows[0]?.p
    grantFull.value = p?.fullTimeGranted ?? false
    grantExtra.value = String(p?.extraMinutes ?? 0)
  },
  { immediate: true },
)

const targets = computed(() => warnTargets(snap.value))
const single = computed(() => snap.value.length === 1)

/** Serverning aniq xabari (tezlik cheklovi, "allaqachon topshirgan"...) ko'rsatiladi; qolganlari umumiy matn */
function actionError(e: unknown): string {
  if (isApiError(e) && ['CONFLICT', 'RATE_LIMITED', 'VALIDATION_ERROR'].includes(e.code)) {
    return e.details[0]?.message ?? e.message
  }
  return errorMessage(e, t)
}

function finish(remaining: string[]) {
  emit('changed')
  emit('done', remaining)
}

// ---- Ogohlantirish ----
async function sendWarn() {
  if (busy.value) return
  const msg = text.value.trim()
  if (!msg) {
    error.value = t('examSessions.live.warnDialog.required')
    return
  }
  if (msg.length > WARN_MAX) {
    error.value = t('examSessions.live.warnDialog.tooLong', { max: WARN_MAX })
    return
  }
  error.value = ''
  busy.value = true
  const sid = props.sessionId
  const list = [...targets.value]
  progress.value = { done: 0, total: list.length }
  let sent = 0
  const skipped: (Line & { key: string })[] = []
  for (const r of list) {
    if (!alive) return
    try {
      await examsApi.warnParticipant(sid, r.key, msg)
      sent++
    } catch (e) {
      skipped.push({
        key: r.key,
        name: r.fullName,
        reason: actionError(e),
      })
    }
    progress.value = { ...progress.value, done: progress.value.done + 1 }
  }
  if (!alive) return
  busy.value = false
  if (single.value && skipped.length) {
    error.value = skipped[0]!.reason
    emit('changed')
    return
  }
  if (!skipped.length) {
    toast.success(t('examSessions.live.warnDialog.sent'))
    finish([])
    emit('close')
    return
  }
  result.value = {
    title: t('examBoard.bulk.sentSummary', { sent, skipped: skipped.length }),
    lines: skipped,
  }
  finish(skipped.map((s) => s.key))
}

// ---- Vaqt berish: ommaviy ----
async function sendGrant() {
  if (busy.value) return
  const n = Number(minutes.value)
  if (!Number.isInteger(n) || n < 1 || n > GRANT_MAX) {
    error.value = t('examBoard.bulk.grantRange')
    return
  }
  error.value = ''
  busy.value = true
  const sid = props.sessionId
  try {
    const fresh = await examsApi.getSession(sid)
    if (!alive) return
    const plan = grantPlan(snap.value, fresh.participants, n)
    progress.value = { done: 0, total: plan.filter((x) => !x.skipped).length }
    let done = 0
    const left: (Line & { key: string })[] = []
    for (const it of plan) {
      if (!alive) return
      if (it.skipped) {
        left.push({ key: it.key, name: it.name, reason: t('examBoard.bulk.grantLimit') })
        continue
      }
      try {
        await examsApi.grantTime(sid, it.key, {
          fullTime: it.fullTime,
          extraMinutes: it.extra,
        })
        done++
      } catch (e) {
        left.push({ key: it.key, name: it.name, reason: actionError(e) })
      }
      progress.value = { ...progress.value, done: progress.value.done + 1 }
    }
    if (!left.length) {
      toast.success(t('examBoard.bulk.grantDone', { n: done, m: n }))
      finish([])
      emit('close')
    } else {
      result.value = {
        title: t('examBoard.bulk.grantSummary', { done, skipped: left.length }),
        lines: left,
      }
      finish(left.map((l) => l.key))
    }
  } catch (e) {
    error.value = actionError(e)
  } finally {
    busy.value = false
  }
}

// ---- Vaqt berish: bitta o'quvchi (mutlaq qiymat) ----
async function sendGrantOne() {
  const r = snap.value[0]
  if (!r || busy.value) return
  const extra = Number(grantExtra.value)
  if (!Number.isInteger(extra) || extra < 0 || extra > GRANT_MAX) {
    error.value = t('examSessions.participants.extraRange')
    return
  }
  busy.value = true
  const sid = props.sessionId
  try {
    await examsApi.grantTime(sid, r.key, {
      fullTime: grantFull.value,
      extraMinutes: extra,
    })
    toast.success(t('examSessions.toast.granted'))
    finish([])
    emit('close')
  } catch (e) {
    toast.error(errorMessage(e, t))
    emit('changed')
  } finally {
    busy.value = false
  }
}

// ---- To'xtatish ----
async function doStop() {
  if (busy.value) return
  const why = reason.value.trim()
  if (!why) {
    error.value = t('examSessions.live.stopDialog.required')
    return
  }
  if (why.length > REASON_MAX) {
    error.value = t('examSessions.live.stopDialog.tooLong', { max: REASON_MAX })
    return
  }
  error.value = ''
  busy.value = true
  const sid = props.sessionId
  const list = [...targets.value]
  progress.value = { done: 0, total: list.length }
  let done = 0
  let score: { earned: number; max: number } | null = null
  const failed: (Line & { key: string })[] = []
  for (const r of list) {
    if (!alive) return
    try {
      const res = await examsApi.terminateParticipant(sid, r.key, why)
      done++
      score = res.score
    } catch (e) {
      failed.push({ key: r.key, name: r.fullName, reason: actionError(e) })
    }
    progress.value = { ...progress.value, done: progress.value.done + 1 }
  }
  if (!alive) return
  busy.value = false
  if (single.value && failed.length) {
    error.value = failed[0]!.reason
    emit('changed')
    return
  }
  if (!failed.length) {
    toast.success(
      single.value && score
        ? t('examSessions.live.stopDialog.done', { earned: score.earned, max: score.max })
        : t('examBoard.bulk.stopDone', { n: done }),
    )
    finish([])
    emit('close')
    return
  }
  result.value = {
    title: t('examBoard.bulk.stopSummary', { done, failed: failed.length }),
    lines: failed,
  }
  finish(failed.map((f) => f.key))
}

const taClass =
  'block w-full rounded-lg border border-border bg-surface p-2 text-sm text-fg focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20'
const open = (m: Exclude<BulkMode, null>) => props.mode === m
</script>

<template>
  <!-- Ogohlantirish -->
  <BaseModal
    :open="open('warn')"
    :title="t('examBoard.bulk.warnTitle')"
    persistent
    @close="requestClose"
  >
    <div class="space-y-3" data-testid="warn-dialog">
      <p class="text-sm text-fg-muted" data-testid="warn-to">
        {{
          single
            ? t('examSessions.live.warnDialog.to', { name: snap[0]?.fullName ?? '' })
            : t('examBoard.bulk.warnTo', { n: targets.length })
        }}
      </p>
      <p
        v-if="snap.length > targets.length && targets.length > 0"
        class="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning"
        data-testid="warn-only-solving"
      >
        {{ t('examBoard.bulk.warnOnlySolving', { n: targets.length, total: snap.length }) }}
      </p>
      <p v-if="targets.length === 0" class="text-sm text-danger" data-testid="warn-none">
        {{ t('examBoard.bulk.warnNone') }}
      </p>
      <p
        v-if="busy && progress.total > 0"
        class="text-sm font-medium text-primary-700"
        data-testid="bulk-progress"
        aria-live="polite"
      >
        {{ progress.done }} / {{ progress.total }}
      </p>
      <template v-if="!result">
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
              @click="text = t(`examSessions.live.warnDialog.${p}`)"
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
            v-model="text"
            rows="3"
            :maxlength="WARN_MAX"
            :class="taClass"
            data-testid="warn-text"
          />
          <p class="mt-1 flex justify-between text-xs text-fg-muted">
            <span>{{ t('examSessions.live.warnDialog.hint', { max: WARN_MAX }) }}</span>
            <span data-testid="warn-counter">{{ text.length }}/{{ WARN_MAX }}</span>
          </p>
          <p v-if="error" class="mt-1 text-sm text-danger" data-testid="warn-error">{{ error }}</p>
        </div>
      </template>
      <div v-else data-testid="bulk-result">
        <p class="text-sm font-medium text-fg">{{ result.title }}</p>
        <ul class="mt-2 space-y-1 text-sm text-fg-muted">
          <li v-for="(l, i) in result.lines" :key="i" data-testid="bulk-result-line">
            {{ l.name }}: {{ l.reason }}
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="requestClose">{{
        result ? t('examBoard.bulk.close') : t('common.cancel')
      }}</BaseButton>
      <BaseButton
        v-if="!result"
        :loading="busy"
        :disabled="targets.length === 0"
        data-testid="warn-send"
        @click="sendWarn"
        >{{ t('examSessions.live.warnDialog.send') }}</BaseButton
      >
    </template>
  </BaseModal>

  <!-- Vaqt berish: ommaviy -->
  <BaseModal
    :open="open('grant')"
    :title="t('examBoard.bulk.grantTitle')"
    persistent
    @close="requestClose"
  >
    <div class="space-y-3" data-testid="bulk-grant-dialog">
      <p class="text-sm text-fg-muted">{{ t('examBoard.bulk.warnTo', { n: snap.length }) }}</p>
      <p
        v-if="busy && progress.total > 0"
        class="text-sm font-medium text-primary-700"
        data-testid="bulk-progress"
        aria-live="polite"
      >
        {{ progress.done }} / {{ progress.total }}
      </p>
      <template v-if="!result">
        <p class="text-xs text-fg-muted">{{ t('examBoard.bulk.grantHint') }}</p>
        <BaseInput
          v-model="minutes"
          type="number"
          inputmode="numeric"
          min="1"
          :max="GRANT_MAX"
          :label="t('examBoard.bulk.grantMinutes')"
          :error="error"
          data-testid="bulk-grant-minutes"
        />
      </template>
      <div v-else data-testid="bulk-result">
        <p class="text-sm font-medium text-fg">{{ result.title }}</p>
        <ul class="mt-2 space-y-1 text-sm text-fg-muted">
          <li v-for="(l, i) in result.lines" :key="i" data-testid="bulk-result-line">
            {{ l.name }}: {{ l.reason }}
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="requestClose">{{
        result ? t('examBoard.bulk.close') : t('common.cancel')
      }}</BaseButton>
      <BaseButton
        v-if="!result"
        :loading="busy"
        data-testid="bulk-grant-confirm"
        @click="sendGrant"
        >{{ t('examBoard.bulk.grantSend') }}</BaseButton
      >
    </template>
  </BaseModal>

  <!-- Vaqt berish: bitta o'quvchi -->
  <BaseModal
    :open="open('grantOne')"
    :title="t('examSessions.participants.grantTitle', { name: snap[0]?.fullName ?? '' })"
    persistent
    @close="requestClose"
  >
    <div class="space-y-4">
      <BaseSwitch
        v-model="grantFull"
        :label="t('examSessions.participants.grantFull')"
        data-testid="grant-full"
      />
      <p class="text-xs text-fg-muted">{{ t('examSessions.participants.grantFullHint') }}</p>
      <BaseInput
        v-model="grantExtra"
        type="number"
        inputmode="numeric"
        min="0"
        :max="GRANT_MAX"
        :label="t('examSessions.participants.grantExtra')"
        :error="error"
        data-testid="grant-extra"
      />
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="requestClose">{{
        t('common.cancel')
      }}</BaseButton>
      <BaseButton :loading="busy" data-testid="grant-confirm" @click="sendGrantOne">{{
        t('common.save')
      }}</BaseButton>
    </template>
  </BaseModal>

  <!-- To'xtatish -->
  <BaseModal
    :open="open('stop')"
    :title="single ? t('examSessions.live.stopDialog.title') : t('examBoard.bulk.stopTitle')"
    persistent
    @close="requestClose"
  >
    <div class="space-y-3" data-testid="stop-dialog">
      <p class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
        {{
          single
            ? t('examSessions.live.stopDialog.text', { name: snap[0]?.fullName ?? '' })
            : t('examBoard.bulk.stopWarn', { n: targets.length })
        }}
      </p>
      <p
        v-if="snap.length > targets.length && targets.length > 0"
        class="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning"
      >
        {{ t('examBoard.bulk.stopOnlySolving', { n: targets.length, total: snap.length }) }}
      </p>
      <p
        v-if="busy && progress.total > 0"
        class="text-sm font-medium text-primary-700"
        data-testid="bulk-progress"
        aria-live="polite"
      >
        {{ progress.done }} / {{ progress.total }}
      </p>
      <template v-if="!result">
        <div v-if="!single">
          <p class="mb-1 text-xs font-medium text-fg-muted">{{ t('examBoard.bulk.stopList') }}</p>
          <ul
            class="max-h-32 overflow-y-auto rounded-lg border border-border px-3 py-2 text-sm text-fg"
            data-testid="stop-names"
          >
            <li v-for="r in targets" :key="r.key">{{ r.fullName }}</li>
          </ul>
        </div>
        <div>
          <label for="stop-reason" class="mb-1 block text-sm font-medium text-fg">{{
            t('examSessions.live.stopDialog.reason')
          }}</label>
          <textarea
            id="stop-reason"
            v-model="reason"
            rows="3"
            :maxlength="REASON_MAX"
            :class="taClass"
            data-testid="stop-reason"
          />
          <p class="mt-1 text-xs text-fg-muted">
            {{ t('examSessions.live.stopDialog.reasonHint') }}
          </p>
          <p v-if="error" class="mt-1 text-sm text-danger" data-testid="stop-error">{{ error }}</p>
        </div>
      </template>
      <div v-else data-testid="bulk-result">
        <p class="text-sm font-medium text-fg">{{ result.title }}</p>
        <ul class="mt-2 space-y-1 text-sm text-fg-muted">
          <li v-for="(l, i) in result.lines" :key="i" data-testid="bulk-result-line">
            {{ l.name }}: {{ l.reason }}
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="requestClose">{{
        result ? t('examBoard.bulk.close') : t('common.cancel')
      }}</BaseButton>
      <BaseButton
        v-if="!result"
        variant="danger"
        :loading="busy"
        :disabled="targets.length === 0"
        data-testid="stop-confirm"
        @click="doStop"
        >{{
          single
            ? t('examSessions.live.stopDialog.confirm')
            : t('examBoard.bulk.stopConfirm', { n: targets.length })
        }}</BaseButton
      >
    </template>
  </BaseModal>
</template>
