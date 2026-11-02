<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Globe,
  Image as ImageIcon,
  Palette,
  Send,
  Trophy,
} from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { isAnythingDirty } from '@/composables/useDirtyRegistry'
import { useAuthStore } from '@/stores/auth'
import { visibleSettingsTabs, type SettingsTabKey } from '@/utils/settingsTabs'
import BrandingSettingsTab from './BrandingSettingsTab.vue'
import SchoolLogoTab from './SchoolLogoTab.vue'
import AttendanceSettingsTab from './AttendanceSettingsTab.vue'
import PublicSettingsTab from './PublicSettingsTab.vue'
import RatingSettingsTab from './RatingSettingsTab.vue'
import ScoringSettingsTab from './ScoringSettingsTab.vue'
import TimetableSettingsTab from './TimetableSettingsTab.vue'
import TelegramSettingsTab from './TelegramSettingsTab.vue'

interface SettingsTab {
  key: SettingsTabKey
  labelKey: string
  icon: Component
  component: Component
}

const ALL: SettingsTab[] = [
  {
    key: 'scoring',
    labelKey: 'settings.tabs.scoring',
    icon: ClipboardCheck,
    component: ScoringSettingsTab,
  },
  { key: 'rating', labelKey: 'settings.tabs.rating', icon: Trophy, component: RatingSettingsTab },
  { key: 'public', labelKey: 'settings.tabs.public', icon: Globe, component: PublicSettingsTab },
  {
    key: 'attendance',
    labelKey: 'settings.tabs.attendance',
    icon: CalendarCheck,
    component: AttendanceSettingsTab,
  },
  {
    key: 'timetable',
    labelKey: 'settings.tabs.timetable',
    icon: CalendarDays,
    component: TimetableSettingsTab,
  },
  {
    key: 'branding',
    labelKey: 'settings.tabs.branding',
    icon: Palette,
    component: BrandingSettingsTab,
  },
  {
    key: 'schoolLogo',
    labelKey: 'settings.tabs.schoolLogo',
    icon: ImageIcon,
    component: SchoolLogoTab,
  },
  {
    key: 'telegram',
    labelKey: 'settings.tabs.telegram',
    icon: Send,
    component: TelegramSettingsTab,
  },
]

/** Yon menyu guruhlari (bo'sh guruhlar rolga qarab yashiriladi) */
const GROUPS: { key: string; tabs: SettingsTabKey[] }[] = [
  { key: 'grading', tabs: ['scoring', 'rating'] },
  { key: 'process', tabs: ['attendance', 'timetable'] },
  { key: 'publicSite', tabs: ['public'] },
  { key: 'appearance', tabs: ['branding', 'schoolLogo'] },
  { key: 'integrations', tabs: ['telegram'] },
]

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { confirm } = useConfirm()

// Maktab admini faqat o'ziga ruxsat berilgan bo'limlarni ko'radi
const tabs = computed(() => {
  const keys = visibleSettingsTabs(
    auth.isSuperadmin,
    (p) => auth.hasPermission(p),
    auth.role === 'school_admin',
  )
  return ALL.filter((x) => keys.includes(x.key))
})
const groups = computed(() =>
  GROUPS.map((g) => ({
    key: g.key,
    items: g.tabs
      .map((k) => tabs.value.find((x) => x.key === k))
      .filter((x): x is SettingsTab => !!x),
  })).filter((g) => g.items.length > 0),
)

// ?tab= - yagona manba: marshrut. Noma'lum yoki ruxsatsiz qiymat birinchi bo'limga tushadi.
const current = computed(
  () => tabs.value.find((x) => x.key === String(route.query.tab ?? '')) ?? tabs.value[0],
)

async function select(key: SettingsTabKey) {
  if (key === current.value?.key) return
  if (isAnythingDirty()) {
    const ok = await confirm({
      title: t('settings.leave.title'),
      message: t('settings.leave.text'),
      confirmText: t('settings.leave.confirm'),
      variant: 'danger',
    })
    if (!ok) return
  }
  // replace: tarixni to'ldirmaydi
  await router.replace({ query: { ...route.query, tab: key } })
}
</script>

<template>
  <PageHeader :title="t('settings.title')" :description="t('settings.description')" />

  <div class="lg:grid lg:grid-cols-[13.75rem_minmax(0,1fr)] lg:items-start lg:gap-8">
    <nav
      :aria-label="t('settings.navLabel')"
      class="-mx-4 mb-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:sticky lg:top-20 lg:mx-0 lg:mb-0 lg:overflow-visible lg:p-0"
      data-testid="settings-nav"
    >
      <div class="flex w-max gap-1.5 lg:block lg:w-auto lg:space-y-5">
        <div
          v-for="g in groups"
          :key="g.key"
          class="flex gap-1.5 lg:block lg:space-y-0.5"
          :data-testid="`settings-group-${g.key}`"
        >
          <p
            class="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted lg:block"
          >
            {{ t(`settings.groups.${g.key}`) }}
          </p>
          <button
            v-for="tab in g.items"
            :key="tab.key"
            type="button"
            :aria-current="current?.key === tab.key ? 'page' : undefined"
            :data-testid="`settings-nav-${tab.key}`"
            class="relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 lg:w-full lg:rounded-lg lg:border-transparent lg:py-2"
            :class="
              current?.key === tab.key
                ? 'border-primary-600/30 bg-primary-50 text-primary-700'
                : 'border-border text-fg-muted hover:bg-surface-muted hover:text-fg lg:border-transparent'
            "
            @click="select(tab.key)"
          >
            <span
              v-if="current?.key === tab.key"
              class="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-primary-600 lg:block"
              aria-hidden="true"
            />
            <component :is="tab.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ t(tab.labelKey) }}
          </button>
        </div>
      </div>
    </nav>

    <div v-if="current" class="min-w-0 max-w-4xl" data-testid="settings-content">
      <header class="mb-4">
        <h2 class="text-lg font-semibold text-fg" data-testid="settings-section-title">
          {{ t(current.labelKey) }}
        </h2>
        <p class="mt-0.5 text-sm text-fg-muted">{{ t(`settings.sections.${current.key}`) }}</p>
      </header>
      <component :is="current.component" :key="current.key" />
    </div>
  </div>
</template>
