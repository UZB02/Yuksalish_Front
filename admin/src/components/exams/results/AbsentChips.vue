<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/** Kirmaganlar: ism chiplari (sinf ostida yoki jadval ostida). `expandable`: "Ro'yxatda ko'rsatish" tugmasi */
defineProps<{ names: string[]; expandable?: boolean }>()
const emit = defineEmits<{ expand: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    v-if="names.length"
    class="flex flex-wrap items-center gap-1.5 border-t border-border pt-2 text-xs"
    data-testid="absent-chips"
  >
    <span class="mr-1 font-medium text-fg-muted">{{
      t('examResults.cards.absent', { n: names.length })
    }}</span>
    <span
      v-for="(n, i) in names"
      :key="i"
      class="rounded-full bg-surface-muted px-2 py-0.5 text-fg-muted"
      data-testid="absent-chip"
      >{{ n }}</span
    >
    <button
      v-if="expandable"
      type="button"
      class="ml-auto font-medium text-primary-700 hover:underline"
      data-testid="absent-expand"
      @click="emit('expand')"
    >
      {{ t('examResults.cards.showInList') }}
    </button>
  </div>
</template>
