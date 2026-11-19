<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { isPending, useExamAssignmentsStore } from '@/stores/examAssignments'
import { fmtDateTime } from '@/utils/examSessions'
import { deadlineLeft, taskStatus } from '@/utils/examTasks'
import type { MyBlockItem } from '@/api/types'

/**
 * "Mening imtihon vazifalarim": o'qituvchiga biriktirilgan fanlar kartochkalari.
 * Kartochka: imtihon · fan, kerakli savollar soni, muddat (necha kun qoldi), progress va holat.
 */
const { t } = useI18n()
const router = useRouter()
const needsSchool = useNeedsSchool()
const store = useExamAssignmentsStore()
const { items, loaded } = storeToRefs(store)

onMounted(() => {
  if (!needsSchool.value) void store.refresh()
})

/** Kutilayotganlar yuqorida (muddat bo'yicha), qolganlari pastda */
const sorted = computed(() =>
  [...items.value].sort((a, b) => {
    const pa = isPending(a) ? 0 : 1
    const pb = isPending(b) ? 0 : 1
    if (pa !== pb) return pa - pb
    return (
      new Date(a.contribDeadline ?? '2999-01-01').getTime() -
      new Date(b.contribDeadline ?? '2999-01-01').getTime()
    )
  }),
)

const TONE = {
  collecting: 'warning',
  done: 'success',
  approved: 'success',
  readonly: 'neutral',
} as const

function leftText(b: MyBlockItem): string {
  const l = deadlineLeft(b.contribDeadline)
  switch (l.kind) {
    case 'overdue':
      return t('examTasks.overdue')
    case 'soon':
      return t('examTasks.soon')
    case 'hours':
      return t('examTasks.hoursLeft', { n: l.n })
    case 'days':
      return t('examTasks.daysLeft', { n: l.n })
    default:
      return ''
  }
}
const open = (b: MyBlockItem) =>
  void router.push({
    name: 'exam-my-block',
    params: { sessionId: b.sessionId, blockId: b.blockId },
  })
</script>

<template>
  <PageHeader :title="t('examTasks.title')" :description="t('examTasks.subtitle')" />

  <NeedsSchool v-if="needsSchool" />
  <div v-else-if="!loaded" class="grid max-w-5xl gap-3 sm:grid-cols-2" aria-busy="true">
    <Skeleton v-for="n in 4" :key="n" class="h-32 w-full" />
  </div>
  <div v-else-if="sorted.length === 0" class="card max-w-5xl" data-testid="tasks-empty">
    <EmptyState :title="t('examTasks.emptyTitle')" :description="t('examTasks.emptyText')" />
  </div>
  <ul v-else class="grid max-w-5xl gap-3 sm:grid-cols-2" data-testid="tasks-list">
    <li v-for="(b, i) in sorted" :key="`${b.sessionId}:${b.blockId}`">
      <button
        type="button"
        class="card block w-full p-4 text-left transition-colors hover:bg-surface-muted"
        :data-testid="`task-${i}`"
        @click="open(b)"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="min-w-0 text-base font-semibold text-fg" data-testid="task-title">
            {{ t('examTasks.taskName', { exam: b.examTitle, subject: b.subjectName ?? b.title }) }}
          </p>
          <BaseBadge
            :tone="b.count >= b.targetCount ? 'success' : 'warning'"
            data-testid="task-progress"
          >
            {{ b.count }}/{{ b.targetCount }}
          </BaseBadge>
        </div>
        <p class="mt-2 text-sm text-fg-muted" data-testid="task-meta">
          {{ t('examTasks.need', { n: b.targetCount }) }}
          <span aria-hidden="true"> · </span>
          <template v-if="b.contribDeadline">
            {{ t('examTasks.deadline', { date: fmtDateTime(b.contribDeadline) }) }}
            <span v-if="leftText(b)" data-testid="task-left"> ({{ leftText(b) }})</span>
          </template>
          <template v-else>{{ t('examTasks.noDeadline') }}</template>
        </p>
        <div class="mt-3 flex items-center justify-between gap-2">
          <BaseBadge :tone="TONE[taskStatus(b)]" data-testid="task-status">
            {{ t(`examTasks.status.${taskStatus(b)}`) }}
          </BaseBadge>
          <span class="text-sm font-medium text-primary-700">
            {{ t('examTasks.openTask') }} →
          </span>
        </div>
      </button>
    </li>
  </ul>
</template>
