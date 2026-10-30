<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOnline } from '@vueuse/core'
import { WifiOff } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import InstallBanner from '@/components/pwa/InstallBanner.vue'

const ui = useUiStore()
const route = useRoute()
const { t } = useI18n()
const online = useOnline()
</script>

<template>
  <div class="min-h-full" :style="{ '--sidebar-w': ui.sidebarCollapsed ? '4rem' : '16rem' }">
    <AppSidebar class="print:hidden" />
    <div
      class="flex min-h-full flex-col transition-[padding] duration-200 lg:pl-[var(--sidebar-w)] print:pl-0"
    >
      <AppHeader class="print:hidden" />
      <div
        v-if="!online"
        role="status"
        class="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning print:hidden"
        data-testid="offline-banner"
      >
        <WifiOff class="h-4 w-4 shrink-0" aria-hidden="true" /> {{ t('pwa.offline.banner') }}
      </div>
      <!-- Jadval sahifalari mavjud kenglikni egallaydi (sidebar yig'ilsa kengayadi);
           forma sahifalari (meta.narrow) o'qishga qulay kenglikda; juda keng monitorda chegara 120rem -->
      <main
        id="main"
        class="mx-auto w-full flex-1 px-4 py-6 sm:px-6"
        :class="route.meta.narrow ? 'max-w-7xl' : 'max-w-[120rem]'"
        data-testid="main"
      >
        <InstallBanner />
        <RouterView />
      </main>
    </div>
  </div>
</template>
