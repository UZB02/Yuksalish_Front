<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { usePermissionsMeta } from '@/composables/usePermissionsMeta'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import PermissionEditor from './PermissionEditor.vue'

const props = defineProps<{
  open: boolean
  targetName: string
  role: 'school_admin' | 'teacher'
  initial: string[]
  allowed?: string[] | null
  submit: (permissions: string[]) => Promise<unknown>
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const { permissions, loading: metaLoading, load: loadMeta } = usePermissionsMeta()
const selected = ref<string[]>([])
const submitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    selected.value = [...props.initial]
    void loadMeta()
  },
  { immediate: true },
)

async function save() {
  submitting.value = true
  try {
    await props.submit(selected.value)
    toast.success(t('permissions.saved'))
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
    :title="t('permissions.title')"
    :description="targetName"
    size="lg"
    persistent
    @close="emit('close')"
  >
    <PermissionEditor
      v-model="selected"
      :permissions="permissions"
      :role="role"
      :allowed="allowed"
      :loading="metaLoading"
    />
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" @click="save">{{ t('common.save') }}</BaseButton>
    </template>
  </BaseModal>
</template>
