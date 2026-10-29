<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const ui = useUiStore()
const route = useRoute()
</script>

<template>
  <div class="min-h-full" :style="{ '--sidebar-w': ui.sidebarCollapsed ? '4rem' : '16rem' }">
    <AppSidebar class="print:hidden" />
    <div
      class="flex min-h-full flex-col transition-[padding] duration-200 lg:pl-[var(--sidebar-w)] print:pl-0"
    >
      <AppHeader class="print:hidden" />
      <!-- Jadval sahifalari mavjud kenglikni egallaydi (sidebar yig'ilsa kengayadi);
           forma sahifalari (meta.narrow) o'qishga qulay kenglikda; juda keng monitorda chegara 120rem -->
      <main
        id="main"
        class="mx-auto w-full flex-1 px-4 py-6 sm:px-6"
        :class="route.meta.narrow ? 'max-w-7xl' : 'max-w-[120rem]'"
        data-testid="main"
      >
        <RouterView />
      </main>
    </div>
  </div>
</template>
