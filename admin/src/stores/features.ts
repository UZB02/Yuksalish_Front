import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { settingsApi } from '@/api/settings.api'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'

export type FeatureKey = 'exams' | 'teacherQuizzes'

/**
 * Maktab bo'yicha yoqiladigan modullar (feature flag). Hozircha: `exams` (Imtihonlar), standart o'chiq.
 * Joriy maktab: maktab xodimi uchun o'zining, superadmin uchun tanlangan maktab. Maktab yo'q yoki
 * yuklashda xato bo'lsa modul o'chiq hisoblanadi (menyu yashiriladi).
 */
export const useFeaturesStore = defineStore('features', () => {
  const auth = useAuthStore()
  const schoolCtx = useSchoolContextStore()

  const examsEnabled = ref(false)
  /** O'qituvchi o'zining kichik testlarini yaratishi mumkin (Sozlamalar > Imtihon): "Imtihonlar" bandi shunda ko'rinadi */
  const teacherQuizzes = ref(false)
  const loadedKey = ref<string | null>(null)
  let pending: Promise<void> | null = null
  let pendingKey: string | null = null

  /** Hozirgi maktab kaliti (foydalanuvchi + maktab); tizimga kirilmagan bo'lsa null */
  const contextKey = computed(() => {
    const u = auth.user
    if (!u) return null
    if (u.role === 'superadmin') return schoolCtx.schoolId ? `s:${schoolCtx.schoolId}` : null
    return u.schoolId ? `u:${u.id}:${u.schoolId}` : null
  })

  function isEnabled(feature: FeatureKey): boolean {
    if (feature === 'exams') return examsEnabled.value
    if (feature === 'teacherQuizzes') return examsEnabled.value && teacherQuizzes.value
    return false
  }

  async function load(): Promise<void> {
    const key = contextKey.value
    if (!key) {
      examsEnabled.value = false
      loadedKey.value = null
      return
    }
    if (loadedKey.value === key) return
    if (pending && pendingKey === key) return pending
    pendingKey = key
    const run = (async () => {
      try {
        const schoolId = auth.user?.role === 'superadmin' ? schoolCtx.schoolId : null
        const res = await settingsApi.get('exams', schoolId ?? undefined)
        if (contextKey.value !== key) return // maktab almashgan: eskirgan javob
        examsEnabled.value = res.effective.enabled === true
        teacherQuizzes.value = res.effective.teachersCanCreateQuizzes === true
        loadedKey.value = key
      } catch {
        if (contextKey.value === key) {
          examsEnabled.value = false
          teacherQuizzes.value = false
          loadedKey.value = null
        }
      }
    })()
    pending = run
    try {
      await run
    } finally {
      if (pending === run) pending = null
    }
  }

  /** Sozlama o'zgargandan keyin (Sozlamalar > Imtihon) majburan qayta yuklash */
  async function refresh(): Promise<void> {
    loadedKey.value = null
    await load()
  }

  function reset() {
    examsEnabled.value = false
    teacherQuizzes.value = false
    loadedKey.value = null
  }

  // Foydalanuvchi yoki maktab almashsa: avval o'chiramiz (eski maktab menyusi qolmasin), keyin yuklaymiz
  watch(
    contextKey,
    (key) => {
      examsEnabled.value = false
      teacherQuizzes.value = false
      loadedKey.value = null
      if (key) void load()
    },
    { immediate: true },
  )

  return { examsEnabled, teacherQuizzes, isEnabled, load, refresh, reset }
})
