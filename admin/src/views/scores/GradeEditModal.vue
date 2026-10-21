<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { gradesApi } from '@/api/grades.api'
import { isApiError } from '@/api/errors'
import type { SubjectGrade } from '@/api/types'
import GradeButtons from '@/components/grading/GradeButtons.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { GRADE_COMMENT_MAX, validateGradeDraft } from '@/utils/grades'

const props = defineProps<{ open: boolean; grade: SubjectGrade | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const value = ref<number | null>(null)
const comment = ref('')
const submitted = ref(false)
const submitting = ref(false)
const serverErrors = ref<Record<string, string>>({})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen || !props.grade) return
    value.value = props.grade.value
    comment.value = props.grade.comment ?? ''
    submitted.value = false
    serverErrors.value = {}
  },
  { immediate: true },
)

const errors = computed(() => validateGradeDraft({ value: value.value, comment: comment.value }))
const msg = (key?: string) =>
  key && submitted.value ? t(`grading.errors.${key}`, { limit: GRADE_COMMENT_MAX }) : ''

async function save() {
  submitted.value = true
  if (!props.grade || Object.keys(errors.value).length) return
  submitting.value = true
  try {
    await gradesApi.update(props.grade.id, {
      value: value.value as number,
      comment: comment.value.trim() === '' ? null : comment.value.trim(),
    })
    toast.success(t('grades.updated'))
    emit('saved')
    emit('close')
  } catch (e) {
    const mapped: Record<string, string> = {}
    if (isApiError(e))
      for (const d of e.details) mapped[d.path.split('.').pop() ?? d.path] = d.message
    if (Object.keys(mapped).length) serverErrors.value = mapped
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('grades.edit')"
    :description="
      grade
        ? `${grade.student.fullName} - ${grade.subject.name} - ${formatDate(grade.date)}`
        : undefined
    "
    persistent
    @close="emit('close')"
  >
    <div class="space-y-4">
      <div>
        <p class="mb-1.5 text-sm font-medium text-fg">{{ t('grading.grade') }}</p>
        <GradeButtons v-model="value" :invalid="!!msg(errors.value)" />
        <p v-if="msg(errors.value)" class="mt-1 text-xs text-danger" role="alert">
          {{ msg(errors.value) }}
        </p>
        <p v-if="serverErrors.value" class="mt-1 text-xs text-danger" role="alert">
          {{ serverErrors.value }}
        </p>
      </div>
      <div>
        <label for="grade-comment" class="mb-1.5 block text-sm font-medium text-fg">
          {{ t('scoring.comment') }}
        </label>
        <textarea
          id="grade-comment"
          v-model="comment"
          rows="3"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500"
        />
        <p v-if="msg(errors.comment)" class="mt-1 text-xs text-danger" role="alert">
          {{ msg(errors.comment) }}
        </p>
        <p v-if="serverErrors.comment" class="mt-1 text-xs text-danger" role="alert">
          {{ serverErrors.comment }}
        </p>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseModal>
</template>
