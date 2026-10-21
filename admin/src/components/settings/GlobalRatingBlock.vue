<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe } from 'lucide-vue-next'
import { ratingsApi } from '@/api/ratings.api'
import type { SchoolRatingItem } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import PublicLink from './PublicLink.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { t } = useI18n()

const schools = ref<SchoolRatingItem[]>([])
const failed = ref(false)

onMounted(async () => {
  try {
    schools.value = await ratingsApi.schools()
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <section
    class="mt-4 rounded-xl border border-primary-200 bg-primary-50 p-4"
    data-testid="global-rating-block"
  >
    <div class="flex items-start gap-3">
      <Globe class="mt-0.5 h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold text-fg">{{ t('settingsPublic.global.title') }}</h3>
        <p class="mt-0.5 text-xs text-fg-muted">{{ t('settingsPublic.global.text') }}</p>
        <BaseSwitch
          class="mt-3"
          :model-value="modelValue"
          :label="t('settingsPublic.global.switch')"
          @update:model-value="emit('update:modelValue', $event)"
        />
        <div v-if="modelValue" class="mt-3 space-y-2">
          <PublicLink slug="global" />
          <p class="text-xs font-medium text-fg">{{ t('settingsPublic.global.included') }}</p>
          <p v-if="failed" class="text-xs text-fg-muted">
            {{ t('settingsPublic.global.listFailed') }}
          </p>
          <ul v-else class="flex flex-wrap gap-1.5">
            <li v-for="s in schools.filter((x) => x.enabled)" :key="s.schoolId">
              <BaseBadge tone="primary">{{ s.name }}</BaseBadge>
            </li>
            <li v-if="!schools.some((x) => x.enabled)" class="text-xs text-fg-muted">
              {{ t('settingsPublic.global.none') }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
