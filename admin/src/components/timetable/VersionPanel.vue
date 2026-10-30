<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { TimetableVersionSummary } from '@/api/timetable.api'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { formatDate } from '@/utils/format'

/** Versiyalar tarixi: qoralama, kelgusi, joriy va tugagan versiyalar */
defineProps<{
  versions: TimetableVersionSummary[]
  selectedId: string | null
  canManage: boolean
  /** Eski tarix (xira ko'rsatiladi) */
  mutedIds?: Set<string>
}>()
const emit = defineEmits<{ select: [id: string]; remove: [id: string] }>()
const { t } = useI18n()

const tone = {
  draft: 'warning',
  current: 'success',
  future: 'info',
  past: 'neutral',
  replaced: 'neutral',
} as const
/** Faqat qoralama va kelajakdagi versiyani o'chirish mumkin */
const removable = (v: TimetableVersionSummary) => v.phase === 'draft' || v.phase === 'future'
</script>

<template>
  <ul
    class="divide-y divide-border rounded-xl border border-border bg-surface"
    data-testid="versions"
  >
    <li
      v-for="v in versions"
      :key="v.id"
      class="flex items-center gap-3 px-3 py-2.5"
      :class="[
        selectedId === v.id ? 'bg-primary-50 dark:bg-primary-500/10' : '',
        v.phase === 'replaced' || mutedIds?.has(v.id) ? 'text-fg-muted opacity-70' : '',
      ]"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
        :data-testid="`version-${v.id}`"
        @click="emit('select', v.id)"
      >
        <BaseBadge :tone="tone[v.phase]">{{ t(`timetable.phase.${v.phase}`) }}</BaseBadge>
        <span class="text-sm font-medium text-fg">
          <template v-if="v.phase === 'replaced'">
            {{ formatDate(v.validFrom) }} – ({{ t('timetable.replacedNote') }})
          </template>
          <template v-else>
            {{ formatDate(v.validFrom) }} – {{ v.validTo ? formatDate(v.validTo) : '…' }}
          </template>
        </span>
        <span class="text-xs text-fg-muted">
          {{ t('timetable.lessonsCount', { n: v.entryCount }) }}
        </span>
        <BaseBadge v-if="v.forced" tone="danger">{{ t('timetable.forced') }}</BaseBadge>
      </button>
      <button
        v-if="canManage && removable(v)"
        type="button"
        class="rounded-lg p-1.5 text-fg-muted hover:bg-danger-soft hover:text-danger"
        :aria-label="t('timetable.deleteVersion')"
        :data-testid="`remove-${v.id}`"
        @click="emit('remove', v.id)"
      >
        <Trash2 class="h-4 w-4" />
      </button>
    </li>
  </ul>
</template>
