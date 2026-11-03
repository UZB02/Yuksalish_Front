<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { isApiError } from '@/api/errors'
import { superadminsApi } from '@/api/superadmins.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { superadminCreateSchema } from '@/validation/schemas'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)

const FIELDS = ['fullName', 'username', 'password', 'currentPassword'] as const
const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(superadminCreateSchema(t)),
  initialValues: { fullName: '', username: '', password: '', currentPassword: '' },
})
const [fullName, fullNameAttrs] = defineField('fullName')
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')
const [currentPassword, currentAttrs] = defineField('currentPassword')

watch(
  () => props.open,
  (o) => o && resetForm(),
)

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    await superadminsApi.create({
      fullName: values.fullName,
      username: values.username.trim().toLowerCase(),
      password: values.password,
      currentPassword: values.currentPassword,
    })
    toast.success(t('superadmins.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT')
      setErrors({ username: t('superadmins.usernameTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal :open="open" :title="t('superadmins.createTitle')" persistent @close="emit('close')">
    <form id="superadmin-create-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="fullName"
        v-bind="fullNameAttrs"
        data-testid="create-fullName"
        :label="t('common.fullName')"
        autocomplete="off"
        :error="errors.fullName"
        required
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="username"
          v-bind="usernameAttrs"
          data-testid="create-username"
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
          data-testid="create-password"
          type="password"
          :label="t('auth.password')"
          autocomplete="new-password"
          :hint="t('validation.passwordHint')"
          :error="errors.password"
          required
        />
      </div>
      <BaseInput
        v-model="currentPassword"
        v-bind="currentAttrs"
        data-testid="create-currentPassword"
        type="password"
        autocomplete="current-password"
        :label="t('superadmins.currentPassword')"
        :hint="t('superadmins.currentPasswordHint')"
        :error="errors.currentPassword"
        required
      />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton
        type="submit"
        form="superadmin-create-form"
        data-testid="create-submit"
        :loading="submitting"
      >
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
