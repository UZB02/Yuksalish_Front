<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { classesApi } from '@/api/classes.api'
import { isApiError } from '@/api/errors'
import type { AcademicYear, ClassPayload, SchoolClass, Teacher } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { classSchema } from '@/validation/domain'

const props = defineProps<{
  open: boolean
  schoolClass: SchoolClass | null
  years: AcademicYear[]
  teachers: Teacher[]
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const nameTouched = ref(false)
const isEdit = computed(() => !!props.schoolClass)

const { errors, defineField, handleSubmit, resetForm, setErrors, setFieldValue } = useForm({
  validationSchema: toTypedSchema(classSchema(t)),
  initialValues: {
    name: '',
    grade: '',
    section: '',
    academicYearId: '',
    homeroomTeacherId: '',
  },
})
const [name, nameAttrs] = defineField('name')
const [grade, gradeAttrs] = defineField('grade')
const [section, sectionAttrs] = defineField('section')
const [academicYearId, yearAttrs] = defineField('academicYearId')
const [homeroomTeacherId, homeroomAttrs] = defineField('homeroomTeacherId')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const c = props.schoolClass
    resetForm({
      values: {
        name: c?.name ?? '',
        grade: c ? String(c.grade) : '',
        section: c?.section ?? '',
        academicYearId: c?.academicYearId ?? props.years.find((y) => y.isActive)?.id ?? '',
        homeroomTeacherId: c?.homeroomTeacherId ?? '',
      },
    })
    nameTouched.value = !!c
  },
  { immediate: true },
)

// Sinf nomi parallel va harfdan avtomatik yig'iladi (7-A), qo'lda tahrirlanmaguncha.
watch([grade, section], ([g, s]) => {
  if (!nameTouched.value) setFieldValue('name', g ? `${g}${s ? `-${s.toUpperCase()}` : ''}` : '')
})

const gradeOptions = Array.from({ length: 11 }, (_, i) => ({
  value: String(i + 1),
  label: t('classes.gradeLabel', { n: i + 1 }),
}))
const yearOptions = computed(() => props.years.map((y) => ({ value: y.id, label: y.name })))
const teacherOptions = computed(() =>
  props.teachers.map((tc) => ({ value: tc.id, label: tc.fullName })),
)

const FIELDS = ['name', 'grade', 'section', 'academicYearId', 'homeroomTeacherId'] as const

const onSubmit = handleSubmit(async (v) => {
  submitting.value = true
  try {
    if (props.schoolClass) {
      await classesApi.update(props.schoolClass.id, {
        name: v.name,
        grade: Number(v.grade),
        section: v.section || null,
        homeroomTeacherId: v.homeroomTeacherId || null,
      })
    } else {
      const payload: ClassPayload = { name: v.name, grade: Number(v.grade) }
      if (v.section) payload.section = v.section
      if (v.academicYearId) payload.academicYearId = v.academicYearId
      if (v.homeroomTeacherId) payload.homeroomTeacherId = v.homeroomTeacherId
      await classesApi.create(payload)
    }
    toast.success(t(isEdit.value ? 'classes.updated' : 'classes.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') setErrors({ name: t('classes.nameTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('classes.edit') : t('classes.add')"
    persistent
    @close="emit('close')"
  >
    <form id="class-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseSelect
          v-model="grade"
          v-bind="gradeAttrs"
          :label="t('classes.grade')"
          :placeholder="t('classes.selectGrade')"
          :options="gradeOptions"
          :error="errors.grade"
          required
        />
        <BaseInput
          v-model="section"
          v-bind="sectionAttrs"
          :label="t('classes.section')"
          placeholder="A"
          :error="errors.section"
        />
      </div>
      <BaseInput
        v-model="name"
        v-bind="nameAttrs"
        :label="t('classes.name')"
        placeholder="7-A"
        :error="errors.name"
        required
        @input="nameTouched = true"
      />
      <BaseSelect
        v-model="academicYearId"
        v-bind="yearAttrs"
        :label="t('classes.academicYear')"
        :placeholder="t('classes.activeYear')"
        :options="yearOptions"
        :disabled="isEdit"
        :error="errors.academicYearId"
      />
      <BaseSelect
        v-model="homeroomTeacherId"
        v-bind="homeroomAttrs"
        :label="t('classes.homeroom')"
        :placeholder="t('classes.noHomeroom')"
        :options="teacherOptions"
        :error="errors.homeroomTeacherId"
      />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="class-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
