import { onBeforeUnmount } from 'vue'

/**
 * Saqlanmagan o'zgarishi bor formalar ro'yxati. PWA yangilanishi sahifani qayta yuklashdan oldin
 * shundan so'raydi: biror forma "dirty" bo'lsa, hech qachon avtomatik reload qilinmaydi.
 */
const sources = new Set<() => boolean>()

export function registerDirtySource(isDirty: () => boolean): () => void {
  sources.add(isDirty)
  return () => {
    sources.delete(isDirty)
  }
}

export function isAnythingDirty(): boolean {
  for (const isDirty of sources) {
    try {
      if (isDirty()) return true
    } catch {
      // Noaniq holatda xavfsiz tomonga: dirty deb hisoblaymiz
      return true
    }
  }
  return false
}

/** Komponent uchun: setup paytida ro'yxatga qo'shiladi, unmount paytida olib tashlanadi. */
export function useDirtySource(isDirty: () => boolean) {
  const unregister = registerDirtySource(isDirty)
  onBeforeUnmount(unregister)
}
