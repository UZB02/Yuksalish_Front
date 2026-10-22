<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpenCheck, Info, UserCheck } from 'lucide-vue-next'
import type { AcademicYear, SchoolClass, Teacher } from '@/api/types'
import SubjectAssignmentsEditor from '@/components/domain/SubjectAssignmentsEditor.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import type { ClassFormState } from '@/composables/useClassForm'

/**
 * Sinf formasi. Keng ekranda ikki ustun: chapda asosiy ma'lumotlar va fanlar,
 * o'ngda (yopishqoq) sinf rahbari va xulosa + `actions` slotidagi tugmalar.
 */
const props = defineProps<{
  state: ClassFormState
  years: AcademicYear[]
  teachers: Teacher[]
  /** Tahrirlashda: o'quvchilar soni va holat xulosada ko'rsatiladi */
  schoolClass?: SchoolClass | null
}>()
defineEmits<{ submit: [] }>()

const { t } = useI18n()
// reactive obyekt: maydonlar v-model orqali o'zgartiriladi (prop emas, shu sababli alias).
const form = props.state

const gradeOptions = Array.from({ length: 11 }, (_, i) => ({
  value: String(i + 1),
  label: t('classes.gradeLabel', { n: i + 1 }),
}))
const yearOptions = computed(() => props.years.map((y) => ({ value: y.id, label: y.name })))
const teacherOptions = computed(() =>
  props.teachers.map((tc) => ({ value: tc.id, label: tc.fullName })),
)

const yearName = computed(() => props.years.find((y) => y.id === form.academicYearId)?.name ?? '—')
const homeroomName = computed(
  () => props.teachers.find((tc) => tc.id === form.homeroomTeacherId)?.fullName ?? null,
)
const subjectsCount = computed(() => form.subjectRows.filter((r) => r.subjectId).length)
</script>

<template>
  <form
    id="class-form"
    class="grid items-start gap-6 lg:grid-cols-3"
    novalidate
    @submit.prevent="$emit('submit')"
  >
    <div class="space-y-6 lg:col-span-2">
      <section class="card p-4 sm:p-6" aria-labelledby="class-basic-title">
        <header class="flex items-start gap-3">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
          >
            <Info class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </span>
          <div>
            <h2 id="class-basic-title" class="text-base font-semibold text-fg">
              {{ t('classes.basicInfo') }}
            </h2>
            <p class="text-sm text-fg-muted">{{ t('classes.basicInfoHint') }}</p>
          </div>
        </header>
        <div class="mt-5 grid gap-4 sm:grid-cols-3">
          <BaseSelect
            v-model="form.grade"
            v-bind="form.gradeAttrs"
            :label="t('classes.grade')"
            :placeholder="t('classes.selectGrade')"
            :options="gradeOptions"
            :error="form.errors.grade"
            required
          />
          <BaseInput
            v-model="form.section"
            v-bind="form.sectionAttrs"
            :label="t('classes.section')"
            placeholder="A"
            :error="form.errors.section"
          />
          <BaseInput
            v-model="form.name"
            v-bind="form.nameAttrs"
            :label="t('classes.name')"
            placeholder="7-A"
            :error="form.errors.name"
            required
            @input="form.nameTouched = true"
          />
          <BaseSelect
            v-model="form.academicYearId"
            v-bind="form.yearAttrs"
            class="sm:col-span-3"
            :label="t('classes.academicYear')"
            :placeholder="t('classes.activeYear')"
            :options="yearOptions"
            :disabled="form.isEdit"
            :error="form.errors.academicYearId"
          />
        </div>
      </section>

      <section class="card p-4 sm:p-6" aria-labelledby="class-subjects-title">
        <header class="mb-5 flex items-start gap-3">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
          >
            <BookOpenCheck class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </span>
          <div>
            <h2 id="class-subjects-title" class="text-base font-semibold text-fg">
              {{ t('classes.subjectsSection') }}
            </h2>
            <p class="text-sm text-fg-muted">{{ t('classes.subjectsHint') }}</p>
          </div>
        </header>
        <SubjectAssignmentsEditor
          v-model="form.subjectRows"
          :subjects="form.subjectList"
          :teachers="teachers"
          :failed="form.subjectsFailed"
          :show-errors="form.rowsSubmitted"
          hide-header
        />
      </section>
    </div>

    <aside class="space-y-6 lg:sticky lg:top-6">
      <section class="card p-4 sm:p-6" aria-labelledby="class-homeroom-title">
        <header class="flex items-start gap-3">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
          >
            <UserCheck class="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </span>
          <div>
            <h2 id="class-homeroom-title" class="text-base font-semibold text-fg">
              {{ t('classes.homeroom') }}
            </h2>
            <p class="text-sm text-fg-muted">{{ t('classes.homeroomHint') }}</p>
          </div>
        </header>
        <div class="mt-5">
          <BaseSelect
            v-model="form.homeroomTeacherId"
            v-bind="form.homeroomAttrs"
            :aria-label="t('classes.homeroom')"
            searchable
            :placeholder="t('classes.noHomeroom')"
            :options="teacherOptions"
            :error="form.errors.homeroomTeacherId"
          />
        </div>
      </section>

      <section class="card p-4 sm:p-6" aria-labelledby="class-summary-title">
        <h2 id="class-summary-title" class="text-sm font-semibold uppercase text-fg-muted">
          {{ t('classes.summary') }}
        </h2>
        <dl class="mt-4 space-y-3 text-sm" data-testid="class-summary">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-fg-muted">{{ t('classes.name') }}</dt>
            <dd class="flex items-center gap-2 font-semibold text-fg">
              {{ form.name || t('classes.newClassName') }}
              <BaseBadge v-if="schoolClass?.isArchived" tone="warning">
                {{ t('classes.archived') }}
              </BaseBadge>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-fg-muted">{{ t('classes.academicYear') }}</dt>
            <dd class="text-fg">{{ yearName }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-fg-muted">{{ t('classes.homeroom') }}</dt>
            <dd class="truncate text-right text-fg">{{ homeroomName ?? '—' }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-fg-muted">{{ t('classes.summarySubjects') }}</dt>
            <dd class="text-fg">{{ subjectsCount }}</dd>
          </div>
          <div v-if="schoolClass" class="flex items-center justify-between gap-3">
            <dt class="text-fg-muted">{{ t('classes.students') }}</dt>
            <dd class="text-fg">{{ schoolClass.studentsCount }}</dd>
          </div>
        </dl>
        <div
          v-if="$slots.actions"
          class="mt-6 hidden gap-2 border-t border-border pt-4 lg:flex"
          data-testid="class-form-actions-desktop"
        >
          <slot name="actions" />
        </div>
      </section>
    </aside>
  </form>
</template>
