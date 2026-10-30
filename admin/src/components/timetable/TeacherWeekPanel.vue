<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { TeacherWeek } from '@/api/timetable.api'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { formatDate } from '@/utils/format'
import TeacherWeekGrid from './TeacherWeekGrid.vue'

/** Hafta navigatsiyasi + haftalik darslar soni + jadval (o'qituvchi sahifalari uchun umumiy) */
defineProps<{ week: TeacherWeek | null; loading: boolean; error?: string }>()
const emit = defineEmits<{ prev: []; next: []; today: []; retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <BaseButton
        variant="secondary"
        size="sm"
        :aria-label="t('timetable.prevWeek')"
        data-testid="week-prev"
        @click="emit('prev')"
      >
        <ChevronLeft class="h-4 w-4" />
      </BaseButton>
      <span class="min-w-[10rem] text-center text-sm font-medium text-fg" data-testid="week-range">
        <template v-if="week">{{ formatDate(week.from) }} – {{ formatDate(week.to) }}</template>
      </span>
      <BaseButton
        variant="secondary"
        size="sm"
        :aria-label="t('timetable.nextWeek')"
        data-testid="week-next"
        @click="emit('next')"
      >
        <ChevronRight class="h-4 w-4" />
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('today')">
        {{ t('timetable.thisWeek') }}
      </BaseButton>
      <BaseBadge v-if="week" tone="primary" class="ml-auto" data-testid="week-count">
        {{ t('timetable.weeklyCount', { n: week.weeklyCount }) }}
      </BaseBadge>
    </div>

    <div v-if="error" class="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">
      <p class="text-danger">{{ error }}</p>
      <BaseButton class="mt-2" size="sm" variant="secondary" @click="emit('retry')">
        {{ t('common.retry') }}
      </BaseButton>
    </div>
    <div v-else-if="loading && !week" class="space-y-2">
      <Skeleton v-for="i in 5" :key="i" class="h-14 w-full" />
    </div>
    <TeacherWeekGrid v-else-if="week" :week="week" />
  </div>
</template>
