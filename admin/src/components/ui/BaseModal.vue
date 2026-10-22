<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useBodyLock } from '@/composables/useBodyLock'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Orqa fonni bosganda yopilmasin (forma to'ldirilayotganda) */
    persistent?: boolean
    /** 'top' - boshqa modallar ustida (tasdiqlash oynasi modal ichidan ochilganda ham ko'rinsin) */
    layer?: 'default' | 'top'
  }>(),
  { size: 'md', persistent: false, layer: 'default' },
)
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const titleId = useId()
const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null
const bodyLock = useBodyLock()

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

watch(
  () => props.open,
  async (isOpen) => {
    bodyLock.set(isOpen)
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      const first = panel.value?.querySelector<HTMLElement>('input, select, textarea')
      ;(first ?? panel.value?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.value)?.focus()
    } else {
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !panel.value) return
  const nodes = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (nodes.length === 0) return
  const first = nodes[0]!
  const last = nodes[nodes.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

function onBackdrop() {
  if (!props.persistent) emit('close')
}

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
        :class="layer === 'top' ? 'z-[60]' : 'z-50'"
        @mousedown.self="onBackdrop"
        @keydown="onKeydown"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          class="flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:rounded-2xl"
          :class="widths[size]"
        >
          <header class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 :id="titleId" class="text-base font-semibold text-fg">{{ title }}</h2>
              <p v-if="description" class="mt-0.5 text-sm text-fg-muted">{{ description }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              <X class="h-5 w-5" />
            </button>
          </header>
          <div class="overflow-y-auto px-5 py-4">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
