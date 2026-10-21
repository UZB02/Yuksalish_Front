<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { isApiError } from '@/api/errors'
import { subjectsApi } from '@/api/subjects.api'
import type { School, Subject } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { subjectSchema } from '@/validation/domain'

const props = defineProps<{
  open: boolean
  item: Subject | null
  /** Faqat superadmin uchun: global yoki maktab tanlash */
  schools: School[]
  canPickScope: boolean
  /** Yaratishda oldindan tanlangan maktab (id) yoki '' - global */
  defaultSchoolId?: string
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const isEdit = computed(() => !!props.item)

const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(subjectSchema(t)),
  initialValues: { name: '', order: '0', schoolId: '' },
})
const [name, nameAttrs] = defineField('name')
const [order, orderAttrs] = defineField('order')
const [schoolId, schoolAttrs] = defineField('schoolId')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const s = props.item
    resetForm({
      values: {
        name: s?.name ?? '',
        order: String(s?.order ?? 0),
        schoolId: s?.schoolId ?? props.defaultSchoolId ?? '',
      },
    })
  },
  { immediate: true },
)

const schoolOptions = computed(() => props.schools.map((s) => ({ value: s.id, label: s.name })))
const FIELDS = ['name', 'order', 'schoolId'] as const

const onSubmit = handleSubmit(async (v) => {
  submitting.value = true
  try {
    if (props.item) {
      await subjectsApi.update(props.item.id, { name: v.name, order: Number(v.order) })
    } else {
      await subjectsApi.create({
        name: v.name,
        order: Number(v.order),
        ...(props.canPickScope ? { schoolId: v.schoolId || null } : {}),
      })
    }
    toast.success(t(isEdit.value ? 'subjects.updated' : 'subjects.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') setErrors({ name: t('subjects.nameTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('subjects.edit') : t('subjects.add')"
    persistent
    @close="emit('close')"
  >
    <form id="subject-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="name"
        v-bind="nameAttrs"
        :label="t('subjects.name')"
        :error="errors.name"
        required
      />
      <BaseInput
        v-model="order"
        v-bind="orderAttrs"
        type="number"
        inputmode="numeric"
        min="0"
        :label="t('subjects.order')"
        :error="errors.order"
        required
      />
      <BaseSelect
        v-if="!isEdit && canPickScope"
        v-model="schoolId"
        v-bind="schoolAttrs"
        :label="t('subjects.scope')"
        :placeholder="t('subjects.global')"
        :options="schoolOptions"
        :error="errors.schoolId"
      />
      <p v-else-if="!isEdit" class="text-xs text-fg-muted">{{ t('subjects.ownSchoolHint') }}</p>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="subject-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
