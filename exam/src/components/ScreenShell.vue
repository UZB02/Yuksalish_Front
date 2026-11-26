<script setup lang="ts">
/** Kirish / tasdiq / natija ekranlarining umumiy kartasi: lg+ da ikki ustun (chap: bo'yalgan panel) */
</script>

<template>
  <div
    class="w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:grid lg:grid-cols-[1fr_1.1fr]"
  >
    <section
      class="min-w-0 space-y-5 border-b border-line bg-brand/5 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10"
    >
      <slot name="side" />
    </section>
    <section class="min-w-0 space-y-5 p-6 sm:p-8 lg:p-10">
      <slot />
    </section>
  </div>
</template>
