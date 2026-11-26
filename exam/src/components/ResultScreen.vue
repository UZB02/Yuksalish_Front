<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../inject'
import type { Block, ClientQuestion, ReviewItem } from '../lib/types'
import Icon from './Icon.vue'
import RichBlocks from './RichBlocks.vue'
import ScreenShell from './ScreenShell.vue'
import { RING_C, RING_R, TONE_BG, TONE_TEXT, percentOf, ringOffset, toneOf } from './resultMath'

const store = useStore()
/** O'zbekcha o'nlik vergul: 3.1 -> 3,1 */
const num = (n: number): string => String(n).replace('.', ',')
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
/** "Fayl + kalit" savoli: varaqadagi raqam; aks holda ko'rilgan savollar ichidagi o'rni */
const indexOf = (id: string) => qOf(id)?.no ?? questions.value.findIndex((q) => q.id === id) + 1
/** Variant matni; fayl savolida variant mazmuni yo'q (faqat harf) */
const optText = (q: ClientQuestion | undefined, id: string): Block[] => {
  const c = q?.options.find((o) => o.id === id)?.content
  return c && c.length ? c : [{ type: 'text', text: id }]
}
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

/** Umumiy foiz va rang (halqa uchun) */
const pct = computed(() =>
  r.value?.score ? percentOf(r.value.score.earned, r.value.score.max) : 0,
)
/** "Fanlar bo'yicha" qatorlari; blok bo'lmasa bitta "Jami" qatori */
const rows = computed(() => {
  const x = r.value
  if (!x?.score) return []
  const src = x.blocks?.length
    ? x.blocks
    : [{ id: 'all', title: 'Jami', earned: x.score.earned, max: x.score.max }]
  return src.map((b) => {
    const p = percentOf(b.earned, b.max)
    return { ...b, pct: p, tone: toneOf(p) }
  })
})
const hasBlocks = computed(() => !!r.value?.blocks?.length)
</script>

<template>
  <div v-if="r" class="w-full space-y-6" data-testid="result">
    <ScreenShell>
      <template #side>
        <div class="flex flex-col items-center gap-4 text-center">
          <div
            v-if="r.available && r.score"
            class="relative h-44 w-44 sm:h-48 sm:w-48"
            role="img"
            :aria-label="`Natija ${pct} foiz`"
            data-testid="result-ring"
          >
            <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90" aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                :r="RING_R"
                fill="none"
                stroke-width="10"
                class="stroke-muted"
              />
              <circle
                cx="60"
                cy="60"
                :r="RING_R"
                fill="none"
                stroke-width="10"
                stroke-linecap="round"
                class="stroke-current"
                :class="TONE_TEXT[toneOf(pct)]"
                :stroke-dasharray="RING_C"
                :stroke-dashoffset="ringOffset(pct)"
              />
            </svg>
            <span
              class="absolute inset-0 flex items-center justify-center text-4xl font-extrabold tabular-nums"
              aria-hidden="true"
              >{{ pct }}%</span
            >
          </div>
          <span
            v-else
            class="flex h-24 w-24 items-center justify-center rounded-full"
            :class="terminated ? 'bg-bad/20 text-bad' : 'bg-ok/20 text-ok'"
            data-testid="result-icon"
          >
            <Icon :name="terminated ? 'alert' : 'ok'" size="h-14 w-14" />
          </span>
          <p v-if="r.available && r.score" class="text-xl font-bold" data-testid="result-score">
            {{ num(r.score.earned) }} / {{ num(r.score.max) }} ball
          </p>
          <h1 class="text-2xl font-bold" data-testid="result-title">{{ title }}</h1>
          <p class="text-fg-soft">Javob berilgan savollar: {{ r.answeredCount }} / {{ r.total }}</p>
        </div>
      </template>

      <template v-if="r.available && r.score">
        <h2 class="text-xl font-bold">{{ hasBlocks ? 'Fanlar bo‘yicha' : 'Umumiy natija' }}</h2>
        <ul class="space-y-4" data-testid="result-blocks">
          <li v-for="b in rows" :key="b.id" data-testid="result-block">
            <div class="mb-1 flex items-baseline justify-between gap-3">
              <span class="min-w-0 break-words font-semibold">{{ b.title }}</span>
              <span class="shrink-0 tabular-nums"
                ><b>{{ num(b.earned) }} / {{ num(b.max) }}</b>
                <span :class="TONE_TEXT[b.tone]" class="ml-2 font-semibold"
                  >{{ b.pct }}%</span
                ></span
              >
            </div>
            <div class="h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                class="h-full rounded-full"
                :class="TONE_BG[b.tone]"
                :style="{ width: b.pct + '%' }"
              />
            </div>
          </li>
        </ul>
        <p
          v-if="r.score.essayPending"
          class="rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm"
          data-testid="essay-note"
        >
          {{ r.score.essayPending }} ta esse javob o‘qituvchi tomonidan tekshiriladi, ball oshishi
          mumkin.
        </p>
      </template>
      <p v-else class="rounded-xl bg-muted p-4 text-lg" data-testid="result-note">{{ note }}</p>
      <p v-if="terminated" class="text-lg text-bad" data-testid="terminated-note">
        Nazoratchi imtihonni to‘xtatdi. Shu paytgacha bergan javoblaringiz saqlandi. Imtihonni davom
        ettirib bo‘lmaydi: nazoratchiga murojaat qiling.
      </p>
      <button class="btn-ghost w-full gap-2" data-testid="leave" @click="store.leave()">
        <Icon name="logout" />Chiqish
      </button>
    </ScreenShell>

    <div v-if="r.review" class="min-w-0 space-y-3" data-testid="review">
      <h2 class="text-lg font-bold">Javoblar tahlili</h2>
      <article
        v-for="it in r.review"
        :key="it.id"
        class="card space-y-2"
        :class="it.ok === true ? 'border-ok' : it.ok === false ? 'border-bad' : ''"
        data-testid="review-item"
      >
        <div class="flex justify-between gap-2 text-sm text-fg-soft">
          <span
            >Savol {{ indexOf(it.id)
            }}<template v-if="r.blocks?.length && blockTitle(it.blockId)">
              · {{ blockTitle(it.blockId) }}</template
            ></span
          >
          <span class="shrink-0">{{ num(it.got) }} / {{ num(it.max) }}</span>
        </div>
        <RichBlocks v-if="qOf(it.id)" :blocks="qOf(it.id)!.content" class="text-lg" />
        <p class="break-words text-sm"><b>Sizning javobingiz:</b> {{ givenText(it) }}</p>
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
        <p v-else-if="it.reveal.texts?.length" class="break-words text-sm">
          <b>To‘g‘ri javob:</b> {{ it.reveal.texts.join(' / ') }}
        </p>
        <p v-else-if="it.ok === null" class="text-sm text-fg-soft">Esse: o‘qituvchi tekshiradi.</p>
      </article>
    </div>
  </div>
</template>
