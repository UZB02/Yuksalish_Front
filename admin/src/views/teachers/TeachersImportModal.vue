<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  UploadCloud,
} from 'lucide-vue-next'
import type { TeacherImportResultRow, TeacherImportRow, TeacherImportStatus } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import {
  useTeachersImport,
  type TeachersImport,
  type TeachersRowFilter,
} from '@/composables/useTeachersImport'
import { formatBytes } from '@/utils/importFile'

const MAX_ROWS = 500

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; imported: [] }>()

const { t } = useI18n()
const wizard: TeachersImport = reactive(useTeachersImport())
const dragging = ref(false)

watch(
  () => props.open,
  () => {
    // Ochilganda ham, yopilganda ham tozalanadi: parollar xotirada qolmasin
    wizard.reset()
  },
)

watch(
  () => wizard.step,
  (s) => {
    if (s === 'result') emit('imported')
  },
)

function onDrop(e: DragEvent) {
  dragging.value = false
  wizard.selectFile(e.dataTransfer?.files?.[0] ?? null)
}
function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  wizard.selectFile(el.files?.[0] ?? null)
  el.value = ''
}

const steps = ['upload', 'preview', 'result']
const rules = ['login', 'duplicate', 'password', 'phone', 'existing']

// ---- Ko'rish bosqichi ----
const summary = computed(() => wizard.preview?.summary)
const cards = computed(() => [
  { key: 'total', value: summary.value?.total ?? 0, tone: 'text-fg' },
  { key: 'create', value: summary.value?.create ?? 0, tone: 'text-success' },
  { key: 'skipExisting', value: summary.value?.skipExisting ?? 0, tone: 'text-warning' },
  { key: 'error', value: summary.value?.error ?? 0, tone: 'text-danger' },
])
const filters = computed<{ value: TeachersRowFilter; label: string }[]>(() => [
  { value: 'all', label: t('teachersImport.filterAll') },
  { value: 'error', label: t('teachersImport.filterError') },
  { value: 'skip_existing', label: t('teachersImport.filterSkip') },
])
const columns = computed<TableColumn[]>(() => [
  { key: 'rowNo', label: t('teachersImport.colRow') },
  { key: 'fullName', label: t('common.fullName') },
  { key: 'phone', label: t('teachersImport.colPhone'), class: 'hidden md:table-cell' },
  { key: 'login', label: t('teachersImport.colLogin') },
  { key: 'password', label: t('teachersImport.colPassword'), class: 'hidden sm:table-cell' },
  { key: 'status', label: t('common.status') },
  { key: 'messages', label: t('teachersImport.colNote') },
])
type ViewRow = TeacherImportRow & { id: string }
const rows = computed<ViewRow[]>(() =>
  wizard.filteredRows.map((r) => ({ ...r, id: String(r.rowNo) })),
)
const tone: Record<TeacherImportStatus, 'success' | 'warning' | 'danger'> = {
  create: 'success',
  skip_existing: 'warning',
  error: 'danger',
}

// ---- Natija bosqichi ----
const resultCards = computed(() => {
  const s = wizard.result?.summary
  return [
    { key: 'created', value: s?.created ?? 0, tone: 'text-success' },
    { key: 'skipped', value: s?.skipped ?? 0, tone: 'text-warning' },
    { key: 'failed', value: s?.failed ?? 0, tone: 'text-danger' },
  ]
})
const resultColumns = computed<TableColumn[]>(() => [
  { key: 'fullName', label: t('common.fullName') },
  { key: 'login', label: t('teachersImport.colLogin') },
  { key: 'password', label: t('teachersImport.colPassword'), class: 'hidden sm:table-cell' },
  { key: 'status', label: t('common.status') },
])
type ResultView = TeacherImportResultRow & { id: string }
const resultRows = computed<ResultView[]>(() =>
  (wizard.result?.results ?? []).map((r) => ({ ...r, id: String(r.rowNo) })),
)
const resultTone = { created: 'success', skipped: 'warning', failed: 'danger' } as const
const hasPasswords = computed(() => (wizard.result?.summary.created ?? 0) > 0)
</script>

<template>
  <BaseModal
    :open="open"
    :title="t(`teachersImport.title.${wizard.step}`)"
    :description="t('teachersImport.stepOf', { n: steps.indexOf(wizard.step) + 1 })"
    size="xl"
    persistent
    @close="emit('close')"
  >
    <!-- 1-qadam: yuklash -->
    <div v-if="wizard.step === 'upload'" class="space-y-5" data-testid="ti-upload">
      <section class="rounded-xl border border-border p-4">
        <h3 class="text-sm font-semibold text-fg">{{ t('teachersImport.step1') }}</h3>
        <p class="mt-1 text-sm text-fg-muted">{{ t('teachersImport.templateHint') }}</p>
        <BaseButton
          class="mt-3"
          size="sm"
          variant="secondary"
          data-testid="ti-template"
          @click="wizard.downloadTemplate()"
        >
          <Download class="h-4 w-4" /> {{ t('teachersImport.downloadTemplate') }}
        </BaseButton>
      </section>

      <section class="rounded-xl bg-primary-50 p-4">
        <h3 class="text-sm font-semibold text-primary-700">{{ t('teachersImport.rulesTitle') }}</h3>
        <ul class="mt-2 list-inside list-disc space-y-1 text-sm text-fg-muted">
          <li v-for="r in rules" :key="r">{{ t(`teachersImport.rules.${r}`) }}</li>
        </ul>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('teachersImport.step2') }}</h3>
        <label
          class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-primary-500"
          :class="
            dragging ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-surface-muted'
          "
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <input
            type="file"
            class="sr-only"
            data-testid="ti-file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            :aria-label="t('teachersImport.chooseFile')"
            @change="onPick"
          />
          <template v-if="wizard.file">
            <FileSpreadsheet class="h-8 w-8 text-success" aria-hidden="true" />
            <p class="text-sm font-medium text-fg">{{ wizard.file.name }}</p>
            <p class="text-xs text-fg-muted">{{ formatBytes(wizard.file.size) }}</p>
            <p class="text-xs text-primary-700">{{ t('teachersImport.changeFile') }}</p>
          </template>
          <template v-else>
            <UploadCloud class="h-8 w-8 text-fg-muted" aria-hidden="true" />
            <p class="text-sm font-medium text-fg">{{ t('teachersImport.dropHere') }}</p>
            <p class="text-xs text-fg-muted">
              {{ t('teachersImport.limits', { rows: MAX_ROWS }) }}
            </p>
          </template>
        </label>
        <p v-if="wizard.fileError" class="mt-2 text-sm text-danger" role="alert">
          {{ wizard.fileError }}
        </p>
      </section>

      <div v-if="wizard.uploading" class="space-y-1">
        <div
          class="h-2 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          :aria-valuenow="wizard.progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="t('teachersImport.uploading')"
        >
          <div
            class="h-full rounded-full bg-primary-600 transition-all"
            :style="{ width: `${wizard.progress}%` }"
          />
        </div>
        <p class="text-xs text-fg-muted">
          {{
            wizard.progress < 100
              ? t('teachersImport.uploadingPercent', { p: wizard.progress })
              : t('teachersImport.checking')
          }}
        </p>
      </div>
    </div>

    <!-- 2-qadam: oldindan ko'rish -->
    <div v-else-if="wizard.step === 'preview'" class="space-y-4" data-testid="ti-preview">
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="c in cards" :key="c.key" class="rounded-xl border border-border p-3">
          <dt class="text-xs text-fg-muted">{{ t(`teachersImport.summary.${c.key}`) }}</dt>
          <dd class="mt-1 text-2xl font-semibold" :class="c.tone">{{ c.value }}</dd>
        </div>
      </dl>
      <p class="text-sm text-fg-muted">{{ t('teachersImport.nothingCreated') }}</p>

      <div
        role="group"
        :aria-label="t('teachersImport.filter')"
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

      <div class="max-h-80 overflow-auto rounded-xl border border-border">
        <BaseTable
          v-if="rows.length > 0"
          :columns="columns"
          :rows="rows"
          :caption="t('teachersImport.previewTable')"
        >
          <template #cell-phone="{ row }">{{ row.phone || '-' }}</template>
          <template #cell-login="{ row }">
            <span class="font-mono text-xs">{{ row.login || '-' }}</span>
            <BaseBadge v-if="row.loginGenerated" tone="info" class="ml-1" data-testid="auto-login">
              {{ t('teachersImport.auto') }}
            </BaseBadge>
          </template>
          <template #cell-password="{ row }">
            <template v-if="row.password">
              <span class="font-mono text-xs">{{ row.password }}</span>
              <BaseBadge
                v-if="row.passwordGenerated"
                tone="info"
                class="ml-1"
                data-testid="auto-password"
              >
                {{ t('teachersImport.auto') }}
              </BaseBadge>
            </template>
            <span v-else class="text-fg-muted">-</span>
          </template>
          <template #cell-status="{ row }">
            <BaseBadge :tone="tone[row.status]" data-testid="row-status">
              {{ t(`teachersImport.status.${row.status}`) }}
            </BaseBadge>
          </template>
          <template #cell-messages="{ row }">
            <ul
              v-if="row.messages.length"
              class="list-inside list-disc text-xs"
              :class="row.status === 'error' ? 'text-danger' : 'text-fg-muted'"
            >
              <li v-for="(m, i) in row.messages" :key="i">{{ m }}</li>
            </ul>
            <span v-else class="text-fg-muted">-</span>
          </template>
        </BaseTable>
        <p v-else class="p-6 text-center text-sm text-fg-muted">{{ t('teachersImport.noRows') }}</p>
      </div>

      <p v-if="wizard.importableCount === 0" class="text-sm text-warning">
        {{ t('teachersImport.noValid') }}
      </p>
    </div>

    <!-- 3-qadam: natija -->
    <div v-else class="space-y-4" data-testid="ti-result">
      <div class="space-y-2 text-center">
        <CheckCircle2 class="mx-auto h-12 w-12 text-success" aria-hidden="true" />
        <h3 class="text-base font-semibold text-fg">{{ t('teachersImport.done') }}</h3>
      </div>
      <dl class="grid grid-cols-3 gap-3">
        <div v-for="c in resultCards" :key="c.key" class="rounded-xl border border-border p-3">
          <dt class="text-xs text-fg-muted">{{ t(`teachersImport.result.${c.key}`) }}</dt>
          <dd class="mt-1 text-2xl font-semibold" :class="c.tone">{{ c.value }}</dd>
        </div>
      </dl>

      <div
        v-if="hasPasswords"
        class="flex gap-3 rounded-xl bg-warning-soft p-3 text-sm text-warning"
        role="alert"
        data-testid="ti-warning"
      >
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div class="space-y-1">
          <p class="font-medium">{{ t('teachersImport.credentialsWarning') }}</p>
          <p>{{ t('teachersImport.passwordsOnce') }}</p>
        </div>
      </div>
      <BaseButton
        v-if="hasPasswords"
        class="w-full sm:w-auto"
        :loading="wizard.downloading"
        data-testid="ti-credentials"
        @click="wizard.downloadCredentials()"
      >
        <Download class="h-4 w-4" /> {{ t('teachersImport.downloadCredentials') }}
      </BaseButton>

      <div class="max-h-72 overflow-auto rounded-xl border border-border">
        <BaseTable
          :columns="resultColumns"
          :rows="resultRows"
          :caption="t('teachersImport.previewTable')"
        >
          <template #cell-login="{ row }">
            <span class="font-mono text-xs">{{ row.login || '-' }}</span>
          </template>
          <template #cell-password="{ row }">
            <span v-if="row.password" class="font-mono text-xs">{{ row.password }}</span>
            <span v-else class="text-fg-muted">-</span>
          </template>
          <template #cell-status="{ row }">
            <BaseBadge :tone="resultTone[row.status]">
              {{ t(`teachersImport.status.${row.status}`) }}
            </BaseBadge>
            <p v-if="row.status === 'failed' && row.message" class="mt-1 text-xs text-danger">
              {{ row.message }}
            </p>
          </template>
        </BaseTable>
      </div>
    </div>

    <p
      v-if="wizard.error"
      class="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
      role="alert"
    >
      {{ wizard.error }}
    </p>

    <template #footer>
      <template v-if="wizard.step === 'upload'">
        <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
        <BaseButton
          :disabled="!wizard.file"
          :loading="wizard.uploading"
          data-testid="ti-check"
          @click="wizard.upload()"
        >
          {{ t('teachersImport.check') }}
        </BaseButton>
      </template>
      <template v-else-if="wizard.step === 'preview'">
        <BaseButton variant="secondary" @click="wizard.backToUpload()">
          {{ t('teachersImport.back') }}
        </BaseButton>
        <BaseButton
          :disabled="!wizard.canConfirm"
          :loading="wizard.confirming"
          data-testid="ti-confirm"
          @click="wizard.confirm()"
        >
          {{ t('teachersImport.confirm', { n: wizard.importableCount }) }}
        </BaseButton>
      </template>
      <BaseButton v-else data-testid="ti-close" @click="emit('close')">
        {{ t('common.close') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
