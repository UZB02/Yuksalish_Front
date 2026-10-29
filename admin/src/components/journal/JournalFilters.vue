<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileSpreadsheet, FileText } from 'lucide-vue-next'
import type { JournalOptions } from '@/api/journal.api'
import type { ExportFormat } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { monthRange } from './journal.utils'

const props = defineProps<{
  options: JournalOptions
  classId: string
  subjectId: string
  from: string
  to: string
  error: 'order' | 'tooLong' | null
  canExport: boolean
  busy: ExportFormat | null
}>()
const emit = defineEmits<{
  'update:classId': [value: string]
  'update:subjectId': [value: string]
  range: [from: string, to: string]
  export: [format: ExportFormat]
}>()
const { t } = useI18n()

const classOptions = computed(() =>
  props.options.classes.map((c) => ({ value: c.id, label: c.name })),
)
const subjectOptions = computed(() => {
  const cls = props.options.classes.find((c) => c.id === props.classId)
  return (cls?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))
})

interface Pick {
  key: string
  label: string
  from: string
  to: string
}
const picks = computed<Pick[]>(() => {
  const today = props.options.today
  const cur = monthRange(today, 0)
  const prev = monthRange(today, -1)
  return [
    { key: 'thisMonth', label: t('journal.picks.thisMonth'), ...cur },
    { key: 'lastMonth', label: t('journal.picks.lastMonth'), ...prev },
    ...props.options.periods.map((p) => ({
      key: `period-${p.id}`,
      label: p.name,
      from: p.from,
      to: p.to,
    })),
  ]
})
const activeKey = computed(
  () => picks.value.find((p) => p.from === props.from && p.to === props.to)?.key ?? 'custom',
)
</script>

<template>
  <div
    class="mb-4 space-y-4 rounded-xl border border-border bg-surface p-4 shadow-card"
    data-testid="journal-filters"
  >
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
      <div data-testid="filter-class">
        <BaseSelect
          :model-value="classId"
          :options="classOptions"
          :label="t('journal.filters.class')"
          :placeholder="t('journal.filters.classPlaceholder')"
          searchable
          @update:model-value="emit('update:classId', $event)"
        />
      </div>
      <div data-testid="filter-subject">
        <BaseSelect
          :model-value="subjectId"
          :options="subjectOptions"
          :label="t('journal.filters.subject')"
          :placeholder="t('journal.filters.subjectPlaceholder')"
          :disabled="!classId"
          @update:model-value="emit('update:subjectId', $event)"
        />
      </div>
      <div v-if="canExport" class="flex items-end gap-2">
        <BaseButton
          variant="secondary"
          data-testid="export-xlsx"
          :loading="busy === 'xlsx'"
          :disabled="busy !== null || !classId || !subjectId || !!error"
          @click="emit('export', 'xlsx')"
        >
          <FileSpreadsheet class="h-4 w-4" aria-hidden="true" /> {{ t('journal.excel') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          data-testid="export-pdf"
          :loading="busy === 'pdf'"
          :disabled="busy !== null || !classId || !subjectId || !!error"
          @click="emit('export', 'pdf')"
        >
          <FileText class="h-4 w-4" aria-hidden="true" /> {{ t('journal.pdf') }}
        </BaseButton>
      </div>
    </div>

    <div class="space-y-3">
      <div role="radiogroup" :aria-label="t('journal.filters.period')" class="flex flex-wrap gap-2">
        <button
          v-for="p in picks"
          :key="p.key"
          type="button"
          role="radio"
          :aria-checked="activeKey === p.key"
          :data-pick="p.key"
          class="rounded-full border px-3 py-1.5 text-sm transition-colors"
          :class="
            activeKey === p.key
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-border bg-surface text-fg hover:bg-surface-muted'
          "
          @click="emit('range', p.from, p.to)"
        >
          {{ p.label }}
        </button>
        <span
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="
            activeKey === 'custom'
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-border bg-surface text-fg-muted'
          "
          data-pick="custom"
          :aria-current="activeKey === 'custom' ? 'true' : undefined"
        >
          {{ t('journal.picks.custom') }}
        </span>
      </div>
      <div class="grid max-w-md gap-3 sm:grid-cols-2">
        <BaseInput
          :model-value="from"
          type="date"
          :label="t('journal.filters.from')"
          data-testid="filter-from"
          @update:model-value="emit('range', $event, to)"
        />
        <BaseInput
          :model-value="to"
          type="date"
          :label="t('journal.filters.to')"
          data-testid="filter-to"
          @update:model-value="emit('range', from, $event)"
        />
      </div>
      <p v-if="error" class="text-sm text-danger" role="alert" data-testid="range-error">
        {{ t(`journal.errors.${error}`) }}
      </p>
    </div>
  </div>
</template>
