<script setup lang="ts">
import { computed } from 'vue'
import { Download } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'
import Spinner from '@/components/ui/Spinner.vue'

/**
 * "Yuklab olish" tugmasi (ochiladigan menyu). Standart: Excel va PDF;
 * `items` berilsa o'sha elementlar (masalan, butun maktab: sinflar/o'qituvchilar x Excel/PDF).
 * Tanlangan element kaliti `select` hodisasi bilan chiqadi.
 */
const props = defineProps<{ busy?: boolean; items?: DropdownItem[] }>()
const emit = defineEmits<{ select: [key: string] }>()
const { t } = useI18n()

const list = computed<DropdownItem[]>(() => {
  const base = props.items ?? [
    { key: 'xlsx', label: t('timetable.exportExcel') },
    { key: 'pdf', label: t('timetable.exportPdf') },
  ]
  return base.map((i) => ({ ...i, disabled: i.disabled || props.busy }))
})
</script>

<template>
  <DropdownMenu
    :items="list"
    :label="t('timetable.download')"
    trigger-test-id="export-trigger"
    trigger-class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors select-none hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
    @select="emit('select', $event)"
  >
    <template #trigger>
      <Spinner v-if="busy" class="h-4 w-4" />
      <Download v-else class="h-4 w-4" aria-hidden="true" />
      {{ t('timetable.download') }}
    </template>
  </DropdownMenu>
</template>
