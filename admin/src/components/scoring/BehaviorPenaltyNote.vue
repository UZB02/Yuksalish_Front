<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BehaviorType } from '@/api/types'

const props = defineProps<{
  types: BehaviorType[]
  typeId: string | null
  /** Sozlamalar → Reyting: xulq turi jarimasi yoqilganmi */
  enabled?: boolean
  /** Ball kiritilganmi (default: ha -> "yana"); ball bo'lmasa faqat jarima qaydi matni */
  scored?: boolean
}>()
const { t } = useI18n()

const penalty = computed(() =>
  props.enabled && props.typeId
    ? (props.types.find((x) => x.id === props.typeId)?.ratingPenalty ?? 0)
    : 0,
)
</script>

<template>
  <p v-if="penalty > 0" class="text-xs text-warning" data-testid="behavior-penalty-note">
    {{
      t(scored === false ? 'scoring.behaviorPenaltyOnlyNote' : 'scoring.behaviorPenaltyNote', {
        n: penalty,
      })
    }}
  </p>
</template>
