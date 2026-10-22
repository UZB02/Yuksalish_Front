<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const { toasts, dismiss } = useToast()

const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
const colors = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-primary-600',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:items-end"
    aria-live="polite"
    aria-atomic="false"
  >
    <TransitionGroup
      enter-active-class="transition duration-200"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-for="item in toasts"
        :key="item.id"
        role="status"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-lg"
      >
        <component
          :is="icons[item.kind]"
          class="mt-0.5 h-5 w-5 shrink-0"
          :class="colors[item.kind]"
        />
        <p class="flex-1 text-sm text-fg">{{ item.message }}</p>
        <button
          type="button"
          class="rounded p-0.5 text-fg-muted hover:text-fg"
          :aria-label="t('common.close')"
          @click="dismiss(item.id)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
