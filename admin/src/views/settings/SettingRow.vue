<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import BaseBadge from '@/components/ui/BaseBadge.vue'

withDefaults(
  defineProps<{
    label: string
    hint?: string
    /** Maktab rejimida: maydon override qilinganmi (undefined - global rejim) */
    flag?: boolean
    /** Global qiymat matni (maktab rejimida ko'rsatiladi) */
    globalText?: string
  }>(),
  // Boolean prop berilmasa Vue false deb oladi: global rejimda undefined bo'lib qolishi kerak
  { flag: undefined },
)
const emit = defineEmits<{ toggle: [on: boolean] }>()
const { t } = useI18n()
</script>

<template>
  <div
    class="grid gap-x-8 gap-y-2.5 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-start"
    data-testid="setting-row"
  >
    <div class="min-w-0">
      <p class="text-sm font-medium text-fg">{{ label }}</p>
      <p v-if="hint" class="mt-0.5 text-xs leading-5 text-fg-muted">{{ hint }}</p>
      <div
        v-if="flag !== undefined"
        class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted"
      >
        <template v-if="flag">
          <BaseBadge tone="primary" data-testid="row-badge">
            {{ t('settings.override.schoolBadge') }}
          </BaseBadge>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
            :title="t('settings.override.revert')"
            data-testid="row-override"
            @click="emit('toggle', false)"
          >
            <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{{ t('settings.override.revert') }}</span>
          </button>
        </template>
        <button
          v-else
          type="button"
          class="rounded font-medium text-primary-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          data-testid="row-override"
          @click="emit('toggle', true)"
        >
          {{ t('settings.override.change') }}
        </button>
        <span>{{ t('settings.override.globalShort') }}: {{ globalText }}</span>
      </div>
    </div>
    <div class="min-w-0"><slot /></div>
  </div>
</template>
