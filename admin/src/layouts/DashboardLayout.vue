<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const ui = useUiStore()
</script>

<template>
  <div class="min-h-full" :style="{ '--sidebar-w': ui.sidebarCollapsed ? '4rem' : '16rem' }">
    <AppSidebar class="print:hidden" />
    <div
      class="flex min-h-full flex-col transition-[padding] duration-200 lg:pl-[var(--sidebar-w)] print:pl-0"
    >
      <AppHeader class="print:hidden" />
      <main id="main" class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
