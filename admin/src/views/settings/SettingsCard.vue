<script setup lang="ts">
/** Sozlamalar kartasi: ixtiyoriy sarlavha/tavsif + ichida (divide-y) qatorlar. */
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <section class="card overflow-hidden">
    <header v-if="title" class="border-b border-border px-4 py-3.5 sm:px-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-fg">{{ title }}</h3>
        <slot name="actions" />
      </div>
      <p v-if="description" class="mt-0.5 text-xs text-fg-muted">{{ description }}</p>
    </header>
    <div class="px-4 sm:px-5"><slot /></div>
  </section>
</template>
