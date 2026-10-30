import { ref } from 'vue'
import type { Router } from 'vue-router'
import { registerSW } from 'virtual:pwa-register'
import { isAnythingDirty } from '@/composables/useDirtyRegistry'
import { createUpdatePolicy } from './updatePolicy'

/** Yangi versiya yuklab olingan va faollashtirishni kutmoqda. */
export const needRefresh = ref(false)

const HOUR_MS = 60 * 60 * 1000

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null

export const updatePolicy = createUpdatePolicy({
  isDirty: isAnythingDirty,
  reload: () => updateSW?.(true),
})

/** Foydalanuvchi "Yangilash" bosganda. false - saqlanmagan o'zgarish bor. */
export function applyUpdateNow(): boolean {
  return updatePolicy.applyNow()
}

/** Service worker'ni ro'yxatdan o'tkazadi (main.ts da, mount'dan keyin). */
export function initPwa(router: Router) {
  if (!('serviceWorker' in navigator)) return
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true
      updatePolicy.markPending()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Yangi versiyani tekshirish: soatiga bir marta va sahifa qayta ko'ringanda
      const check = () => void registration.update().catch(() => undefined)
      setInterval(check, HOUR_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
  // Keyingi marshrut almashuvida (saqlanmagan o'zgarish yo'q bo'lsa) jim yangilaydi.
  router.afterEach((_to, from) => {
    if (from.matched.length === 0) return // dastlabki navigatsiya
    updatePolicy.applyOnNavigation()
  })
}
