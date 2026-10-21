<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SearchX } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-full items-center justify-center p-4">
    <EmptyState
      :icon="SearchX"
      :title="t('errors.notFoundTitle')"
      :description="t('errors.notFoundText')"
    >
      <RouterLink :to="{ name: 'home' }">
        <BaseButton>{{ t('errors.toHome') }}</BaseButton>
      </RouterLink>
    </EmptyState>
  </div>
</template>
