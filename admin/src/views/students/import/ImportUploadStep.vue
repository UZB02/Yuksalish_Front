<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { formatBytes, IMPORT_MAX_ROWS } from '@/utils/importFile'
import type { ImportWizard } from '@/composables/useImportWizard'

defineProps<{ wizard: ImportWizard; className?: string }>()
const { t } = useI18n()
const dragging = ref(false)

function onDrop(e: DragEvent, wizard: ImportWizard) {
  dragging.value = false
  wizard.selectFile(e.dataTransfer?.files?.[0] ?? null)
}

function onPick(e: Event, wizard: ImportWizard) {
  const el = e.target as HTMLInputElement
  wizard.selectFile(el.files?.[0] ?? null)
  el.value = '' // bir xil faylni qayta tanlash mumkin bo'lsin
}
</script>

<template>
  <div class="space-y-5">
    <p v-if="className" class="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">
      {{ t('import.forClass', { name: className }) }}
    </p>

    <section class="rounded-xl border border-border p-4">
      <h3 class="text-sm font-semibold text-fg">{{ t('import.step1') }}</h3>
      <p class="mt-1 text-sm text-fg-muted">
        {{ className ? t('import.templateHintClass') : t('import.templateHint') }}
      </p>
      <BaseButton class="mt-3" size="sm" variant="secondary" @click="wizard.downloadTemplate()">
        <Download class="h-4 w-4" /> {{ t('import.downloadTemplate') }}
      </BaseButton>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('import.step2') }}</h3>
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-primary-500"
        :class="
          dragging ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-surface-muted'
        "
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop($event, wizard)"
      >
        <input
          type="file"
          class="sr-only"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          :aria-label="t('import.chooseFile')"
          @change="onPick($event, wizard)"
        />
        <template v-if="wizard.file">
          <FileSpreadsheet class="h-8 w-8 text-success" aria-hidden="true" />
          <p class="text-sm font-medium text-fg">{{ wizard.file.name }}</p>
          <p class="text-xs text-fg-muted">{{ formatBytes(wizard.file.size) }}</p>
          <p class="text-xs text-primary-700">{{ t('import.changeFile') }}</p>
        </template>
        <template v-else>
          <UploadCloud class="h-8 w-8 text-fg-muted" aria-hidden="true" />
          <p class="text-sm font-medium text-fg">{{ t('import.dropHere') }}</p>
          <p class="text-xs text-fg-muted">{{ t('import.limits', { rows: IMPORT_MAX_ROWS }) }}</p>
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
        :aria-label="t('import.uploading')"
      >
        <div
          class="h-full rounded-full bg-primary-600 transition-all"
          :style="{ width: `${wizard.progress}%` }"
        />
      </div>
      <p class="text-xs text-fg-muted">
        {{
          wizard.progress < 100
            ? t('import.uploadingPercent', { p: wizard.progress })
            : t('import.checking')
        }}
      </p>
    </div>

    <p v-if="wizard.error" class="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
      {{ wizard.error }}
    </p>
  </div>
</template>
