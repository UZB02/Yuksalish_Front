<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Pencil } from 'lucide-vue-next'
import { authApi } from '@/api/auth.api'
import { isApiError } from '@/api/errors'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import PhotoUploader from '@/components/ui/PhotoUploader.vue'
import { ROLE_LABEL_KEYS } from '@/constants/roles'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import { profileEditSchema } from '@/validation/schemas'

const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const editing = ref(false)
const submitting = ref(false)

const FIELDS = ['fullName', 'username', 'phone', 'currentPassword'] as const
const CHECK_DELAY_MS = 400
const USERNAME_OK = /^[a-z0-9._-]{3,32}$/

const original = () => auth.user?.username ?? ''
const { errors, defineField, handleSubmit, resetForm, setErrors, setFieldError } = useForm({
  validationSchema: toTypedSchema(profileEditSchema(t, original)),
  initialValues: { fullName: '', username: '', phone: '', currentPassword: '' },
})
const [fullName, fullNameAttrs] = defineField('fullName')
const [username, usernameAttrs] = defineField('username')
const [phone, phoneAttrs] = defineField('phone')
const [currentPassword, currentPasswordAttrs] = defineField('currentPassword')

const normalized = computed(() => (username.value ?? '').trim().toLowerCase())
const usernameChanged = computed(
  () => editing.value && normalized.value !== original().toLowerCase(),
)

// ---- Loginning bandligini jonli tekshirish ----
type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error'
const availability = ref<Availability>('idle')
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

function stopChecking() {
  clearTimeout(timer)
  seq++
}
watch(normalized, (value) => {
  stopChecking()
  if (!editing.value || value === original().toLowerCase() || !USERNAME_OK.test(value)) {
    availability.value = 'idle'
    return
  }
  availability.value = 'checking'
  const mine = seq
  timer = setTimeout(async () => {
    try {
      const res = await authApi.usernameAvailable(value)
      if (mine !== seq) return
      availability.value = res.available ? 'available' : 'taken'
    } catch {
      if (mine === seq) availability.value = 'error'
    }
  }, CHECK_DELAY_MS)
})
onBeforeUnmount(stopChecking)

const usernameHint = computed(() => {
  if (availability.value === 'checking') return t('profile.usernameChecking')
  if (availability.value === 'available') return t('profile.usernameAvailable')
  if (availability.value === 'error') return t('profile.usernameCheckFailed')
  return t('profile.usernameHint')
})
const usernameError = computed(
  () => errors.value.username || (availability.value === 'taken' ? t('profile.usernameTaken') : ''),
)

function startEdit() {
  if (!auth.user) return
  stopChecking()
  availability.value = 'idle'
  resetForm({
    values: {
      fullName: auth.user.fullName,
      username: auth.user.username,
      phone: auth.user.phone ?? '',
      currentPassword: '',
    },
  })
  editing.value = true
}
function cancelEdit() {
  stopChecking()
  availability.value = 'idle'
  editing.value = false
}

const onSubmit = handleSubmit(async (values) => {
  const user = auth.user
  if (!user) return
  if (availability.value === 'taken') return
  const payload: Parameters<typeof authApi.updateMe>[0] = {}
  const name = values.fullName.trim()
  const nextPhone = (values.phone ?? '').trim()
  const nextUsername = values.username.trim().toLowerCase()
  if (name !== user.fullName) payload.fullName = name
  if (nextPhone !== (user.phone ?? '')) payload.phone = nextPhone === '' ? null : nextPhone
  if (nextUsername !== user.username.toLowerCase()) {
    payload.username = nextUsername
    payload.currentPassword = values.currentPassword
  }
  if (Object.keys(payload).length === 0) {
    editing.value = false
    return
  }
  submitting.value = true
  try {
    auth.user = await authApi.updateMe(payload)
    toast.success(t('profile.infoSaved'))
    cancelEdit()
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT')
      setFieldError('username', t('profile.usernameTaken'))
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})

// O'z rasmi: faqat maktab xodimi (o'qituvchi / maktab admini)
const canPhoto = computed(() => auth.user?.role === 'teacher' || auth.user?.role === 'school_admin')
async function uploadPhoto(file: File) {
  auth.user = await authApi.setOwnPhoto(file)
}
async function removePhoto() {
  auth.user = await authApi.removeOwnPhoto()
}
</script>

<template>
  <section v-if="auth.user" class="card p-6" :aria-label="t('profile.info')">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-base font-semibold text-fg">{{ t('profile.info') }}</h2>
      <BaseButton
        v-if="!editing"
        size="sm"
        variant="secondary"
        data-testid="profile-edit"
        @click="startEdit"
      >
        <Pencil class="h-4 w-4" /> {{ t('profile.editInfo') }}
      </BaseButton>
    </div>
    <PhotoUploader
      v-if="canPhoto"
      class="mb-5"
      :name="auth.user.fullName"
      :photo="auth.user.photo"
      :upload="uploadPhoto"
      :remove="removePhoto"
    />

    <form
      v-if="editing"
      class="space-y-4"
      novalidate
      data-testid="profile-form"
      @submit.prevent="onSubmit"
    >
      <BaseInput
        v-model="fullName"
        v-bind="fullNameAttrs"
        data-testid="profile-fullName"
        autocomplete="name"
        :label="t('profile.fullName')"
        :error="errors.fullName"
        required
      />
      <BaseInput
        v-model="username"
        v-bind="usernameAttrs"
        data-testid="profile-username"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        :label="t('auth.username')"
        :hint="usernameHint"
        :error="usernameError"
        required
      />
      <BaseInput
        v-model="phone"
        v-bind="phoneAttrs"
        data-testid="profile-phone"
        type="tel"
        autocomplete="tel"
        placeholder="+998 90 123 45 67"
        :label="t('profile.phone')"
        :error="errors.phone"
      />
      <BaseInput
        v-if="usernameChanged"
        v-model="currentPassword"
        v-bind="currentPasswordAttrs"
        data-testid="profile-currentPassword"
        type="password"
        autocomplete="current-password"
        :label="t('profile.currentPasswordForUsername')"
        :error="errors.currentPassword"
        required
      />
      <div class="flex flex-wrap gap-2">
        <BaseButton type="submit" data-testid="profile-save" :loading="submitting">
          {{ t('profile.saveInfo') }}
        </BaseButton>
        <BaseButton variant="secondary" data-testid="profile-cancel" @click="cancelEdit">
          {{ t('common.cancel') }}
        </BaseButton>
      </div>
    </form>

    <dl v-else class="space-y-3 text-sm">
      <div class="flex justify-between gap-4">
        <dt class="text-fg-muted">{{ t('profile.fullName') }}</dt>
        <dd class="text-right font-medium text-fg">{{ auth.user.fullName }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-fg-muted">{{ t('auth.username') }}</dt>
        <dd class="break-all text-right font-medium text-fg">{{ auth.user.username }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-fg-muted">{{ t('profile.phone') }}</dt>
        <dd class="text-right font-medium text-fg">{{ auth.user.phone || '-' }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-fg-muted">{{ t('profile.role') }}</dt>
        <dd class="flex flex-wrap justify-end gap-1.5">
          <BaseBadge tone="primary">{{ t(ROLE_LABEL_KEYS[auth.user.role]) }}</BaseBadge>
          <BaseBadge v-if="auth.isOwner" tone="warning" data-testid="owner-badge">
            {{ t('profile.ownerBadge') }}
          </BaseBadge>
        </dd>
      </div>
      <div v-if="auth.user.lastLoginAt" class="flex justify-between gap-4">
        <dt class="text-fg-muted">{{ t('profile.lastLogin') }}</dt>
        <dd class="text-right text-fg">{{ formatDateTime(auth.user.lastLoginAt) }}</dd>
      </div>
    </dl>
  </section>
</template>
