<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileSpreadsheet, FileText } from 'lucide-vue-next'
import type { JournalOptions } from '@/api/journal.api'
import type { ExportFormat } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { fmtDate, monthRange } from './journal.utils'

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
/** Dan/Gacha maydonlari faqat "Boshqa davr" tanlanganda ko'rinadi (joy tejash) */
const showCustom = ref(false)
watch(
  activeKey,
  (k) => {
    if (k === 'custom') showCustom.value = true
  },
  { immediate: true },
)
function pickPreset(p: Pick) {
  showCustom.value = false
  emit('range', p.from, p.to)
}
const rangeText = computed(() =>
  props.from && props.to ? `${fmtDate(props.from)} — ${fmtDate(props.to)}` : '',
)
</script>

<template>
  <!-- Ixcham asboblar qatori: sinf, fan, davr va eksport bitta qatorda (kenglik yetmasa o'raladi) -->
  <div
    class="mb-3 rounded-xl border border-border bg-surface p-2.5 shadow-card"
    data-testid="journal-filters"
  >
    <div class="flex flex-wrap items-center gap-2">
      <div class="w-full sm:w-44" data-testid="filter-class">
        <BaseSelect
          :model-value="classId"
          :options="classOptions"
          :aria-label="t('journal.filters.class')"
          :placeholder="t('journal.filters.classPlaceholder')"
          searchable
          @update:model-value="emit('update:classId', $event)"
        />
      </div>
      <div class="w-full sm:w-60" data-testid="filter-subject">
        <BaseSelect
          :model-value="subjectId"
          :options="subjectOptions"
          :aria-label="t('journal.filters.subject')"
          :placeholder="t('journal.filters.subjectPlaceholder')"
          :disabled="!classId"
          @update:model-value="emit('update:subjectId', $event)"
        />
      </div>

      <div
        role="radiogroup"
        :aria-label="t('journal.filters.period')"
        class="flex flex-wrap items-center gap-1 rounded-lg bg-surface-muted p-1"
      >
        <button
          v-for="p in picks"
          :key="p.key"
          type="button"
          role="radio"
          :aria-checked="activeKey === p.key && !showCustom"
          :data-pick="p.key"
          class="rounded-md px-2.5 py-1 text-sm font-medium transition-colors"
          :class="
            activeKey === p.key && !showCustom
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-fg-muted hover:bg-surface hover:text-fg'
          "
          @click="pickPreset(p)"
        >
          {{ p.label }}
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="showCustom"
          data-pick="custom"
          class="rounded-md px-2.5 py-1 text-sm font-medium transition-colors"
          :class="
            showCustom
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-fg-muted hover:bg-surface hover:text-fg'
          "
          @click="showCustom = true"
        >
          {{ t('journal.picks.custom') }}
        </button>
      </div>

      <template v-if="showCustom">
        <BaseInput
          :model-value="from"
          type="date"
          class="w-[9.5rem]"
          :aria-label="t('journal.filters.from')"
          data-testid="filter-from"
          @update:model-value="emit('range', $event, to)"
        />
        <span class="text-fg-muted" aria-hidden="true">—</span>
        <BaseInput
          :model-value="to"
          type="date"
          class="w-[9.5rem]"
          :aria-label="t('journal.filters.to')"
          data-testid="filter-to"
          @update:model-value="emit('range', from, $event)"
        />
      </template>
      <span
        v-else-if="rangeText"
        class="whitespace-nowrap px-1 text-sm text-fg-muted"
        data-testid="range-text"
        >{{ rangeText }}</span
      >

      <div v-if="canExport" class="ml-auto flex gap-2">
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
    <p v-if="error" class="mt-2 text-sm text-danger" role="alert" data-testid="range-error">
      {{ t(`journal.errors.${error}`) }}
    </p>
  </div>
</template>
