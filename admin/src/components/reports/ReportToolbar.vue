<script setup lang="ts">
import { FileSpreadsheet, FileText, Printer } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { ExportFormat } from '@/api/types'

defineProps<{
  /** reports.export ruxsati bor (yo'q bo'lsa eksport tugmalari ko'rsatilmaydi) */
  canExport: boolean
  /** So'rov tayyor emas (davr yoki majburiy filtr yo'q) */
  disabled?: boolean
  /** Hozir yuklanayotgan format */
  busy: ExportFormat | null
}>()
const emit = defineEmits<{ export: [format: ExportFormat]; print: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-2 print:hidden" data-testid="report-toolbar">
    <template v-if="canExport">
      <BaseButton
        variant="secondary"
        data-testid="export-xlsx"
        :loading="busy === 'xlsx'"
        :disabled="disabled || busy !== null"
        @click="emit('export', 'xlsx')"
      >
        <FileSpreadsheet class="h-4 w-4" aria-hidden="true" /> {{ t('reports.excel') }}
      </BaseButton>
      <BaseButton
        variant="secondary"
        data-testid="export-pdf"
        :loading="busy === 'pdf'"
        :disabled="disabled || busy !== null"
        @click="emit('export', 'pdf')"
      >
        <FileText class="h-4 w-4" aria-hidden="true" /> {{ t('reports.pdf') }}
      </BaseButton>
    </template>
    <BaseButton variant="ghost" :disabled="disabled" @click="emit('print')">
      <Printer class="h-4 w-4" aria-hidden="true" /> {{ t('reports.print') }}
    </BaseButton>
  </div>
</template>
