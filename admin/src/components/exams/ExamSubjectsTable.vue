<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BellRing, Settings2 } from 'lucide-vue-next'
import type { ExamBlock, ExamSession } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { blockState, blocksSummary, progressTone, type BlockState } from '@/utils/examFlow'

/**
 * "Fanlar" jadvali: fan (+koeffitsiyent), o'qituvchilar, savollar N/maqsad (taraqqiyot chizig'i), holat va amal.
 * Pastda: "1 / 3 fan tasdiqlandi", "Eslatma" va "Sozlamalar".
 */
const props = defineProps<{ session: ExamSession; busy?: boolean }>()
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
</script>

<template>
  <section class="card mb-5 overflow-hidden" data-testid="blocks-panel">
    <h2 class="px-4 pt-4 text-sm font-semibold text-fg">{{ t('examFlow.subjectsTitle') }}</h2>
    <div class="overflow-x-auto">
      <table class="mt-2 w-full text-left text-sm sm:min-w-[640px]" data-testid="subjects-table">
        <thead class="text-xs text-fg-muted">
          <tr>
            <th class="px-4 py-2 font-medium">{{ t('examFlow.table.subject') }}</th>
            <th class="hidden px-2 py-2 font-medium sm:table-cell">
              {{ t('examFlow.table.teachers') }}
            </th>
            <th class="px-2 py-2 font-medium">{{ t('examFlow.table.questions') }}</th>
            <th class="px-2 py-2 font-medium">{{ t('examFlow.table.status') }}</th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="(b, i) in blocks" :key="b.id" :data-testid="`detail-block-${i}`">
            <td class="px-3 py-3 align-top sm:px-4">
              <span class="font-medium text-fg" data-testid="block-name">{{
                b.subjectName ?? b.title
              }}</span>
              <span
                v-if="coefMode"
                class="ml-1.5 text-xs text-fg-muted"
                :data-testid="`detail-block-coef-${i}`"
                >×{{ fmtCoef(b.coefficient) }}</span
              >
              <p class="mt-0.5 text-xs text-fg-muted sm:hidden">
                {{
                  b.contributors.map((c) => c.fullName).join(', ') || t('examBlocks.noContributors')
                }}
              </p>
            </td>
            <td
              class="hidden px-2 py-3 align-top text-fg-muted sm:table-cell"
              data-testid="block-teachers"
            >
              {{
                b.contributors.map((c) => c.fullName).join(', ') || t('examBlocks.noContributors')
              }}
            </td>
            <td class="px-2 py-3 align-top">
              <div class="flex items-center gap-2">
                <span
                  class="w-12 shrink-0 text-xs font-semibold text-fg"
                  :data-testid="`detail-block-progress-${i}`"
                  >{{ b.count }}/{{ b.targetCount }}</span
                >
                <div
                  class="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted sm:block"
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
            </td>
            <td class="px-2 py-3 align-top">
              <BaseBadge :tone="TONE[blockState(b)]" :data-testid="`detail-block-state-${i}`">
                {{ t(`examFlow.blockState.${blockState(b)}`) }}
              </BaseBadge>
            </td>
            <td class="px-2 py-3 text-right align-top sm:px-4">
              <BaseButton
                size="sm"
                :variant="action(b) === 'approve' ? 'primary' : 'secondary'"
                :data-testid="`detail-block-action-${i}`"
                @click="action(b) === 'open' ? emit('open', b.id) : emit('review', b.id)"
              >
                {{ t(`examFlow.action.${action(b)}`) }}
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      class="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3"
      data-testid="subjects-footer"
    >
      <p class="text-sm text-fg-muted" data-testid="approved-summary">
        <span class="font-medium text-fg">{{
          t('examFlow.approvedOf', { a: sum.approved, n: sum.total })
        }}</span>
        <template v-if="sum.done > 0"> · {{ t('examFlow.doneWaiting', { n: sum.done }) }}</template>
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
</template>
