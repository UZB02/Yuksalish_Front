<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
</script>

<template>
  <div class="min-h-full">
    <AppSidebar class="print:hidden" />
    <div class="flex min-h-full flex-col lg:pl-64 print:pl-0">
      <AppHeader class="print:hidden" />
      <main id="main" class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
