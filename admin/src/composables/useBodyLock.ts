import { onBeforeUnmount } from 'vue'

/**
 * Bir nechta ochiq modal uchun umumiy body scroll bloki (hisoblagich bilan).
 * Ichki modal (masalan, tasdiqlash) yopilganda tashqi modal ochiq bo'lsa, scroll qaytmaydi.
 */
let count = 0
let previousOverflow = ''

function acquire() {
  if (typeof document === 'undefined') return
  if (count === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  count++
}

function release() {
  if (typeof document === 'undefined' || count === 0) return
  count--
  if (count === 0) document.body.style.overflow = previousOverflow
}

/** Komponent uchun: `set(true/false)` takroriy chaqiruvlarga chidamli, unmount da bo'shatadi. */
export function useBodyLock() {
  let held = false
  const set = (on: boolean) => {
    if (on && !held) {
      held = true
      acquire()
    } else if (!on && held) {
      held = false
      release()
    }
  }
  onBeforeUnmount(() => set(false))
  return { set }
}

/** Faqat testlar uchun: holatni tiklash */
export function __resetBodyLock() {
  count = 0
  previousOverflow = ''
  if (typeof document !== 'undefined') document.body.style.overflow = ''
}
