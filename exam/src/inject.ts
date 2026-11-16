import { inject, type InjectionKey } from 'vue'
import type { ExamStore } from './store'

export const STORE_KEY: InjectionKey<ExamStore> = Symbol('exam-store')

export function useStore(): ExamStore {
  const s = inject(STORE_KEY)
  if (!s) throw new Error('Store yo‘q')
  return s
}
