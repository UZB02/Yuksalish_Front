<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from 'lucide-vue-next'
import { timetableApi } from '@/api/timetable.api'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import TeacherWeekPanel from '@/components/timetable/TeacherWeekPanel.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useTeacherWeek } from '@/composables/useTeacherWeek'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'

/** Maktab admini uchun: tanlangan o'qituvchining haftasi va haftalik darslar soni */
const { t } = useI18n()
const route = useRoute()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()
const w = useTeacherWeek((d) => timetableApi.teacherWeek(String(route.params.id), d))
const error = computed(() => (w.error.value ? errorMessage(w.error.value, t) : ''))

async function reload() {
  w.date.value = undefined
  await w.load()
}
onMounted(() => {
  if (!needsSchool.value) void w.load()
})
watch([() => route.params.id, () => schoolCtx.schoolId], () => !needsSchool.value && void reload())
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <header class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
      <RouterLink
        :to="{ name: 'timetable', query: { tab: 'teachers' } }"
        class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('timetable.backToTimetable') }}
      </RouterLink>
      <div class="min-w-0">
        <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl" data-testid="teacher-title">
          {{ w.week.value?.teacher.fullName ?? t('timetable.teacherWeek') }}
        </h1>
        <p class="mt-0.5 text-sm text-fg-muted">{{ t('timetable.teacherWeek') }}</p>
      </div>
    </header>
    <TeacherWeekPanel
      :week="w.week.value"
      :loading="w.loading.value"
      :error="error"
      @prev="w.shift(-1)"
      @next="w.shift(1)"
      @today="w.goToday()"
      @retry="w.load()"
    />
  </template>
</template>
