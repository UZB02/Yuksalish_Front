import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Tugmaga bog'langan, `body` ga teleport qilinadigan panel uchun joylashuv va yopilish mantig'i
 * (menyu, popover). Tashqariga bosish, Escape, scroll/resize bilan yopiladi; pastda joy kam bo'lsa
 * tugmadan tepaga ochiladi, shuning uchun jadvalning `overflow` i uni kesmaydi.
 */
export function useAnchoredPanel(
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  options: { align?: 'start' | 'end'; onClose?: (returnFocus: boolean) => void } = {},
) {
  const open = ref(false)
  const style = ref<Record<string, string>>({ top: '0px', left: '0px', visibility: 'hidden' })

  function position() {
    const t = trigger.value
    if (!t) return
    const r = t.getBoundingClientRect()
    const ph = panel.value?.offsetHeight ?? 0
    const pw = panel.value?.offsetWidth ?? 0
    const gap = 4
    const below = window.innerHeight - r.bottom
    const top = below < ph + gap + 8 && r.top > below ? r.top - ph - gap : r.bottom + gap
    let left = options.align === 'start' ? r.left : r.right - pw
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8))
    style.value = { top: `${Math.max(8, top)}px`, left: `${left}px` }
  }

  function close(returnFocus = false) {
    if (!open.value) return
    open.value = false
    options.onClose?.(returnFocus)
    if (returnFocus) void nextTick(() => trigger.value?.focus())
  }

  function onPointerDown(e: Event) {
    const target = e.target as Node
    if (panel.value?.contains(target) || trigger.value?.contains(target)) return
    close()
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close(true)
    }
  }
  const onViewport = () => close()
  function onScroll(e: Event) {
    if (panel.value?.contains(e.target as Node)) return
    close()
  }

  watch(open, async (isOpen) => {
    if (isOpen) {
      style.value = { top: '0px', left: '0px', visibility: 'hidden' }
      await nextTick()
      position()
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('keydown', onKeydown, true)
      window.addEventListener('resize', onViewport)
      window.addEventListener('scroll', onScroll, true)
    } else {
      removeListeners()
    }
  })

  function removeListeners() {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeydown, true)
    window.removeEventListener('resize', onViewport)
    window.removeEventListener('scroll', onScroll, true)
  }
  onBeforeUnmount(removeListeners)

  return {
    open,
    style,
    toggle: () => (open.value ? close(false) : (open.value = true)),
    close,
  }
}
