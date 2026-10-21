import { ref } from 'vue'
import { settingsApi } from '@/api/settings.api'
import type { ScoringSettings } from '@/api/types'
import { DEFAULT_SCORING } from '@/utils/scoring'

/** Joriy foydalanuvchi uchun samarali baholash sozlamalari (ball tahrirlash validatsiyasi uchun). */
export function useEffectiveScoring() {
  const settings = ref<ScoringSettings>({ ...DEFAULT_SCORING })
  const loaded = ref(false)

  async function load() {
    try {
      settings.value = (await settingsApi.getScoring()).effective
    } catch {
      // Standart qiymatlar qoladi; server baribir tekshiradi.
    } finally {
      loaded.value = true
    }
  }
  return { settings, loaded, load }
}
