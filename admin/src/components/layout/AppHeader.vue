<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Menu } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import SchoolSwitcher from './SchoolSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
import UserMenu from './UserMenu.vue'

const { t } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6"
  >
    <button
      type="button"
      class="rounded-lg p-2 text-fg-muted hover:bg-surface-muted lg:hidden"
      :aria-label="t('nav.openMenu')"
      aria-controls="app-sidebar"
      :aria-expanded="ui.sidebarOpen"
      @click="ui.toggleSidebar()"
    >
      <Menu class="h-5 w-5" />
    </button>

    <SchoolSwitcher v-if="auth.isSuperadmin" />

    <div class="ml-auto flex items-center gap-1 sm:gap-2">
      <ThemeToggle />
      <UserMenu />
    </div>
  </header>
</template>
