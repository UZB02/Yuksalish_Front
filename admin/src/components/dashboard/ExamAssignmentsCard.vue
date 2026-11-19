<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClipboardCheck } from 'lucide-vue-next'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { isPending, useExamAssignmentsStore } from '@/stores/examAssignments'
import { deadlineLeft } from '@/utils/examTasks'

/** Eslatma: kutilayotgan imtihon vazifalari soni va "Mening imtihon vazifalarim" sahifasiga havola */
const { t } = useI18n()
const store = useExamAssignmentsStore()
onMounted(() => void store.refresh())
const rows = computed(() => store.items.filter(isPending))
/** Eng yaqin muddat: soat/kun ko'rinishida */
const nearest = computed(() => {
  const ds = rows.value
    .map((r) => r.contribDeadline)
    .filter((d): d is string => !!d)
    .sort()
  const l = deadlineLeft(ds[0])
  if (l.kind === 'overdue') return t('examTasks.overdue')
  if (l.kind === 'soon') return t('examTasks.soon')
  if (l.kind === 'hours') return t('examTasks.hoursLeft', { n: l.n })
  if (l.kind === 'days') return t('examTasks.daysLeft', { n: l.n })
  return ''
})
</script>

<template>
  <RouterLink
    v-if="rows.length"
    :to="{ name: 'exam-tasks' }"
    class="card mb-4 flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-surface-muted"
    data-testid="exam-assignments-card"
  >
    <ClipboardCheck class="h-5 w-5 text-primary-600" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-fg">
        {{ t('examFlow.cardTitle') }}
        <BaseBadge tone="warning" data-testid="exam-assignments-count">{{ rows.length }}</BaseBadge>
      </p>
      <p class="mt-0.5 text-sm text-fg-muted">
        {{ t('examTasks.reminderText', { n: rows.length }) }}
        <span v-if="nearest" data-testid="exam-assignments-left"> ({{ nearest }})</span>
      </p>
    </div>
    <span class="text-sm font-medium text-primary-700">{{ t('examTasks.reminderOpen') }} →</span>
  </RouterLink>
</template>
