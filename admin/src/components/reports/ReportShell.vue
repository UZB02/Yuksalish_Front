<script setup lang="ts">
import { BarChart3 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { ApiError } from '@/api/errors'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { errorMessage } from '@/utils/errors'

defineProps<{
  loading: boolean
  error: ApiError | null
  empty: boolean
  /** Majburiy filtr tanlanmagan (so'rov yuborilmagan) */
  idle?: boolean
  idleText?: string
}>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div v-if="idle" class="card" data-testid="report-idle">
    <EmptyState :icon="BarChart3" :title="idleText ?? t('reports.idle')" />
  </div>
  <div v-else-if="error" class="card" data-testid="report-error">
    <EmptyState :title="t('errors.loadFailed')" :description="errorMessage(error, t)">
      <BaseButton variant="secondary" @click="emit('retry')">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>
  <div v-else-if="loading" class="space-y-3" data-testid="report-loading" aria-busy="true">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Skeleton v-for="n in 4" :key="n" class="h-20 w-full" />
    </div>
    <Skeleton class="h-64 w-full" />
  </div>
  <div v-else-if="empty" class="card" data-testid="report-empty">
    <EmptyState
      :icon="BarChart3"
      :title="t('reports.emptyTitle')"
      :description="t('reports.emptyText')"
    />
  </div>
  <div v-else class="space-y-4"><slot /></div>
</template>
