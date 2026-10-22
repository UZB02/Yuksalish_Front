<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, CalendarRange } from 'lucide-vue-next'
import { classesApi } from '@/api/classes.api'
import type { SchoolClass } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useClassForm } from '@/composables/useClassForm'
import { useConfirm } from '@/composables/useConfirm'
import { useAcademicYearLookup, useTeacherLookup } from '@/composables/useLookups'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import ClassForm from './ClassForm.vue'

/** Ikki marshrut uchun bitta sahifa: `class-create` (yangi) va `class-edit` (tahrirlash). */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()
const years = useAcademicYearLookup()
const teachers = useTeacherLookup()

const classId = computed(() => (route.name === 'class-edit' ? String(route.params.id) : null))
const schoolClass = ref<SchoolClass | null>(null)
const loading = ref(true)
const error = ref('')
const ready = ref(false)
const form = useClassForm(schoolClass, years.items)
/** Muvaffaqiyatli saqlangandan (yoki maktab almashgandan) keyin chiqish ogohlantirilmaydi. */
let skipLeaveGuard = false

const noActiveYear = computed(
  () => !classId.value && years.loaded.value && !years.failed.value && !years.activeYear.value,
)
/** Tahrirlash tafsilot sahifasidan ochilgan bo'lsa (?from=detail) - o'sha yerga, aks holda ro'yxatga. */
const backTo = computed(() =>
  classId.value && route.query.from === 'detail'
    ? { name: 'class-detail', params: { id: classId.value } }
    : { name: 'classes' },
)
/** Forma ko'rsatiladigan holat (sarlavha ham faqat shunda chiqadi) */
const showForm = computed(
  () => ready.value && !needsSchool.value && !error.value && !noActiveYear.value,
)
const title = computed(() =>
  classId.value
    ? t('classes.editNamed', { name: schoolClass.value?.name ?? '' })
    : t('classes.add'),
)

async function load() {
  ready.value = false
  error.value = ''
  schoolClass.value = null
  if (needsSchool.value) {
    loading.value = false
    return
  }
  loading.value = true
  void teachers.load()
  try {
    const [, c] = await Promise.all([
      years.load(),
      classId.value ? classesApi.get(classId.value) : Promise.resolve(null),
    ])
    schoolClass.value = c
    form.init()
    ready.value = true
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  const saved = await form.submit()
  if (!saved) return
  skipLeaveGuard = true
  await router.push({ name: 'class-detail', params: { id: saved.id } })
}

onBeforeRouteLeave(async () => {
  if (skipLeaveGuard || !form.dirty) return true
  return confirm({
    title: t('scoring.unsaved.title'),
    message: t('classes.unsavedLeaveText'),
    confirmText: t('scoring.unsaved.leave'),
    variant: 'danger',
  })
})
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (!skipLeaveGuard && form.dirty) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void load()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
// Maktab almashsa sinf boshqa maktabga tegishli bo'lib qoladi: ro'yxatga qaytamiz.
watch(
  () => schoolCtx.schoolId,
  () => {
    skipLeaveGuard = true
    void router.replace({ name: 'classes' })
  },
)
</script>

<template>
  <!-- Keng ekranda: orqaga tugmasi | sarlavha va izoh bitta qatorda; kichik ekranda ustma-ust -->
  <header
    class="mb-6 flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-5"
    data-testid="class-form-header"
  >
    <RouterLink
      :to="backTo"
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('classes.back') }}
    </RouterLink>
    <template v-if="showForm">
      <span class="hidden h-10 w-px shrink-0 bg-border lg:block" aria-hidden="true" />
      <div class="min-w-0">
        <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl">{{ title }}</h1>
        <p class="mt-0.5 text-sm text-fg-muted">{{ t('classes.formSubtitle') }}</p>
      </div>
    </template>
  </header>

  <NeedsSchool v-if="needsSchool" />

  <div v-else-if="loading" class="max-w-6xl space-y-4" data-testid="class-form-skeleton">
    <Skeleton class="h-8 w-64" />
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <Skeleton class="h-48 w-full" />
        <Skeleton class="h-64 w-full" />
      </div>
      <div class="space-y-6">
        <Skeleton class="h-36 w-full" />
        <Skeleton class="h-56 w-full" />
      </div>
    </div>
  </div>

  <div v-else-if="error" class="card max-w-6xl">
    <EmptyState :title="t('classes.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load()">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else-if="noActiveYear" class="card max-w-6xl">
    <EmptyState
      :icon="CalendarRange"
      :title="t('classes.noActiveYearTitle')"
      :description="t('classes.noActiveYearText')"
    >
      <RouterLink :to="{ name: 'academic-years' }">
        <BaseButton>{{ t('classes.toYears') }}</BaseButton>
      </RouterLink>
    </EmptyState>
  </div>

  <div v-else-if="ready" class="max-w-6xl">
    <ClassForm
      :state="form"
      :years="years.items.value"
      :teachers="teachers.items.value"
      :school-class="schoolClass"
      @submit="onSubmit"
    >
      <!-- Keng ekranda tugmalar xulosa kartasida (yopishqoq ustunda) -->
      <template #actions>
        <RouterLink :to="backTo" class="flex-1">
          <BaseButton variant="secondary" class="w-full">{{ t('common.cancel') }}</BaseButton>
        </RouterLink>
        <BaseButton type="submit" class="flex-1" :loading="form.submitting">
          {{ t('common.save') }}
        </BaseButton>
      </template>
    </ClassForm>
    <!-- Kichik ekranda tugmalar pastki yopishqoq panelda -->
    <div
      class="sticky bottom-0 z-10 -mx-4 mt-6 flex gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden"
      data-testid="class-form-actions-mobile"
    >
      <RouterLink :to="backTo" class="shrink-0">
        <BaseButton variant="secondary" class="whitespace-nowrap">
          {{ t('common.cancel') }}
        </BaseButton>
      </RouterLink>
      <BaseButton
        type="submit"
        form="class-form"
        class="flex-1 whitespace-nowrap"
        :loading="form.submitting"
      >
        {{ t('common.save') }}
      </BaseButton>
    </div>
  </div>
</template>
