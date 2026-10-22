<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useConfirm } from '@/composables/useConfirm'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

const { t } = useI18n()
const { state, settle } = useConfirm()
</script>

<template>
  <BaseModal
    :open="state.open"
    :title="state.options.title"
    size="sm"
    layer="top"
    @close="settle(false)"
  >
    <p v-if="state.options.message" class="whitespace-pre-line text-sm text-fg-muted">
      {{ state.options.message }}
    </p>
    <template #footer>
      <BaseButton variant="secondary" @click="settle(false)">
        {{ state.options.cancelText ?? t('common.cancel') }}
      </BaseButton>
      <BaseButton :variant="state.options.variant ?? 'primary'" @click="settle(true)">
        {{ state.options.confirmText ?? t('common.confirm') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
