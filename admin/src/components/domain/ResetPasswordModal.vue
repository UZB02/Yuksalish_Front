<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { resetPasswordSchema } from '@/validation/schemas'

const props = defineProps<{
  open: boolean
  /** Kimning paroli tiklanayotgani (sarlavha uchun) */
  targetName: string
  submit: (newPassword: string) => Promise<unknown>
}>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)

const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(resetPasswordSchema(t)),
  initialValues: { newPassword: '', confirmPassword: '' },
})
const [newPassword, newPasswordAttrs] = defineField('newPassword')
const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword')

watch(
  () => props.open,
  (o) => o && resetForm(),
)

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    await props.submit(values.newPassword)
    toast.success(t('resetPassword.success'))
    emit('close')
  } catch (e) {
    if (!applyServerErrors(e, setErrors, ['newPassword'])) toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('resetPassword.title')"
    :description="targetName"
    persistent
    @close="emit('close')"
  >
    <form id="reset-password-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="newPassword"
        v-bind="newPasswordAttrs"
        type="password"
        autocomplete="new-password"
        :label="t('resetPassword.newPassword')"
        :hint="t('validation.passwordHint')"
        :error="errors.newPassword"
        required
      />
      <BaseInput
        v-model="confirmPassword"
        v-bind="confirmPasswordAttrs"
        type="password"
        autocomplete="new-password"
        :label="t('resetPassword.confirm')"
        :error="errors.confirmPassword"
        required
      />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="reset-password-form" :loading="submitting">
        {{ t('resetPassword.submit') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
