<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Lock, Plus, X } from 'lucide-vue-next'
import type { TieBreakKey } from '@/api/types'
import { moveItem, normalizeTieBreak } from '@/utils/ratingForm'

const props = defineProps<{ modelValue: TieBreakKey[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: TieBreakKey[]] }>()
const { t } = useI18n()

const CHOICES: TieBreakKey[] = ['daysCount', 'scoresCount']

// "Alifbo" har doim oxirida va qulflangan: tahrirlanadigan ro'yxat undan tashqari.
const head = computed(() => normalizeTieBreak(props.modelValue).slice(0, -1))
const missing = computed(() => CHOICES.filter((c) => !head.value.includes(c)))

const commit = (list: TieBreakKey[]) => emit('update:modelValue', normalizeTieBreak(list))
const move = (i: number, d: -1 | 1) => commit(moveItem(head.value, i, d))
const remove = (i: number) => commit(head.value.filter((_, idx) => idx !== i))
const add = (k: TieBreakKey) => commit([...head.value, k])
</script>

<template>
  <div>
    <ol class="space-y-1.5" :aria-label="t('settings.fields.tieBreak.label')">
      <li
        v-for="(k, i) in head"
        :key="k"
        data-testid="tie-item"
        class="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      >
        <span class="w-5 text-fg-muted">{{ i + 1 }}.</span>
        <span class="flex-1 text-fg">{{ t(`settings.options.tieBreak.${k}`) }}</span>
        <button
          type="button"
          class="rounded p-1 text-fg-muted hover:bg-surface-muted disabled:opacity-30"
          :disabled="disabled || i === 0"
          :aria-label="t('settings.tie.up')"
          data-testid="tie-up"
          @click="move(i, -1)"
        >
          <ArrowUp class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded p-1 text-fg-muted hover:bg-surface-muted disabled:opacity-30"
          :disabled="disabled || i === head.length - 1"
          :aria-label="t('settings.tie.down')"
          data-testid="tie-down"
          @click="move(i, 1)"
        >
          <ArrowDown class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded p-1 text-danger hover:bg-surface-muted disabled:opacity-30"
          :disabled="disabled"
          :aria-label="t('settings.tie.remove')"
          data-testid="tie-remove"
          @click="remove(i)"
        >
          <X class="h-4 w-4" />
        </button>
      </li>
      <li
        data-testid="tie-locked"
        class="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted px-3 py-2 text-sm text-fg-muted"
      >
        <span class="w-5">{{ head.length + 1 }}.</span>
        <span class="flex-1">{{ t('settings.options.tieBreak.alphabetical') }}</span>
        <Lock class="h-4 w-4" aria-hidden="true" />
        <span class="sr-only">{{ t('settings.tie.locked') }}</span>
      </li>
    </ol>
    <div v-if="missing.length" class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="k in missing"
        :key="k"
        type="button"
        class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-fg-muted hover:bg-surface-muted disabled:opacity-50"
        :disabled="disabled"
        data-testid="tie-add"
        @click="add(k)"
      >
        <Plus class="h-3.5 w-3.5" /> {{ t(`settings.options.tieBreak.${k}`) }}
      </button>
    </div>
  </div>
</template>
