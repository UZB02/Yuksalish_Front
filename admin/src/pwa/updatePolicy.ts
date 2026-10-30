export interface UpdatePolicyDeps {
  /** Saqlanmagan o'zgarish bormi (useDirtyRegistry.isAnythingDirty) */
  isDirty: () => boolean
  /** Yangi service worker'ni faollashtirib, sahifani qayta yuklaydi */
  reload: () => void | Promise<void>
}

/**
 * Yangilanish siyosati:
 *  - foydalanuvchi "Yangilash" bossa - faqat dirty bo'lmasa qo'llanadi;
 *  - keyingi marshrut almashuvida - yangilanish kutilayotgan va hech narsa dirty bo'lmasa jim qo'llanadi.
 * Dirty holatda hech qachon reload qilinmaydi.
 */
export function createUpdatePolicy(deps: UpdatePolicyDeps) {
  let pending = false

  return {
    markPending() {
      pending = true
    },
    get pending() {
      return pending
    },
    /** Foydalanuvchi "Yangilash" tugmasini bosdi. false - dirty tufayli rad etildi. */
    applyNow(): boolean {
      if (deps.isDirty()) return false
      void deps.reload()
      return true
    },
    /** Marshrut almashgandan keyin chaqiriladi. true - reload boshlandi. */
    applyOnNavigation(): boolean {
      if (!pending || deps.isDirty()) return false
      void deps.reload()
      return true
    },
  }
}
