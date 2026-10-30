<script setup lang="ts">
import { DEFAULT_BRAND_MARK } from '@/constants/brand'
import { useI18n } from 'vue-i18n'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
import { useBrandingStore } from '@/stores/branding'

const { t } = useI18n()
const branding = useBrandingStore()
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center px-4 py-10">
    <div class="absolute right-4 top-4"><ThemeToggle /></div>
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center text-center">
        <img
          v-if="branding.logoSrc"
          :src="branding.logoSrc"
          alt=""
          class="mb-4 h-16 max-w-[12rem] object-contain"
          data-testid="auth-brand-logo"
        />
        <img
          v-else
          :src="DEFAULT_BRAND_MARK"
          alt=""
          class="mb-4 h-16 w-16 object-contain"
          data-testid="auth-default-mark"
        />
        <p class="text-lg font-semibold text-fg">{{ branding.appName }}</p>
        <p class="text-sm text-fg-muted">{{ t('app.tagline') }}</p>
      </div>
      <RouterView />
    </div>
  </div>
</template>
