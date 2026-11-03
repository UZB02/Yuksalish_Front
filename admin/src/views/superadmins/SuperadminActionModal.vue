<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import type { TypedSchema } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { TriangleAlert } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { currentPasswordSchema, superadminResetSchema } from '@/validation/schemas'

const props = defineProps<{
  open: boolean
  title: string
  /** Kimga tegishli ekani (sarlavha ostida) */
  targetName?: string
  /** Tushuntirish matni */
  message?: string
  /** Ogohlantirish (qizil blok) */
  warning?: string
  confirmText: string
  danger?: boolean
  /** true - yangi parol maydonlari ham so'raladi (parolni tiklash) */
  withNewPassword?: boolean
  submit: (payload: { currentPassword: string; newPassword?: string }) => Promise<unknown>
}>()
const emit = defineEmits<{ close: []; done: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)

interface FormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const schema = computed(
  () =>
    toTypedSchema(
      props.withNewPassword ? superadminResetSchema(t) : currentPasswordSchema(t),
    ) as unknown as TypedSchema<FormValues>,
)
const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm<FormValues>({
  validationSchema: schema,
  initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
})
const [currentPassword, currentAttrs] = defineField('currentPassword')
const [newPassword, newAttrs] = defineField('newPassword')
const [confirmPassword, confirmAttrs] = defineField('confirmPassword')

watch(
  () => props.open,
  (o) => o && resetForm(),
)

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    await props.submit({
      currentPassword: values.currentPassword,
      ...(props.withNewPassword ? { newPassword: values.newPassword } : {}),
    })
    emit('done')
    emit('close')
  } catch (e) {
    if (!applyServerErrors(e, setErrors, ['currentPassword', 'newPassword'])) {
      toast.error(errorMessage(e, t))
    }
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="title"
    :description="targetName"
    persistent
    @close="emit('close')"
  >
    <form id="superadmin-action-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <p v-if="message" class="text-sm text-fg-muted">{{ message }}</p>
      <div
        v-if="warning"
        class="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger"
        role="alert"
        data-testid="action-warning"
      >
        <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
        <p>{{ warning }}</p>
      </div>
      <template v-if="withNewPassword">
        <BaseInput
          v-model="newPassword"
          v-bind="newAttrs"
          data-testid="action-newPassword"
          type="password"
          autocomplete="new-password"
          :label="t('superadmins.newPassword')"
          :hint="t('validation.passwordHint')"
          :error="errors.newPassword"
          required
        />
        <BaseInput
          v-model="confirmPassword"
          v-bind="confirmAttrs"
          data-testid="action-confirmPassword"
          type="password"
          autocomplete="new-password"
          :label="t('superadmins.confirmPassword')"
          :error="errors.confirmPassword"
          required
        />
      </template>
      <BaseInput
        v-model="currentPassword"
        v-bind="currentAttrs"
        data-testid="action-currentPassword"
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
        form="superadmin-action-form"
        data-testid="action-submit"
        :variant="danger ? 'danger' : 'primary'"
        :loading="submitting"
      >
        {{ confirmText }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
