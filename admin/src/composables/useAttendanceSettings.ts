import { ref } from 'vue'
import { settingsApi } from '@/api/settings.api'
import type { AttendanceSettings } from '@/api/types'
import { DEFAULT_ATTENDANCE_FORM } from '@/utils/attendanceForm'

/** Joriy foydalanuvchi uchun samarali davomat sozlamalari (ish kunlari, validatsiya). */
export function useEffectiveAttendance() {
  const settings = ref<AttendanceSettings>({ ...DEFAULT_ATTENDANCE_FORM })
  const loaded = ref(false)

  async function load() {
    try {
      settings.value = (await settingsApi.get('attendance')).effective
    } catch {
      // Standart qiymatlar qoladi; server baribir tekshiradi.
    } finally {
      loaded.value = true
    }
  }
  return { settings, loaded, load }
}
