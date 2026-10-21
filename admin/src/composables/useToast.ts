import { reactive, readonly } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seq = 0

function remove(id: number) {
  const i = state.items.findIndex((t) => t.id === id)
  if (i !== -1) state.items.splice(i, 1)
}

function push(kind: ToastKind, message: string, duration = 4500) {
  const id = ++seq
  state.items.push({ id, kind, message })
  if (duration > 0) setTimeout(() => remove(id), duration)
  return id
}

export function useToast() {
  return {
    toasts: readonly(state).items,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message, 7000),
    info: (message: string) => push('info', message),
    dismiss: remove,
  }
}
