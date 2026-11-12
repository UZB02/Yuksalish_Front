<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/** "Faqat jarima qaydi" (ball yo'q) belgisi: ball o'rnida "−N" ko'rsatiladi. */
defineProps<{ penalty?: number }>()
const { t } = useI18n()
</script>

<template>
  <span
    v-if="(penalty ?? 0) > 0"
    class="inline-flex items-center rounded-md border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-sm font-semibold leading-none text-danger"
    :title="t('scoring.penaltyOnlyHint', { n: penalty })"
    data-testid="penalty-badge"
  >
    −{{ penalty }}
  </span>
  <span v-else class="text-fg-muted">-</span>
</template>
