<script setup lang="ts">
import { computed, ref } from 'vue'
import { TEXT_LIMITS } from '../lib/answers'
import { isAnswered } from '../lib/grid'
import type { AnswerEntry, ClientQuestion } from '../lib/types'

/**
 * Javob varaqasi ("Fayl + kalit" bloki): savollar 1..N, har biri uchun variant harflari (A-F) yoki qisqa javob maydoni.
 * Telefonda pastda doim ko'rinadigan ochiladigan panel, keng ekranda o'ngdagi ustun.
 */
const props = defineProps<{
  questions: ClientQuestion[]
  answers: Record<string, AnswerEntry>
  /** Qog'oz yetkazish: fayl ko'rsatkichi yo'q, varaqa asosiy ekran (doim ochiq, pastga qotirilmaydi) */
  paper?: boolean
}>()
const emit = defineEmits<{
  pick: [q: ClientQuestion, optionId: string]
  text: [qid: string, v: string]
}>()

const open = ref(false)
const done = computed(
  () => props.questions.filter((q) => isAnswered(props.answers[q.id]?.value)).length,
)

const selected = (q: ClientQuestion): string[] => {
  const v = props.answers[q.id]?.value
  if (Array.isArray(v)) return v
  return typeof v === 'string' && q.type !== 'short' ? [v] : []
}
const text = (q: ClientQuestion) => {
  const v = props.answers[q.id]?.value
  return typeof v === 'string' ? v : ''
}
const label = (q: ClientQuestion) => q.no ?? props.questions.indexOf(q) + 1
</script>

<template>
  <section
    :class="
      paper
        ? 'mx-auto w-full max-w-2xl rounded-xl border-2 border-brand bg-surface'
        : 'fixed inset-x-0 bottom-[4.75rem] z-20 border-t-2 border-brand bg-surface shadow-[0_-4px_12px_rgba(0,0,0,0.12)] lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:rounded-xl lg:border-2 lg:shadow-none'
    "
    aria-label="Javob varaqasi"
    data-testid="answer-sheet"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between px-4 py-2.5 text-left font-semibold lg:cursor-default"
      :aria-expanded="open"
      data-testid="sheet-toggle"
      @click="open = !open"
    >
      <span>Javob varaqasi</span>
      <span
        class="text-sm tabular-nums"
        :class="done === questions.length ? 'text-ok' : 'text-fg-soft'"
      >
        <span data-testid="sheet-count">{{ done }} / {{ questions.length }}</span>
        <span v-if="!paper" class="ml-2 lg:hidden" aria-hidden="true">{{ open ? '▼' : '▲' }}</span>
      </span>
    </button>
    <div
      class="space-y-1.5 overflow-y-auto px-3 pb-3 lg:block"
      :class="[
        open || paper ? 'block' : 'hidden',
        paper ? '' : 'max-h-[42vh] lg:max-h-[calc(100vh-14rem)]',
      ]"
      data-testid="sheet-body"
    >
      <div
        v-for="q in questions"
        :key="q.id"
        class="flex items-center gap-2 rounded-lg border px-2 py-1.5"
        :class="isAnswered(answers[q.id]?.value) ? 'border-ok bg-ok/10' : 'border-line'"
        :data-testid="`sheet-row-${label(q)}`"
      >
        <span class="w-8 shrink-0 text-center text-sm font-bold tabular-nums">{{ label(q) }}</span>
        <div v-if="q.type === 'short'" class="min-w-0 flex-1">
          <input
            :value="text(q)"
            class="input !min-h-10 !py-1"
            :maxlength="TEXT_LIMITS.short"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            inputmode="text"
            placeholder="Javob"
            :data-testid="`sheet-text-${label(q)}`"
            @input="emit('text', q.id, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div v-else class="flex flex-1 flex-wrap gap-1.5">
          <button
            v-for="o in q.options"
            :key="o.id"
            type="button"
            class="flex h-10 min-w-10 items-center justify-center border-2 text-sm font-bold"
            :class="[
              q.type === 'multi' ? 'rounded-md' : 'rounded-full',
              selected(q).includes(o.id)
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-line bg-surface text-fg',
            ]"
            :aria-pressed="selected(q).includes(o.id)"
            :aria-label="`${label(q)}-savol, ${o.id}`"
            :data-testid="`sheet-opt-${label(q)}-${o.id}`"
            @click="emit('pick', q, o.id)"
          >
            {{ o.id }}
          </button>
          <span v-if="q.type === 'multi'" class="self-center text-xs text-fg-soft">bir nechta</span>
        </div>
      </div>
    </div>
  </section>
</template>
