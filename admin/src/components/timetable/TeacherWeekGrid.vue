<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TeacherWeek, TimetableLesson } from '@/api/timetable.api'
import { formatDate } from '@/utils/format'

/** O'qituvchi haftasi: kompyuterda to'r (kun x dars), mobilda kunlar bo'yicha kartalar */
const props = defineProps<{ week: TeacherWeek }>()
const { t } = useI18n()

const rows = computed(() =>
  Array.from({ length: props.week.settings.lessonsPerDay }, (_, i) => i + 1),
)
const at = (date: string, n: number): TimetableLesson[] =>
  props.week.days.find((d) => d.date === date)?.lessons.filter((l) => l.lessonNo === n) ?? []
const hasAny = computed(() => props.week.days.some((d) => d.lessons.length))
</script>

<template>
  <div data-testid="week-grid">
    <!-- Kompyuter -->
    <div class="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
      <table class="w-full min-w-[640px] table-fixed border-collapse text-sm">
        <thead>
          <tr class="bg-surface-muted">
            <th class="w-12 border-b border-border px-2 py-2 text-center text-xs text-fg-muted">
              #
            </th>
            <th
              v-for="d in week.days"
              :key="d.date"
              class="border-b border-l border-border px-2 py-2 text-left text-xs font-semibold"
              :class="d.date === week.today ? 'text-primary-700' : 'text-fg'"
              :data-testid="`week-day-${d.weekday}`"
            >
              {{ t(`journal.weekdayLong.${d.weekday}`) }}
              <span class="block font-normal text-fg-muted">{{ formatDate(d.date) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in rows" :key="n">
            <th
              class="border-t border-border px-2 py-2 text-center text-xs font-semibold text-fg-muted"
            >
              {{ n }}
            </th>
            <td
              v-for="d in week.days"
              :key="d.date"
              class="h-16 border-l border-t border-border px-2 py-1.5 align-top"
              :class="d.date === week.today ? 'bg-primary-50/60 dark:bg-primary-500/10' : ''"
              :data-testid="`week-cell-${d.weekday}-${n}`"
            >
              <div v-for="(l, i) in at(d.date, n)" :key="i" class="min-w-0">
                <div class="truncate text-sm font-semibold text-fg">{{ l.class?.name }}</div>
                <div class="truncate text-xs text-fg-muted">{{ l.subject.name }}</div>
                <div v-if="l.room" class="text-xs text-fg-muted">
                  {{ t('timetable.room') }}: {{ l.room }}
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobil -->
    <div class="space-y-3 md:hidden">
      <section
        v-for="d in week.days"
        :key="d.date"
        class="rounded-xl border bg-surface"
        :class="d.date === week.today ? 'border-primary-500' : 'border-border'"
      >
        <header class="flex items-center justify-between border-b border-border px-3 py-2">
          <h3 class="text-sm font-semibold text-fg">{{ t(`journal.weekdayLong.${d.weekday}`) }}</h3>
          <span class="text-xs text-fg-muted">{{ formatDate(d.date) }}</span>
        </header>
        <p v-if="!d.lessons.length" class="px-3 py-3 text-sm text-fg-muted">
          {{ t('timetable.noLessonsDay') }}
        </p>
        <ul v-else class="divide-y divide-border">
          <li v-for="(l, i) in d.lessons" :key="i" class="flex items-center gap-3 px-3 py-2">
            <span class="w-5 text-center text-sm font-semibold text-fg-muted">{{
              l.lessonNo
            }}</span>
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-fg">
                {{ l.class?.name }} · {{ l.subject.name }}
              </div>
              <div v-if="l.room" class="text-xs text-fg-muted">
                {{ t('timetable.room') }}: {{ l.room }}
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
    <p v-if="!hasAny" class="mt-3 text-sm text-fg-muted">{{ t('timetable.noLessonsWeek') }}</p>
  </div>
</template>
