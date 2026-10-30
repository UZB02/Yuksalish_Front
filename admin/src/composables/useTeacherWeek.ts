import { ref } from 'vue'
import type { TeacherWeek } from '@/api/timetable.api'
import { addDaysIso } from '@/utils/timetable'

/** O'qituvchi haftasi: yuklash va haftalar bo'yicha yurish (oldingi / keyingi / bugun) */
export function useTeacherWeek(fetch: (date?: string) => Promise<TeacherWeek>) {
  const week = ref<TeacherWeek | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)
  const date = ref<string | undefined>(undefined)

  async function load() {
    loading.value = true
    error.value = null
    try {
      week.value = await fetch(date.value)
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }
  async function shift(weeks: number) {
    const base = date.value ?? week.value?.from
    if (!base) return
    date.value = addDaysIso(base, weeks * 7)
    await load()
  }
  async function goToday() {
    date.value = undefined
    await load()
  }
  return { week, loading, error, date, load, shift, goToday }
}
