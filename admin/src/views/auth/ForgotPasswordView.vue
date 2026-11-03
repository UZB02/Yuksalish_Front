<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { AlertCircle, Check, Send } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { authApi } from '@/api/auth.api'
import { isApiError } from '@/api/errors'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { resetPasswordSchema } from '@/validation/schemas'

const RESEND_SECONDS = 60

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

type Step = 1 | 2 | 3
const step = ref<Step>(1)
const username = ref('')
const usernameError = ref('')
const code = ref('')
const codeError = ref('')
const resetToken = ref('')
const formError = ref('')
const submitting = ref(false)
const botUsername = ref<string | null>(null)

// Qayta yuborish hisoblagichi
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
function startCountdown() {
  stopCountdown()
  countdown.value = RESEND_SECONDS
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) stopCountdown()
  }, 1000)
}
function stopCountdown() {
  if (timer) clearInterval(timer)
  timer = null
  if (countdown.value < 0) countdown.value = 0
}
onBeforeUnmount(stopCountdown)

onMounted(async () => {
  try {
    const info = await authApi.passwordResetInfo()
    botUsername.value = info.available ? info.botUsername : null
  } catch {
    botUsername.value = null
  }
})

const botHandle = computed(() => (botUsername.value ? `@${botUsername.value}` : ''))
const stepKeys = ['login', 'code', 'password'] as const

/** Serverning o'zbekcha xabarini ko'rsatamiz (kod noto'g'ri, bekor qilindi, juda ko'p urinish) */
function apiMessage(e: unknown): string {
  if (isApiError(e) && (e.code === 'VALIDATION_ERROR' || e.code === 'RATE_LIMITED') && e.message) {
    return e.message
  }
  return errorMessage(e, t)
}

async function sendCode(): Promise<boolean> {
  await authApi.passwordResetRequest(username.value.trim().toLowerCase())
  startCountdown()
  return true
}

async function onSubmitLogin() {
  formError.value = ''
  usernameError.value = ''
  if (!username.value.trim()) {
    usernameError.value = t('validation.required')
    return
  }
  submitting.value = true
  try {
    await sendCode()
    code.value = ''
    codeError.value = ''
    step.value = 2
  } catch (e) {
    formError.value = apiMessage(e)
  } finally {
    submitting.value = false
  }
}

async function onResend() {
  if (countdown.value > 0 || submitting.value) return
  formError.value = ''
  codeError.value = ''
  submitting.value = true
  try {
    await sendCode()
    code.value = ''
    toast.info(t('auth.forgot.resent'))
  } catch (e) {
    formError.value = apiMessage(e)
  } finally {
    submitting.value = false
  }
}

function onCodeInput(v: string) {
  code.value = v.replace(/\D/g, '').slice(0, 6)
}

async function onSubmitCode() {
  formError.value = ''
  codeError.value = ''
  if (!/^\d{6}$/.test(code.value)) {
    codeError.value = t('auth.forgot.codeInvalid')
    return
  }
  submitting.value = true
  try {
    resetToken.value = await authApi.passwordResetVerify(
      username.value.trim().toLowerCase(),
      code.value,
    )
    stopCountdown()
    step.value = 3
  } catch (e) {
    codeError.value = apiMessage(e)
  } finally {
    submitting.value = false
  }
}

function goBack() {
  formError.value = ''
  codeError.value = ''
  if (step.value === 3) resetToken.value = ''
  step.value = 1
  stopCountdown()
  countdown.value = 0
}

// 3-qadam: yangi parol
const { errors, defineField, handleSubmit, setErrors } = useForm({
  validationSchema: toTypedSchema(resetPasswordSchema(t)),
  initialValues: { newPassword: '', confirmPassword: '' },
})
const [newPassword, newAttrs] = defineField('newPassword')
const [confirmPassword, confirmAttrs] = defineField('confirmPassword')

const onSubmitPassword = handleSubmit(async (values) => {
  formError.value = ''
  submitting.value = true
  try {
    await authApi.passwordResetComplete(resetToken.value, values.newPassword)
    toast.success(t('auth.forgot.success'))
    await router.replace({ name: 'login' })
  } catch (e) {
    const detail = isApiError(e) ? e.details[0] : undefined
    const field = detail?.path.split('.').pop()
    if (field === 'resetToken') {
      // Token yaroqsiz yoki muddati o'tgan: jarayonni boshidan boshlaymiz
      resetToken.value = ''
      step.value = 1
      formError.value = t('auth.forgot.sessionExpired')
    } else if (detail && field === 'password') {
      setErrors({ newPassword: detail.message })
    } else {
      formError.value = apiMessage(e)
    }
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <div class="card p-6 sm:p-8">
    <h1 class="text-xl font-semibold text-fg">{{ t('auth.forgot.title') }}</h1>

    <ol
      class="mb-5 mt-4 flex items-center gap-2"
      :aria-label="t('auth.forgot.stepsLabel')"
      data-testid="forgot-stepper"
    >
      <li
        v-for="(key, i) in stepKeys"
        :key="key"
        class="flex flex-1 items-center gap-2 text-xs"
        :aria-current="step === i + 1 ? 'step' : undefined"
        :data-step="i + 1"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
          :class="
            step > i + 1
              ? 'border-primary-600 bg-primary-600 text-white'
              : step === i + 1
                ? 'border-primary-600 text-primary-600'
                : 'border-border text-fg-muted'
          "
        >
          <Check v-if="step > i + 1" class="h-3.5 w-3.5" aria-hidden="true" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span
          class="hidden truncate sm:inline"
          :class="step === i + 1 ? 'font-medium text-fg' : 'text-fg-muted'"
        >
          {{ t(`auth.forgot.steps.${key}`) }}
        </span>
        <span v-if="i < stepKeys.length - 1" class="h-px flex-1 bg-border" aria-hidden="true" />
      </li>
    </ol>

    <div
      v-if="formError"
      class="mb-4 flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
      role="alert"
      data-testid="forgot-error"
    >
      <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{{ formError }}</span>
    </div>

    <!-- 1-qadam: login -->
    <form v-if="step === 1" class="space-y-4" novalidate @submit.prevent="onSubmitLogin">
      <p class="text-sm text-fg-muted">{{ t('auth.forgot.loginSubtitle') }}</p>
      <BaseInput
        v-model="username"
        :label="t('auth.username')"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        :error="usernameError"
        required
        data-testid="forgot-username"
      />
      <BaseButton type="submit" class="w-full" :loading="submitting">
        {{ t('auth.forgot.sendCode') }}
      </BaseButton>
      <p class="text-center text-sm">
        <RouterLink :to="{ name: 'login' }" class="text-primary-600 hover:underline">
          {{ t('auth.forgot.backToLogin') }}
        </RouterLink>
      </p>
    </form>

    <!-- 2-qadam: kod -->
    <form v-else-if="step === 2" class="space-y-4" novalidate @submit.prevent="onSubmitCode">
      <div
        class="flex items-start gap-2 rounded-lg bg-surface-muted p-3 text-sm text-fg-muted"
        data-testid="forgot-sent-info"
      >
        <Send class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p>{{ t('auth.forgot.sentInfo') }}</p>
          <p v-if="botHandle" class="mt-1">
            {{ t('auth.forgot.botLink') }}
            <a
              :href="`https://t.me/${botUsername}`"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-primary-600 hover:underline"
              data-testid="forgot-bot-link"
              >{{ botHandle }}</a
            >
          </p>
        </div>
      </div>
      <BaseInput
        :model-value="code"
        :label="t('auth.forgot.codeLabel')"
        :hint="t('auth.forgot.codeHint')"
        :error="codeError"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]*"
        maxlength="6"
        placeholder="------"
        class="code-input"
        required
        data-testid="forgot-code"
        @update:model-value="onCodeInput"
      />
      <BaseButton type="submit" class="w-full" :loading="submitting">
        {{ t('auth.forgot.verify') }}
      </BaseButton>
      <div class="flex items-center justify-between gap-2">
        <BaseButton variant="ghost" size="sm" @click="goBack">
          {{ t('auth.forgot.back') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          size="sm"
          :disabled="countdown > 0 || submitting"
          data-testid="forgot-resend"
          @click="onResend"
        >
          {{
            countdown > 0
              ? t('auth.forgot.resendIn', { seconds: countdown })
              : t('auth.forgot.resend')
          }}
        </BaseButton>
      </div>
    </form>

    <!-- 3-qadam: yangi parol -->
    <form v-else class="space-y-4" novalidate @submit.prevent="onSubmitPassword">
      <p class="text-sm text-fg-muted">{{ t('auth.forgot.passwordSubtitle') }}</p>
      <BaseInput
        v-model="newPassword"
        v-bind="newAttrs"
        type="password"
        autocomplete="new-password"
        :label="t('auth.forgot.newPassword')"
        :hint="t('validation.passwordHint')"
        :error="errors.newPassword"
        required
        data-testid="forgot-password"
      />
      <BaseInput
        v-model="confirmPassword"
        v-bind="confirmAttrs"
        type="password"
        autocomplete="new-password"
        :label="t('auth.forgot.confirmPassword')"
        :error="errors.confirmPassword"
        required
        data-testid="forgot-confirm"
      />
      <BaseButton type="submit" class="w-full" :loading="submitting">
        {{ t('auth.forgot.save') }}
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="goBack">
        {{ t('auth.forgot.back') }}
      </BaseButton>
    </form>
  </div>
</template>

<style scoped>
.code-input :deep(input) {
  text-align: center;
  font-size: 1.25rem;
  letter-spacing: 0.5em;
  font-variant-numeric: tabular-nums;
}
</style>
