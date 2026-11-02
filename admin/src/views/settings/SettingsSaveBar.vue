<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'

/**
 * Pastki saqlash paneli: faqat bo'lim o'zgargan bo'lsagina ko'rinadi.
 * Sidebar kengligiga (lg) va mobil xavfsiz hududga (safe-area) moslashadi.
 */
defineProps<{ dirty: boolean; saving?: boolean; canSave: boolean }>()
defineEmits<{ discard: []; save: [] }>()
const { t } = useI18n()
</script>

<template>
  <Transition
    enter-active-class="transition duration-150"
    enter-from-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-100"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="dirty"
      class="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:left-[var(--sidebar-w,16rem)]"
      role="region"
      :aria-label="t('settings.unsaved')"
      data-testid="settings-save-bar"
    >
      <div class="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p class="flex items-center gap-2 text-sm text-fg-muted">
          <span class="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
          {{ t('settings.unsaved') }}
        </p>
        <div class="flex gap-2 sm:ml-auto">
          <BaseButton
            variant="secondary"
            class="flex-1 sm:flex-none"
            :disabled="saving"
            data-testid="settings-discard"
            @click="$emit('discard')"
          >
            {{ t('common.cancel') }}
          </BaseButton>
          <BaseButton
            class="flex-1 sm:flex-none"
            :disabled="!canSave"
            :loading="saving"
            data-testid="settings-save"
            @click="$emit('save')"
          >
            {{ t('common.save') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Transition>
</template>
