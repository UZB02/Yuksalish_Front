<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../inject'
import { countFlagged, countUnanswered, gridCells } from '../lib/grid'
import { requestFullscreen } from '../lib/events'
import { formatRemaining, isLowTime } from '../lib/timer'
import AnswerInput from './AnswerInput.vue'
import RichBlocks from './RichBlocks.vue'

const store = useStore()
const s = store.state

const q = computed(() => s.questions[s.index])
const cells = computed(() => gridCells(s.questions, s.answers))
const unanswered = computed(() => countUnanswered(s.questions, s.answers))
const flagged = computed(() => countFlagged(s.questions, s.answers))
const timeText = computed(() => formatRemaining(s.remaining))
const low = computed(() => isLowTime(s.remaining))
const confirming = ref(false)

const saveText = computed(() => {
  switch (s.saveStatus) {
    case 'saving':
      return 'Saqlanmoqda...'
    case 'offline':
      return 'Saqlanmadi: internet yo‘q'
    case 'failed':
      return 'Saqlanmadi, qayta uriniladi'
    default:
      return 'Saqlandi'
  }
})
const saveTone = computed(() =>
  s.saveStatus === 'saved' ? 'text-ok' : s.saveStatus === 'saving' ? 'text-fg-soft' : 'text-bad',
)

const cellClass = (state: string, current: boolean) => [
  'flex h-11 min-w-11 items-center justify-center rounded-lg border-2 text-sm font-semibold',
  state === 'answered'
    ? 'border-ok bg-ok/15 text-fg'
    : state === 'flagged'
      ? 'border-warn bg-warn/20 text-fg'
      : 'border-line bg-surface text-fg-soft',
  current ? 'ring-2 ring-brand ring-offset-2 ring-offset-page' : '',
]

async function doSubmit() {
  confirming.value = false
  await store.submit(false)
}
const noCopy = (e: Event) => e.preventDefault()
</script>

<template>
  <div v-if="q" class="pb-28" data-testid="exam">
    <div class="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{{ s.join?.exam.title }}</p>
          <p class="text-xs" :class="saveTone" data-testid="save-status">{{ saveText }}</p>
        </div>
        <div
          class="rounded-xl px-3 py-1.5 text-xl font-bold tabular-nums"
          :class="low ? 'bg-bad text-white' : 'bg-muted text-fg'"
          data-testid="timer"
          aria-live="off"
        >
          {{ timeText }}
        </div>
      </div>
      <div
        v-if="!s.online"
        class="bg-bad px-4 py-1 text-center text-sm text-white"
        data-testid="offline-bar"
      >
        Internet yo‘q. Javoblar telefonda saqlanmoqda, ulanish tiklanganda yuboriladi.
      </div>
    </div>

    <div class="mx-auto max-w-3xl space-y-4 px-4 pt-4">
      <section
        class="card no-select space-y-4"
        data-testid="question"
        @contextmenu="noCopy"
        @copy="noCopy"
        @cut="noCopy"
      >
        <div class="flex items-center justify-between text-sm text-fg-soft">
          <span data-testid="question-index"
            >Savol {{ s.index + 1 }} / {{ s.questions.length }}</span
          >
          <span>{{ q.points }} ball</span>
        </div>
        <RichBlocks :blocks="q.content" class="text-lg" />
        <AnswerInput
          :question="q"
          :value="s.answers[q.id]?.value ?? null"
          @pick="store.pickOption(q, $event)"
          @text="store.setAnswer(q.id, $event)"
        />
      </section>

      <div class="flex gap-2">
        <button
          class="btn-ghost flex-1"
          :disabled="s.index === 0"
          data-testid="prev"
          @click="store.goto(s.index - 1)"
        >
          Oldingi
        </button>
        <button
          class="btn-ghost flex-1"
          :class="s.answers[q.id]?.flagged ? 'border-warn text-warn' : ''"
          data-testid="flag"
          @click="store.toggleFlag(q.id)"
        >
          {{ s.answers[q.id]?.flagged ? 'Belgi olib tashlash' : 'Keyinroq qaytaman' }}
        </button>
        <button
          class="btn-primary flex-1"
          :disabled="s.index === s.questions.length - 1"
          data-testid="next"
          @click="store.goto(s.index + 1)"
        >
          Keyingi
        </button>
      </div>

      <section class="card" aria-label="Savollar ro‘yxati">
        <div class="flex flex-wrap gap-2" data-testid="grid">
          <button
            v-for="c in cells"
            :key="c.id"
            type="button"
            :class="cellClass(c.state, c.index === s.index)"
            :data-state="c.state"
            :aria-label="`${c.index + 1}-savol`"
            :data-testid="`cell-${c.index}`"
            @click="store.goto(c.index)"
          >
            {{ c.index + 1 }}
          </button>
        </div>
        <p class="mt-3 text-xs text-fg-soft">
          Yashil: javob berilgan, sariq: keyinroq qaytaman, kulrang: javobsiz.
        </p>
      </section>
    </div>

    <div
      class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur"
    >
      <div class="mx-auto flex max-w-3xl gap-2">
        <button
          class="btn-ghost"
          type="button"
          data-testid="fullscreen"
          @click="requestFullscreen()"
        >
          To‘liq ekran
        </button>
        <button
          class="btn-primary flex-1"
          data-testid="submit"
          :disabled="s.busy"
          @click="confirming = true"
        >
          Topshirish
        </button>
      </div>
    </div>

    <div
      v-if="confirming"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      data-testid="submit-dialog"
    >
      <div class="card w-full max-w-md space-y-4">
        <h2 class="text-xl font-bold">Imtihonni topshirasizmi?</h2>
        <p data-testid="submit-summary">
          Javobsiz savollar: <b>{{ unanswered }}</b><template v-if="flagged"
            >, “Keyinroq qaytaman” belgilanganlar: <b>{{ flagged }}</b></template
          >.
        </p>
        <p class="text-sm text-fg-soft">Topshirgandan keyin javoblarni o‘zgartirib bo‘lmaydi.</p>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1" data-testid="submit-cancel" @click="confirming = false">
            Qaytish
          </button>
          <button class="btn-primary flex-1" data-testid="submit-confirm" @click="doSubmit">
            Topshirish
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
