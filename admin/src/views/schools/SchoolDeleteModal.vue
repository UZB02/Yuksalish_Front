<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'
import { schoolsApi } from '@/api/schools.api'
import { isApiError } from '@/api/errors'
import type { School, SchoolDeletePreview } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Spinner from '@/components/ui/Spinner.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

const props = defineProps<{ open: boolean; school: School | null }>()
const emit = defineEmits<{ close: []; deleted: [id: string] }>()

const { t } = useI18n()
const toast = useToast()

const preview = ref<SchoolDeletePreview | null>(null)
const previewLoading = ref(false)
const previewError = ref('')

const confirmName = ref('')
const password = ref('')
const acknowledge = ref(false)
const submitting = ref(false)
const nameError = ref('')
const passwordError = ref('')
const generalError = ref('')

/** Server ham aynan shuni tekshiradi: ikki chetdagi bo'shliqlar e'tiborsiz, registr muhim */
const nameMatches = computed(
  () => !!props.school && confirmName.value.trim() === props.school.name.trim(),
)
const nameShownError = computed(
  () =>
    nameError.value ||
    (confirmName.value && !nameMatches.value ? t('schools.delete.nameMismatch') : ''),
)
const canSubmit = computed(
  () =>
    !!props.school &&
    !props.school.isActive &&
    nameMatches.value &&
    password.value.length > 0 &&
    acknowledge.value &&
    !submitting.value,
)
const visibleItems = computed(() => (preview.value?.items ?? []).filter((i) => i.count > 0))

async function loadPreview(id: string) {
  previewLoading.value = true
  previewError.value = ''
  preview.value = null
  try {
    preview.value = await schoolsApi.deletePreview(id)
  } catch (e) {
    previewError.value = errorMessage(e, t)
  } finally {
    previewLoading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen || !props.school) return
    confirmName.value = ''
    password.value = ''
    acknowledge.value = false
    nameError.value = ''
    passwordError.value = ''
    generalError.value = ''
    void loadPreview(props.school.id)
  },
  { immediate: true },
)

// Kiritish o'zgarganda tegishli server xatosi tozalanadi
watch(confirmName, () => (nameError.value = ''))
watch(password, () => {
  passwordError.value = ''
  generalError.value = ''
})

async function submit() {
  const school = props.school
  if (!school || !canSubmit.value) return
  submitting.value = true
  nameError.value = passwordError.value = generalError.value = ''
  try {
    await schoolsApi.remove(school.id, {
      confirmName: confirmName.value.trim(),
      password: password.value,
      acknowledge: true,
    })
    toast.success(t('schools.delete.done'))
    emit('deleted', school.id)
    emit('close')
  } catch (e) {
    if (isApiError(e) && e.code === 'INVALID_PASSWORD') {
      passwordError.value = t('schools.delete.wrongPassword')
    } else if (isApiError(e) && e.code === 'RATE_LIMITED') {
      generalError.value = e.message || t('schools.delete.rateLimited')
    } else if (isApiError(e) && e.details.some((d) => d.path === 'confirmName')) {
      nameError.value = t('schools.delete.nameMismatch')
    } else {
      generalError.value = isApiError(e) && e.code === 'CONFLICT' ? e.message : errorMessage(e, t)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('schools.delete.title')"
    size="lg"
    persistent
    layer="top"
    @close="emit('close')"
  >
    <form
      v-if="school"
      id="school-delete-form"
      class="space-y-4"
      novalidate
      data-testid="school-delete-form"
      @submit.prevent="submit"
    >
      <div
        class="flex items-start gap-3 rounded-lg border border-danger bg-danger/10 p-3 text-sm text-danger"
        role="alert"
        data-testid="school-delete-warning"
      >
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
        <p class="font-medium">{{ t('schools.delete.warning') }}</p>
      </div>

      <p v-if="school.isActive" class="text-sm text-danger" data-testid="school-delete-active">
        {{ t('schools.delete.notInactive') }}
      </p>

      <div data-testid="school-delete-preview">
        <div v-if="previewLoading" class="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner class="h-4 w-4" /> {{ t('schools.delete.loading') }}
        </div>
        <p v-else-if="previewError" class="text-sm text-danger">
          {{ t('schools.delete.loadFailed') }}: {{ previewError }}
        </p>
        <template v-else-if="preview">
          <p class="mb-2 text-sm font-medium text-fg">{{ t('schools.delete.willDelete') }}</p>
          <ul
            v-if="visibleItems.length"
            class="grid max-h-56 grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm sm:grid-cols-2"
          >
            <li
              v-for="item in visibleItems"
              :key="item.key"
              class="flex justify-between gap-3"
              :data-testid="`preview-${item.key}`"
            >
              <span class="text-fg-muted">{{ item.label }}</span>
              <span class="font-medium tabular-nums text-fg">{{ item.count }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-fg-muted">{{ t('schools.delete.nothing') }}</p>
          <p class="mt-2 text-xs text-fg-muted">
            {{ t('schools.delete.total', { count: preview.total }) }}
          </p>
        </template>
      </div>

      <div>
        <p id="school-delete-name-label" class="mb-1.5 text-sm font-medium text-fg">
          <i18n-t keypath="schools.delete.confirmName" scope="global">
            <template #name>
              <b class="break-all text-danger" data-testid="school-delete-name-hint">{{
                school.name
              }}</b>
            </template>
          </i18n-t>
        </p>
        <BaseInput
          v-model="confirmName"
          aria-labelledby="school-delete-name-label"
          :error="nameShownError"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          data-testid="school-delete-name"
        />
      </div>

      <BaseInput
        v-model="password"
        type="password"
        :label="t('schools.delete.password')"
        :hint="t('schools.delete.passwordHint')"
        :error="passwordError"
        autocomplete="current-password"
        data-testid="school-delete-password"
      />

      <BaseCheckbox
        v-model="acknowledge"
        :label="t('schools.delete.acknowledge')"
        data-testid="school-delete-ack"
      />

      <p
        v-if="generalError"
        class="text-sm text-danger"
        role="alert"
        data-testid="school-delete-error"
      >
        {{ generalError }}
      </p>
    </form>
    <template #footer>
      <BaseButton variant="secondary" :disabled="submitting" @click="emit('close')">
        {{ t('common.cancel') }}
      </BaseButton>
      <BaseButton
        type="submit"
        form="school-delete-form"
        variant="danger"
        :disabled="!canSubmit"
        :loading="submitting"
        data-testid="school-delete-submit"
      >
        {{ t('schools.delete.submit') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
