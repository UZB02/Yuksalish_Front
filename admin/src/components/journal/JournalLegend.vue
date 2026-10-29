<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { GRADE_CLASS } from './journal.utils'

const { t } = useI18n()
const grades = [5, 4, 3, 2]
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted"
    data-testid="legend"
  >
    <span v-for="g in grades" :key="g" class="inline-flex items-center gap-1.5">
      <span
        class="inline-flex h-5 w-5 items-center justify-center rounded font-semibold"
        :class="GRADE_CLASS[g]"
        >{{ g }}</span
      >
      {{ t(`journal.legend.grade${g}`) }}
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="inline-flex h-5 w-5 items-center justify-center font-semibold text-danger/70"
        >N</span
      >
      {{ t('journal.absence.N') }}
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="inline-flex h-5 w-5 items-center justify-center font-semibold text-fg-muted"
        >B</span
      >
      {{ t('journal.absence.B') }}
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="inline-block h-1.5 w-1.5 rounded-full bg-fg-muted" />
      {{ t('journal.absence.partial') }}
    </span>
  </div>
</template>
