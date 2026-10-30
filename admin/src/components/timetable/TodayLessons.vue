<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarClock } from 'lucide-vue-next'
import { timetableApi } from '@/api/timetable.api'
import type { MyTodayLessons, TodayAttendanceStatus, TodayLesson } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import OverrideTypeBadge from './OverrideTypeBadge.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth'

/**
 * "Bugungi darslarim": o'qituvchining bugungi darslari (jadvaldan), davomat holati bilan.
 * Dashboard va "Mening sinflarim" sahifasi tepasida. Jadval yo'q / xato bo'lsa jim qoladi
 * (faqat bo'sh holat matni), sahifaning qolgan qismiga ta'sir qilmaydi.
 */
const { t } = useI18n()
const auth = useAuthStore()

const data = ref<MyTodayLessons | null>(null)
const loading = ref(true)
const failed = ref(false)

const canAttend = computed(
  () =>
    auth.hasPermission(PERMISSIONS.ATTENDANCE_TAKE) ||
    auth.hasPermission(PERMISSIONS.ATTENDANCE_EDIT),
)
const canGrade = computed(
  () =>
    auth.hasPermission(PERMISSIONS.GRADES_CREATE) || auth.hasPermission(PERMISSIONS.GRADES_EDIT),
)

const TONES: Record<TodayAttendanceStatus, 'success' | 'warning' | 'neutral'> = {
  taken: 'success',
  partial: 'warning',
  none: 'neutral',
}

const attendanceTo = (l: TodayLesson) => ({
  name: 'class-attendance',
  params: { id: l.classId },
  query: { date: l.date, lessonNo: String(l.lessonNo) },
})
const gradeTo = (l: TodayLesson) => ({
  name: 'grading',
  query: {
    classId: l.classId,
    subjectId: l.subjectId,
    date: l.date,
    lessonNo: String(l.lessonNo),
  },
})

onMounted(async () => {
  try {
    data.value = await timetableApi.myToday()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section
    v-if="!failed"
    class="card mb-6 p-4 sm:p-6"
    data-testid="today-lessons"
    :aria-label="t('todayLessons.title')"
  >
    <h2 class="mb-3 flex items-center gap-2 text-base font-semibold text-fg">
      <CalendarClock class="h-5 w-5 text-primary-600" aria-hidden="true" />
      {{ t('todayLessons.title') }}
    </h2>

    <div v-if="loading" class="space-y-2">
      <Skeleton v-for="n in 2" :key="n" class="h-16 w-full" />
    </div>

    <p
      v-else-if="data && !data.hasTimetable"
      class="py-4 text-center text-sm text-fg-muted"
      data-testid="today-no-timetable"
    >
      {{ t('todayLessons.noTimetable') }}
    </p>
    <p
      v-else-if="data && !data.working"
      class="py-4 text-center text-sm text-fg-muted"
      data-testid="today-not-working"
    >
      {{ t('todayLessons.notWorking') }}
    </p>
    <p
      v-else-if="!data || data.lessons.length === 0"
      class="py-4 text-center text-sm text-fg-muted"
      data-testid="today-empty"
    >
      {{ t('todayLessons.emptyToday') }}
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="l in data.lessons"
        :key="`${l.classId}-${l.lessonNo}`"
        class="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center"
        :class="l.cancelled ? 'opacity-60' : ''"
        data-testid="today-lesson"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-base font-semibold text-primary-700"
            :title="t('todayLessons.lessonNo', { n: l.lessonNo })"
            data-testid="lesson-no"
          >
            {{ l.lessonNo }}
          </span>
          <div class="min-w-0">
            <p
              class="truncate text-sm font-medium text-fg"
              :class="l.cancelled ? 'line-through' : ''"
            >
              {{ l.class.name }} · {{ l.subject.name }}
            </p>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <BaseBadge v-if="l.substitute" tone="info" data-testid="substitute-badge">
                {{ t('todayLessons.substitute') }}
              </BaseBadge>
              <OverrideTypeBadge
                v-if="l.overrideType === 'replace' || l.overrideType === 'extra'"
                :type="l.overrideType"
                data-testid="override-badge"
              />
              <BaseBadge v-if="l.cancelled" tone="danger">
                {{ t('todayLessons.cancelled') }}
              </BaseBadge>
              <BaseBadge v-else :tone="TONES[l.status]" data-testid="lesson-status">
                {{ t(`todayLessons.status.${l.status}`) }}
                <template v-if="l.status === 'partial'">
                  ·
                  {{ t('todayLessons.marked', { done: l.markedStudents, total: l.totalStudents }) }}
                </template>
              </BaseBadge>
            </div>
          </div>
        </div>
        <div v-if="!l.cancelled" class="flex shrink-0 gap-2">
          <RouterLink
            v-if="canAttend"
            :to="attendanceTo(l)"
            class="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-muted sm:flex-none"
            data-testid="lesson-attendance"
          >
            {{ t('todayLessons.attendance') }}
          </RouterLink>
          <RouterLink
            v-if="canGrade"
            :to="gradeTo(l)"
            class="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-muted sm:flex-none"
            data-testid="lesson-grade"
          >
            {{ t('todayLessons.grade') }}
          </RouterLink>
        </div>
      </li>
    </ul>
  </section>
</template>
