<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import type { FlowStage } from '@/utils/examFlow'

/** 6 bosqichli ko'rsatkich: bajarilganlar yashil, joriysi ajratilgan. "Savollar" bosqichida muddat ("22.11 gacha") */
defineProps<{ stages: FlowStage[]; deadline?: string | null }>()
const { t } = useI18n()
</script>

<template>
  <ol class="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6" data-testid="stage-bar">
    <li
      v-for="(st, i) in stages"
      :key="st.key"
      class="flex min-w-0 flex-col gap-0.5 rounded-lg border px-2.5 py-2"
      :class="
        st.state === 'done'
          ? 'border-success/40 bg-success-soft text-success'
          : st.state === 'current'
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-border bg-surface-muted text-fg-muted'
      "
      :aria-current="st.state === 'current' ? 'step' : undefined"
      :data-testid="`stage-${st.key}`"
      :data-state="st.state"
    >
      <span class="flex items-center gap-1 text-xs font-semibold">
        <Check v-if="st.state === 'done'" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span v-else>{{ i + 1 }}.</span>
        <span class="truncate">{{ t(`examFlow.step.${st.key}`) }}</span>
      </span>
      <span
        v-if="st.key === 'questions' && deadline"
        class="truncate text-[11px] opacity-80"
        data-testid="stage-deadline"
      >
        {{ t('examFlow.untilShort', { date: deadline }) }}
      </span>
    </li>
  </ol>
</template>
