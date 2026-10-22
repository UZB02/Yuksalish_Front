<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import PhotoUploader from './PhotoUploader.vue'

defineProps<{
  open: boolean
  name: string
  photo?: string | null
  upload: (file: File) => Promise<void>
  remove: () => Promise<void>
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>

<template>
  <BaseModal :open="open" :title="t('photo.title')" size="sm" @close="emit('close')">
    <PhotoUploader :name="name" :photo="photo" :upload="upload" :remove="remove" />
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.close') }}</BaseButton>
    </template>
  </BaseModal>
</template>
