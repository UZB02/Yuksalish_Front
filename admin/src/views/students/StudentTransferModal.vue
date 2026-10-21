<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { studentsApi } from '@/api/students.api'
import type { SchoolClass, Student } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

const props = defineProps<{ open: boolean; student: Student | null; classes: SchoolClass[] }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const target = ref('')
const error = ref('')
const submitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    target.value = ''
    error.value = ''
  },
  { immediate: true },
)

// Joriy sinf ro'yxatdan chiqariladi.
const options = computed(() =>
  props.classes
    .filter((c) => c.id !== props.student?.classId)
    .map((c) => ({ value: c.id, label: c.name })),
)

async function save() {
  if (!props.student) return
  if (!target.value) {
    error.value = t('validation.selectClass')
    return
  }
  submitting.value = true
  try {
    await studentsApi.transfer(props.student.id, target.value)
    toast.success(t('students.transferred'))
    emit('saved')
    emit('close')
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('students.transfer')"
    :description="student ? `${student.fullName} (${student.class.name})` : undefined"
    size="sm"
    persistent
    @close="emit('close')"
  >
    <BaseSelect
      v-model="target"
      :label="t('students.newClass')"
      :placeholder="t('students.selectClass')"
      :options="options"
      :error="error"
      required
    />
    <p class="mt-3 text-xs text-fg-muted">{{ t('students.transferHint') }}</p>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" @click="save">{{ t('students.transfer') }}</BaseButton>
    </template>
  </BaseModal>
</template>
