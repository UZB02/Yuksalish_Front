<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { classesApi } from '@/api/classes.api'
import type { SchoolClass, Teacher } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

const props = defineProps<{
  open: boolean
  schoolClass: SchoolClass | null
  teachers: Teacher[]
  loading?: boolean
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const selected = ref<string[]>([])
const homeroomId = ref('')
const submitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen || !props.schoolClass) return
    selected.value = [...props.schoolClass.teacherIds]
    homeroomId.value = props.schoolClass.homeroomTeacherId ?? ''
  },
  { immediate: true },
)

// Sinf rahbari ham biriktirilgan o'qituvchi bo'lishi kerak.
const homeroomOptions = computed(() =>
  props.teachers
    .filter((tc) => selected.value.includes(tc.id))
    .map((tc) => ({ value: tc.id, label: tc.fullName })),
)

function toggle(id: string, value: boolean) {
  selected.value = value ? [...selected.value, id] : selected.value.filter((x) => x !== id)
  if (!value && homeroomId.value === id) homeroomId.value = ''
}

async function save() {
  if (!props.schoolClass) return
  submitting.value = true
  try {
    await classesApi.setTeachers(props.schoolClass.id, {
      teacherIds: selected.value,
      homeroomTeacherId: homeroomId.value || null,
    })
    toast.success(t('classes.teachersSaved'))
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
    :title="t('classes.assignTeachers')"
    :description="schoolClass?.name"
    persistent
    @close="emit('close')"
  >
    <p v-if="!loading && teachers.length === 0" class="text-sm text-fg-muted">
      {{ t('classes.noTeachers') }}
    </p>
    <div v-else class="space-y-4">
      <ul class="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
        <li v-for="tc in teachers" :key="tc.id">
          <BaseCheckbox
            :model-value="selected.includes(tc.id)"
            :label="tc.fullName"
            @update:model-value="toggle(tc.id, $event)"
          />
        </li>
      </ul>
      <BaseSelect
        v-model="homeroomId"
        :label="t('classes.homeroom')"
        :placeholder="t('classes.noHomeroom')"
        :options="homeroomOptions"
      />
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseModal>
</template>
