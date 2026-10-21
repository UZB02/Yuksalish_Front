<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from './BaseButton.vue'

/**
 * Baholash/davomat varaqlarining pastki saqlash paneli.
 * Mobilda xabar alohida qatorda, tugmalar to'liq kenglikda va qisqa yozuv bilan (matn qatorga bo'linmasin).
 */
defineProps<{
  /** Chapdagi holat matni (bo'sh bo'lsa ko'rsatilmaydi) */
  message?: string
  danger?: boolean
  showDiscard: boolean
  saving: boolean
  canSave: boolean
  /** O'zgarishlar soni (mobil qisqa yozuv uchun) */
  count: number
  /** Katta ekrandagi to'liq yozuv, masalan "Saqlash (4 ta o'zgarish)" */
  saveLabel: string
}>()

defineEmits<{ discard: []; save: [] }>()

const { t } = useI18n()
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:left-64"
  >
    <div
      class="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
    >
      <p
        v-if="message"
        class="text-xs sm:text-sm"
        :class="danger ? 'text-danger' : 'text-fg-muted'"
        data-testid="save-bar-message"
      >
        {{ message }}
      </p>
      <div class="flex w-full gap-2 sm:ml-auto sm:w-auto">
        <BaseButton
          v-if="showDiscard"
          variant="secondary"
          class="shrink-0 whitespace-nowrap"
          :disabled="saving"
          @click="$emit('discard')"
        >
          {{ t('scoring.discard') }}
        </BaseButton>
        <BaseButton
          class="flex-1 whitespace-nowrap sm:flex-none"
          :disabled="!canSave"
          :loading="saving"
          @click="$emit('save')"
        >
          <span class="sm:hidden">{{ t('common.save') }} ({{ count }})</span>
          <span class="hidden sm:inline">{{ saveLabel }}</span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>
