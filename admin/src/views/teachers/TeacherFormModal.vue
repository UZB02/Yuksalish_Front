<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import type { TypedSchema } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { teachersApi } from '@/api/teachers.api'
import { isApiError } from '@/api/errors'
import type { Teacher } from '@/api/types'
import PermissionEditor from '@/components/domain/PermissionEditor.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PhotoUploader from '@/components/ui/PhotoUploader.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { usePermissionsMeta } from '@/composables/usePermissionsMeta'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { teacherCreateSchema, teacherEditSchema } from '@/validation/schemas'

const props = defineProps<{
  open: boolean
  teacher: Teacher | null
  /** school_admin uchun: faqat o'zida mavjud ruxsatlar; superadmin uchun null */
  allowedPermissions: string[] | null
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const { permissions: permList, loading: metaLoading, load: loadMeta } = usePermissionsMeta()
const submitting = ref(false)
const isEdit = computed(() => !!props.teacher)
const permissions = ref<string[]>([])
const isActive = ref(true)

interface FormValues {
  fullName: string
  username: string
  password: string
  phone: string
}

const schema = computed(
  () =>
    toTypedSchema(
      isEdit.value ? teacherEditSchema(t) : teacherCreateSchema(t),
    ) as unknown as TypedSchema<FormValues>,
)
const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm<FormValues>({
  validationSchema: schema,
  initialValues: { fullName: '', username: '', password: '', phone: '' },
})
const [fullName, fullNameAttrs] = defineField('fullName')
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')
const [phone, phoneAttrs] = defineField('phone')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const tc = props.teacher
    resetForm({
      values: {
        fullName: tc?.fullName ?? '',
        username: tc?.username ?? '',
        password: '',
        phone: tc?.phone ?? '',
      },
    })
    isActive.value = tc?.isActive ?? true
    permissions.value = tc ? [...tc.permissions] : []
    if (!tc) void loadMeta()
  },
  { immediate: true },
)

// Rasm: tahrirlashda darhol serverga; ro'yxat fon sahifada yangilanadi
const currentPhoto = ref<string | null>(null)
watch(
  () => [props.open, props.teacher] as const,
  () => (currentPhoto.value = props.teacher?.photo ?? null),
  { immediate: true },
)
async function uploadPhoto(file: File) {
  const updated = await teachersApi.setPhoto(props.teacher!.id, file)
  currentPhoto.value = updated.photo ?? null
  emit('saved')
}
async function removePhoto() {
  await teachersApi.removePhoto(props.teacher!.id)
  currentPhoto.value = null
  emit('saved')
}

const FIELDS = ['fullName', 'username', 'password', 'phone'] as const

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    if (props.teacher) {
      await teachersApi.update(props.teacher.id, {
        fullName: values.fullName,
        phone: values.phone || null,
        isActive: isActive.value,
      })
    } else {
      await teachersApi.create({
        fullName: values.fullName,
        username: values.username!,
        password: values.password!,
        phone: values.phone || undefined,
        permissions: permissions.value,
      })
    }
    toast.success(t(isEdit.value ? 'teachers.updated' : 'teachers.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') setErrors({ username: t('teachers.usernameTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('teachers.edit') : t('teachers.add')"
    :size="isEdit ? 'md' : 'lg'"
    persistent
    @close="emit('close')"
  >
    <form id="teacher-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <PhotoUploader
        v-if="isEdit && teacher"
        :name="teacher.fullName"
        :photo="currentPhoto"
        :upload="uploadPhoto"
        :remove="removePhoto"
      />
      <BaseInput
        v-model="fullName"
        v-bind="fullNameAttrs"
        :label="t('common.fullName')"
        autocomplete="off"
        :error="errors.fullName"
        required
      />
      <BaseInput
        v-model="phone"
        v-bind="phoneAttrs"
        type="tel"
        placeholder="+998 90 123 45 67"
        :label="t('common.phone')"
        :error="errors.phone"
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
          <p v-if="allowedPermissions" class="mb-2 text-xs text-fg-muted">
            {{ t('permissions.limitedHint') }}
          </p>
          <PermissionEditor
            v-model="permissions"
            :permissions="permList"
            role="teacher"
            :allowed="allowedPermissions"
            :loading="metaLoading"
          />
        </div>
      </template>
      <BaseSwitch v-else v-model="isActive" :label="t('common.active')" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="teacher-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
