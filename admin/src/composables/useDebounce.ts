import { refDebounced } from '@vueuse/core'
import type { Ref } from 'vue'

/** Qidiruv kabi tez o'zgaruvchi qiymatlarni kechiktiradi. */
export function useDebounce<T>(source: Ref<T>, delay = 350) {
  return refDebounced(source, delay)
}
