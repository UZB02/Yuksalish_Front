<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { School as SchoolIcon } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <div class="card">
    <EmptyState
      :icon="SchoolIcon"
      :title="t('schoolSwitcher.selectFirst')"
      :description="t('schoolSwitcher.selectFirstText')"
    />
  </div>
</template>
