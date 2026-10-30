<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import type { Platform } from '@/utils/platform'

const { t } = useI18n()
const { platform, instructionsOpen, closeInstructions } = useInstallPrompt()

const STEP_COUNT: Record<Platform, number> = {
  'ios-safari': 3,
  'ios-other': 2,
  'android-chromium': 3,
  'desktop-chromium': 2,
  'firefox-desktop': 1,
  'firefox-android': 2,
  'safari-macos': 2,
  'in-app': 2,
  other: 1,
}

const steps = computed(() =>
  Array.from({ length: STEP_COUNT[platform] }, (_, i) =>
    t(`pwa.install.steps.${platform}.${i + 1}`),
  ),
)
</script>

<template>
  <BaseModal
    :open="instructionsOpen"
    :title="t('pwa.install.title')"
    :description="t('pwa.install.description')"
    @close="closeInstructions"
  >
    <ol class="list-decimal space-y-2 pl-5 text-sm text-fg" data-testid="install-steps">
      <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
    </ol>
    <p
      v-if="platform === 'ios-safari'"
      class="mt-4 rounded-lg bg-surface-muted p-3 text-xs text-fg-muted"
    >
      {{ t('pwa.install.iosNote') }}
    </p>
    <div class="mt-5 flex justify-end">
      <BaseButton variant="secondary" @click="closeInstructions">{{
        t('common.close')
      }}</BaseButton>
    </div>
  </BaseModal>
</template>
