<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { NavItem } from '@/constants/navigation'

defineProps<{
  item: NavItem
  /** Ixcham (faqat ikonka) rejim: tooltip va aria-label qo'shiladi */
  rail?: boolean
  /** Guruh ichidagi band: biroz ichkariroq */
  nested?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <RouterLink
    :to="{ name: item.name }"
    class="flex items-center gap-3 rounded-lg text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
    :class="[nested ? 'py-2 pl-4 pr-3' : 'px-3 py-2.5', rail && 'lg:justify-center lg:px-0']"
    :title="rail ? t(item.labelKey) : undefined"
    :aria-label="rail ? t(item.labelKey) : undefined"
    active-class="!bg-primary-50 !text-primary-700"
  >
    <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
    <span :class="rail && 'lg:hidden'" data-testid="nav-label">{{ t(item.labelKey) }}</span>
  </RouterLink>
</template>
