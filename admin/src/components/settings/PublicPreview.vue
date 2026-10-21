<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Medal } from 'lucide-vue-next'
import type { PublicSettings } from '@/api/types'

const props = defineProps<{
  settings: PublicSettings
  /** Sarlavha belgilanmagan bo'lsa ko'rsatiladigan maktab nomi */
  schoolName?: string
}>()
const { t } = useI18n()

const SAMPLES = [
  { key: 'student1', score: 96.4, change: 2 },
  { key: 'student2', score: 94.1, change: 0 },
  { key: 'student3', score: 91.8, change: -1 },
  { key: 'student4', score: 88.2, change: 3 },
  { key: 'student5', score: 85.7, change: -2 },
]

const accent = computed(() => props.settings.primaryColor ?? 'rgb(var(--primary-600))')
const title = computed(
  () => props.settings.title || props.schoolName || t('settingsPublic.preview.defaultTitle'),
)
const rows = computed(() =>
  props.settings.topStudents === null
    ? SAMPLES
    : SAMPLES.slice(0, Math.max(1, props.settings.topStudents)),
)
const medalColors = ['#f59e0b', '#94a3b8', '#b45309']
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
    role="img"
    :aria-label="t('settingsPublic.preview.label')"
    data-testid="public-preview"
  >
    <div
      class="px-4 py-4 text-white"
      :style="{ backgroundColor: accent }"
      data-testid="preview-header"
    >
      <p class="text-base font-semibold" data-testid="preview-title">{{ title }}</p>
      <p v-if="settings.subtitle" class="mt-0.5 text-xs opacity-90" data-testid="preview-subtitle">
        {{ settings.subtitle }}
      </p>
    </div>

    <p
      v-if="!settings.enabled"
      class="bg-warning-soft px-4 py-2 text-xs text-warning"
      data-testid="preview-disabled"
    >
      {{ t('settingsPublic.preview.disabled') }}
    </p>

    <div v-if="settings.showClasses || settings.showStudents" class="flex gap-2 px-4 pt-3 text-xs">
      <span
        v-if="settings.showStudents"
        class="rounded-full px-2.5 py-1 font-medium text-white"
        :style="{ backgroundColor: accent }"
      >
        {{ t('settingsPublic.preview.students') }}
      </span>
      <span
        v-if="settings.showClasses"
        class="rounded-full border border-border px-2.5 py-1 text-fg-muted"
        data-testid="preview-classes-tab"
      >
        {{ t('settingsPublic.preview.classes') }}
      </span>
    </div>
    <p v-else class="px-4 py-6 text-center text-xs text-fg-muted">
      {{ t('settingsPublic.preview.nothing') }}
    </p>

    <table v-if="settings.showStudents" class="mt-2 w-full text-sm" data-testid="preview-table">
      <tbody class="divide-y divide-border">
        <tr v-for="(s, i) in rows" :key="s.key" data-testid="preview-row">
          <td class="w-10 py-2 pl-4">
            <Medal
              v-if="settings.showMedals && i < 3"
              class="h-4 w-4"
              :style="{ color: medalColors[i] }"
              data-testid="preview-medal"
              aria-hidden="true"
            />
            <span v-else class="text-fg-muted">{{ i + 1 }}</span>
          </td>
          <td class="py-2 text-fg">{{ t(`settingsPublic.preview.${s.key}`) }}</td>
          <td v-if="settings.showTrend" class="w-10 py-2 text-xs" data-testid="preview-trend">
            <span v-if="s.change > 0" class="inline-flex items-center text-success">
              <ArrowUp class="h-3 w-3" />{{ s.change }}
            </span>
            <span v-else-if="s.change < 0" class="inline-flex items-center text-danger">
              <ArrowDown class="h-3 w-3" />{{ -s.change }}
            </span>
            <span v-else class="text-fg-muted">-</span>
          </td>
          <td
            v-if="settings.showScores"
            class="py-2 pr-4 text-right font-semibold text-fg"
            data-testid="preview-score"
          >
            {{ s.score }}
          </td>
        </tr>
      </tbody>
    </table>
    <p class="border-t border-border px-4 py-2 text-xs text-fg-muted">
      {{
        t('settingsPublic.preview.footer', {
          refresh: settings.autoRefreshSeconds,
          slide: settings.tvSlideSeconds,
        })
      }}
    </p>
  </div>
</template>
