<script setup lang="ts">
import { nextTick, ref, useId, type Component } from 'vue'
import { MoreVertical } from 'lucide-vue-next'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'

export interface DropdownItem {
  key: string
  label: string
  icon?: Component
  /** Xavfli amal: qizil rangda */
  danger?: boolean
  disabled?: boolean
  /** Bu elementdan oldin ajratgich chizig'i */
  separator?: boolean
}

defineProps<{
  items: DropdownItem[]
  /** Tugma uchun aria-label (masalan "Boshqa amallar: Ism") */
  label: string
}>()
const emit = defineEmits<{ select: [key: string] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const menuId = useId()
const { open, style, toggle, close } = useAnchoredPanel(trigger, panel)

const itemEls = () =>
  Array.from(panel.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])

async function openAndFocus(which: 'first' | 'last') {
  if (!open.value) open.value = true
  await nextTick()
  await nextTick()
  const els = itemEls()
  ;(which === 'first' ? els[0] : els[els.length - 1])?.focus({ preventScroll: true })
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    void openAndFocus('first')
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    void openAndFocus('last')
  }
}

async function onTriggerClick() {
  const wasOpen = open.value
  toggle()
  if (!wasOpen) {
    await nextTick()
    await nextTick()
    itemEls()[0]?.focus({ preventScroll: true })
  }
}

function onMenuKeydown(e: KeyboardEvent) {
  const els = itemEls()
  const i = els.indexOf(document.activeElement as HTMLElement)
  const go = (n: number) => {
    e.preventDefault()
    els[(n + els.length) % els.length]?.focus({ preventScroll: true })
  }
  if (e.key === 'ArrowDown') go(i + 1)
  else if (e.key === 'ArrowUp') go(i < 0 ? els.length - 1 : i - 1)
  else if (e.key === 'Home') go(0)
  else if (e.key === 'End') go(els.length - 1)
  else if (e.key === 'Tab') close(true)
}

function pick(item: DropdownItem) {
  if (item.disabled) return
  close(true)
  emit('select', item.key)
}
</script>

<template>
  <span class="inline-flex">
    <button
      ref="trigger"
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :aria-label="label"
      :title="label"
      data-testid="menu-trigger"
      @click="onTriggerClick"
      @keydown="onTriggerKeydown"
    >
      <slot name="trigger"><MoreVertical class="h-4 w-4" aria-hidden="true" /></slot>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        :id="menuId"
        ref="panel"
        role="menu"
        :aria-label="label"
        class="fixed z-[100] min-w-[13rem] rounded-lg border border-border bg-surface py-1 shadow-lg"
        :style="style"
        data-testid="menu-panel"
        @keydown="onMenuKeydown"
      >
        <template v-for="item in items" :key="item.key">
          <div v-if="item.separator" role="separator" class="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            :disabled="item.disabled"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              item.danger
                ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft'
                : 'text-fg hover:bg-surface-muted focus:bg-surface-muted'
            "
            :data-testid="`menu-item-${item.key}`"
            @click="pick(item)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          </button>
        </template>
      </div>
    </Teleport>
  </span>
</template>
