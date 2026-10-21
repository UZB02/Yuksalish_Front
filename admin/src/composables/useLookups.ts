import { computed, ref, type Ref } from 'vue'
import { academicYearsApi } from '@/api/academicYears.api'
import { classesApi } from '@/api/classes.api'
import { teachersApi } from '@/api/teachers.api'
import type { AcademicYear, SchoolClass, Teacher } from '@/api/types'

/**
 * Tanlagichlar (select) uchun ma'lumotnomalar. Har biri load() bilan yuklanadi;
 * xato bo'lsa ro'yxat bo'sh qoladi va `failed` true bo'ladi (sahifa ishlashda davom etadi).
 */
function createLookup<T>(fetch: () => Promise<T[]>) {
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const failed = ref(false)
  const loaded = ref(false)

  async function load() {
    loading.value = true
    failed.value = false
    try {
      items.value = await fetch()
    } catch {
      items.value = []
      failed.value = true
    } finally {
      loading.value = false
      loaded.value = true
    }
  }
  return { items, loading, failed, loaded, load }
}

export function useAcademicYearLookup() {
  const lookup = createLookup<AcademicYear>(async () => (await academicYearsApi.list()).items)
  const activeYear = computed(() => lookup.items.value.find((y) => y.isActive) ?? null)
  return { ...lookup, activeYear }
}

export function useTeacherLookup() {
  return createLookup<Teacher>(
    async () => (await teachersApi.list({ limit: 100, isActive: true })).items,
  )
}

/** Faol (arxivlanmagan) sinflar - o'quvchi qo'shish/o'tkazish tanlagichlari uchun. */
export function useClassLookup() {
  return createLookup<SchoolClass>(async () => (await classesApi.list({ limit: 100 })).items)
}
