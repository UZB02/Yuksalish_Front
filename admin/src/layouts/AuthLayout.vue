<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { BarChart3 } from 'lucide-vue-next'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'

const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center px-4 py-10">
    <div class="absolute right-4 top-4"><ThemeToggle /></div>
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center text-center">
        <span
          class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white"
        >
          <BarChart3 class="h-6 w-6" aria-hidden="true" />
        </span>
        <p class="text-lg font-semibold text-fg">{{ t('app.name') }}</p>
        <p class="text-sm text-fg-muted">{{ t('app.tagline') }}</p>
      </div>
      <RouterView />
    </div>
  </div>
</template>
