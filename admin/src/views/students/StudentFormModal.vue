<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { studentsApi } from '@/api/students.api'
import { isApiError } from '@/api/errors'
import type { Gender, SchoolClass, Student, StudentPayload } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { toDateInput } from '@/utils/format'
import { studentSchema } from '@/validation/domain'

const props = defineProps<{
  open: boolean
  student: Student | null
  classes: SchoolClass[]
  /** Sinf sahifasidan ochilsa oldindan tanlanadi */
  defaultClassId?: string
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const isEdit = computed(() => !!props.student)

const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(studentSchema(t)),
  initialValues: {
    fullName: '',
    classId: '',
    birthDate: '',
    gender: '',
    studentCode: '',
    parentPhone: '',
  },
})
const [fullName, fullNameAttrs] = defineField('fullName')
const [classId, classIdAttrs] = defineField('classId')
const [birthDate, birthDateAttrs] = defineField('birthDate')
const [gender, genderAttrs] = defineField('gender')
const [studentCode, codeAttrs] = defineField('studentCode')
const [parentPhone, phoneAttrs] = defineField('parentPhone')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const s = props.student
    resetForm({
      values: {
        fullName: s?.fullName ?? '',
        classId: s?.classId ?? props.defaultClassId ?? '',
        birthDate: toDateInput(s?.birthDate),
        gender: s?.gender ?? '',
        studentCode: s?.studentCode ?? '',
        parentPhone: s?.parentPhone ?? '',
      },
    })
  },
  { immediate: true },
)

const classOptions = computed(() => props.classes.map((c) => ({ value: c.id, label: c.name })))
const genderOptions = computed(() => [
  { value: 'male', label: t('students.genders.male') },
  { value: 'female', label: t('students.genders.female') },
])

const FIELDS = ['fullName', 'classId', 'birthDate', 'gender', 'studentCode', 'parentPhone'] as const

const onSubmit = handleSubmit(async (v) => {
  submitting.value = true
  try {
    if (props.student) {
      // Tahrirlashda bo'sh ixtiyoriy maydon null (tozalash); sinf o'tkazish alohida amal.
      await studentsApi.update(props.student.id, {
        fullName: v.fullName,
        birthDate: v.birthDate || null,
        gender: (v.gender || null) as Gender | null,
        studentCode: v.studentCode || null,
        parentPhone: v.parentPhone || null,
      })
    } else {
      const payload: StudentPayload = { fullName: v.fullName, classId: v.classId }
      if (v.birthDate) payload.birthDate = v.birthDate
      if (v.gender) payload.gender = v.gender as Gender
      if (v.studentCode) payload.studentCode = v.studentCode
      if (v.parentPhone) payload.parentPhone = v.parentPhone
      await studentsApi.create(payload)
    }
    toast.success(t(isEdit.value ? 'students.updated' : 'students.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') {
      // Dublikat: ID yoki F.I.Sh. + tug'ilgan sana
      const msg = t('students.duplicate')
      setErrors(v.studentCode ? { studentCode: msg, fullName: msg } : { fullName: msg })
    } else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('students.edit') : t('students.add')"
    persistent
    @close="emit('close')"
  >
    <form id="student-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="fullName"
        v-bind="fullNameAttrs"
        :label="t('common.fullName')"
        autocomplete="off"
        :error="errors.fullName"
        required
      />
      <BaseSelect
        v-model="classId"
        v-bind="classIdAttrs"
        :label="t('students.class')"
        :placeholder="t('students.selectClass')"
        :options="classOptions"
        :disabled="isEdit"
        :error="errors.classId"
        required
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="birthDate"
          v-bind="birthDateAttrs"
          type="date"
          :label="t('students.birthDate')"
          :error="errors.birthDate"
        />
        <BaseSelect
          v-model="gender"
          v-bind="genderAttrs"
          :label="t('students.gender')"
          :placeholder="t('students.notSpecified')"
          :options="genderOptions"
          :error="errors.gender"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="studentCode"
          v-bind="codeAttrs"
          :label="t('students.code')"
          autocomplete="off"
          :error="errors.studentCode"
        />
        <BaseInput
          v-model="parentPhone"
          v-bind="phoneAttrs"
          type="tel"
          placeholder="+998 90 123 45 67"
          :label="t('students.parentPhone')"
          :error="errors.parentPhone"
        />
      </div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="student-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
