<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings2 } from 'lucide-vue-next'
import type { ExamSession } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import { fmtDateTime } from '@/utils/examSessions'

/** "Ma'lumot" bo'limi: imtihonning barcha ma'lumotlari (sana, kod, sinflar, natija rejimi, ball/vaqt rejimi...). */
const props = defineProps<{ s: ExamSession; hasBlocks: boolean }>()
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
const phaseText = computed(() => (props.s.phase ? t(`examSessions.phase.${props.s.phase}`) : ''))
</script>

<template>
  <div class="card p-4" data-testid="detail-info">
    <dl class="grid gap-x-8 text-sm sm:grid-cols-2">
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.wizard.start') }}</dt>
        <dd class="text-right font-medium text-fg">{{ fmtDateTime(s.scheduledStart) }}</dd>
      </div>
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.detail.ends') }}</dt>
        <dd class="text-right font-medium text-fg">
          {{ fmtDateTime(s.endsAt) }}
          <span v-if="phaseText" class="font-normal text-fg-muted">({{ phaseText }})</span>
        </dd>
      </div>
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.wizard.duration') }}</dt>
        <dd class="text-right font-medium text-fg">
          {{ t('examSessions.minutes', { n: s.durationMin }) }}
        </dd>
      </div>
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.detail.code') }}</dt>
        <dd class="text-right font-mono font-medium text-fg" data-testid="detail-code">
          {{ s.code ?? '—' }}
        </dd>
      </div>
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.wizard.classes') }}</dt>
        <dd class="text-right font-medium text-fg">
          {{ s.classes.map((c) => c.name).join(', ') || '—' }}
        </dd>
      </div>
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.wizard.resultsMode') }}</dt>
        <dd class="text-right font-medium text-fg">
          {{ t(`examSessions.results.${s.resultsMode}`) }}
        </dd>
      </div>
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.wizard.supervisors') }}</dt>
        <dd class="text-right font-medium text-fg">
          {{ s.supervisors.map((x) => x.fullName).join(', ') || '—' }}
        </dd>
      </div>
      <div class="flex justify-between gap-3 border-b border-border py-2">
        <dt class="text-fg-muted">{{ t('examSessions.detail.author') }}</dt>
        <dd class="text-right font-medium text-fg">{{ s.createdByName ?? '—' }}</dd>
      </div>
      <template v-if="hasBlocks">
        <div class="flex justify-between gap-3 border-b border-border py-2">
          <dt class="text-fg-muted">{{ t('examBlocks.scoringMode') }}</dt>
          <dd class="text-right font-medium text-fg" data-testid="detail-scoring">
            {{ t(`examBlocks.scoring.${s.scoringMode ?? 'points'}`) }}
          </dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-border py-2">
          <dt class="text-fg-muted">{{ t('examBlocks.timingMode') }}</dt>
          <dd class="text-right font-medium text-fg" data-testid="detail-timing">
            {{ t(`examBlocks.timing.${s.timingMode ?? 'common'}`) }}
          </dd>
        </div>
        <div
          v-if="s.contribDeadline"
          class="flex justify-between gap-3 border-b border-border py-2"
        >
          <dt class="text-fg-muted">{{ t('examBlocks.contribDeadline') }}</dt>
          <dd class="text-right font-medium text-fg" data-testid="detail-contrib-deadline">
            {{ fmtDateTime(s.contribDeadline) }}
          </dd>
        </div>
      </template>
    </dl>
    <div v-if="s.canEdit" class="pt-3">
      <BaseButton variant="secondary" data-testid="info-edit" @click="emit('edit')">
        <Settings2 class="h-4 w-4" aria-hidden="true" /> {{ t('examBoard.info.edit') }}
      </BaseButton>
    </div>
  </div>
</template>
