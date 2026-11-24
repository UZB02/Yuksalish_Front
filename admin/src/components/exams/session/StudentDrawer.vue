<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { fmtLeft, fmtNum, type BoardRow, type BoardStage } from '@/utils/examBoard'
import ProgressRing from './ProgressRing.vue'

/**
 * O'quvchi paneli: o'ngdan (telefonda pastdan) chiqadi. Shaxsiy amallar (kod, PIN, vaqt, qayta kirish, ogohlantirish,
 * to'xtatish, olib tashlash), jonli tafsilot va Keyin bosqichida fanlar bo'yicha ball. Esc yopadi, fokus panel ichida
 * qoladi va yopilganda tugmaga qaytadi. Ma'lumot har 5 s da yangilansa ham panel yopilmaydi (kalit bo'yicha).
 */
const props = defineProps<{
  row: BoardRow
  stage: BoardStage
  /** Ochilgan shaxsiy kod (audit bilan olingan) */
  shownCode: string | undefined
  blockNames: Record<string, string>
  canGrant: boolean
  canIntervene: boolean
  canClose: boolean
  editable: boolean
  canViewResults: boolean
}>()
const emit = defineEmits<{
  close: []
  toggleCode: []
  regenerate: []
  remove: []
  grant: []
  reentry: []
  warn: []
  stop: []
  viewAnswers: []
}>()
const { t } = useI18n()

const panel = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)
let opener: HTMLElement | null = null

watch(
  () => props.row.key,
  async () => {
    await nextTick()
    closeBtn.value?.focus()
  },
  { immediate: true },
)
if (typeof document !== 'undefined') opener = document.activeElement as HTMLElement | null
onBeforeUnmount(() => opener?.focus?.())

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !panel.value) return
  const els = Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
  if (!els.length) return
  const first = els[0]!
  const last = els[els.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

const initials = computed(() =>
  props.row.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join(''),
)
const TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'danger'> = {
  not_started: 'neutral',
  joined: 'info',
  in_progress: 'warning',
  submitted: 'success',
  auto_submitted: 'primary',
  terminated: 'danger',
}
const p = computed(() => props.row.p)
const running = computed(() => props.row.phase === 'in_progress')
const showWarnStop = computed(() => props.canIntervene && running.value)
const showReentry = computed(
  () => props.canClose && ['joined', 'in_progress'].includes(props.row.phase),
)
const fmtClock = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const agoText = computed(() => {
  const s = props.row.idleSec
  if (s === null) return '—'
  return s < 60
    ? t('examSessions.live.agoSec', { n: s })
    : t('examSessions.live.agoMin', { n: Math.floor(s / 60) })
})
const answersPct = computed(() =>
  props.row.total > 0 ? Math.min(100, Math.round((props.row.answered / props.row.total) * 100)) : 0,
)
const result = computed(() => props.row.result)
const rootClass = 'fixed inset-0 z-40 flex items-end justify-end bg-slate-950/50 md:items-stretch'
</script>

<template>
  <Teleport to="body">
    <div :class="rootClass" data-testid="student-drawer-backdrop" @mousedown.self="emit('close')">
      <aside
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="row.fullName"
        class="flex w-full flex-col border-border bg-surface text-fg shadow-xl max-md:max-h-[85vh] max-md:rounded-t-2xl max-md:border-t md:h-full md:max-w-md md:border-l"
        data-testid="student-drawer"
        :data-key="row.key"
        @keydown="onKeydown"
      >
        <header class="flex items-center gap-3 border-b border-border p-4">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
            aria-hidden="true"
            >{{ initials }}</span
          >
          <div class="min-w-0 flex-1">
            <h2 class="break-words text-base font-semibold" data-testid="drawer-name">
              {{ row.fullName }}
            </h2>
            <p class="text-xs text-fg-muted">
              {{ row.className ?? row.origin ?? '—' }} ·
              {{ t(`examSessions.participants.kinds.${row.kind}`) }}
            </p>
          </div>
          <button
            ref="closeBtn"
            type="button"
            class="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted"
            :aria-label="t('examBoard.drawer.close')"
            data-testid="drawer-close"
            @click="emit('close')"
          >
            <X class="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div class="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <!-- Holat va jonli tafsilot -->
          <section v-if="stage !== 'before'" class="space-y-2" data-testid="drawer-live">
            <div class="flex items-center justify-between gap-2">
              <BaseBadge :tone="TONE[row.phase]" data-testid="drawer-phase">{{
                t(`examSessions.live.statuses.${row.phase}`)
              }}</BaseBadge>
              <span v-if="row.total > 0" class="tabular-nums" data-testid="drawer-answers">{{
                t('examBoard.drawer.answers', { a: row.answered, t: row.total })
              }}</span>
            </div>
            <div
              v-if="stage === 'during' && row.total > 0"
              class="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              :aria-valuenow="answersPct"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="h-full rounded-full bg-primary-600"
                :style="{ width: answersPct + '%' }"
              />
            </div>
            <p v-if="row.terminated" class="text-xs text-danger" data-testid="drawer-terminated">
              {{ t('examBoard.drawer.terminated', { reason: row.terminated.reason }) }}
              <template v-if="row.terminated.byName"> ({{ row.terminated.byName }})</template>
            </p>
            <dl v-if="stage === 'during'" class="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt class="text-xs text-fg-muted">{{ t('examSessions.live.cols.timeLeft') }}</dt>
                <dd class="font-mono" data-testid="drawer-timeleft">
                  {{ row.timeLeftMs !== null ? fmtLeft(row.timeLeftMs) : '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-fg-muted">{{ t('examBoard.drawer.lastSeen') }}</dt>
                <dd data-testid="drawer-lastseen">
                  <BaseBadge v-if="row.stale" tone="danger" data-testid="live-stale">{{
                    t('examSessions.live.noContact')
                  }}</BaseBadge>
                  <span v-else class="text-fg-muted">{{ agoText }}</span>
                </dd>
              </div>
              <div data-testid="live-leaves">
                <dt class="text-xs text-fg-muted">{{ t('examBoard.drawer.leaves') }}</dt>
                <dd>
                  <template v-if="row.leaves > 0">
                    <BaseBadge
                      tone="danger"
                      :title="
                        row.leaveDetail
                          ? t('examSessions.live.leavesTitle', {
                              blur: row.leaveDetail.blur,
                              hidden: row.leaveDetail.hidden,
                              fullscreen: row.leaveDetail.fullscreen,
                            })
                          : undefined
                      "
                      data-testid="live-leaves-count"
                      >{{ t('examSessions.live.leavesCount', { n: row.leaves }) }}</BaseBadge
                    >
                    <span class="block text-xs text-fg-muted" data-testid="live-leaves-last">{{
                      t('examSessions.live.leavesLast', { time: fmtClock(row.lastLeaveAt) })
                    }}</span>
                  </template>
                  <span v-else class="text-fg-muted">0</span>
                </dd>
              </div>
              <div data-testid="live-warnings">
                <dt class="text-xs text-fg-muted">{{ t('examBoard.drawer.warnings') }}</dt>
                <dd class="text-fg-muted">
                  <template v-if="row.warningsSent > 0">
                    {{ t('examSessions.live.warnSent', { n: row.warningsSent }) }}
                    <span
                      v-if="row.warningsPending > 0"
                      class="block text-xs text-warning"
                      data-testid="live-warn-pending"
                      >{{ t('examSessions.live.warnPending', { n: row.warningsPending }) }}</span
                    >
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
              <div v-if="row.block && running" class="col-span-2" data-testid="live-block">
                <dt class="text-xs text-fg-muted">
                  {{
                    t('examSessions.live.block', { n: row.block.index + 1, total: row.block.total })
                  }}
                </dt>
                <dd class="truncate">{{ row.block.title }}</dd>
              </div>
            </dl>
          </section>

          <!-- Keyin: fanlar bo'yicha ball -->
          <section v-if="stage === 'after'" class="space-y-3" data-testid="drawer-scores">
            <template v-if="result">
              <div class="flex items-center gap-3">
                <ProgressRing :pct="Math.round(result.percent)" :size="48" />
                <p class="text-3xl font-semibold tabular-nums" data-testid="drawer-total">
                  {{ fmtNum(result.earned) }}
                  <span class="text-base font-normal text-fg-muted"
                    >/ {{ fmtNum(result.max) }}</span
                  >
                </p>
              </div>
              <p v-if="result.essayPending > 0" class="text-xs text-warning">
                {{ t('examBoard.drawer.essayPending', { n: result.essayPending }) }}
              </p>
              <div
                v-for="b in result.blocks"
                :key="b.blockId"
                :data-testid="`drawer-block-${b.blockId}`"
              >
                <p class="mb-1 flex justify-between">
                  <span>{{ blockNames[b.blockId] ?? '—' }}</span>
                  <b class="tabular-nums"
                    >{{ fmtNum(b.earned) }} / {{ fmtNum(b.max) }}
                    <span class="font-normal text-fg-muted"
                      >({{ b.max > 0 ? Math.round((b.earned / b.max) * 100) : 0 }}%)</span
                    ></b
                  >
                </p>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    class="h-full rounded-full bg-primary-600"
                    :style="{ width: (b.max > 0 ? Math.round((b.earned / b.max) * 100) : 0) + '%' }"
                  />
                </div>
              </div>
            </template>
            <p v-else class="text-fg-muted">{{ t('examBoard.drawer.noResult') }}</p>
            <BaseButton
              v-if="canViewResults && result"
              variant="secondary"
              data-testid="drawer-view-answers"
              @click="emit('viewAnswers')"
            >
              {{ t('examBoard.drawer.viewAnswers') }}
            </BaseButton>
          </section>

          <!-- Shaxsiy kod, PIN va vaqt -->
          <section class="space-y-2" data-testid="drawer-personal">
            <h3 class="font-semibold">{{ t('examBoard.drawer.personal') }}</h3>
            <div class="flex flex-wrap items-center gap-1.5" data-testid="code-cell">
              <template v-if="p.hasCode">
                <code
                  class="whitespace-nowrap font-mono text-sm tracking-wider text-fg"
                  data-testid="code-text"
                >
                  {{ shownCode ?? '•••-•••-•••' }}
                </code>
                <button
                  type="button"
                  class="text-xs text-primary-700 hover:underline"
                  data-testid="code-toggle"
                  @click="emit('toggleCode')"
                >
                  {{
                    shownCode
                      ? t('examSessions.participants.codeHide')
                      : t('examSessions.participants.codeShow')
                  }}
                </button>
              </template>
              <span v-else class="text-xs text-warning" data-testid="code-missing">
                {{ t('examSessions.participants.codeMissing') }}
              </span>
              <BaseBadge :tone="p.hasPin ? 'success' : 'danger'" data-testid="pin-status">
                {{
                  t('examBoard.drawer.pinState', {
                    state: (p.hasPin
                      ? t('examSessions.participants.pinReady')
                      : t('examSessions.participants.pinMissing')
                    ).toLowerCase(),
                  })
                }}
              </BaseBadge>
            </div>
            <p class="text-xs text-fg-muted" data-testid="time-status">
              {{ t('examBoard.drawer.time') }}:
              <template v-if="p.fullTimeGranted">{{
                t('examSessions.participants.fullTime')
              }}</template>
              <template v-if="p.extraMinutes">
                +{{ p.extraMinutes }} {{ t('examSessions.participants.min') }}</template
              >
              <template v-if="!p.fullTimeGranted && !p.extraMinutes">—</template>
            </p>
          </section>

          <section class="grid grid-cols-2 gap-2" data-testid="drawer-actions">
            <BaseButton
              v-if="showWarnStop"
              variant="primary"
              data-testid="live-warn"
              @click="emit('warn')"
            >
              {{ t('examBoard.toolbar.warn') }}
            </BaseButton>
            <BaseButton
              v-if="canGrant"
              variant="secondary"
              data-testid="grant-open"
              @click="emit('grant')"
            >
              {{ t('examSessions.participants.grant') }}
            </BaseButton>
            <BaseButton
              v-if="showReentry"
              variant="secondary"
              data-testid="allow-reentry"
              @click="emit('reentry')"
            >
              {{ t('examSessions.attempt.reentry') }}
            </BaseButton>
            <BaseButton
              v-if="showWarnStop"
              variant="danger"
              data-testid="live-stop"
              @click="emit('stop')"
            >
              {{ t('examBoard.toolbar.stop') }}
            </BaseButton>
            <BaseButton
              v-if="editable"
              variant="secondary"
              data-testid="regen-pin"
              @click="emit('regenerate')"
            >
              {{ t('examSessions.participants.regen') }}
            </BaseButton>
            <BaseButton
              v-if="editable"
              variant="ghost"
              data-testid="remove-participant"
              @click="emit('remove')"
            >
              {{ t('examSessions.participants.remove') }}
            </BaseButton>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
