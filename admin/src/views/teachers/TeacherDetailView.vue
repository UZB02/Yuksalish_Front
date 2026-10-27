<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, BookOpen, Layers, Pencil, ShieldCheck, Users } from 'lucide-vue-next'
import { teachersApi } from '@/api/teachers.api'
import type { Teacher } from '@/api/types'
import LastLogin from '@/components/domain/LastLogin.vue'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import TeacherActionsMenu from '@/components/domain/TeacherActionsMenu.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useTeacherActions } from '@/composables/useTeacherActions'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { buildWorkload } from '@/utils/teacherWorkload'
import TeacherActionModals from './TeacherActionModals.vue'

const { t, te } = useI18n()
const route = useRoute()
const schoolCtx = useSchoolContextStore()
const needsSchool = useNeedsSchool()

const teacher = ref<Teacher | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  if (needsSchool.value) return
  loading.value = teacher.value === null
  error.value = ''
  try {
    teacher.value = await teachersApi.get(String(route.params.id))
  } catch (e) {
    teacher.value = null
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

const actions = useTeacherActions(load)

onMounted(load)
watch([() => route.params.id, () => schoolCtx.schoolId], load)

const workload = computed(() => (teacher.value ? buildWorkload(teacher.value) : null))
const kpis = computed(() => [
  { key: 'classes', icon: Layers, value: workload.value?.classesTotal ?? 0 },
  { key: 'subjects', icon: BookOpen, value: workload.value?.subjects.length ?? 0 },
  { key: 'homeroom', icon: Users, value: workload.value?.homeroom.length ?? 0 },
])
const isEmpty = computed(
  () =>
    !!workload.value &&
    workload.value.subjects.length === 0 &&
    workload.value.homeroom.length === 0 &&
    workload.value.noSubject.length === 0,
)

function permissionLabel(key: string): string {
  const k = `permissions.items.${key.replace(/\./g, '_')}`
  return te(k) ? t(k) : key
}
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <header class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
      <RouterLink
        :to="{ name: 'teachers' }"
        class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('teachers.back') }}
      </RouterLink>

      <Skeleton v-if="loading" class="h-12 w-full max-w-md" data-testid="detail-skeleton" />
      <template v-else-if="teacher">
        <span class="hidden h-10 w-px shrink-0 bg-border lg:block" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 items-center gap-3" data-testid="teacher-header">
          <AvatarImage :name="teacher.fullName" :src="teacher.photo" size="lg" />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 class="min-w-0 break-words text-xl font-semibold text-fg sm:text-2xl">
                {{ teacher.fullName }}
              </h1>
              <BaseBadge :tone="teacher.isActive ? 'success' : 'neutral'">
                {{ teacher.isActive ? t('common.active') : t('common.inactive') }}
              </BaseBadge>
            </div>
            <p
              class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted"
              data-testid="teacher-meta"
            >
              <span>{{ teacher.username }}</span>
              <template v-if="teacher.phone">
                <span aria-hidden="true">&middot;</span>
                <span>{{ teacher.phone }}</span>
              </template>
              <span aria-hidden="true">&middot;</span>
              <span class="inline-flex items-center gap-1">
                {{ t('common.lastLogin') }}: <LastLogin :value="teacher.lastLoginAt" />
              </span>
            </p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1 lg:justify-end">
          <BaseButton
            variant="secondary"
            size="sm"
            data-testid="detail-edit"
            @click="actions.openEdit(teacher)"
          >
            <Pencil class="h-4 w-4" /> {{ t('common.edit') }}
          </BaseButton>
          <TeacherActionsMenu
            :teacher="teacher"
            @classes="actions.openClasses"
            @permissions="actions.openPermissions"
            @reset="actions.openReset"
            @toggle="actions.toggleActive"
          />
        </div>
      </template>
    </header>

    <div v-if="error" class="card">
      <EmptyState :title="t('teachers.loadFailed')" :description="error">
        <BaseButton variant="secondary" @click="load()">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>

    <div v-else-if="loading" class="grid gap-4 sm:grid-cols-3">
      <Skeleton v-for="n in 3" :key="n" class="h-20" />
    </div>

    <template v-else-if="teacher && workload">
      <div class="mb-4 grid grid-cols-3 gap-3" data-testid="teacher-kpis">
        <div v-for="k in kpis" :key="k.key" class="card flex items-center gap-3 p-3 sm:p-4">
          <span
            class="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 sm:flex"
          >
            <component :is="k.icon" class="h-5 w-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <p class="text-xl font-semibold text-fg sm:text-2xl" :data-testid="`kpi-${k.key}`">
              {{ k.value }}
            </p>
            <p class="truncate text-xs text-fg-muted">{{ t(`teachers.kpi.${k.key}`) }}</p>
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <section class="card p-4 lg:col-span-2" data-testid="teacher-breakdown">
          <h2 class="mb-3 text-base font-semibold text-fg">{{ t('teachers.breakdown') }}</h2>
          <p v-if="isEmpty" class="text-sm text-fg-muted">{{ t('teachers.breakdownEmpty') }}</p>
          <div v-else class="space-y-4">
            <div v-for="s in workload.subjects" :key="s.subjectId" data-testid="breakdown-subject">
              <p class="text-sm font-medium text-fg">
                {{ s.subjectName }}
                <span class="font-normal text-fg-muted">
                  · {{ t('teachers.classesCount', { n: s.classes.length }) }}
                </span>
              </p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <RouterLink
                  v-for="c in s.classes"
                  :key="c.id"
                  :to="{ name: 'class-detail', params: { id: c.id } }"
                  class="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 hover:underline dark:bg-sky-500/15 dark:text-sky-300"
                >
                  {{ c.name }}
                </RouterLink>
              </div>
            </div>
            <div v-if="workload.homeroom.length > 0" data-testid="breakdown-homeroom">
              <p class="text-sm font-medium text-fg">{{ t('teachers.homeroomClasses') }}</p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <RouterLink
                  v-for="c in workload.homeroom"
                  :key="c.id"
                  :to="{ name: 'class-detail', params: { id: c.id } }"
                  class="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success hover:underline"
                >
                  {{ c.name }}
                </RouterLink>
              </div>
            </div>
            <div v-if="workload.noSubject.length > 0" data-testid="breakdown-nosubject">
              <p class="text-sm font-medium text-fg">{{ t('teachers.noSubjectClasses') }}</p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <RouterLink
                  v-for="c in workload.noSubject"
                  :key="c.id"
                  :to="{ name: 'class-detail', params: { id: c.id } }"
                  class="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-fg-muted hover:underline"
                >
                  {{ c.name }}
                </RouterLink>
              </div>
            </div>
          </div>
        </section>

        <section class="card p-4" data-testid="teacher-permissions">
          <h2 class="mb-1 flex items-center gap-2 text-base font-semibold text-fg">
            <ShieldCheck class="h-4 w-4 text-primary-700" aria-hidden="true" />
            {{ t('teachers.permissionsSummary') }}
          </h2>
          <p class="mb-3 text-xs text-fg-muted">
            {{ t('teachers.permissionsCount', { n: teacher.permissions.length }) }}
          </p>
          <p v-if="teacher.permissions.length === 0" class="text-sm text-fg-muted">
            {{ t('teachers.permissionsEmpty') }}
          </p>
          <ul v-else class="flex flex-wrap gap-1.5">
            <li
              v-for="p in teacher.permissions"
              :key="p"
              class="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-fg"
            >
              {{ permissionLabel(p) }}
            </li>
          </ul>
        </section>
      </div>
    </template>

    <TeacherActionModals :actions="actions" />
  </template>
</template>
