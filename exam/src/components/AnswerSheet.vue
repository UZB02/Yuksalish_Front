<script setup lang="ts">
import { computed, ref } from 'vue'
import { TEXT_LIMITS } from '../lib/answers'
import { isAnswered } from '../lib/grid'
import type { AnswerEntry, ClientQuestion } from '../lib/types'
import Icon from './Icon.vue'

/**
 * Javob varaqasi ("Fayl + kalit" bloki): savollar 1..N, har biri uchun variant harflari (A-F) yoki qisqa javob maydoni.
 * Kompyuterda o'ngdagi doimiy ustun (pastida "Topshirish" doim ko'rinadi), telefonda pastga qotirilgan ochiladigan panel.
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
const pct = computed(() =>
  props.questions.length ? (done.value / props.questions.length) * 100 : 0,
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
    class="flex flex-col bg-surface"
    :class="
      paper
        ? 'mx-auto w-full max-w-2xl rounded-2xl border-2 border-brand'
        : 'fixed inset-x-0 bottom-0 z-30 border-t-2 border-brand pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.12)] lg:static lg:z-auto lg:h-full lg:min-h-0 lg:rounded-2xl lg:border-2 lg:pb-0 lg:shadow-none'
    "
    aria-label="Javoblar varag‘i"
    data-testid="answer-sheet"
  >
    <button
      type="button"
      class="flex min-h-12 w-full shrink-0 items-center justify-between gap-2 px-4 py-2 text-left font-semibold lg:cursor-default"
      :aria-expanded="paper ? true : open"
      data-testid="sheet-toggle"
      @click="open = !open"
    >
      <span class="text-lg">Javoblar varag‘i</span>
      <span
        class="flex items-center gap-1 tabular-nums"
        :class="done === questions.length ? 'text-ok' : 'text-fg-soft'"
      >
        <span data-testid="sheet-count">{{ done }} / {{ questions.length }}</span>
        <Icon v-if="!paper" :name="open ? 'down' : 'up'" class="lg:hidden" />
      </span>
    </button>
    <div class="hidden shrink-0 px-4 pb-2 lg:block" :class="paper ? '!block' : ''">
      <div
        class="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(pct)"
        aria-label="Javob berilgan savollar"
      >
        <div class="h-full rounded-full bg-brand" :style="{ width: pct + '%' }" />
      </div>
    </div>
    <div
      class="min-h-0 space-y-1.5 overflow-y-auto px-3 pb-3 lg:block lg:flex-1"
      :class="[open || paper ? 'block' : 'hidden', paper ? '' : 'max-h-[40dvh] lg:max-h-none']"
      data-testid="sheet-body"
    >
      <div
        v-for="q in questions"
        :key="q.id"
        class="flex items-center gap-2 rounded-xl border px-2 py-1.5"
        :class="isAnswered(answers[q.id]?.value) ? 'border-ok bg-ok/10' : 'border-line'"
        :data-testid="`sheet-row-${label(q)}`"
      >
        <span class="w-8 shrink-0 text-center text-sm font-bold tabular-nums">{{ label(q) }}</span>
        <div v-if="q.type === 'short'" class="min-w-0 flex-1">
          <input
            :value="text(q)"
            class="input !min-h-11 !py-1 !text-lg"
            :maxlength="TEXT_LIMITS.short"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            inputmode="text"
            placeholder="Javob"
            :aria-label="`${label(q)}-savol javobi`"
            :data-testid="`sheet-text-${label(q)}`"
            @input="emit('text', q.id, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div v-else class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <button
            v-for="o in q.options"
            :key="o.id"
            type="button"
            class="flex h-11 w-11 items-center justify-center border-2 text-base font-bold"
            :class="[
              q.type === 'multi' ? 'rounded-lg' : 'rounded-full',
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
    <div v-if="$slots.footer" class="shrink-0 border-t border-line p-3">
      <slot name="footer" />
    </div>
  </section>
</template>
