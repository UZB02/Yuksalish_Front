<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { teachersApi } from '@/api/teachers.api'
import type { SchoolClass, Teacher } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

const props = defineProps<{
  open: boolean
  teacher: Teacher | null
  classes: SchoolClass[]
  loading?: boolean
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const selected = ref<string[]>([])
const submitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) selected.value = (props.teacher?.classes ?? []).map((c) => c.id)
  },
  { immediate: true },
)

function toggle(id: string, value: boolean) {
  selected.value = value ? [...selected.value, id] : selected.value.filter((x) => x !== id)
}

async function save() {
  if (!props.teacher) return
  submitting.value = true
  try {
    await teachersApi.setClasses(props.teacher.id, selected.value)
    toast.success(t('teachers.classesSaved'))
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
    :title="t('teachers.assignClasses')"
    :description="teacher?.fullName"
    persistent
    @close="emit('close')"
  >
    <div v-if="loading" class="space-y-2">
      <Skeleton v-for="n in 4" :key="n" class="h-6 w-full" />
    </div>
    <p v-else-if="classes.length === 0" class="text-sm text-fg-muted">
      {{ t('teachers.noClasses') }}
    </p>
    <ul
      v-else
      class="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-2"
    >
      <li v-for="c in classes" :key="c.id">
        <BaseCheckbox
          :model-value="selected.includes(c.id)"
          :label="c.name"
          @update:model-value="toggle(c.id, $event)"
        />
      </li>
    </ul>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseModal>
</template>
