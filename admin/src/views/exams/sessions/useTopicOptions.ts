import { ref } from 'vue'
import { examsApi } from '@/api/exams.api'

export interface TopicOption {
  id: string
  subjectId: string
  /** "Fan / Mavzu" */
  label: string
  questionsCount: number
}

/**
 * Foydalanuvchiga ko'rinadigan barcha mavzular (fan bo'yicha). Imtihon tuzishda qoida va qo'lda tanlash uchun.
 * Fan berilsa faqat shu fan mavzulari qoladi.
 */
export function useTopicOptions() {
  const topics = ref<TopicOption[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const subs = await examsApi.subjects()
      const all = await Promise.all(
        subs.subjects.map(async (s) => {
          const r = await examsApi.listTopics(s.id)
          return r.topics.map<TopicOption>((x) => ({
            id: x.id,
            subjectId: s.id,
            label: `${s.name} / ${x.name}`,
            questionsCount: x.questionsCount,
          }))
        }),
      )
      topics.value = all.flat()
    } finally {
      loading.value = false
    }
  }
  return { topics, loading, load }
}
