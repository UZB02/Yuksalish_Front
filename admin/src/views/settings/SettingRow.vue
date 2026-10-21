<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'

defineProps<{
  label: string
  hint?: string
  /** Maktab rejimida: maydon override qilinganmi (undefined - global rejim) */
  flag?: boolean
  /** Global qiymat matni (maktab rejimida ko'rsatiladi) */
  globalText?: string
}>()
const emit = defineEmits<{ toggle: [on: boolean] }>()
const { t } = useI18n()
</script>

<template>
  <div class="grid gap-3 py-4 sm:grid-cols-[1fr_20rem] sm:items-start">
    <div>
      <p class="text-sm font-medium text-fg">{{ label }}</p>
      <p v-if="hint" class="mt-0.5 text-xs text-fg-muted">{{ hint }}</p>
      <div v-if="flag !== undefined" class="mt-2 space-y-1">
        <BaseCheckbox
          :model-value="flag"
          :label="t('settings.override.useOwn')"
          @update:model-value="emit('toggle', $event)"
        />
        <p class="text-xs text-fg-muted">
          {{ t('settings.override.globalValue') }}: <b class="text-fg">{{ globalText }}</b>
          <span v-if="flag" class="ml-1 text-primary-700">
            ({{ t('settings.override.schoolValue') }})
          </span>
        </p>
      </div>
    </div>
    <div class="min-w-0"><slot /></div>
  </div>
</template>
