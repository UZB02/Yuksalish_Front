<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import type { TypedSchema } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { schoolAdminsApi } from '@/api/schoolAdmins.api'
import { isApiError } from '@/api/errors'
import type { School, SchoolAdmin } from '@/api/types'
import PermissionEditor from '@/components/domain/PermissionEditor.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { usePermissionsMeta } from '@/composables/usePermissionsMeta'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { schoolAdminCreateSchema, schoolAdminEditSchema } from '@/validation/schemas'

const props = defineProps<{
  open: boolean
  admin: SchoolAdmin | null
  schools: School[]
  /** Yaratishda oldindan tanlangan maktab */
  defaultSchoolId?: string
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const { permissions: permList, loading: metaLoading, load: loadMeta } = usePermissionsMeta()
const submitting = ref(false)
const isEdit = computed(() => !!props.admin)
const permissions = ref<string[]>([])
const isActive = ref(true)

interface FormValues {
  schoolId: string
  fullName: string
  username: string
  password: string
}

// Yaratish va tahrirlash sxemalari turlicha; ikkalasi uchun umumiy forma.
const schema = computed(
  () =>
    toTypedSchema(
      isEdit.value ? schoolAdminEditSchema(t) : schoolAdminCreateSchema(t),
    ) as unknown as TypedSchema<FormValues>,
)
const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm<FormValues>({
  validationSchema: schema,
  initialValues: { schoolId: '', fullName: '', username: '', password: '' },
})
const [schoolId, schoolIdAttrs] = defineField('schoolId')
const [fullName, fullNameAttrs] = defineField('fullName')
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const a = props.admin
    resetForm({
      values: {
        schoolId: a?.schoolId ?? props.defaultSchoolId ?? '',
        fullName: a?.fullName ?? '',
        username: a?.username ?? '',
        password: '',
      },
    })
    isActive.value = a?.isActive ?? true
    permissions.value = a ? [...a.permissions] : []
    if (!a) void loadMeta()
  },
  { immediate: true },
)

const schoolOptions = computed(() =>
  props.schools.map((s) => ({
    value: s.id,
    label: s.isActive ? s.name : `${s.name} (${t('common.inactive')})`,
  })),
)

const FIELDS = ['schoolId', 'fullName', 'username', 'password'] as const

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    if (props.admin) {
      await schoolAdminsApi.update(props.admin.id, {
        fullName: values.fullName,
        isActive: isActive.value,
      })
    } else {
      await schoolAdminsApi.create({
        schoolId: values.schoolId!,
        fullName: values.fullName,
        username: values.username!,
        password: values.password!,
        permissions: permissions.value,
      })
    }
    toast.success(t(isEdit.value ? 'schoolAdmins.updated' : 'schoolAdmins.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT')
      setErrors({ username: t('schoolAdmins.usernameTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('schoolAdmins.edit') : t('schoolAdmins.add')"
    :size="isEdit ? 'md' : 'lg'"
    persistent
    @close="emit('close')"
  >
    <form id="school-admin-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseSelect
        v-if="!isEdit"
        v-model="schoolId"
        v-bind="schoolIdAttrs"
        :label="t('schoolAdmins.school')"
        :placeholder="t('schoolAdmins.selectSchool')"
        :options="schoolOptions"
        :error="errors.schoolId"
        required
      />
      <BaseInput
        v-model="fullName"
        v-bind="fullNameAttrs"
        :label="t('common.fullName')"
        autocomplete="off"
        :error="errors.fullName"
        required
      />
      <template v-if="!isEdit">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="username"
            v-bind="usernameAttrs"
            :label="t('auth.username')"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            :error="errors.username"
            required
          />
          <BaseInput
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            :label="t('auth.password')"
            autocomplete="new-password"
            :hint="t('validation.passwordHint')"
            :error="errors.password"
            required
          />
        </div>
        <div>
          <p class="mb-2 text-sm font-medium text-fg">{{ t('permissions.title') }}</p>
          <PermissionEditor
            v-model="permissions"
            :permissions="permList"
            role="school_admin"
            :loading="metaLoading"
          />
        </div>
      </template>
      <BaseSwitch v-else v-model="isActive" :label="t('common.active')" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="school-admin-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
