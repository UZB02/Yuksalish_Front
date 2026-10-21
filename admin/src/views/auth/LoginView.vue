<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { AlertCircle } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { isApiError } from '@/api/errors'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import { loginSchema } from '@/validation/schemas'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const formError = ref('')
const submitting = ref(false)

const { errors, defineField, handleSubmit } = useForm({
  validationSchema: toTypedSchema(loginSchema(t)),
  initialValues: { username: '', password: '' },
})
const [username, usernameAttrs] = defineField('username')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  formError.value = ''
  submitting.value = true
  try {
    await auth.login(values)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    // Faqat ichki yo'llarga yo'naltiramiz (open redirect'dan himoya).
    await router.replace(
      redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : { name: 'home' },
    )
  } catch (e) {
    formError.value =
      isApiError(e) && e.code === 'UNAUTHORIZED' ? t('auth.invalidCredentials') : errorMessage(e, t)
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h1 class="text-xl font-semibold text-fg">{{ t('auth.title') }}</h1>
    <p class="mb-6 mt-1 text-sm text-fg-muted">{{ t('auth.subtitle') }}</p>

    <div
      v-if="formError"
      class="mb-4 flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
      role="alert"
    >
      <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{{ formError }}</span>
    </div>

    <form class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="username"
        v-bind="usernameAttrs"
        :label="t('auth.username')"
        autocomplete="username"
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
        autocomplete="current-password"
        :error="errors.password"
        required
      />
      <BaseButton type="submit" class="w-full" :loading="submitting">
        {{ t('auth.login') }}
      </BaseButton>
    </form>
  </div>
</template>
