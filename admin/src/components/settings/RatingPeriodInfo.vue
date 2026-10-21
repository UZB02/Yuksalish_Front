<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import { ratingsApi } from '@/api/ratings.api'
import type { RatingConfig } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { formatDate, formatDateTime } from '@/utils/format'

const props = defineProps<{ schoolId?: string }>()
const { t } = useI18n()
const toast = useToast()

const config = ref<RatingConfig | null>(null)
const loading = ref(false)
const recalculating = ref(false)
const error = ref('')

async function load() {
  if (!props.schoolId) {
    config.value = null
    return
  }
  loading.value = true
  error.value = ''
  try {
    config.value = await ratingsApi.config(props.schoolId)
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

async function recalc() {
  recalculating.value = true
  try {
    await ratingsApi.recalculate(props.schoolId)
    toast.success(t('ratings.recalculated'))
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    recalculating.value = false
  }
}

onMounted(load)
watch(() => props.schoolId, load)
</script>

<template>
  <div class="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-sm">
    <p v-if="!schoolId" class="text-fg-muted">{{ t('settingsRating.pickSchoolForPeriod') }}</p>
    <template v-else>
      <p v-if="error" class="text-danger" role="alert">{{ error }}</p>
      <p v-else-if="loading && !config" class="text-fg-muted">{{ t('common.loading') }}</p>
      <template v-else-if="config">
        <p class="text-fg">
          {{ t('settingsRating.currentPeriod') }}:
          <b>{{ config.period.label }}</b>
          ({{ formatDate(config.period.from) }} - {{ formatDate(config.period.to) }})
        </p>
        <p v-if="config.period.fallback" class="mt-1 text-xs text-warning">
          {{ t('ratings.fallbackNote') }}
        </p>
        <p class="mt-1 text-xs text-fg-muted">
          {{ t('ratings.calculatedAt') }}:
          {{
            config.calculatedAt ? formatDateTime(config.calculatedAt) : t('ratings.notCalculated')
          }}
        </p>
      </template>
      <BaseButton
        class="mt-3"
        size="sm"
        variant="secondary"
        :loading="recalculating"
        @click="recalc"
      >
        <RefreshCw class="h-4 w-4" /> {{ t('ratings.recalculate') }}
      </BaseButton>
    </template>
  </div>
</template>
