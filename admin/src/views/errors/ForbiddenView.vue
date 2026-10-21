<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ShieldAlert } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <EmptyState
    :icon="ShieldAlert"
    :title="t('errors.forbiddenTitle')"
    :description="t('errors.forbiddenText')"
  >
    <RouterLink :to="{ name: 'profile' }">
      <BaseButton variant="secondary">{{ t('nav.profile') }}</BaseButton>
    </RouterLink>
  </EmptyState>
</template>
