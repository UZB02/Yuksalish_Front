<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OverrideType } from '@/api/timetable.api'
import BaseBadge from '@/components/ui/BaseBadge.vue'

/** Almashtirish turi belgisi: o'rinbosar / fan almashtirildi / bekor / qo'shimcha / ko'chirildi */
const props = defineProps<{ type: OverrideType | null | undefined; moved?: boolean }>()
const { t } = useI18n()

const TONES = {
  substitute: 'info',
  replace: 'warning',
  cancel: 'danger',
  extra: 'success',
} as const

const key = computed(() => (props.moved ? 'moved' : props.type))
const tone = computed(() => (props.moved || !props.type ? 'neutral' : TONES[props.type]))
</script>

<template>
  <BaseBadge v-if="key" :tone="tone" :data-override-type="key">
    {{ t(`substitutions.type.${key}`) }}
  </BaseBadge>
</template>
