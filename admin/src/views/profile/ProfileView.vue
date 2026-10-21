<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { authApi } from '@/api/auth.api'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { ROLE_LABEL_KEYS } from '@/constants/roles'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import { changePasswordSchema } from '@/validation/schemas'

const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const submitting = ref(false)

const { errors, defineField, handleSubmit, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(changePasswordSchema(t)),
  initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
})
const [currentPassword, currentAttrs] = defineField('currentPassword')
const [newPassword, newAttrs] = defineField('newPassword')
const [confirmPassword, confirmAttrs] = defineField('confirmPassword')

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    // Backend parol versiyasini oshiradi: eski access token yaroqsiz, yangisini saqlaymiz.
    const { accessToken } = await authApi.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
    if (auth.user) auth.setSession(accessToken, auth.user)
    toast.success(t('profile.passwordChanged'))
    resetForm()
  } catch (e) {
    const fields = ['currentPassword', 'newPassword']
    if (!applyServerErrors(e, setErrors, fields)) toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <PageHeader :title="t('profile.title')" />

  <div class="grid gap-6 lg:grid-cols-2">
    <section v-if="auth.user" class="card p-6" :aria-label="t('profile.info')">
      <h2 class="mb-4 text-base font-semibold text-fg">{{ t('profile.info') }}</h2>
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-fg-muted">{{ t('profile.fullName') }}</dt>
          <dd class="text-right font-medium text-fg">{{ auth.user.fullName }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-fg-muted">{{ t('auth.username') }}</dt>
          <dd class="text-right font-medium text-fg">{{ auth.user.username }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-fg-muted">{{ t('profile.role') }}</dt>
          <dd>
            <BaseBadge tone="primary">{{ t(ROLE_LABEL_KEYS[auth.user.role]) }}</BaseBadge>
          </dd>
        </div>
        <div v-if="auth.user.lastLoginAt" class="flex justify-between gap-4">
          <dt class="text-fg-muted">{{ t('profile.lastLogin') }}</dt>
          <dd class="text-right text-fg">{{ formatDateTime(auth.user.lastLoginAt) }}</dd>
        </div>
      </dl>
    </section>

    <section class="card p-6" :aria-label="t('profile.changePassword')">
      <h2 class="mb-4 text-base font-semibold text-fg">{{ t('profile.changePassword') }}</h2>
      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <BaseInput
          v-model="currentPassword"
          v-bind="currentAttrs"
          type="password"
          autocomplete="current-password"
          :label="t('profile.currentPassword')"
          :error="errors.currentPassword"
          required
        />
        <BaseInput
          v-model="newPassword"
          v-bind="newAttrs"
          type="password"
          autocomplete="new-password"
          :label="t('profile.newPassword')"
          :hint="t('validation.passwordHint')"
          :error="errors.newPassword"
          required
        />
        <BaseInput
          v-model="confirmPassword"
          v-bind="confirmAttrs"
          type="password"
          autocomplete="new-password"
          :label="t('profile.confirmPassword')"
          :error="errors.confirmPassword"
          required
        />
        <BaseButton type="submit" :loading="submitting">{{ t('profile.save') }}</BaseButton>
      </form>
    </section>
  </div>
</template>
