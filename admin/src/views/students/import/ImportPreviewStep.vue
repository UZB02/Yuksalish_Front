<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download } from 'lucide-vue-next'
import type { ImportRow, ImportRowStatus } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import type { ImportWizard, RowFilter } from '@/composables/useImportWizard'

const props = defineProps<{ wizard: ImportWizard }>()
const { t } = useI18n()

const summary = computed(() => props.wizard.preview!.summary)

const cards = computed(() => [
  { key: 'total', value: summary.value.total, tone: 'text-fg' },
  { key: 'valid', value: summary.value.valid, tone: 'text-success' },
  { key: 'invalid', value: summary.value.invalid, tone: 'text-danger' },
  { key: 'duplicates', value: summary.value.duplicates, tone: 'text-warning' },
])

const filters = computed<{ value: RowFilter; label: string }[]>(() => [
  { value: 'all', label: t('import.filterAll') },
  { value: 'invalid', label: t('import.filterInvalid') },
  { value: 'duplicate', label: t('import.filterDuplicate') },
])

const columns = computed<TableColumn[]>(() => [
  { key: 'row', label: t('import.row') },
  { key: 'fullName', label: t('common.fullName') },
  { key: 'className', label: t('students.class'), class: 'hidden sm:table-cell' },
  { key: 'status', label: t('common.status') },
  { key: 'errors', label: t('import.problem') },
])

type ViewRow = ImportRow & { id: string }
const rows = computed<ViewRow[]>(() =>
  props.wizard.filteredRows.map((r) => ({ ...r, id: String(r.row) })),
)

const tone: Record<ImportRowStatus, 'success' | 'danger' | 'warning'> = {
  valid: 'success',
  invalid: 'danger',
  duplicate: 'warning',
}
</script>

<template>
  <div class="space-y-4">
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div v-for="c in cards" :key="c.key" class="rounded-xl border border-border p-3">
        <dt class="text-xs text-fg-muted">{{ t(`import.summary.${c.key}`) }}</dt>
        <dd class="mt-1 text-2xl font-semibold" :class="c.tone">{{ c.value }}</dd>
      </div>
    </dl>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        :aria-label="t('import.filter')"
        class="inline-flex rounded-lg border border-border p-0.5"
      >
        <button
          v-for="f in filters"
          :key="f.value"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="
            wizard.filter === f.value ? 'bg-primary-600 text-white' : 'text-fg-muted hover:text-fg'
          "
          :aria-pressed="wizard.filter === f.value"
          @click="wizard.setFilter(f.value)"
        >
          {{ f.label }}
        </button>
      </div>
      <BaseButton
        v-if="summary.invalid > 0"
        size="sm"
        variant="secondary"
        @click="wizard.downloadErrors()"
      >
        <Download class="h-4 w-4" /> {{ t('import.downloadErrors') }}
      </BaseButton>
    </div>

    <fieldset v-if="summary.duplicates > 0" class="rounded-xl border border-border p-3">
      <legend class="px-1 text-sm font-medium text-fg">{{ t('import.duplicateMode') }}</legend>
      <div class="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <input
            type="radio"
            value="skip"
            class="accent-primary-600"
            :checked="wizard.duplicateMode === 'skip'"
            @change="wizard.setDuplicateMode('skip')"
          />
          {{ t('import.skip') }}
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <input
            type="radio"
            value="update"
            class="accent-primary-600"
            :checked="wizard.duplicateMode === 'update'"
            @change="wizard.setDuplicateMode('update')"
          />
          {{ t('import.update') }}
        </label>
      </div>
    </fieldset>

    <div class="max-h-72 overflow-y-auto rounded-xl border border-border">
      <BaseTable
        v-if="rows.length > 0"
        :columns="columns"
        :rows="rows"
        :caption="t('import.previewTable')"
      >
        <template #cell-fullName="{ row }">{{ row.data.fullName || '-' }}</template>
        <template #cell-className="{ row }">{{ row.data.className || '-' }}</template>
        <template #cell-status="{ row }">
          <BaseBadge :tone="tone[row.status]">{{ t(`import.status.${row.status}`) }}</BaseBadge>
        </template>
        <template #cell-errors="{ row }">
          <ul v-if="row.errors.length" class="list-inside list-disc text-xs text-danger">
            <li v-for="(e, i) in row.errors" :key="i">{{ e }}</li>
          </ul>
          <span v-else-if="row.status === 'duplicate'" class="text-xs text-warning">
            {{ t('import.alreadyExists') }}
          </span>
          <span v-else class="text-fg-muted">-</span>
        </template>
      </BaseTable>
      <p v-else class="p-6 text-center text-sm text-fg-muted">{{ t('import.noRows') }}</p>
    </div>

    <p v-if="summary.valid === 0 && wizard.duplicateMode === 'skip'" class="text-sm text-warning">
      {{ t('import.noValid') }}
    </p>
    <p v-if="wizard.error" class="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
      {{ wizard.error }}
    </p>
  </div>
</template>
