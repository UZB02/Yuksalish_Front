<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../inject'
import type { Block, ClientQuestion, ReviewItem } from '../lib/types'
import RichBlocks from './RichBlocks.vue'

const store = useStore()
const r = computed(() => store.state.result)
/** Ko'rilgan barcha savollar (blokma-blok: oldingi bloklar ham) */
const questions = computed(() => store.state.allQuestions)
const blockTitle = (id: string | null | undefined) =>
  store.state.blocks.find((b) => b.id === id)?.title ?? ''

const terminated = computed(() => r.value?.terminated === true)
const title = computed(() =>
  terminated.value
    ? 'Imtihon nazoratchi tomonidan to‘xtatildi'
    : r.value?.status === 'auto_submitted'
      ? 'Vaqt tugadi: javoblar topshirildi'
      : 'Javoblaringiz qabul qilindi',
)
const note = computed(() => {
  const x = r.value
  if (!x) return ''
  if (x.available) return ''
  return x.mode === 'after_publish'
    ? 'Natija o‘qituvchi e’lon qilgandan keyin ko‘rinadi.'
    : 'Bu imtihon natijasi o‘quvchiga ko‘rsatilmaydi.'
})

const qOf = (id: string): ClientQuestion | undefined => questions.value.find((q) => q.id === id)
const indexOf = (id: string) => questions.value.findIndex((q) => q.id === id) + 1
const optText = (q: ClientQuestion | undefined, id: string): Block[] =>
  q?.options.find((o) => o.id === id)?.content ?? [{ type: 'text', text: id }]
const givenText = (it: ReviewItem): string => {
  const v = it.given
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length))
    return 'Javob berilmagan'
  const q = qOf(it.id)
  const ids = Array.isArray(v) ? v : [v]
  if (q && (q.type === 'single' || q.type === 'multi'))
    return ids.map((id) => plainOf(q, id)).join(', ')
  return ids.join(', ')
}
const plainOf = (q: ClientQuestion, id: string): string =>
  optText(q, id)
    .map((b) => (b.type === 'text' ? b.text : b.type === 'math' ? b.tex : ''))
    .join(' ')
    .trim() || id
</script>

<template>
  <div v-if="r" class="space-y-4" data-testid="result">
    <div class="card space-y-3 text-center">
      <h1 class="text-2xl font-bold" data-testid="result-title">{{ title }}</h1>
      <p v-if="terminated" class="text-lg text-bad" data-testid="terminated-note">
        Nazoratchi imtihonni to‘xtatdi. Shu paytgacha bergan javoblaringiz saqlandi. Imtihonni davom
        ettirib bo‘lmaydi: nazoratchiga murojaat qiling.
      </p>
      <p class="text-fg-soft">Javob berilgan savollar: {{ r.answeredCount }} / {{ r.total }}</p>
      <div v-if="r.available && r.score" class="rounded-xl bg-muted p-4" data-testid="result-score">
        <p class="text-sm text-fg-soft">Sizning ballingiz</p>
        <p class="text-4xl font-extrabold">
          {{ r.score.earned }} <span class="text-xl text-fg-soft">/ {{ r.score.max }}</span>
        </p>
        <p v-if="r.score.essayPending" class="mt-2 text-sm text-fg-soft" data-testid="essay-note">
          {{ r.score.essayPending }} ta esse javob o‘qituvchi tomonidan tekshiriladi, ball oshishi
          mumkin.
        </p>
        <ul
          v-if="r.blocks?.length"
          class="mt-3 flex flex-wrap justify-center gap-2 text-sm"
          data-testid="result-blocks"
        >
          <li
            v-for="b in r.blocks"
            :key="b.id"
            class="rounded-lg border border-line px-3 py-1.5"
            data-testid="result-block"
          >
            {{ b.title }}: <b>{{ b.earned }} / {{ b.max }}</b>
          </li>
        </ul>
      </div>
      <p v-else class="text-lg" data-testid="result-note">{{ note }}</p>
      <button class="btn-ghost" data-testid="leave" @click="store.leave()">Chiqish</button>
    </div>

    <div v-if="r.review" class="space-y-3" data-testid="review">
      <h2 class="text-lg font-bold">Javoblar tahlili</h2>
      <article
        v-for="it in r.review"
        :key="it.id"
        class="card space-y-2"
        :class="it.ok === true ? 'border-ok' : it.ok === false ? 'border-bad' : ''"
        data-testid="review-item"
      >
        <div class="flex justify-between text-sm text-fg-soft">
          <span
            >Savol {{ indexOf(it.id)
            }}<template v-if="r.blocks?.length && blockTitle(it.blockId)">
              · {{ blockTitle(it.blockId) }}</template
            ></span
          >
          <span>{{ it.got }} / {{ it.max }}</span>
        </div>
        <RichBlocks v-if="qOf(it.id)" :blocks="qOf(it.id)!.content" />
        <p class="text-sm"><b>Sizning javobingiz:</b> {{ givenText(it) }}</p>
        <div v-if="it.reveal.optionIds?.length" class="text-sm">
          <b>To‘g‘ri javob:</b>
          <RichBlocks
            v-for="id in it.reveal.optionIds"
            :key="id"
            :blocks="optText(qOf(it.id), id)"
            inline
            class="ml-2"
          />
        </div>
        <p v-else-if="it.reveal.texts?.length" class="text-sm">
          <b>To‘g‘ri javob:</b> {{ it.reveal.texts.join(' / ') }}
        </p>
        <p v-else-if="it.ok === null" class="text-sm text-fg-soft">Esse: o‘qituvchi tekshiradi.</p>
      </article>
    </div>
  </div>
</template>
