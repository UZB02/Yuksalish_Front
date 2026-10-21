<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Monitor, Moon, Sun } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()
const icon = computed(() => (ui.theme === 'light' ? Sun : ui.theme === 'dark' ? Moon : Monitor))
</script>

<template>
  <button
    type="button"
    class="rounded-lg p-2 text-fg-muted hover:bg-surface-muted hover:text-fg"
    :title="t(`theme.${ui.theme}`)"
    :aria-label="t('theme.toggle', { current: t(`theme.${ui.theme}`) })"
    @click="ui.cycleTheme()"
  >
    <component :is="icon" class="h-5 w-5" aria-hidden="true" />
  </button>
</template>
