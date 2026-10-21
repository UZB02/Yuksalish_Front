<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClipboardCheck, Users } from 'lucide-vue-next'
import { classesApi } from '@/api/classes.api'
import { scoresApi } from '@/api/scores.api'
import type { SchoolClass, TodayProgress } from '@/api/types'
import ProgressBar from '@/components/scoring/ProgressBar.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'

// "Xulq bahosi" rejimi: mavjud xulq (0-100) baholash oqimiga kirish. O'qituvchi faqat o'zi sinf rahbari
// bo'lgan sinflarda baholay oladi (backend ham shuni majburlaydi); admin barcha sinflarni ko'radi.
const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const classes = ref<SchoolClass[]>([])
const progress = ref<Map<string, TodayProgress>>(new Map())

const isTeacher = computed(() => auth.user?.role === 'teacher')
const items = computed(() =>
  isTeacher.value
    ? classes.value.filter((c) => c.homeroomTeacherId === auth.user?.id)
    : classes.value,
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    classes.value = (await classesApi.list({ limit: 100 })).items
    scoresApi
      .todayProgress()
      .then((list) => (progress.value = new Map(list.map((p) => [p.classId, p]))))
      .catch(() => undefined)
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <Skeleton v-for="n in 3" :key="n" class="h-32 w-full" />
  </div>

  <div v-else-if="error" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else-if="items.length === 0" class="card" data-testid="conduct-not-homeroom">
    <EmptyState
      :icon="ClipboardCheck"
      :title="isTeacher ? t('grading.conduct.notHomeroomTitle') : t('myClasses.emptyTitle')"
      :description="isTeacher ? t('grading.conduct.notHomeroomText') : t('myClasses.emptyText')"
    />
  </div>

  <template v-else>
    <p v-if="isTeacher" class="mb-3 text-sm text-fg-muted">{{ t('grading.conduct.hint') }}</p>
    <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="c in items" :key="c.id" class="card flex flex-col p-5">
        <div class="flex items-start justify-between gap-2">
          <h2 class="text-lg font-semibold text-fg">{{ c.name }}</h2>
          <BaseBadge tone="primary">
            <Users class="h-3 w-3" aria-hidden="true" /> {{ c.studentsCount }}
          </BaseBadge>
        </div>
        <ProgressBar
          v-if="progress.get(c.id)"
          class="mt-3"
          :done="progress.get(c.id)!.scored"
          :total="progress.get(c.id)!.total"
        />
        <RouterLink
          :to="{ name: 'class-scoring', params: { id: c.id } }"
          class="mt-4 block"
          data-testid="conduct-link"
        >
          <BaseButton class="w-full" size="sm">
            <ClipboardCheck class="h-4 w-4" /> {{ t('classes.gradeAction') }}
          </BaseButton>
        </RouterLink>
      </li>
    </ul>
  </template>
</template>
