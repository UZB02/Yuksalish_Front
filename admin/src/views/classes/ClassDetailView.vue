<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, CalendarCheck, ClipboardCheck, FileBarChart, UserPlus } from 'lucide-vue-next'
import { classesApi } from '@/api/classes.api'
import type { SchoolClass } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useTeacherLookup } from '@/composables/useLookups'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import StudentsPanel from '../students/StudentsPanel.vue'
import ClassTeachersModal from './ClassTeachersModal.vue'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const teachers = useTeacherLookup()

const schoolClass = ref<SchoolClass | null>(null)
const loading = ref(true)
const error = ref('')
const assignOpen = ref(false)

const classId = computed(() => String(route.params.id))
const canManage = computed(() => auth.hasPermission(PERMISSIONS.CLASSES_MANAGE))
const backTo = computed(() => ({ name: auth.role === 'teacher' ? 'my-classes' : 'classes' }))

/** silent: sarlavha ma'lumotlarini skeletonsiz yangilash (ochiq modallar yopilib ketmasligi uchun). */
async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    schoolClass.value = await classesApi.get(classId.value)
  } catch (e) {
    if (!silent) {
      schoolClass.value = null
      error.value = errorMessage(e, t)
    }
  } finally {
    loading.value = false
  }
}

async function openAssign() {
  assignOpen.value = true
  if (teachers.items.value.length === 0) await teachers.load()
}

onMounted(() => load())
watch(classId, () => load())
</script>

<template>
  <RouterLink
    :to="backTo"
    class="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
  >
    <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('classes.back') }}
  </RouterLink>

  <div v-if="loading" class="space-y-3">
    <Skeleton class="h-8 w-48" />
    <Skeleton class="h-4 w-80" />
    <Skeleton class="mt-6 h-64 w-full" />
  </div>

  <div v-else-if="error || !schoolClass" class="card">
    <EmptyState :title="t('classes.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load()">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <template v-else>
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-semibold text-fg sm:text-2xl">{{ schoolClass.name }}</h1>
          <BaseBadge v-if="schoolClass.isArchived" tone="warning">
            {{ t('classes.archived') }}
          </BaseBadge>
        </div>
        <dl class="mt-2 space-y-1 text-sm">
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-fg-muted">{{ t('classes.homeroom') }}:</dt>
            <dd class="text-fg">
              {{ schoolClass.homeroomTeacher?.fullName ?? t('classes.noHomeroom') }}
            </dd>
          </div>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <dt class="text-fg-muted">{{ t('classes.teachers') }}:</dt>
            <dd class="flex flex-wrap gap-1">
              <BaseBadge v-for="tc in schoolClass.teachers" :key="tc.id">{{
                tc.fullName
              }}</BaseBadge>
              <span v-if="schoolClass.teachers.length === 0" class="text-fg">-</span>
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-fg-muted">{{ t('classes.students') }}:</dt>
            <dd class="text-fg">{{ schoolClass.studentsCount }}</dd>
          </div>
        </dl>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-if="
            (auth.hasPermission(PERMISSIONS.SCORES_CREATE) ||
              auth.hasPermission(PERMISSIONS.SCORES_EDIT)) &&
            !schoolClass.isArchived
          "
          :to="{ name: 'class-scoring', params: { id: schoolClass.id } }"
        >
          <BaseButton>
            <ClipboardCheck class="h-4 w-4" /> {{ t('classes.gradeAction') }}
          </BaseButton>
        </RouterLink>
        <RouterLink
          v-if="
            (auth.hasPermission(PERMISSIONS.ATTENDANCE_TAKE) ||
              auth.hasPermission(PERMISSIONS.ATTENDANCE_EDIT)) &&
            !schoolClass.isArchived
          "
          :to="{ name: 'class-attendance', params: { id: schoolClass.id } }"
        >
          <BaseButton variant="secondary">
            <CalendarCheck class="h-4 w-4" /> {{ t('attendance.action') }}
          </BaseButton>
        </RouterLink>
        <RouterLink
          v-if="auth.hasPermission(PERMISSIONS.REPORTS_VIEW)"
          :to="{ name: 'reports', query: { tab: 'class', classId: schoolClass.id } }"
          data-testid="class-report-link"
        >
          <BaseButton variant="secondary">
            <FileBarChart class="h-4 w-4" /> {{ t('classes.classReport') }}
          </BaseButton>
        </RouterLink>
        <BaseButton v-if="canManage" @click="openAssign">
          <UserPlus class="h-4 w-4" /> {{ t('classes.assignTeachers') }}
        </BaseButton>
      </div>
    </header>

    <StudentsPanel
      :class-id="schoolClass.id"
      :class-name="schoolClass.name"
      @changed="load(true)"
    />

    <ClassTeachersModal
      v-if="canManage"
      :open="assignOpen"
      :school-class="schoolClass"
      :teachers="teachers.items.value"
      :loading="teachers.loading.value"
      @close="assignOpen = false"
      @saved="load(true)"
    />
  </template>
</template>
