<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronRight } from 'lucide-vue-next'

/** Savollar banki > Fan > Mavzu yo'li. Oxirgi element joriy sahifa (havolasiz) */
defineProps<{ items: { label: string; to?: RouteLocationRaw }[] }>()
const { t } = useI18n()
</script>

<template>
  <nav :aria-label="t('exams.breadcrumb')" class="mb-4 text-sm" data-testid="exam-breadcrumb">
    <ol class="flex flex-wrap items-center gap-1 text-fg-muted">
      <li v-for="(it, i) in items" :key="i" class="flex min-w-0 items-center gap-1">
        <ChevronRight v-if="i > 0" class="h-4 w-4 shrink-0" aria-hidden="true" />
        <RouterLink
          v-if="it.to && i < items.length - 1"
          :to="it.to"
          class="truncate rounded hover:text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
        >
          {{ it.label }}
        </RouterLink>
        <span v-else class="truncate font-medium text-fg" aria-current="page">{{ it.label }}</span>
      </li>
    </ol>
  </nav>
</template>
