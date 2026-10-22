<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onKeyStroke, useMediaQuery } from '@vueuse/core'
import { BarChart3, PanelLeftClose, PanelLeftOpen, X } from 'lucide-vue-next'
import { NAV_ITEMS } from '@/constants/navigation'
import { canAccess } from '@/router/guards'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const isDesktop = useMediaQuery('(min-width: 1024px)')
const closeBtn = ref<HTMLButtonElement | null>(null)

const items = computed(() => NAV_ITEMS.filter((i) => canAccess(auth, i)))

// Mobilda sahifa o'zgarganda drawer yopiladi.
watch(
  () => route.fullPath,
  () => ui.closeSidebar(),
)
watch(isDesktop, (v) => v && ui.closeSidebar())
watch(
  () => ui.sidebarOpen,
  async (open) => {
    if (open && !isDesktop.value) {
      await nextTick()
      closeBtn.value?.focus()
    }
  },
)
onKeyStroke('Escape', () => ui.sidebarOpen && ui.closeSidebar())

// Yopiq drawer ichidagi elementlar klaviatura va ekran o'quvchidan yashiriladi.
const collapsed = computed(() => ui.sidebarCollapsed)
const hidden = computed(() => !isDesktop.value && !ui.sidebarOpen)
</script>

<template>
  <div>
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.sidebarOpen && !isDesktop"
        class="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        aria-hidden="true"
        @click="ui.closeSidebar()"
      />
    </Transition>

    <aside
      id="app-sidebar"
      class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-[transform,width] duration-200 lg:w-[var(--sidebar-w,16rem)] lg:translate-x-0"
      :class="ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      :inert="hidden"
      :aria-label="t('nav.main')"
    >
      <div
        :class="[
          'flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-5',
          collapsed && 'lg:justify-center lg:px-0',
        ]"
      >
        <div class="flex items-center gap-2.5" :class="collapsed && 'lg:hidden'">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white"
          >
            <BarChart3 class="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            class="text-sm font-semibold leading-tight text-fg"
            data-testid="sidebar-brand-label"
            >{{ t('app.name') }}</span
          >
        </div>
        <!-- Yig'ish/yoyish (faqat lg+): yig'ilganda logotipning o'zi yoyish tugmasi bo'ladi -->
        <button
          v-if="collapsed"
          type="button"
          class="group hidden h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 lg:flex"
          :aria-label="t('nav.expand')"
          :title="t('nav.expand')"
          :aria-expanded="false"
          aria-controls="app-sidebar"
          data-testid="sidebar-collapse-toggle"
          @click="ui.toggleSidebarCollapsed()"
        >
          <BarChart3
            class="h-4 w-4 group-hover:hidden group-focus-visible:hidden"
            aria-hidden="true"
          />
          <PanelLeftOpen
            class="hidden h-4 w-4 group-hover:block group-focus-visible:block"
            aria-hidden="true"
          />
        </button>
        <button
          v-else
          type="button"
          class="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg lg:flex"
          :aria-label="t('nav.collapse')"
          :title="t('nav.collapse')"
          :aria-expanded="true"
          aria-controls="app-sidebar"
          data-testid="sidebar-collapse-toggle"
          @click="ui.toggleSidebarCollapsed()"
        >
          <PanelLeftClose class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          ref="closeBtn"
          type="button"
          class="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted lg:hidden"
          :aria-label="t('common.close')"
          @click="ui.closeSidebar()"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
        <RouterLink
          v-for="item in items"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
          :class="collapsed && 'lg:justify-center lg:px-0'"
          :title="collapsed ? t(item.labelKey) : undefined"
          :aria-label="collapsed ? t(item.labelKey) : undefined"
          active-class="!bg-primary-50 !text-primary-700"
        >
          <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
          <span :class="collapsed && 'lg:hidden'" data-testid="nav-label">{{
            t(item.labelKey)
          }}</span>
        </RouterLink>
      </nav>
    </aside>
  </div>
</template>
