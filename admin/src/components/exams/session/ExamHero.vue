<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Ban,
  BellRing,
  Copy,
  Lock,
  MoreVertical,
  Pencil,
  Printer,
  Timer,
  Trash2,
  Trophy,
  Undo2,
  Unlock,
} from 'lucide-vue-next'
import type { ExamSession } from '@/api/types'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import { fmtDateTime } from '@/utils/examSessions'
import { fmtLeft } from '@/utils/examBoard'

/**
 * Sarlavha (bitta qator, binafsha gradient): orqaga, nom + holat, qisqa ma'lumot, ko'pi bilan 2 ta asosiy tugma
 * (holatga qarab) va ⋮ menyu (qolgan barcha amallar; xavflilari ajratgichdan keyin). Ochiq imtihonda qolgan vaqt.
 */
const props = defineProps<{
  s: ExamSession
  /** Holat belgisi matni (blokli imtihonda bosqich nomi) */
  pill: string
  /** Server vaqti (ms): qolgan vaqt uchun */
  nowMs: number
  busy: boolean
  /** Natijalar yopilgan, "e'londan keyin" rejimida va hali e'lon qilinmagan */
  canPublish: boolean
  /** Tasdiqlanmagan (o'qituvchisi bor) fanlar nomi */
  missingNames: string[]
  /** Tasdiqlash uchun birinchi tayyor fan (o'qituvchi tugatgan); yo'q: hech kim tugatmagan */
  reviewTarget: { id: string; name: string } | null
  /** "Eslatma" ko'rinadimi (qoralama, yig'ilayotgan fan bor) */
  canRemind: boolean
  hasBlocks: boolean
}>()
const emit = defineEmits<{ back: []; action: [key: string]; copyCode: [] }>()
const { t } = useI18n()

interface Btn {
  key: string
  label: string
  primary: boolean
  disabled?: boolean
  title?: string
  testid: string
}

/** Holatga qarab asosiy tugmalar (≤ 2) */
const primaries = computed<Btn[]>(() => {
  const s = props.s
  const out: Btn[] = []
  if (s.status === 'draft' && s.canSubmit) {
    if (props.hasBlocks && props.missingNames.length > 0) {
      out.push({
        key: 'review',
        label: props.reviewTarget
          ? t('examBoard.hero.confirmSubject', { subject: props.reviewTarget.name })
          : t('examBoard.hero.confirmSubjects'),
        primary: true,
        disabled: !props.reviewTarget,
        title: props.reviewTarget ? undefined : t('examBoard.hero.nobodyFinished'),
        testid: 'act-review',
      })
    } else {
      out.push({
        key: 'submit',
        label: t('examSessions.detail.submit'),
        primary: true,
        testid: 'act-submit',
      })
    }
  } else if (s.status === 'pending_approval' && s.canApprove) {
    out.push({
      key: 'approve',
      label: t('examSessions.detail.approve'),
      primary: true,
      testid: 'act-approve',
    })
    out.push({
      key: 'reject',
      label: t('examSessions.detail.reject'),
      primary: false,
      testid: 'act-reject',
    })
  } else if (s.status === 'scheduled') {
    if (s.canOpen) {
      out.push({
        key: 'open',
        label: t('examBoard.hero.start'),
        primary: true,
        testid: 'act-open',
      })
    }
    if (s.canPrint) {
      out.push({
        key: 'print',
        label: t('examBoard.menu.print'),
        primary: false,
        testid: 'act-print',
      })
    }
  } else if (s.status === 'open') {
    if (s.canExtend) {
      out.push({
        key: 'extend',
        label: t('examBoard.hero.addTime'),
        primary: false,
        testid: 'act-extend',
      })
    }
    if (s.canClose) {
      out.push({
        key: 'close',
        label: t('examSessions.detail.close'),
        primary: true,
        testid: 'act-close',
      })
    }
  } else if (s.status === 'closed' && s.canViewResults) {
    out.push({
      key: 'excel',
      label: t('examBoard.hero.excel'),
      primary: false,
      testid: 'act-excel',
    })
    out.push(
      props.canPublish
        ? {
            key: 'publish',
            label: t('examBoard.hero.publish'),
            primary: true,
            testid: 'act-publish',
          }
        : {
            key: 'results',
            label: t('examBoard.hero.results'),
            primary: true,
            testid: 'act-results',
          },
    )
  }
  return out.slice(0, 2)
})

/** ⋮ menyu: asosiy tugmada bo'lmagan barcha amallar; xavflilari ajratgichdan keyin */
const items = computed<DropdownItem[]>(() => {
  const s = props.s
  const taken = new Set(primaries.value.map((b) => b.key))
  const out: DropdownItem[] = []
  const add = (
    key: string,
    label: string,
    icon: DropdownItem['icon'],
    ok: boolean | undefined,
    danger = false,
  ) => {
    if (ok && !taken.has(key)) out.push({ key, label, icon, danger })
  }
  add('edit', t('examBoard.menu.edit'), Pencil, s.canEdit)
  add('results', t('examSessions.detail.results'), Trophy, s.canViewResults)
  add('extend', t('examSessions.detail.extend'), Timer, s.canExtend)
  add('reopen', t('examSessions.detail.reopen'), Unlock, s.canReopen)
  add('return', t('examSessions.detail.returnToDraft'), Undo2, s.canReturnToDraft && !s.hasAttempts)
  add('copy', t('examSessions.detail.copy'), Copy, s.canCopy)
  add('print', t('examBoard.menu.print'), Printer, s.canPrint)
  add('remind', t('examFlow.remind'), BellRing, props.canRemind)
  const safe = out.length
  add('close', t('examSessions.detail.close'), Lock, s.canClose, true)
  add('cancel', t('examSessions.detail.cancel'), Ban, s.canCancel, true)
  add('delete', t('common.delete'), Trash2, s.canDelete, true)
  if (out.length > safe) out[safe]!.separator = safe > 0
  return out
})

const meta = computed(() => {
  const s = props.s
  return [
    t(`examSessions.type.${s.type}`),
    !props.hasBlocks ? s.subjectName : null,
    s.classes.map((c) => c.name).join(', '),
    fmtDateTime(s.scheduledStart),
    t('examSessions.minutes', { n: s.durationMin }),
  ]
    .filter(Boolean)
    .join(' · ')
})
const showCode = computed(
  () => !!props.s.code && (props.s.status === 'open' || props.s.status === 'scheduled'),
)
const timeLeft = computed(() =>
  props.s.status === 'open' ? fmtLeft(Date.parse(props.s.endsAt) - props.nowMs) : null,
)

/** Bekor qilingan imtihon: kulrang gradient (ko'k-binafshadan farq qiladi) */
const gradient = computed(() =>
  props.s.status === 'cancelled'
    ? 'linear-gradient(90deg, #475569, #64748b)'
    : 'linear-gradient(90deg, #4338ca, #6d28d9)',
)
const btnBase =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60'
const btnPrimary = `${btnBase} bg-white text-indigo-950 hover:opacity-90`
const btnGhost = `${btnBase} border border-white/50 text-white hover:bg-white/10`
const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'
</script>

<template>
  <header
    class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 text-white"
    :style="{ background: gradient }"
    data-testid="exam-hero"
  >
    <button
      type="button"
      class="-ml-1 shrink-0"
      :class="iconBtn"
      :aria-label="t('examBoard.back')"
      data-testid="hero-back"
      @click="emit('back')"
    >
      <ArrowLeft class="h-5 w-5" aria-hidden="true" />
    </button>
    <div class="min-w-0 flex-1 basis-56">
      <div class="flex flex-wrap items-center gap-x-2">
        <h1 class="truncate text-lg font-semibold leading-6" data-testid="hero-title">
          {{ s.title }}
        </h1>
        <span
          class="rounded-full bg-white/20 px-2 py-0.5 text-xs"
          data-testid="detail-status"
          :data-status="s.status"
          >{{ pill }}</span
        >
        <button
          v-if="showCode"
          type="button"
          class="shrink-0 whitespace-nowrap rounded-full bg-white/20 px-2 py-0.5 font-mono text-xs font-semibold hover:bg-white/30"
          :title="t('examBoard.copyCode')"
          :aria-label="t('examBoard.copyCode')"
          data-testid="hero-code"
          @click="emit('copyCode')"
        >
          {{ t('examBoard.code', { code: s.code }) }}
        </button>
        <span
          v-if="s.timeUp"
          class="rounded-full bg-danger px-2 py-0.5 text-xs text-white"
          data-testid="time-up"
          >{{ t('examSessions.detail.timeUp') }}</span
        >
      </div>
      <p class="truncate text-xs leading-5 text-indigo-100" data-testid="hero-meta">
        {{ meta }}
      </p>
    </div>
    <div class="flex w-full items-center gap-2 sm:w-auto">
      <span
        v-if="timeLeft"
        class="mr-auto flex items-baseline gap-1.5 sm:mr-3"
        data-testid="hero-timer-box"
      >
        <span class="hidden text-xs text-indigo-100 sm:inline">{{ t('examBoard.remaining') }}</span>
        <span
          class="text-lg font-bold tabular-nums sm:text-2xl"
          role="timer"
          data-testid="hero-timer"
          >{{ timeLeft }}</span
        >
      </span>
      <button
        v-for="b in primaries"
        :key="b.key"
        type="button"
        :class="b.primary ? btnPrimary : btnGhost"
        :disabled="b.disabled || busy"
        :title="b.title"
        :data-testid="b.testid"
        @click="emit('action', b.key)"
      >
        {{ b.label }}
      </button>
      <span v-if="items.length" class="ml-auto sm:ml-0">
        <DropdownMenu
          :items="items"
          :label="t('examBoard.more')"
          :trigger-class="iconBtn"
          @select="emit('action', $event)"
        >
          <template #trigger><MoreVertical class="h-5 w-5" aria-hidden="true" /></template>
        </DropdownMenu>
      </span>
    </div>
  </header>
</template>
