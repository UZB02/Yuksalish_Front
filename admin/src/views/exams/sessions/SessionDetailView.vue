<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Printer } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import type {
  ExamAttemptRow,
  ExamAttemptsResponse,
  ExamSession,
  ExamSessionMeta,
  ExamSessionParticipant,
} from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { useAuthStore } from '@/stores/auth'
import { clearDraftById } from '@/utils/examWizardDraft'
import { STATUS_TONE, fmtDateTime, localToIso, nowLocal } from '@/utils/examSessions'
import ExamFlowStepper from '@/components/exams/ExamFlowStepper.vue'
import ExamSubjectsTable from '@/components/exams/ExamSubjectsTable.vue'
import LiveMonitor from '@/components/exams/LiveMonitor.vue'
import { FLOW_PILL_TONE, examFlow } from '@/utils/examFlow'
import ParticipantsPanel from './ParticipantsPanel.vue'

/** Imtihon sahifasi: ma'lumot, holat amallari, tasdiq/rad, ishtirokchilar jadvali (PIN holati), PIN kartochkalari */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())
const auth = useAuthStore()

const id = computed(() => String(route.params.id))
const s = ref<ExamSession | null>(null)
const meta = ref<ExamSessionMeta | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const showAdd = ref(false)
const printClass = ref('')

const rejectOpen = ref(false)
const rejectReason = ref('')
const rejectError = ref('')

// ---- Urinishlar (o'quvchi imtihon topshirish holati): E5 da nazoratchi ekrani kengayadi ----
const attempts = ref<ExamAttemptsResponse | null>(null)
const attemptByKey = computed(
  () => new Map<string, ExamAttemptRow>((attempts.value?.items ?? []).map((a) => [a.key, a])),
)
let attemptsTimer: ReturnType<typeof setInterval> | null = null
async function loadAttempts() {
  if (!s.value || !['scheduled', 'open', 'closed'].includes(s.value.status)) return
  try {
    attempts.value = await examsApi.sessionAttempts(id.value)
  } catch {
    /* jadval holat ustunlarisiz ko'rinadi */
  }
}
async function allowReentry(p: ExamSessionParticipant) {
  const ok = await confirm({
    title: t('examSessions.attempt.reentryTitle'),
    message: t('examSessions.attempt.reentryText', { name: p.fullName }),
    confirmText: t('examSessions.attempt.reentry'),
  })
  if (ok) {
    await run(() => examsApi.allowReentry(id.value, p.key), 'examSessions.toast.reentry')
    await loadAttempts()
  }
}
onBeforeUnmount(() => {
  if (attemptsTimer) clearInterval(attemptsTimer)
})

// ---- Qayta ochish va hammaga vaqt qo'shish ----
const reopenOpen = ref(false)
const reopenReason = ref('')
const reopenEnd = ref('')
const reopenError = ref<Record<string, string>>({})
function openReopen() {
  reopenReason.value = ''
  reopenEnd.value = nowLocal(60)
  reopenError.value = {}
  reopenOpen.value = true
}
async function doReopen() {
  reopenError.value = {}
  if (!reopenReason.value.trim()) reopenError.value.reason = t('examSessions.errors.reasonRequired')
  if (!reopenEnd.value) reopenError.value.end = t('examSessions.errors.newEndRequired')
  else if (new Date(localToIso(reopenEnd.value)).getTime() <= Date.now()) {
    reopenError.value.end = t('examSessions.errors.newEndPast')
  }
  if (Object.keys(reopenError.value).length) return
  busy.value = true
  try {
    const r = await examsApi.reopenSession(id.value, {
      reason: reopenReason.value.trim(),
      newEnd: localToIso(reopenEnd.value),
    })
    reopenOpen.value = false
    toast.success(
      r.codeChanged
        ? t('examSessions.detail.reopenedCode', { code: r.code ?? '' })
        : t('examSessions.toast.reopened'),
    )
    await refresh()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

const extendOpen = ref(false)
const extendMinutes = ref('15')
const extendReason = ref('')
const extendError = ref('')
function openExtend() {
  extendMinutes.value = '15'
  extendReason.value = ''
  extendError.value = ''
  extendOpen.value = true
}
async function doExtend() {
  const n = Number(extendMinutes.value)
  if (!Number.isInteger(n) || n < 1 || n > 180) {
    extendError.value = t('examSessions.errors.minutesRange')
    return
  }
  busy.value = true
  try {
    await examsApi.extendSession(id.value, {
      minutes: n,
      reason: extendReason.value.trim() || undefined,
    })
    extendOpen.value = false
    toast.success(t('examSessions.toast.extended'))
    await refresh()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

const grantFor = ref<ExamSessionParticipant | null>(null)
const grantFull = ref(false)
const grantExtra = ref('0')
const grantError = ref('')

const classOptions = computed(() => {
  const names = [
    ...new Set((s.value?.participants ?? []).map((p) => p.className).filter(Boolean)),
  ] as string[]
  return [
    { value: '', label: t('examSessions.detail.allClasses') },
    ...names.map((n) => ({ value: n, label: n })),
  ]
})

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    const [x, m] = await Promise.all([examsApi.getSession(id.value), examsApi.sessionMeta()])
    s.value = x
    meta.value = m
    void loadAttempts()
    if (attemptsTimer) clearInterval(attemptsTimer)
    attemptsTimer = setInterval(() => void loadAttempts(), 15_000)
  } catch (e) {
    s.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
async function refresh() {
  try {
    s.value = await examsApi.getSession(id.value)
    void loadAttempts()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
onMounted(load)
watch(id, load)
watch(schoolId, () => void router.replace({ name: 'exam-sessions' }))

async function run(fn: () => Promise<unknown>, okKey?: string) {
  busy.value = true
  try {
    await fn()
    if (okKey) toast.success(t(okKey))
    await refresh()
  } catch (e) {
    toast.error(errorMessage(e, t))
    await refresh()
  } finally {
    busy.value = false
  }
}

const act = (a: 'submit' | 'approve' | 'open' | 'close', okKey: string) =>
  run(() => examsApi.sessionAction(id.value, a), okKey)

/** Haqiqiy (blokli) bloklar; eski imtihonda bo'sh */
const realBlocks = computed(() => (s.value?.blocks ?? []).filter((b) => !b.legacy))

/** Blokli imtihon bosqichlari va holat belgisi (DB da yangi holat yo'q: mavjud ma'lumotdan hisoblanadi) */
const flow = computed(() => (s.value && realBlocks.value.length ? examFlow(s.value) : null))
const contribShort = computed(() => {
  const d = s.value?.contribDeadline
  return d ? fmtDateTime(d).slice(0, 5) : null
})
const metaLine = computed(() => {
  if (!s.value) return ''
  return [
    t(`examSessions.type.${s.value.type}`),
    s.value.classes.map((c) => c.name).join(', '),
    fmtDateTime(s.value.scheduledStart),
    t('examSessions.minutes', { n: s.value.durationMin }),
  ]
    .filter(Boolean)
    .join(' · ')
})
/** Tasdiqlanmagan (o'qituvchisi bor) fanlar nomi: rejalashtirishga to'sqinlik */
const missingApproval = computed(() =>
  (s.value?.blocks ?? [])
    .filter((b) => !b.legacy && b.contributors.length > 0)
    .filter((b) => !(b.status === 'ready' && b.readyBy !== 'contributor'))
    .map((b) => b.subjectName ?? b.title),
)
const openBlock = (blockId: string) =>
  void router.push({ name: 'exam-my-block', params: { sessionId: id.value, blockId } })
const reviewBlock = (blockId: string) =>
  void router.push({ name: 'exam-block-review', params: { id: id.value, blockId } })
const editSettings = () => void router.push({ name: 'exam-session-edit', params: { id: id.value } })

/** "Eslatma": tugallanmagan fanlar o'qituvchilariga Telegram (soatiga bir marta har fanga) */
async function remind() {
  busy.value = true
  try {
    const r = await examsApi.remindSession(id.value)
    if (r.disabled) toast.info(t('examFlow.remindDisabled'))
    else if (r.notConnected) toast.info(t('examFlow.remindNotConnected'))
    else if (r.blocks.length && r.blocks.every((b) => b.state === 'recent'))
      toast.info(t('examFlow.remindRecent'))
    else if (r.blocks.length === 0) toast.info(t('examFlow.remindNobody'))
    else
      toast.success(
        t('examFlow.remindSent', { n: r.blocks.filter((b) => b.state === 'sent').length }),
      )
    await refresh()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

/** Rejalashtirish: maqsaddan kam savol bo'lsa tuzuvchi tasdiqlaydi (409 + details.path=blocks) */
async function submitSession() {
  await run(async () => {
    try {
      await examsApi.submitSession(id.value)
    } catch (e) {
      if (isApiError(e) && e.status === 409 && e.details.some((d) => d.path === 'approval')) {
        toast.error(`${t('examFlow.needApproval')} ${e.details.map((d) => d.message).join('; ')}`)
        return
      }
      if (isApiError(e) && e.status === 409 && e.details.some((d) => d.path === 'blocks')) {
        const ok = await confirm({
          title: t('examBlocks.shortTitle'),
          message: `${t('examBlocks.shortText')}\n${e.details.map((d) => d.message).join('\n')}`,
          confirmText: t('examBlocks.shortConfirm'),
        })
        if (!ok) return
        await examsApi.submitSession(id.value, true)
      } else {
        throw e
      }
    }
    toast.success(t('examSessions.toast.scheduled'))
  })
}

async function cancel() {
  const ok = await confirm({
    title: t('examSessions.detail.cancelTitle'),
    message: t('examSessions.detail.cancelText'),
    confirmText: t('examSessions.detail.cancel'),
    variant: 'danger',
  })
  if (ok) await run(() => examsApi.cancelSession(id.value), 'examSessions.toast.cancelled')
}
/** O'chirish: urinishsiz imtihon oddiy tasdiq bilan; urinishli (yopilgan) imtihon uchun ikki variantli oyna */
const deleteOpen = ref(false)
const deleteMode = ref<'exam_only' | 'with_results'>('exam_only')
const deleteTitle = ref('')
const deleteError = ref('')
async function remove() {
  if (s.value?.hasAttempts) {
    deleteMode.value = 'exam_only'
    deleteTitle.value = ''
    deleteError.value = ''
    deleteOpen.value = true
    return
  }
  const ok = await confirm({
    title: t('examSessions.detail.deleteTitle'),
    message: t('examSessions.detail.deleteText'),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (ok) await doDelete()
}
async function doDelete() {
  if (!s.value) return
  if (
    deleteOpen.value &&
    deleteMode.value === 'with_results' &&
    deleteTitle.value !== s.value.title
  ) {
    deleteError.value = t('examSessions.detail.deleteTitleMismatch')
    return
  }
  busy.value = true
  try {
    await examsApi.deleteSession(
      id.value,
      deleteOpen.value
        ? {
            mode: deleteMode.value,
            confirmTitle: deleteMode.value === 'with_results' ? deleteTitle.value : undefined,
          }
        : {},
    )
    clearDraftById(auth.user?.id ?? '', schoolId.value ?? auth.user?.schoolId ?? '', id.value)
    toast.success(t('examSessions.toast.deleted'))
    deleteOpen.value = false
    void router.replace({ name: 'exam-sessions' })
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

/** Nusxa olib yangi imtihon: yangi qoralama ustada ochiladi, ogohlantirishlar toast bilan */
async function copySession() {
  busy.value = true
  try {
    const r = await examsApi.copySession(id.value)
    toast.success(t('examSessions.toast.copied'))
    for (const w of r.warnings) toast.info(w)
    void router.push({
      name: 'exam-session-edit',
      params: { id: r.session.id },
      query: { copied: '1' },
    })
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}
/** Tahrirlash uchun qaytarish (urinish yo'q imtihon): qoralamaga, ustada ochiladi */
async function returnToDraft() {
  const ok = await confirm({
    title: t('examSessions.detail.returnTitle'),
    message: t('examSessions.detail.returnText'),
    confirmText: t('examSessions.detail.returnConfirm'),
  })
  if (!ok) return
  busy.value = true
  try {
    await examsApi.returnToDraft(id.value)
    toast.success(t('examSessions.toast.returned'))
    void router.push({ name: 'exam-session-edit', params: { id: id.value } })
  } catch (e) {
    toast.error(errorMessage(e, t))
    await refresh()
  } finally {
    busy.value = false
  }
}
async function closeNow() {
  const ok = await confirm({
    title: t('examSessions.detail.closeTitle'),
    message: t('examSessions.detail.closeText'),
    confirmText: t('examSessions.detail.close'),
    variant: 'danger',
  })
  if (ok) await act('close', 'examSessions.toast.closed')
}

function openReject() {
  rejectReason.value = ''
  rejectError.value = ''
  rejectOpen.value = true
}
async function doReject() {
  if (!rejectReason.value.trim()) {
    rejectError.value = t('examSessions.errors.reasonRequired')
    return
  }
  rejectOpen.value = false
  await run(
    () => examsApi.rejectSession(id.value, rejectReason.value.trim()),
    'examSessions.toast.rejected',
  )
}

async function print() {
  busy.value = true
  try {
    await examsApi.downloadPinSheet(id.value, printClass.value || undefined)
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

async function regenerate(p: ExamSessionParticipant) {
  const ok = await confirm({
    title: t('examSessions.participants.regenTitle'),
    message: t('examSessions.participants.regenText', { name: p.fullName }),
    confirmText: t('examSessions.participants.regen'),
  })
  if (ok) {
    await run(() => examsApi.regeneratePin(id.value, p.key), 'examSessions.toast.pinRegenerated')
    const next = { ...shownCodes.value }
    delete next[p.key]
    shownCodes.value = next
  }
}
/** Shaxsiy kod: ro'yxatda maskalangan; "Ko'rsatish" alohida endpoint (audit bilan) orqali, qayta bosilsa yashirinadi */
const shownCodes = ref<Record<string, string>>({})
async function toggleCode(p: ExamSessionParticipant) {
  if (shownCodes.value[p.key]) {
    const next = { ...shownCodes.value }
    delete next[p.key]
    shownCodes.value = next
    return
  }
  try {
    const r = await examsApi.participantCode(id.value, p.key)
    if (r.code) shownCodes.value = { ...shownCodes.value, [p.key]: r.code }
    else toast.info(t('examSessions.participants.codeMissingHint'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
async function removeParticipant(p: ExamSessionParticipant) {
  const ok = await confirm({
    title: t('examSessions.participants.removeTitle'),
    message: t('examSessions.participants.removeText', { name: p.fullName }),
    confirmText: t('examSessions.participants.remove'),
    variant: 'danger',
  })
  if (ok) await run(() => examsApi.removeParticipant(id.value, p.key))
}

function openGrant(p: ExamSessionParticipant) {
  grantFor.value = p
  grantFull.value = p.fullTimeGranted
  grantExtra.value = String(p.extraMinutes)
  grantError.value = ''
}
async function doGrant() {
  const p = grantFor.value
  if (!p) return
  const extra = Number(grantExtra.value)
  if (!Number.isInteger(extra) || extra < 0 || extra > 240) {
    grantError.value = t('examSessions.participants.extraRange')
    return
  }
  grantFor.value = null
  await run(
    () => examsApi.grantTime(id.value, p.key, { fullTime: grantFull.value, extraMinutes: extra }),
    'examSessions.toast.granted',
  )
}

const ATTEMPT_TONE: Record<
  string,
  'neutral' | 'success' | 'danger' | 'warning' | 'primary' | 'info'
> = {
  not_started: 'neutral',
  joined: 'info',
  in_progress: 'warning',
  submitted: 'success',
  auto_submitted: 'primary',
}

const phaseText = computed(() => (s.value?.phase ? t(`examSessions.phase.${s.value.phase}`) : ''))
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
    <PageHeader
      :title="s.title"
      :description="
        flow
          ? metaLine
          : `${t(`examSessions.type.${s.type}`)}${s.subjectName ? ' · ' + s.subjectName : ''}`
      "
    >
      <template #actions>
        <BaseBadge v-if="flow" :tone="FLOW_PILL_TONE[flow.pill]" data-testid="detail-status">
          {{ t(`examFlow.pill.${flow.pill}`) }}
        </BaseBadge>
        <BaseBadge v-else :tone="STATUS_TONE[s.status]" data-testid="detail-status">
          {{ t(`examSessions.status.${s.status}`) }}
        </BaseBadge>
        <BaseBadge v-if="s.timeUp" tone="danger" data-testid="time-up">
          {{ t('examSessions.detail.timeUp') }}
        </BaseBadge>
      </template>
    </PageHeader>

    <p
      v-if="meta && !meta.pinSecretConfigured && meta.isAdministration"
      class="mb-4 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning"
    >
      {{ t('examSessions.pinSecretMissing') }}
    </p>
    <p
      v-if="s.approval.status === 'rejected' && s.status === 'draft'"
      class="mb-4 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
      data-testid="rejected-note"
    >
      {{ t('examSessions.detail.rejected', { reason: s.approval.reason }) }}
    </p>
    <p
      v-if="s.status === 'pending_approval'"
      class="mb-4 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning"
      data-testid="pending-note"
    >
      {{ t('examSessions.detail.pending') }}
    </p>

    <component
      :is="flow ? 'details' : 'div'"
      class="card mb-5 p-4 text-sm"
      data-testid="detail-info"
    >
      <summary v-if="flow" class="cursor-pointer text-sm font-semibold text-fg">
        {{ t('examFlow.infoTitle') }}
      </summary>
      <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3" :class="flow && 'mt-3'">
        <div>
          <p class="text-fg-muted">{{ t('examSessions.wizard.start') }}</p>
          <p class="text-fg">{{ fmtDateTime(s.scheduledStart) }}</p>
        </div>
        <div>
          <p class="text-fg-muted">{{ t('examSessions.detail.ends') }}</p>
          <p class="text-fg">
            {{ fmtDateTime(s.endsAt) }}
            <span v-if="phaseText" class="text-fg-muted">({{ phaseText }})</span>
          </p>
        </div>
        <div>
          <p class="text-fg-muted">{{ t('examSessions.wizard.duration') }}</p>
          <p class="text-fg">{{ t('examSessions.minutes', { n: s.durationMin }) }}</p>
        </div>
        <div>
          <p class="text-fg-muted">{{ t('examSessions.detail.code') }}</p>
          <p class="font-mono text-lg text-fg" data-testid="detail-code">{{ s.code ?? '—' }}</p>
        </div>
        <div>
          <p class="text-fg-muted">{{ t('examSessions.wizard.classes') }}</p>
          <p class="text-fg">{{ s.classes.map((c) => c.name).join(', ') || '—' }}</p>
        </div>
        <div>
          <p class="text-fg-muted">{{ t('examSessions.wizard.resultsMode') }}</p>
          <p class="text-fg">{{ t(`examSessions.results.${s.resultsMode}`) }}</p>
        </div>
        <div>
          <p class="text-fg-muted">{{ t('examSessions.wizard.supervisors') }}</p>
          <p class="text-fg">{{ s.supervisors.map((x) => x.fullName).join(', ') || '—' }}</p>
        </div>
        <div>
          <p class="text-fg-muted">{{ t('examSessions.detail.author') }}</p>
          <p class="text-fg">{{ s.createdByName ?? '—' }}</p>
        </div>
        <template v-if="realBlocks.length">
          <div>
            <p class="text-fg-muted">{{ t('examBlocks.scoringMode') }}</p>
            <p class="text-fg" data-testid="detail-scoring">
              {{ t(`examBlocks.scoring.${s.scoringMode ?? 'points'}`) }}
            </p>
          </div>
          <div>
            <p class="text-fg-muted">{{ t('examBlocks.timingMode') }}</p>
            <p class="text-fg" data-testid="detail-timing">
              {{ t(`examBlocks.timing.${s.timingMode ?? 'common'}`) }}
            </p>
          </div>
          <div v-if="s.contribDeadline">
            <p class="text-fg-muted">{{ t('examBlocks.contribDeadline') }}</p>
            <p class="text-fg" data-testid="detail-contrib-deadline">
              {{ fmtDateTime(s.contribDeadline) }}
            </p>
          </div>
        </template>
      </div>
    </component>

    <section v-if="flow" class="card mb-5 space-y-3 p-4" data-testid="stage-dashboard">
      <ExamFlowStepper :stages="flow.stages" :deadline="contribShort" />
      <p
        v-if="s.status === 'draft' && missingApproval.length"
        class="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"
        data-testid="stage-warning"
      >
        {{ t('examFlow.needApproval') }} {{ missingApproval.join(', ') }}
      </p>
    </section>

    <ExamSubjectsTable
      v-if="flow"
      :session="s"
      :busy="busy"
      @open="openBlock"
      @review="reviewBlock"
      @remind="remind"
      @settings="editSettings"
    />

    <div class="mb-5 flex flex-wrap gap-2" data-testid="detail-actions">
      <BaseButton
        v-if="s.canEdit"
        variant="secondary"
        data-testid="act-edit"
        @click="router.push({ name: 'exam-session-edit', params: { id: s.id } })"
      >
        {{ t('common.edit') }}
      </BaseButton>
      <BaseButton
        v-if="s.canSubmit"
        :loading="busy"
        :disabled="!!flow && missingApproval.length > 0"
        :title="flow && missingApproval.length ? t('examFlow.needApproval') : undefined"
        data-testid="act-submit"
        @click="submitSession"
      >
        {{ t('examSessions.detail.submit') }}
      </BaseButton>
      <template v-if="s.canApprove">
        <BaseButton
          :loading="busy"
          data-testid="act-approve"
          @click="act('approve', 'examSessions.toast.approved')"
        >
          {{ t('examSessions.detail.approve') }}
        </BaseButton>
        <BaseButton variant="danger" data-testid="act-reject" @click="openReject">
          {{ t('examSessions.detail.reject') }}
        </BaseButton>
      </template>
      <BaseButton
        v-if="s.canOpen"
        variant="secondary"
        :loading="busy"
        data-testid="act-open"
        @click="act('open', 'examSessions.toast.opened')"
      >
        {{ t('examSessions.detail.open') }}
      </BaseButton>
      <BaseButton
        v-if="s.canViewResults"
        variant="secondary"
        data-testid="act-results"
        @click="router.push({ name: 'exam-session-results', params: { id: s.id } })"
      >
        {{ t('examSessions.detail.results') }}
      </BaseButton>
      <BaseButton
        v-if="s.canExtend"
        variant="secondary"
        data-testid="act-extend"
        @click="openExtend"
      >
        {{ t('examSessions.detail.extend') }}
      </BaseButton>
      <BaseButton
        v-if="s.canReopen"
        variant="secondary"
        data-testid="act-reopen"
        @click="openReopen"
      >
        {{ t('examSessions.detail.reopen') }}
      </BaseButton>
      <BaseButton v-if="s.canClose" variant="secondary" data-testid="act-close" @click="closeNow">
        {{ t('examSessions.detail.close') }}
      </BaseButton>
      <BaseButton v-if="s.canCancel" variant="danger" data-testid="act-cancel" @click="cancel">
        {{ t('examSessions.detail.cancel') }}
      </BaseButton>
      <BaseButton
        v-if="s.canReturnToDraft && !s.hasAttempts"
        variant="secondary"
        :loading="busy"
        data-testid="act-return"
        @click="returnToDraft"
      >
        {{ t('examSessions.detail.returnToDraft') }}
      </BaseButton>
      <BaseButton
        v-if="s.canCopy"
        variant="secondary"
        :loading="busy"
        data-testid="act-copy"
        @click="copySession"
      >
        {{ t('examSessions.detail.copy') }}
      </BaseButton>
      <BaseButton v-if="s.canDelete" variant="danger" data-testid="act-delete" @click="remove">
        {{ t('common.delete') }}
      </BaseButton>
    </div>

    <section
      v-if="s.canPrint"
      class="card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      data-testid="print-block"
    >
      <BaseSelect
        v-model="printClass"
        class="sm:w-64"
        :label="t('examSessions.detail.printFor')"
        :options="classOptions"
        data-testid="print-class"
      />
      <BaseButton variant="secondary" :loading="busy" data-testid="print-pins" @click="print">
        <Printer class="h-4 w-4" aria-hidden="true" />
        {{ t('examSessions.detail.printPins') }}
      </BaseButton>
      <p class="text-xs text-fg-muted sm:ml-2">{{ t('examSessions.detail.printHint') }}</p>
    </section>

    <p
      v-if="attempts?.joinAlert.alertAt"
      class="mb-4 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
      data-testid="join-alert"
    >
      {{ t('examSessions.attempt.joinAlert', { n: attempts.joinAlert.failures }) }}
    </p>

    <section class="card mb-5 p-4">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-fg">
          <span v-if="flow" class="text-fg-muted">4.</span>
          {{ t('examSessions.participants.title') }} ({{ s.participants.length }})
        </h2>
        <BaseButton
          v-if="editable"
          size="sm"
          variant="secondary"
          data-testid="toggle-add"
          @click="showAdd = !showAdd"
        >
          {{ t('examSessions.participants.add') }}
        </BaseButton>
      </div>
      <div v-if="showAdd && editable" class="mb-4 rounded-lg border border-border p-3">
        <ParticipantsPanel :session="s" :meta="meta" @changed="refresh" />
      </div>

      <p v-if="s.participants.length === 0" class="text-sm text-fg-muted">
        {{ t('examSessions.participants.empty') }}
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[960px] text-left text-sm" data-testid="participants-table">
          <thead class="text-xs uppercase text-fg-muted">
            <tr>
              <th class="py-2 pr-3">{{ t('examSessions.participants.name') }}</th>
              <th class="py-2 pr-3">{{ t('examSessions.participants.classOrigin') }}</th>
              <th class="py-2 pr-3">{{ t('examSessions.participants.kind') }}</th>
              <th class="py-2 pr-3">{{ t('examSessions.participants.pin') }}</th>
              <th class="py-2 pr-3">{{ t('examSessions.participants.time') }}</th>
              <th v-if="attempts" class="py-2 pr-3">{{ t('examSessions.attempt.status') }}</th>
              <th v-if="attempts" class="py-2 pr-3">{{ t('examSessions.attempt.answered') }}</th>
              <th v-if="attempts" class="py-2 pr-3">{{ t('examSessions.attempt.warnings') }}</th>
              <th class="py-2 text-right">{{ t('examSessions.participants.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="p in s.participants" :key="p.key" data-testid="participant-row">
              <td class="py-2 pr-3 font-medium text-fg">{{ p.fullName }}</td>
              <td class="py-2 pr-3 text-fg-muted">{{ p.className ?? p.origin ?? '—' }}</td>
              <td class="py-2 pr-3">
                <BaseBadge>{{ t(`examSessions.participants.kinds.${p.kind}`) }}</BaseBadge>
              </td>
              <td class="py-2 pr-3">
                <div class="mb-1 flex items-center gap-1.5" data-testid="code-cell">
                  <template v-if="p.hasCode">
                    <code
                      class="whitespace-nowrap font-mono text-xs tracking-wider text-fg"
                      data-testid="code-text"
                    >
                      {{ shownCodes[p.key] ?? '•••-•••-•••' }}
                    </code>
                    <button
                      type="button"
                      class="text-xs text-primary-700 hover:underline"
                      data-testid="code-toggle"
                      @click="toggleCode(p)"
                    >
                      {{
                        shownCodes[p.key]
                          ? t('examSessions.participants.codeHide')
                          : t('examSessions.participants.codeShow')
                      }}
                    </button>
                  </template>
                  <span v-else class="text-xs text-warning" data-testid="code-missing">
                    {{ t('examSessions.participants.codeMissing') }}
                  </span>
                </div>
                <BaseBadge :tone="p.hasPin ? 'success' : 'danger'" data-testid="pin-status">
                  {{
                    p.hasPin
                      ? t('examSessions.participants.pinReady')
                      : t('examSessions.participants.pinMissing')
                  }}
                </BaseBadge>
              </td>
              <td class="py-2 pr-3 text-xs text-fg-muted" data-testid="time-status">
                <template v-if="p.fullTimeGranted">{{
                  t('examSessions.participants.fullTime')
                }}</template>
                <template v-if="p.extraMinutes">
                  +{{ p.extraMinutes }} {{ t('examSessions.participants.min') }}</template
                >
                <template v-if="!p.fullTimeGranted && !p.extraMinutes">—</template>
              </td>
              <template v-if="attempts">
                <td class="py-2 pr-3" data-testid="attempt-status">
                  <BaseBadge
                    :tone="
                      attemptByKey.get(p.key)?.terminated
                        ? 'danger'
                        : ATTEMPT_TONE[attemptByKey.get(p.key)?.status ?? 'not_started']
                    "
                  >
                    {{
                      attemptByKey.get(p.key)?.terminated
                        ? t('examSessions.attempt.statuses.terminated')
                        : t(
                            `examSessions.attempt.statuses.${attemptByKey.get(p.key)?.status ?? 'not_started'}`,
                          )
                    }}
                  </BaseBadge>
                </td>
                <td class="py-2 pr-3 text-fg-muted" data-testid="attempt-answered">
                  <template v-if="(attemptByKey.get(p.key)?.total ?? 0) > 0">
                    {{ attemptByKey.get(p.key)!.answered }} / {{ attemptByKey.get(p.key)!.total }}
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="py-2 pr-3" data-testid="attempt-warnings">
                  <BaseBadge v-if="(attemptByKey.get(p.key)?.warnings ?? 0) > 0" tone="warning">
                    {{ attemptByKey.get(p.key)!.warnings }}
                  </BaseBadge>
                  <span v-else class="text-fg-muted">0</span>
                </td>
              </template>
              <td class="py-2 text-right">
                <div class="flex min-w-[230px] flex-wrap justify-end gap-1">
                  <BaseButton
                    v-if="
                      s.canClose &&
                      ['joined', 'in_progress'].includes(attemptByKey.get(p.key)?.status ?? '')
                    "
                    size="sm"
                    variant="ghost"
                    data-testid="allow-reentry"
                    @click="allowReentry(p)"
                  >
                    {{ t('examSessions.attempt.reentry') }}
                  </BaseButton>
                  <BaseButton
                    v-if="s.canGrant"
                    size="sm"
                    variant="secondary"
                    data-testid="grant-open"
                    @click="openGrant(p)"
                  >
                    {{ t('examSessions.participants.grant') }}
                  </BaseButton>
                  <BaseButton
                    v-if="editable"
                    size="sm"
                    variant="ghost"
                    data-testid="regen-pin"
                    @click="regenerate(p)"
                  >
                    {{ t('examSessions.participants.regen') }}
                  </BaseButton>
                  <BaseButton
                    v-if="editable"
                    size="sm"
                    variant="ghost"
                    data-testid="remove-participant"
                    @click="removeParticipant(p)"
                  >
                    {{ t('examSessions.participants.remove') }}
                  </BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="s.canMonitor" data-testid="stage-run">
      <LiveMonitor :session-id="s.id" :stage="flow ? '5.' : undefined" @changed="loadAttempts" />
    </div>

    <BaseModal
      :open="deleteOpen"
      :title="t('examSessions.detail.deleteTitle')"
      persistent
      @close="deleteOpen = false"
    >
      <div class="space-y-4" data-testid="delete-dialog">
        <p class="text-sm text-fg-muted">{{ t('examSessions.detail.deleteChoice') }}</p>
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
          <input
            v-model="deleteMode"
            type="radio"
            value="exam_only"
            data-testid="delete-exam-only"
          />
          <span class="text-sm">
            <b class="block text-fg">{{ t('examSessions.detail.deleteExamOnly') }}</b>
            {{ t('examSessions.detail.deleteExamOnlyHint') }}
          </span>
        </label>
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-danger p-3">
          <input
            v-model="deleteMode"
            type="radio"
            value="with_results"
            data-testid="delete-with-results"
          />
          <span class="text-sm">
            <b class="block text-danger">{{ t('examSessions.detail.deleteWithResults') }}</b>
            {{ t('examSessions.detail.deleteWithResultsHint') }}
          </span>
        </label>
        <div
          v-if="deleteMode === 'with_results'"
          class="space-y-2"
          data-testid="delete-confirm-box"
        >
          <p class="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {{ t('examSessions.detail.deleteIrreversible') }}
          </p>
          <BaseInput
            v-model="deleteTitle"
            :label="t('examSessions.detail.deleteTypeTitle', { title: s?.title ?? '' })"
            :error="deleteError"
            data-testid="delete-title"
          />
        </div>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="deleteOpen = false">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton
          variant="danger"
          :loading="busy"
          :disabled="deleteMode === 'with_results' && deleteTitle !== s?.title"
          data-testid="delete-confirm"
          @click="doDelete"
        >
          {{ t('common.delete') }}
        </BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="reopenOpen"
      :title="t('examSessions.detail.reopenTitle')"
      persistent
      @close="reopenOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-fg-muted">{{ t('examSessions.detail.reopenHint') }}</p>
        <BaseInput
          v-model="reopenReason"
          :label="t('examSessions.detail.reopenReason')"
          :error="reopenError.reason"
          :maxlength="500"
          data-testid="reopen-reason"
        />
        <BaseInput
          v-model="reopenEnd"
          type="datetime-local"
          :label="t('examSessions.detail.reopenEnd')"
          :error="reopenError.end"
          data-testid="reopen-end"
        />
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="reopenOpen = false">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton :loading="busy" data-testid="reopen-confirm" @click="doReopen">{{
          t('examSessions.detail.reopen')
        }}</BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="extendOpen"
      :title="t('examSessions.detail.extendTitle')"
      persistent
      @close="extendOpen = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-fg-muted">{{ t('examSessions.detail.extendHint') }}</p>
        <BaseInput
          v-model="extendMinutes"
          type="number"
          inputmode="numeric"
          min="1"
          max="180"
          :label="t('examSessions.detail.extendMinutes')"
          :error="extendError"
          data-testid="extend-minutes"
        />
        <BaseInput
          v-model="extendReason"
          :label="t('examSessions.detail.extendReason')"
          :maxlength="500"
          data-testid="extend-reason"
        />
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="extendOpen = false">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton :loading="busy" data-testid="extend-confirm" @click="doExtend">{{
          t('examSessions.detail.extend')
        }}</BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="rejectOpen"
      :title="t('examSessions.detail.rejectTitle')"
      persistent
      @close="rejectOpen = false"
    >
      <BaseInput
        v-model="rejectReason"
        :label="t('examSessions.detail.reason')"
        :error="rejectError"
        :maxlength="500"
        data-testid="reject-reason"
      />
      <template #footer>
        <BaseButton variant="secondary" @click="rejectOpen = false">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton variant="danger" data-testid="reject-confirm" @click="doReject">{{
          t('examSessions.detail.reject')
        }}</BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      :open="!!grantFor"
      :title="t('examSessions.participants.grantTitle', { name: grantFor?.fullName ?? '' })"
      persistent
      @close="grantFor = null"
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
          max="240"
          :label="t('examSessions.participants.grantExtra')"
          :error="grantError"
          data-testid="grant-extra"
        />
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="grantFor = null">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton data-testid="grant-confirm" @click="doGrant">{{ t('common.save') }}</BaseButton>
      </template>
    </BaseModal>
  </template>
</template>
