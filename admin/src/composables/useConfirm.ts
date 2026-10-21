import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
}

const state = reactive<{
  open: boolean
  options: ConfirmOptions
  resolve: ((value: boolean) => void) | null
}>({
  open: false,
  options: { title: '' },
  resolve: null,
})

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    // Oldingi ochiq dialog bo'lsa, uni bekor qilingan deb hisoblaymiz.
    state.resolve?.(false)
    state.options = options
    state.open = true
    return new Promise<boolean>((resolve) => {
      state.resolve = resolve
    })
  }

  function settle(value: boolean) {
    state.open = false
    state.resolve?.(value)
    state.resolve = null
  }

  return { state, confirm, settle }
}
