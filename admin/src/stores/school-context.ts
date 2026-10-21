import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { schoolsApi } from '@/api/schools.api'
import type { School } from '@/api/types'

const STORAGE_KEY = 'schoolId'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage mavjud bo'lmasa e'tiborsiz qoldiriladi.
  }
}

/** Superadmin tanlagan maktab. Faqat maktab id si localStorage da saqlanadi. */
export const useSchoolContextStore = defineStore('school-context', () => {
  const schoolId = ref<string | null>(readStored())
  const schools = ref<School[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const selectedSchool = computed(() => schools.value.find((s) => s.id === schoolId.value) ?? null)

  function select(id: string | null) {
    schoolId.value = id || null
    writeStored(schoolId.value)
  }

  async function loadSchools() {
    loading.value = true
    try {
      const { items } = await schoolsApi.list({ limit: 100 })
      schools.value = items
      loaded.value = true
      // Saqlangan maktab endi mavjud bo'lmasa, tanlov tozalanadi.
      if (schoolId.value && !items.some((s) => s.id === schoolId.value)) select(null)
    } finally {
      loading.value = false
    }
  }

  function reset() {
    schools.value = []
    loaded.value = false
    select(null)
  }

  return { schoolId, schools, loading, loaded, selectedSchool, select, loadSchools, reset }
})
