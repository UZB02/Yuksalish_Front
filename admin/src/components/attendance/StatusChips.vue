<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AttendanceStatus } from '@/api/types'
import { textOn } from '@/utils/attendance'

defineProps<{
  statuses: AttendanceStatus[]
  modelValue: string | null
  disabled?: boolean
  invalid?: boolean
  label?: string
}>()
const emit = defineEmits<{ pick: [statusId: string] }>()
const { t } = useI18n()
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label ?? t('attendance.status')"
    :aria-invalid="invalid"
    class="flex flex-wrap gap-2"
  >
    <button
      v-for="s in statuses"
      :key="s.id"
      type="button"
      role="radio"
      :aria-checked="modelValue === s.id"
      :disabled="disabled"
      :title="s.name"
      class="inline-flex min-h-[2.75rem] min-w-[2.75rem] flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
      :class="invalid && !modelValue ? 'ring-2 ring-danger' : ''"
      :style="
        modelValue === s.id
          ? { backgroundColor: s.color, borderColor: s.color, color: textOn(s.color) }
          : { borderColor: s.color, color: 'rgb(var(--fg))' }
      "
      data-testid="status-chip"
      @click="emit('pick', s.id)"
    >
      <span class="text-base font-bold">{{ s.shortName }}</span>
      <span class="hidden text-xs font-medium sm:inline">{{ s.name }}</span>
    </button>
  </div>
</template>
