<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle2 } from 'lucide-vue-next'
import type { ImportWizard } from '@/composables/useImportWizard'

const props = defineProps<{ wizard: ImportWizard }>()
const { t } = useI18n()

const items = computed(() => {
  const r = props.wizard.result
  return [
    { key: 'created', value: r?.created ?? 0, tone: 'text-success' },
    { key: 'updated', value: r?.updated ?? 0, tone: 'text-primary-700' },
    { key: 'skipped', value: r?.skipped ?? 0, tone: 'text-warning' },
    { key: 'failed', value: r?.failed ?? 0, tone: 'text-danger' },
  ]
})
</script>

<template>
  <div class="space-y-4 text-center">
    <CheckCircle2 class="mx-auto h-12 w-12 text-success" aria-hidden="true" />
    <h3 class="text-base font-semibold text-fg">{{ t('import.done') }}</h3>
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div v-for="i in items" :key="i.key" class="rounded-xl border border-border p-3">
        <dt class="text-xs text-fg-muted">{{ t(`import.result.${i.key}`) }}</dt>
        <dd class="mt-1 text-2xl font-semibold" :class="i.tone">{{ i.value }}</dd>
      </div>
    </dl>
  </div>
</template>
