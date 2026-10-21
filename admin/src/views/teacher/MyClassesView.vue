<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { BookOpenCheck, CalendarCheck, ClipboardCheck, Users } from 'lucide-vue-next'
import { attendanceApi } from '@/api/attendance.api'
import { classesApi } from '@/api/classes.api'
import { scoresApi } from '@/api/scores.api'
import type { AttendanceProgress, SchoolClass, TodayProgress } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ProgressBar from '@/components/scoring/ProgressBar.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const needsSchool = useNeedsSchool()

// Bir xil ko'rinish uch marshrutda: o'qituvchi (/my-classes), baholash uchun sinf tanlash (/scoring)
// va davomat uchun sinf tanlash (/attendance).
const mode = computed<'mine' | 'scoring' | 'attendance'>(() =>
  route.name === 'scoring' ? 'scoring' : route.name === 'attendance' ? 'attendance' : 'mine',
)
const canScore = computed(
  () =>
    auth.hasPermission(PERMISSIONS.SCORES_CREATE) || auth.hasPermission(PERMISSIONS.SCORES_EDIT),
)

const canAttend = computed(
  () =>
    auth.hasPermission(PERMISSIONS.ATTENDANCE_TAKE) ||
    auth.hasPermission(PERMISSIONS.ATTENDANCE_EDIT),
)
const showScoring = computed(() => mode.value !== 'attendance' && canScore.value)
const showAttendance = computed(() => mode.value !== 'scoring' && canAttend.value)
const attendanceProgress = ref<Map<string, AttendanceProgress>>(new Map())

const items = ref<SchoolClass[]>([])
const progress = ref<Map<string, TodayProgress>>(new Map())
const loading = ref(true)
const error = ref('')

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    items.value = (await classesApi.list({ limit: 100 })).items
    // Progress ixtiyoriy: xato bo'lsa kartalar baribir ko'rinadi.
    if (showScoring.value) {
      scoresApi
        .todayProgress()
        .then((list) => (progress.value = new Map(list.map((p) => [p.classId, p]))))
        .catch(() => undefined)
    }
    if (showAttendance.value) {
      attendanceApi
        .todayProgress()
        .then((list) => (attendanceProgress.value = new Map(list.map((p) => [p.classId, p]))))
        .catch(() => undefined)
    }
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <PageHeader
    :title="
      mode === 'scoring'
        ? t('scoring.pickTitle')
        : mode === 'attendance'
          ? t('attendance.pickTitle')
          : t('myClasses.title')
    "
    :description="
      mode === 'scoring'
        ? t('scoring.pickDescription')
        : mode === 'attendance'
          ? t('attendance.pickDescription')
          : t('myClasses.description')
    "
  />

  <NeedsSchool v-if="needsSchool" />

  <div v-else-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <Skeleton v-for="n in 3" :key="n" class="h-40 w-full" />
  </div>

  <div v-else-if="error" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else-if="items.length === 0" class="card">
    <EmptyState
      :icon="BookOpenCheck"
      :title="t('myClasses.emptyTitle')"
      :description="t('myClasses.emptyText')"
    />
  </div>

  <ul v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <li v-for="c in items" :key="c.id" class="card flex flex-col p-5">
      <RouterLink
        :to="{ name: 'class-detail', params: { id: c.id } }"
        class="group flex-1 rounded-lg"
      >
        <div class="flex items-start justify-between gap-2">
          <h2 class="text-lg font-semibold text-fg group-hover:text-primary-700">{{ c.name }}</h2>
          <BaseBadge tone="primary">
            <Users class="h-3 w-3" aria-hidden="true" /> {{ c.studentsCount }}
          </BaseBadge>
        </div>
        <p class="mt-1 text-sm text-fg-muted">
          {{ t('classes.homeroom') }}: {{ c.homeroomTeacher?.fullName ?? '-' }}
        </p>
      </RouterLink>
      <ProgressBar
        v-if="showScoring && progress.get(c.id)"
        class="mt-3"
        :done="progress.get(c.id)!.scored"
        :total="progress.get(c.id)!.total"
      />
      <div
        v-if="showAttendance && attendanceProgress.get(c.id)"
        class="mt-3"
        data-testid="att-progress"
      >
        <ProgressBar
          label-key="attendance.progress"
          :done="attendanceProgress.get(c.id)!.markedStudents"
          :total="attendanceProgress.get(c.id)!.totalStudents"
        />
        <BaseBadge
          v-if="attendanceProgress.get(c.id)!.markedUnits === 0"
          tone="warning"
          class="mt-1.5"
          data-testid="att-unmarked"
        >
          {{ t('attendance.notTakenToday') }}
        </BaseBadge>
      </div>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        <RouterLink
          v-if="showScoring"
          :to="{ name: 'class-scoring', params: { id: c.id } }"
          class="block flex-1"
        >
          <BaseButton class="w-full" size="sm">
            <ClipboardCheck class="h-4 w-4" /> {{ t('classes.gradeAction') }}
          </BaseButton>
        </RouterLink>
        <RouterLink
          v-if="showAttendance"
          :to="{ name: 'class-attendance', params: { id: c.id } }"
          class="block flex-1"
        >
          <BaseButton class="w-full" size="sm" :variant="showScoring ? 'secondary' : 'primary'">
            <CalendarCheck class="h-4 w-4" /> {{ t('attendance.action') }}
          </BaseButton>
        </RouterLink>
      </div>
    </li>
  </ul>
</template>
