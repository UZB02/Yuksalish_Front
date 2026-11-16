<script setup lang="ts">
import { computed } from 'vue'
import { TEXT_LIMITS } from '../lib/answers'
import type { AnswerValue, ClientQuestion } from '../lib/types'
import RichBlocks from './RichBlocks.vue'

const props = defineProps<{ question: ClientQuestion; value: AnswerValue }>()
const emit = defineEmits<{ pick: [optionId: string]; text: [value: string] }>()

const selected = computed<string[]>(() => {
  const v = props.value
  if (Array.isArray(v)) return v
  return typeof v === 'string' && props.question.type === 'single' ? [v] : []
})
const text = computed(() => (typeof props.value === 'string' ? props.value : ''))
const limit = computed(() =>
  props.question.type === 'essay' ? TEXT_LIMITS.essay : TEXT_LIMITS.short,
)
</script>

<template>
  <div v-if="question.type === 'single' || question.type === 'multi'" class="space-y-3">
    <p v-if="question.type === 'multi'" class="text-sm text-fg-soft">
      Bir nechta to‘g‘ri javobni belgilang.
    </p>
    <button
      v-for="o in question.options"
      :key="o.id"
      type="button"
      class="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors"
      :class="selected.includes(o.id) ? 'border-brand bg-brand/10' : 'border-line bg-surface'"
      :aria-pressed="selected.includes(o.id)"
      :data-testid="`option-${o.id}`"
      @click="emit('pick', o.id)"
    >
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center border-2"
        :class="[
          question.type === 'single' ? 'rounded-full' : 'rounded-md',
          selected.includes(o.id) ? 'border-brand bg-brand text-brand-fg' : 'border-line',
        ]"
        aria-hidden="true"
      >
        <span v-if="selected.includes(o.id)" class="text-xs">✓</span>
      </span>
      <RichBlocks :blocks="o.content" class="min-w-0 flex-1" />
    </button>
  </div>
  <div v-else>
    <textarea
      v-if="question.type === 'essay'"
      :value="text"
      class="input min-h-48 resize-y py-3 text-lg"
      :maxlength="limit"
      placeholder="Javobingizni yozing"
      data-testid="answer-text"
      @input="emit('text', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      :value="text"
      class="input"
      :maxlength="limit"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="Javobingizni kiriting"
      data-testid="answer-text"
      @input="emit('text', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="question.type === 'essay'" class="mt-1 text-right text-sm text-fg-soft">
      {{ text.length }} / {{ limit }}
    </p>
  </div>
</template>
