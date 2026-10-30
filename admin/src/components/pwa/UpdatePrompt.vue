<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { applyUpdateNow, needRefresh } from '@/pwa/registerPwa'

const { t } = useI18n()
const later = ref(false)
const blocked = ref(false)

function update() {
  // Saqlanmagan o'zgarish bo'lsa reload qilinmaydi
  blocked.value = !applyUpdateNow()
}
</script>

<template>
  <div
    v-if="needRefresh && !later"
    role="alert"
    class="fixed inset-x-0 bottom-0 z-[75] flex justify-center p-4 sm:justify-start"
  >
    <div
      class="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <div class="flex items-start gap-3">
        <RefreshCw class="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <div class="flex-1">
          <p class="text-sm font-medium text-fg">{{ t('pwa.update.title') }}</p>
          <p v-if="blocked" class="mt-1 text-sm text-warning">{{ t('pwa.update.saveFirst') }}</p>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <BaseButton variant="ghost" size="sm" @click="later = true">
          {{ t('pwa.update.later') }}
        </BaseButton>
        <BaseButton size="sm" @click="update">{{ t('pwa.update.action') }}</BaseButton>
      </div>
    </div>
  </div>
</template>
