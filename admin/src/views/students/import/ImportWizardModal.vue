<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useImportWizard, type ImportWizard } from '@/composables/useImportWizard'
import ImportPreviewStep from './ImportPreviewStep.vue'
import ImportResultStep from './ImportResultStep.vue'
import ImportUploadStep from './ImportUploadStep.vue'

const props = defineProps<{
  open: boolean
  /** Sinf sahifasidan ochilganda sinf id va nomi */
  classId?: string
  className?: string
}>()
const emit = defineEmits<{ close: []; imported: [] }>()

const { t } = useI18n()
const wizard: ImportWizard = reactive(useImportWizard(() => props.classId))

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) wizard.reset()
  },
)

// Natija ko'rsatilganda ro'yxat avtomatik yangilanadi.
watch(
  () => wizard.step,
  (s) => {
    if (s === 'result') emit('imported')
  },
)

const titleKey = () => `import.title.${wizard.step}`
</script>

<template>
  <BaseModal
    :open="open"
    :title="t(titleKey())"
    :description="
      t('import.stepOf', { n: ['upload', 'preview', 'result'].indexOf(wizard.step) + 1 })
    "
    size="xl"
    persistent
    @close="emit('close')"
  >
    <ImportUploadStep v-if="wizard.step === 'upload'" :wizard="wizard" :class-name="className" />
    <ImportPreviewStep v-else-if="wizard.step === 'preview'" :wizard="wizard" />
    <ImportResultStep v-else :wizard="wizard" />

    <template #footer>
      <template v-if="wizard.step === 'upload'">
        <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
        <BaseButton :disabled="!wizard.file" :loading="wizard.uploading" @click="wizard.upload()">
          {{ t('import.check') }}
        </BaseButton>
      </template>
      <template v-else-if="wizard.step === 'preview'">
        <BaseButton variant="secondary" @click="wizard.backToUpload()">
          {{ t('import.back') }}
        </BaseButton>
        <BaseButton
          :disabled="!wizard.canConfirm"
          :loading="wizard.confirming"
          @click="wizard.confirm()"
        >
          {{ t('import.confirm', { n: wizard.importableCount }) }}
        </BaseButton>
      </template>
      <BaseButton v-else @click="emit('close')">{{ t('common.close') }}</BaseButton>
    </template>
  </BaseModal>
</template>
