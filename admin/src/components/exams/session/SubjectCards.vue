<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BellRing, Check, Circle, Settings2 } from 'lucide-vue-next'
import type { ExamBlock, ExamSession } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import {
  blockState,
  blocksSummary,
  progressTone,
  type BlockState,
  type FlowStage,
} from '@/utils/examFlow'
import { fmtDateTime } from '@/utils/examSessions'
import ProgressRing from './ProgressRing.vue'

/**
 * "Fanlar" bo'limi: har fan kartochkasi (halqa, koeffitsiyent, o'qituvchilar, savollar N/maqsad, holat, amal).
 * Oldin bosqichida pastda "Qadamlar" va "Vaqt" kartochkalari ham chiqadi. Keyin bosqichida halqada fan bo'yicha
 * o'rtacha foiz.
 */
const props = defineProps<{
  session: ExamSession
  stage: 'before' | 'during' | 'after'
  busy?: boolean
  stages: FlowStage[] | null
  deadline: string | null
  missingNames: string[]
  /** Keyin: fan bo'yicha o'rtacha foiz (blockId bo'yicha) */
  avgByBlock: Record<string, number>
}>()
const emit = defineEmits<{
  open: [blockId: string]
  review: [blockId: string]
  remind: []
  settings: []
}>()
const { t } = useI18n()

const blocks = computed(() => (props.session.blocks ?? []).filter((b) => !b.legacy))
const draft = computed(() => props.session.status === 'draft')
const sum = computed(() => blocksSummary(props.session.blocks))
const coefMode = computed(() => props.session.scoringMode === 'coefficient')
const fmtCoef = (n: number) => String(n).replace('.', ',')
const RING = ['#4f46e5', '#0f766e', '#b45309', '#be185d', '#0369a1']

const TONE: Record<BlockState, 'warning' | 'primary' | 'success' | 'neutral'> = {
  collecting: 'warning',
  done: 'primary',
  approved: 'success',
  auto: 'neutral',
}
const BAR: Record<'warning' | 'primary' | 'success', string> = {
  warning: 'bg-warning',
  primary: 'bg-primary-600',
  success: 'bg-success',
}
const RINGC: Record<'warning' | 'primary' | 'success', string> = {
  warning: 'rgb(var(--warning))',
  primary: 'rgb(var(--primary-600))',
  success: 'rgb(var(--success))',
}
const pct = (b: ExamBlock) =>
  b.targetCount > 0 ? Math.min(100, Math.round((b.count / b.targetCount) * 100)) : 100
/** Amal: yig'ilmoqda = Ochish, o'qituvchi tugatdi = Ko'rib tasdiqlash, tasdiqlangan = Ko'rish */
const action = (b: ExamBlock): 'open' | 'approve' | 'view' => {
  if (!draft.value) return 'view'
  const st = blockState(b)
  return st === 'collecting' ? 'open' : st === 'done' ? 'approve' : 'view'
}
const canRemind = computed(
  () =>
    draft.value &&
    props.session.canEdit &&
    blocks.value.some((b) => blockState(b) === 'collecting' && b.contributors.length > 0),
)
const teachers = (b: ExamBlock) =>
  b.contributors.map((c) => c.fullName).join(', ') || t('examBlocks.noContributors')
const after = computed(() => props.stage === 'after')
</script>

<template>
  <div data-testid="subjects-panel">
    <section data-testid="blocks-panel">
      <div
        class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3"
        data-testid="subjects-table"
      >
        <div
          v-for="(b, i) in blocks"
          :key="b.id"
          class="card flex min-w-0 items-center gap-3 p-3"
          :data-testid="`detail-block-${i}`"
        >
          <ProgressRing
            v-if="after"
            :pct="avgByBlock[b.id] ?? 0"
            :color="RING[i % RING.length]"
            :label="avgByBlock[b.id] !== undefined ? avgByBlock[b.id] + '%' : '—'"
          />
          <ProgressRing
            v-else
            :pct="pct(b)"
            :color="RINGC[progressTone(b.count, b.targetCount)]"
            :label="String(b.count)"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold leading-5 text-fg">
              <span data-testid="block-name">{{ b.subjectName ?? b.title }}</span>
              <span
                v-if="coefMode"
                class="ml-1 text-xs font-normal text-fg-muted"
                :data-testid="`detail-block-coef-${i}`"
                >×{{ fmtCoef(b.coefficient) }}</span
              >
            </p>
            <p class="truncate text-xs leading-4 text-fg-muted" data-testid="block-teachers">
              {{ teachers(b) }}
            </p>
            <div class="flex items-center gap-2">
              <span
                class="shrink-0 text-xs font-semibold text-fg"
                :data-testid="`detail-block-progress-${i}`"
                >{{ b.count }}/{{ b.targetCount }}</span
              >
              <div
                class="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                :aria-valuenow="pct(b)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full"
                  :class="BAR[progressTone(b.count, b.targetCount)]"
                  :style="{ width: pct(b) + '%' }"
                  :data-testid="`detail-block-bar-${i}`"
                  :data-tone="progressTone(b.count, b.targetCount)"
                />
              </div>
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <BaseBadge :tone="TONE[blockState(b)]" :data-testid="`detail-block-state-${i}`">
              {{ t(`examFlow.blockState.${blockState(b)}`) }}
            </BaseBadge>
            <BaseButton
              size="sm"
              :variant="action(b) === 'approve' ? 'primary' : 'secondary'"
              :data-testid="`detail-block-action-${i}`"
              @click="action(b) === 'open' ? emit('open', b.id) : emit('review', b.id)"
            >
              {{ t(`examFlow.action.${action(b)}`) }}
            </BaseButton>
          </div>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-3 px-1" data-testid="subjects-footer">
        <p class="text-sm text-fg-muted" data-testid="approved-summary">
          <span class="font-medium text-fg">{{
            t('examFlow.approvedOf', { a: sum.approved, n: sum.total })
          }}</span>
          <template v-if="sum.done > 0">
            · {{ t('examFlow.doneWaiting', { n: sum.done }) }}</template
          >
          <template v-if="sum.collecting > 0">
            · {{ t('examFlow.collectingN', { n: sum.collecting }) }}</template
          >
        </p>
        <div class="ml-auto flex flex-wrap gap-2">
          <BaseButton
            v-if="canRemind"
            size="sm"
            variant="secondary"
            :loading="busy"
            data-testid="act-remind"
            @click="emit('remind')"
          >
            <BellRing class="h-4 w-4" aria-hidden="true" /> {{ t('examFlow.remind') }}
          </BaseButton>
          <BaseButton
            v-if="draft && session.canEdit"
            size="sm"
            variant="secondary"
            data-testid="act-settings"
            @click="emit('settings')"
          >
            <Settings2 class="h-4 w-4" aria-hidden="true" /> {{ t('examFlow.settings') }}
          </BaseButton>
        </div>
      </div>
    </section>

    <div v-if="stage === 'before' && stages" class="mt-3 grid gap-3 md:grid-cols-2">
      <section class="card p-4" data-testid="stage-dashboard">
        <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('examBoard.subjects.stepsTitle') }}</h3>
        <ol class="space-y-2 text-sm" data-testid="stage-bar">
          <li
            v-for="st in stages"
            :key="st.key"
            class="flex items-center gap-2"
            :aria-current="st.state === 'current' ? 'step' : undefined"
            :data-testid="`stage-${st.key}`"
            :data-state="st.state"
          >
            <Check
              v-if="st.state === 'done'"
              class="h-4 w-4 shrink-0 text-success"
              aria-hidden="true"
            />
            <Circle
              v-else
              class="h-4 w-4 shrink-0"
              :class="st.state === 'current' ? 'text-warning' : 'text-fg-muted'"
              aria-hidden="true"
            />
            <span
              :class="
                st.state === 'current'
                  ? 'font-semibold text-fg'
                  : st.state === 'todo'
                    ? 'text-fg-muted'
                    : 'text-fg'
              "
              >{{ t(`examFlow.step.${st.key}`) }}</span
            >
            <span
              v-if="st.key === 'questions' && deadline"
              class="truncate text-xs text-fg-muted"
              data-testid="stage-deadline"
              >{{ t('examFlow.untilShort', { date: deadline }) }}</span
            >
          </li>
        </ol>
        <p
          v-if="draft && missingNames.length"
          class="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"
          data-testid="stage-warning"
        >
          {{ t('examFlow.needApproval') }} {{ missingNames.join(', ') }}
        </p>
      </section>
      <section class="card p-4" data-testid="time-card">
        <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('examBoard.subjects.timeTitle') }}</h3>
        <dl class="space-y-1.5 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('examSessions.wizard.start') }}</dt>
            <dd class="text-right text-fg">{{ fmtDateTime(session.scheduledStart) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('examSessions.wizard.duration') }}</dt>
            <dd class="text-right text-fg">
              {{ t('examSessions.minutes', { n: session.durationMin }) }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-fg-muted">{{ t('examSessions.wizard.supervisors') }}</dt>
            <dd class="text-right text-fg">
              {{ session.supervisors.map((x) => x.fullName).join(', ') || '—' }}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>
