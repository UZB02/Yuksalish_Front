<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import type { ExamTopic } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

/** Mavzu yaratish/tahrirlash oynasi (nom 1-150, tavsif ≤500) */
const props = defineProps<{ open: boolean; subjectId: string; item: ExamTopic | null }>()
const emit = defineEmits<{ close: []; saved: [topic: ExamTopic] }>()

const { t } = useI18n()
const toast = useToast()
const name = ref('')
const description = ref('')
const nameError = ref('')
const submitting = ref(false)
const isEdit = computed(() => !!props.item)

watch(
  () => props.open,
  (o) => {
    if (!o) return
    name.value = props.item?.name ?? ''
    description.value = props.item?.description ?? ''
    nameError.value = ''
  },
  { immediate: true },
)

async function submit() {
  nameError.value = ''
  const n = name.value.trim()
  if (!n) {
    nameError.value = t('exams.topics.errors.nameRequired')
    return
  }
  if (n.length > 150) {
    nameError.value = t('exams.topics.errors.nameLong')
    return
  }
  submitting.value = true
  try {
    const body = { name: n, description: description.value.trim() }
    const saved = props.item
      ? await examsApi.updateTopic(props.item.id, body)
      : await examsApi.createTopic(props.subjectId, body)
    toast.success(t(isEdit.value ? 'exams.topics.toast.updated' : 'exams.topics.toast.created'))
    emit('saved', saved)
  } catch (e) {
    if (isApiError(e) && e.code === 'CONFLICT') nameError.value = t('exams.topics.errors.duplicate')
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('exams.topics.editTitle') : t('exams.topics.addTitle')"
    persistent
    @close="emit('close')"
  >
    <form id="topic-form" class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="name"
        :label="t('exams.topics.name')"
        :error="nameError"
        :maxlength="150"
        required
        data-testid="topic-name"
      />
      <div>
        <label for="topic-desc" class="mb-1.5 block text-sm font-medium text-fg">
          {{ t('exams.topics.description') }}
        </label>
        <textarea
          id="topic-desc"
          v-model="description"
          rows="3"
          maxlength="500"
          class="block w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          data-testid="topic-description"
        />
        <p class="mt-1 text-xs text-fg-muted">{{ t('exams.topics.descriptionHint') }}</p>
      </div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="topic-form" :loading="submitting" data-testid="topic-save">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
