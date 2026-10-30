<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { visibleSettingsTabs, type SettingsTabKey } from '@/utils/settingsTabs'
import AttendanceSettingsTab from './AttendanceSettingsTab.vue'
import PublicSettingsTab from './PublicSettingsTab.vue'
import RatingSettingsTab from './RatingSettingsTab.vue'
import ScoringSettingsTab from './ScoringSettingsTab.vue'
import TimetableSettingsTab from './TimetableSettingsTab.vue'

interface SettingsTab {
  key: SettingsTabKey
  labelKey: string
  component: Component
}

const ALL: SettingsTab[] = [
  { key: 'scoring', labelKey: 'settings.tabs.scoring', component: ScoringSettingsTab },
  { key: 'rating', labelKey: 'settings.tabs.rating', component: RatingSettingsTab },
  { key: 'public', labelKey: 'settings.tabs.public', component: PublicSettingsTab },
  { key: 'attendance', labelKey: 'settings.tabs.attendance', component: AttendanceSettingsTab },
  { key: 'timetable', labelKey: 'settings.tabs.timetable', component: TimetableSettingsTab },
]

const { t } = useI18n()
const auth = useAuthStore()
// Maktab admini faqat "Davomat" va "Dars jadvali" tablarini ko'radi
const tabs = computed(() => {
  const keys = visibleSettingsTabs(auth.isSuperadmin, (p) => auth.hasPermission(p))
  return ALL.filter((x) => keys.includes(x.key))
})
const active = ref<SettingsTabKey>('scoring')
const current = computed(() => tabs.value.find((x) => x.key === active.value) ?? tabs.value[0])
</script>

<template>
  <PageHeader :title="t('settings.title')" :description="t('settings.description')" />

  <div
    role="tablist"
    :aria-label="t('settings.title')"
    class="mb-4 flex gap-1 overflow-x-auto border-b border-border"
  >
    <button
      v-for="tab in tabs"
      :id="`tab-${tab.key}`"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="current?.key === tab.key"
      :aria-controls="`panel-${tab.key}`"
      class="whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
      :class="
        current?.key === tab.key
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-fg-muted hover:text-fg'
      "
      @click="active = tab.key"
    >
      {{ t(tab.labelKey) }}
    </button>
  </div>

  <div
    v-if="current"
    :id="`panel-${current.key}`"
    role="tabpanel"
    :aria-labelledby="`tab-${current.key}`"
  >
    <component :is="current.component" />
  </div>
</template>
