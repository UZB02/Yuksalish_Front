<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{ page: number; totalPages: number; total: number; limit: number }>()
const emit = defineEmits<{ change: [page: number] }>()
const { t } = useI18n()
</script>

<template>
  <nav
    class="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row"
    :aria-label="t('common.pagination')"
  >
    <p class="text-sm text-fg-muted">
      {{
        t('common.paginationInfo', {
          from: total === 0 ? 0 : (page - 1) * limit + 1,
          to: Math.min(page * limit, total),
          total,
        })
      }}
    </p>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page <= 1"
        :aria-label="t('common.prev')"
        @click="emit('change', page - 1)"
      >
        <ChevronLeft class="h-4 w-4" />
      </button>
      <span class="min-w-[4.5rem] text-center text-sm text-fg" aria-live="polite">
        {{ page }} / {{ totalPages }}
      </span>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page >= totalPages"
        :aria-label="t('common.next')"
        @click="emit('change', page + 1)"
      >
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>
  </nav>
</template>
