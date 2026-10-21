<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ratingsApi } from '@/api/ratings.api'
import type { ClassRatingItem, StudentRatingItem } from '@/api/types'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useSchoolContextStore } from '@/stores/school-context'
import RankBadge from './RankBadge.vue'

const { t } = useI18n()
const schoolCtx = useSchoolContextStore()

const students = ref<StudentRatingItem[]>([])
const classes = ref<ClassRatingItem[]>([])
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [s, c] = await Promise.all([ratingsApi.students({ limit: 5 }), ratingsApi.classes()])
    students.value = s.items.filter((i) => i.eligible).slice(0, 5)
    classes.value = c.items.slice(0, 3)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => schoolCtx.schoolId, load)
</script>

<template>
  <section v-if="!failed" class="mt-6 grid gap-4 lg:grid-cols-2" data-testid="top-ratings">
    <div class="card p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-fg">{{ t('ratings.top.students') }}</h2>
        <RouterLink :to="{ name: 'ratings' }" class="text-sm text-primary-700 hover:underline">
          {{ t('ratings.top.all') }}
        </RouterLink>
      </div>
      <Skeleton v-if="loading" class="h-32 w-full" />
      <p v-else-if="students.length === 0" class="py-4 text-sm text-fg-muted">
        {{ t('ratings.emptyText') }}
      </p>
      <ol v-else class="divide-y divide-border">
        <li v-for="s in students" :key="s.studentId" class="flex items-center gap-2 py-2 text-sm">
          <RankBadge :rank="s.rank" />
          <RouterLink
            :to="{ name: 'student-profile', params: { id: s.studentId } }"
            class="flex-1 truncate text-fg hover:underline"
          >
            {{ s.fullName }}
            <span class="text-xs text-fg-muted">{{ s.className }}</span>
          </RouterLink>
          <b class="text-fg">{{ s.score }}</b>
        </li>
      </ol>
    </div>

    <div class="card p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-fg">{{ t('ratings.top.classes') }}</h2>
        <RouterLink :to="{ name: 'ratings' }" class="text-sm text-primary-700 hover:underline">
          {{ t('ratings.top.all') }}
        </RouterLink>
      </div>
      <Skeleton v-if="loading" class="h-32 w-full" />
      <p v-else-if="classes.length === 0" class="py-4 text-sm text-fg-muted">
        {{ t('ratings.emptyText') }}
      </p>
      <ol v-else class="divide-y divide-border">
        <li v-for="c in classes" :key="c.classId" class="flex items-center gap-2 py-2 text-sm">
          <RankBadge :rank="c.rank" />
          <span class="flex-1 truncate text-fg">{{ c.className }}</span>
          <b class="text-fg">{{ c.score }}</b>
        </li>
      </ol>
    </div>
  </section>
</template>
