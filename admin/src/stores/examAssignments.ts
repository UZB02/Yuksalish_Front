import { ref } from 'vue'
import { defineStore } from 'pinia'
import { examsApi } from '@/api/exams.api'
import type { MyBlockItem } from '@/api/types'

/**
 * Menga biriktirilgan imtihon fanlari (o'qituvchi): yon menyu nishoni va boshqaruv paneli kartochkasi uchun.
 * "Ochiq vazifa" = qulflanmagan va "Tugatdim" (tayyor) belgisi qo'yilmagan.
 * Modul o'chiq (403) yoki xato bo'lsa jim: nishon ko'rinmaydi.
 */
export const isPending = (b: Pick<MyBlockItem, 'locked' | 'blockStatus'>) =>
  !b.locked && b.blockStatus !== 'ready'

export const useExamAssignmentsStore = defineStore('examAssignments', () => {
  const items = ref<MyBlockItem[]>([])
  const pending = ref(0)
  const loaded = ref(false)

  async function refresh() {
    try {
      items.value = await examsApi.myBlocks()
      pending.value = items.value.filter(isPending).length
    } catch {
      items.value = []
      pending.value = 0
    } finally {
      loaded.value = true
    }
  }
  return { items, pending, loaded, refresh }
})
