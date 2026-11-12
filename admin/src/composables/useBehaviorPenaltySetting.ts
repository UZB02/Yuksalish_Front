import { ref } from 'vue'
import { settingsApi } from '@/api/settings.api'

/** Samarali "xulq turi jarimasi" sozlamasi (baholash oynasida ogohlantirish uchun). Xatoda: o'chiq. */
export function useBehaviorPenaltySetting() {
  const enabled = ref(false)

  async function load() {
    try {
      enabled.value = !!(await settingsApi.get('rating')).effective.behaviorPenaltyEnabled
    } catch {
      // Ogohlantirish ko'rsatilmaydi; hisoblashni baribir server bajaradi.
    }
  }
  return { enabled, load }
}
