<script setup lang="ts">
import { computed } from 'vue'
import { TEXT_LIMITS } from '../lib/answers'
import type { AnswerValue, ClientQuestion } from '../lib/types'
import { optionsFitTwoColumns } from './answerLayout'
import Icon from './Icon.vue'
import RichBlocks from './RichBlocks.vue'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const props = defineProps<{ question: ClientQuestion; value: AnswerValue }>()
const emit = defineEmits<{ pick: [optionId: string]; text: [value: string] }>()

const selected = computed<string[]>(() => {
  const v = props.value
  if (Array.isArray(v)) return v
  return typeof v === 'string' && props.question.type === 'single' ? [v] : []
})
const twoCols = computed(() => optionsFitTwoColumns(props.question))
const text = computed(() => (typeof props.value === 'string' ? props.value : ''))
const limit = computed(() =>
  props.question.type === 'essay' ? TEXT_LIMITS.essay : TEXT_LIMITS.short,
)
</script>

<template>
  <div
    v-if="question.type === 'single' || question.type === 'multi'"
    class="grid gap-3"
    :class="twoCols ? 'xl:grid-cols-2' : ''"
    :data-cols="twoCols ? 2 : 1"
    :role="question.type === 'multi' ? 'group' : 'radiogroup'"
    aria-label="Javob variantlari"
  >
    <p v-if="question.type === 'multi'" class="text-sm text-fg-soft xl:col-span-2">
      Bir nechta to‘g‘ri javobni belgilang.
    </p>
    <button
      v-for="(o, k) in question.options"
      :key="o.id"
      type="button"
      class="flex min-h-[3.75rem] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg transition-colors 2xl:min-h-[4.5rem] 2xl:text-xl"
      :class="selected.includes(o.id) ? 'border-brand bg-brand/10' : 'border-line bg-surface'"
      :aria-pressed="selected.includes(o.id)"
      :data-testid="`option-${o.id}`"
      @click="emit('pick', o.id)"
    >
      <span
        class="flex h-9 w-9 shrink-0 2xl:h-11 2xl:w-11 items-center justify-center border-2 font-bold"
        :class="[
          question.type === 'single' ? 'rounded-full' : 'rounded-lg',
          selected.includes(o.id)
            ? 'border-brand bg-brand text-brand-fg'
            : 'border-line text-fg-soft',
        ]"
        aria-hidden="true"
      >
        <Icon v-if="selected.includes(o.id) && question.type === 'multi'" name="check" />
        <template v-else>{{ LETTERS[k] ?? k + 1 }}</template>
      </span>
      <RichBlocks :blocks="o.content" class="min-w-0 flex-1 break-words" />
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
