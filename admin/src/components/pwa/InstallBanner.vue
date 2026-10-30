<script setup lang="ts">
import { DEFAULT_BRAND_MARK } from '@/constants/brand'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useInstallPrompt } from '@/composables/useInstallPrompt'

const { t } = useI18n()
const { bannerVisible, install, dismissBanner } = useInstallPrompt()
</script>

<template>
  <div
    v-if="bannerVisible"
    class="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface p-3 print:hidden"
    data-testid="install-banner"
  >
    <img :src="DEFAULT_BRAND_MARK" alt="" class="h-8 w-8 shrink-0 object-contain" />
    <p class="flex-1 text-sm text-fg">{{ t('pwa.banner.text') }}</p>
    <BaseButton size="sm" @click="install">{{ t('pwa.install.menu') }}</BaseButton>
    <button
      type="button"
      class="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted"
      :aria-label="t('common.close')"
      @click="dismissBanner"
    >
      <X class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</template>
