<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useStore } from '../inject'
import { countFlagged, countUnanswered, gridCells, isAnswered } from '../lib/grid'
import { requestFullscreen } from '../lib/events'
import { formatRemaining, isLowTime } from '../lib/timer'
import AnswerInput from './AnswerInput.vue'
import AnswerSheet from './AnswerSheet.vue'
import BrandLogo from './BrandLogo.vue'
import FileViewer from './FileViewer.vue'
import Icon from './Icon.vue'
import QuestionMap, { type MapGroup } from './QuestionMap.vue'
import RichBlocks from './RichBlocks.vue'
import ThemeToggle from './ThemeToggle.vue'
import VariantPicker from './VariantPicker.vue'

const store = useStore()
const s = store.state

const q = computed(() => s.questions[s.index])
/** "Fayl + kalit" bloki: joriy savol shu blokda bo'lsa fayl ko'rsatkichi va javob varaqasi chiqadi */
const fileBlock = computed(() => s.files.find((f) => f.blockId === q.value?.blockId) ?? null)
const fileQuestions = computed(() => s.questions.filter((x) => x.blockId === q.value?.blockId))
/** Qog'oz yetkazish: variant hali tanlanmagan bloklar (savollari tanlangandan keyin paydo bo'ladi) */
const pendingPaper = computed(() => s.files.filter((f) => f.delivery === 'paper' && !f.variant))
const cells = computed(() => gridCells(s.questions, s.answers))
const unanswered = computed(() => countUnanswered(s.questions, s.answers))
const flagged = computed(() => countFlagged(s.questions, s.answers))
/** Blokma-blok: asosiy taymer joriy blok vaqti; aks holda umumiy */
const perBlock = computed(() => !!s.block)
const shownMs = computed(() => (perBlock.value ? s.blockRemaining : s.remaining))
const timeText = computed(() => formatRemaining(shownMs.value))
const totalText = computed(() => formatRemaining(s.remaining))
const low = computed(() => isLowTime(shownMs.value))
const confirming = ref(false)
const mapOpen = ref(false)
/** Nazoratchi ogohlantirishi: navbatdagi birinchisi ko'rsatiladi (test bloklanmaydi, lekin tasdiqlash kerak) */
const warning = computed(() => s.warnings[0] ?? null)
const lastBlock = computed(() => !!s.block && s.block.index >= s.block.total - 1)
const finishBlockMode = computed(() => perBlock.value && !lastBlock.value)
const submitLabel = computed(() => (finishBlockMode.value ? 'Blokni yakunlash' : 'Topshirish'))
const blockTitle = (id: string | undefined) => s.blocks.find((b) => b.id === id)?.title ?? ''
const currentBlockTitle = computed(() =>
  s.block ? blockTitle(s.block.id ?? undefined) : blockTitle(q.value?.blockId),
)
const student = computed(() => {
  const p = s.join?.participant
  if (!p) return ''
  return p.className ? `${p.fullName} · ${p.className}` : p.fullName
})
const answeredIn = (blockId: string) =>
  s.questions.filter((x) => x.blockId === blockId && isAnswered(s.answers[x.id]?.value)).length

interface Tab {
  id: string
  title: string
  count: number
  answered: number | null
  first: number
  state: 'current' | 'open' | 'done' | 'locked'
}
/**
 * Fan yorliqlari. Umumiy vaqtda: bloklar orasida erkin o'tish. Blokma-blokda: faqat joriy blok ochiq,
 * oldingilari yakunlangan, keyingilari qulflangan (o'tib bo'lmaydi).
 */
const tabs = computed<Tab[]>(() => {
  if (s.blocks.length < 2) return []
  if (perBlock.value) {
    const cur = s.block!.index
    return s.blocks.map((b, i) => ({
      id: b.id,
      title: b.title,
      count: b.questionCount,
      answered: i === cur ? answeredIn(b.id) : null,
      first: -1,
      state: i === cur ? 'current' : i < cur ? 'done' : 'locked',
    }))
  }
  return s.blocks
    .map((b) => {
      const count = s.questions.filter((x) => x.blockId === b.id).length
      return {
        id: b.id,
        title: b.title,
        count,
        answered: answeredIn(b.id),
        first: s.questions.findIndex((x) => x.blockId === b.id),
        state: (q.value?.blockId === b.id ? 'current' : 'open') as Tab['state'],
      }
    })
    .filter((t) => t.count > 0)
})
const showTabs = computed(() => tabs.value.length > 1)
const tabHint = (t: Tab) =>
  t.state === 'locked'
    ? 'Oldingi blokni yakunlagach ochiladi'
    : t.state === 'done'
      ? 'Yakunlangan: qaytib bo‘lmaydi'
      : ''
const tabSub = (t: Tab) =>
  t.state === 'locked' ? 'Keyin' : t.state === 'done' ? 'Yakunlangan' : null

/** Savollar xaritasi: fan (blok) bo'yicha guruhlangan */
const groups = computed<MapGroup[]>(() => {
  const mk = (c: (typeof cells.value)[number]) => ({
    ...c,
    answered: isAnswered(s.answers[c.id]?.value),
  })
  if (s.blocks.length < 2) return [{ key: 'all', title: '', cells: cells.value.map(mk) }]
  return s.blocks
    .map((b) => ({
      key: b.id,
      title: b.title,
      cells: cells.value.filter((c) => s.questions[c.index]?.blockId === b.id).map(mk),
    }))
    .filter((g) => g.cells.length)
})
const answeredAll = computed(
  () => cells.value.filter((c) => isAnswered(s.answers[c.id]?.value)).length,
)
const pct = computed(() =>
  cells.value.length ? Math.round((answeredAll.value / cells.value.length) * 100) : 0,
)

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

async function doSubmit() {
  confirming.value = false
  if (perBlock.value) await store.finishBlock(false)
  else await store.submit(false)
}
const noCopy = (e: Event) => e.preventDefault()

function pickTab(t: Tab) {
  if (t.state === 'locked' || t.state === 'done' || t.first < 0) return
  store.goto(t.first)
}
const questionEl = ref<HTMLElement | null>(null)
async function goFromMap(i: number) {
  mapOpen.value = false
  store.goto(i)
  await nextTick()
  questionEl.value?.focus()
}
function askSubmit() {
  mapOpen.value = false
  confirming.value = true
}

const mapClose = ref<HTMLButtonElement | null>(null)
const cancelBtn = ref<HTMLButtonElement | null>(null)
watch(mapOpen, async (v) => {
  if (!v) return
  await nextTick()
  mapClose.value?.focus()
})
watch(confirming, async (v) => {
  if (!v) return
  await nextTick()
  cancelBtn.value?.focus()
})
</script>

<template>
  <div
    v-if="q || pendingPaper.length"
    class="pb-28 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:pb-0"
    data-testid="exam"
  >
    <header class="sticky top-0 z-30 shrink-0 border-b border-line bg-surface/95 backdrop-blur">
      <div
        class="mx-auto flex h-16 w-full max-w-6xl xl:max-w-[1400px] 2xl:max-w-[1600px] items-center gap-3 px-4"
      >
        <BrandLogo size="h-9 w-9" />
        <div class="min-w-0 flex-1 leading-tight">
          <p class="truncate font-semibold" data-testid="exam-title">{{ s.join?.exam.title }}</p>
          <p class="truncate text-sm text-fg-soft" data-testid="exam-student">{{ student }}</p>
        </div>
        <span
          class="inline-flex min-w-0 max-w-[38%] items-center gap-1 text-right text-xs leading-tight sm:max-w-none sm:shrink-0 sm:text-sm"
          :class="saveTone"
          role="status"
          data-testid="save-status"
          >{{ saveText }}</span
        >
        <ThemeToggle class="max-sm:hidden" />
        <div
          class="shrink-0 rounded-xl px-3 py-1.5 text-xl font-bold tabular-nums sm:text-3xl"
          :class="low ? 'bg-bad text-white' : 'bg-muted text-fg'"
          role="timer"
          aria-label="Qolgan vaqt"
          data-testid="timer"
          aria-live="off"
        >
          {{ timeText }}
        </div>
      </div>
      <p
        v-if="perBlock"
        class="mx-auto w-full max-w-6xl truncate px-4 pb-1 xl:max-w-[1400px] 2xl:max-w-[1600px] text-xs text-fg-soft"
        data-testid="block-header"
      >
        {{ s.block!.index + 1 }}/{{ s.block!.total }}-blok: {{ currentBlockTitle }} · umumiy
        <span data-testid="total-time">{{ totalText }}</span>
      </p>
      <nav
        v-if="showTabs"
        :class="[
          'mx-auto w-full max-w-6xl gap-2 px-4 pb-3 xl:max-w-[1400px] 2xl:max-w-[1600px]',
          tabs.length <= 3 ? 'grid' : 'flex overflow-x-auto pr-10',
        ]"
        :style="
          tabs.length <= 3
            ? { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }
            : undefined
        "
        aria-label="Fanlar"
        data-testid="block-tabs"
      >
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="flex flex-1 flex-col items-start rounded-xl border-2 px-3 py-2 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-2"
          :class="[
            tabs.length > 3 ? 'min-w-[7.5rem] shrink-0' : 'min-w-0',
            t.state === 'current'
              ? 'border-brand bg-brand/10'
              : t.state === 'open'
                ? 'border-line bg-surface'
                : 'border-line bg-muted text-fg-soft opacity-80',
          ]"
          :disabled="t.state === 'locked' || t.state === 'done'"
          :aria-current="t.state === 'current' ? 'true' : undefined"
          :title="tabHint(t) || undefined"
          :data-state="t.state"
          :data-testid="`block-tab-${t.id}`"
          @click="pickTab(t)"
        >
          <span
            class="flex w-full min-w-0 items-center gap-1 text-sm font-semibold sm:w-auto sm:text-base"
          >
            <Icon v-if="t.state === 'locked'" name="lock" size="h-4 w-4" />
            <span class="truncate">{{ t.title }}</span>
          </span>
          <span
            class="text-sm tabular-nums"
            :class="t.answered !== null && t.answered === t.count ? 'text-ok' : 'text-fg-soft'"
          >
            <template v-if="tabSub(t)">{{ tabSub(t) }} · {{ t.count }}</template>
            <template v-else>{{ t.answered }}/{{ t.count }}</template>
          </span>
        </button>
      </nav>
      <div
        v-if="showTabs && tabs.length > 3"
        class="pointer-events-none absolute bottom-3 right-0 h-12 w-10 bg-gradient-to-l from-surface to-transparent"
        aria-hidden="true"
        data-testid="tabs-fade"
      />
      <div
        v-if="!s.online"
        class="bg-bad px-4 py-1 text-center text-sm text-white"
        data-testid="offline-bar"
      >
        Internet yo‘q. Javoblar telefonda saqlanmoqda, ulanish tiklanganda yuboriladi.
      </div>
    </header>

    <div
      v-if="pendingPaper.length"
      class="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:max-h-[40dvh] lg:shrink-0 lg:overflow-y-auto"
    >
      <VariantPicker
        v-for="pb in pendingPaper"
        :key="pb.blockId"
        :block="pb"
        :title="blockTitle(pb.blockId)"
      />
    </div>

    <!-- "Fayl + kalit": chapda fayl, o'ngda javoblar varag'i -->
    <div
      v-if="q && fileBlock"
      class="mx-auto w-full items-start gap-5 px-4 pt-5 lg:min-h-0 lg:flex-1 lg:pb-5"
      :class="
        fileBlock.delivery === 'paper'
          ? 'max-w-3xl lg:overflow-y-auto'
          : 'grid max-w-6xl pb-40 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch xl:max-w-[1400px] xl:grid-cols-[minmax(0,1fr)_400px] 2xl:max-w-[1600px] 2xl:grid-cols-[minmax(0,1fr)_440px]'
      "
      data-testid="file-exam"
    >
      <main
        v-if="fileBlock.delivery !== 'paper'"
        class="min-w-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col"
      >
        <div class="mb-2 flex items-center gap-2 text-sm text-fg-soft">
          <Icon name="file" size="h-4 w-4" />{{ currentBlockTitle || 'Fayl' }}
        </div>
        <FileViewer
          :key="fileBlock.blockId"
          :file="fileBlock"
          class="h-[62svh] min-h-72 lg:h-auto lg:min-h-0 lg:flex-1"
        />
      </main>
      <AnswerSheet
        :questions="fileQuestions"
        :answers="s.answers"
        :paper="fileBlock.delivery === 'paper'"
        @pick="(qq, id) => store.pickOption(qq, id)"
        @text="(id, v) => store.setAnswer(id, v)"
      >
        <template #footer>
          <div class="flex gap-2">
            <button
              class="btn-ghost gap-2"
              type="button"
              data-testid="fullscreen"
              @click="requestFullscreen()"
            >
              <Icon name="fs" />To‘liq ekran
            </button>
            <button
              class="btn-primary flex-1"
              data-testid="submit"
              :disabled="s.busy"
              @click="confirming = true"
            >
              {{ submitLabel }}
            </button>
          </div>
        </template>
      </AnswerSheet>
    </div>

    <!-- Oddiy savol: chapda savol kartasi, o'ngda doimiy xarita -->
    <div
      v-else-if="q"
      class="mx-auto grid w-full max-w-6xl items-start gap-5 px-4 pt-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:pb-5 xl:max-w-[1400px] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:max-w-[1600px] 2xl:grid-cols-[minmax(0,1fr)_400px]"
    >
      <main class="min-w-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <div class="mb-4 flex items-center gap-3 lg:hidden">
          <div class="min-w-0 flex-1">
            <p class="mb-1 text-sm text-fg-soft">
              Javob berilgan:
              <b class="tabular-nums text-fg">{{ answeredAll }}/{{ cells.length }}</b>
            </p>
            <div
              class="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="pct"
              aria-label="Javob berilgan savollar"
            >
              <div class="h-full rounded-full bg-brand" :style="{ width: pct + '%' }" />
            </div>
          </div>
          <button
            type="button"
            class="btn-ghost gap-2 px-4"
            aria-haspopup="dialog"
            data-testid="map-open"
            @click="mapOpen = true"
          >
            <Icon name="grid" />Xarita
          </button>
        </div>

        <section
          ref="questionEl"
          tabindex="-1"
          class="card no-select border-2 outline-none sm:p-8 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:p-8 2xl:p-10"
          data-testid="question"
          @contextmenu="noCopy"
          @copy="noCopy"
          @cut="noCopy"
        >
          <div
            class="space-y-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2"
            data-testid="question-body"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-soft">
              <span class="font-semibold text-fg">
                <span data-testid="question-index"
                  >Savol {{ s.index + 1 }} / {{ s.questions.length }}</span
                >
                <template v-if="!perBlock && currentBlockTitle">
                  · <span data-testid="question-block">{{ currentBlockTitle }}</span>
                </template>
              </span>
              <span>{{ q.points }} ball</span>
            </div>
            <RichBlocks :blocks="q.content" class="text-xl sm:text-2xl 2xl:text-3xl" />
            <AnswerInput
              :question="q"
              :value="s.answers[q.id]?.value ?? null"
              @pick="store.pickOption(q, $event)"
              @text="store.setAnswer(q.id, $event)"
            />
          </div>
          <div
            class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:mt-4 lg:shrink-0 lg:border-0 lg:border-t lg:border-line lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-4 lg:backdrop-blur-none"
          >
            <div class="mx-auto grid max-w-xl grid-cols-3 gap-2 lg:flex lg:max-w-none">
              <button
                type="button"
                class="btn-ghost min-w-0 flex-1 gap-1 !px-2 text-base"
                :disabled="s.index === 0"
                data-testid="prev"
                @click="store.goto(s.index - 1)"
              >
                <Icon name="left" size="h-5 w-5 max-[400px]:hidden" /><span class="truncate"
                  >Oldingi</span
                >
              </button>
              <button
                type="button"
                class="btn min-w-0 flex-1 gap-1 border-2 !px-2 text-base"
                :class="
                  s.answers[q.id]?.flagged
                    ? 'border-warn bg-warn/15 text-fg'
                    : 'border-line bg-surface text-fg'
                "
                :aria-pressed="!!s.answers[q.id]?.flagged"
                :aria-label="
                  s.answers[q.id]?.flagged
                    ? '“Keyinroq qaytaman” belgisini olib tashlash'
                    : 'Keyinroq qaytaman deb belgilash'
                "
                data-testid="flag"
                @click="store.toggleFlag(q.id)"
              >
                <Icon name="flag" size="h-5 w-5 max-[400px]:hidden" /><span class="truncate">{{
                  s.answers[q.id]?.flagged ? 'Belgilangan' : 'Belgilash'
                }}</span>
              </button>
              <button
                type="button"
                class="btn-primary min-w-0 flex-1 gap-1 !px-2 text-base"
                :class="s.index === s.questions.length - 1 ? 'max-lg:hidden' : ''"
                :disabled="s.index === s.questions.length - 1"
                data-testid="next"
                @click="store.goto(s.index + 1)"
              >
                <span class="truncate">Keyingi</span
                ><Icon name="right" size="h-5 w-5 max-[400px]:hidden" />
              </button>
              <button
                v-if="s.index === s.questions.length - 1"
                type="button"
                class="btn-primary min-w-0 flex-1 !px-2 lg:hidden"
                :disabled="s.busy"
                data-testid="submit-last"
                @click="confirming = true"
              >
                {{ submitLabel }}
              </button>
            </div>
          </div>
        </section>
      </main>

      <aside
        class="card hidden min-h-0 flex-col gap-3 border-2 lg:flex lg:h-full"
        aria-label="Savollar xaritasi"
        data-testid="map-aside"
      >
        <div class="flex shrink-0 items-center justify-between">
          <h2 class="text-lg font-bold">Savollar xaritasi</h2>
          <span class="font-semibold tabular-nums">{{ answeredAll }}/{{ cells.length }}</span>
        </div>
        <QuestionMap
          :groups="groups"
          :current="s.index"
          grid-testid="grid"
          fluid
          @goto="store.goto($event)"
        />
        <div class="flex shrink-0 flex-col gap-2 border-t border-line pt-3">
          <button
            class="btn-primary w-full"
            data-testid="submit"
            :disabled="s.busy"
            @click="confirming = true"
          >
            {{ submitLabel }}
          </button>
          <button
            class="btn-ghost w-full gap-2"
            type="button"
            data-testid="fullscreen"
            @click="requestFullscreen()"
          >
            <Icon name="fs" />To‘liq ekran
          </button>
        </div>
      </aside>
    </div>

    <!-- Faqat qog'oz varianti tanlanmagan holat: topshirish/to'liq ekran tugmalari -->
    <div
      v-if="!q"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur"
    >
      <div class="mx-auto flex max-w-3xl gap-2">
        <button
          class="btn-ghost gap-2"
          type="button"
          data-testid="fullscreen"
          @click="requestFullscreen()"
        >
          <Icon name="fs" />To‘liq ekran
        </button>
        <button
          class="btn-primary flex-1"
          data-testid="submit"
          :disabled="s.busy"
          @click="confirming = true"
        >
          {{ submitLabel }}
        </button>
      </div>
    </div>

    <!-- Telefon: xarita paneli -->
    <div
      v-if="mapOpen"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50 lg:hidden"
      data-testid="map-backdrop"
      @click.self="mapOpen = false"
      @keydown.esc="mapOpen = false"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Savollar xaritasi"
        class="flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-3xl border border-line bg-surface p-4 shadow-xl"
        data-testid="map-panel"
      >
        <div class="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-line" />
        <div class="mb-3 flex shrink-0 items-center justify-between gap-2">
          <h2 class="text-xl font-bold">Savollar xaritasi</h2>
          <div class="flex gap-2">
            <ThemeToggle testid="theme-toggle-panel" />
            <button
              ref="mapClose"
              type="button"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line"
              aria-label="Yopish"
              data-testid="map-close"
              @click="mapOpen = false"
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
        <QuestionMap
          :groups="groups"
          :current="s.index"
          prefix="m-"
          grid-testid="grid-panel"
          cols="grid-cols-6 sm:grid-cols-8"
          cell-size="h-11"
          @goto="goFromMap"
        />
        <div class="mt-3 flex shrink-0 gap-2 border-t border-line pt-3">
          <button
            class="btn-ghost gap-2"
            type="button"
            data-testid="fullscreen-panel"
            @click="requestFullscreen()"
          >
            <Icon name="fs" />To‘liq ekran
          </button>
          <button
            class="btn-primary flex-1"
            :disabled="s.busy"
            data-testid="submit-panel"
            @click="askSubmit"
          >
            {{ submitLabel }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="confirming"
      class="fixed inset-0 z-[45] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-title"
      data-testid="submit-dialog"
      @keydown.esc="confirming = false"
    >
      <div class="card w-full max-w-md space-y-4">
        <h2 id="submit-title" class="text-xl font-bold" data-testid="submit-title">
          {{ finishBlockMode ? 'Blokni yakunlaysizmi?' : 'Imtihonni topshirasizmi?' }}
        </h2>
        <p class="text-lg" data-testid="submit-summary">
          Javobsiz savollar: <b>{{ unanswered }}</b><template v-if="flagged"
            >, belgilangan savollar: <b>{{ flagged }}</b></template
          >.
        </p>
        <p v-if="finishBlockMode" class="text-sm text-fg-soft" data-testid="block-warning">
          Keyingi blokka o‘tgach bu blokka qaytib bo‘lmaydi.
        </p>
        <p v-else class="text-sm text-fg-soft">
          Topshirgandan keyin javoblarni o‘zgartirib bo‘lmaydi.
        </p>
        <div class="flex gap-2">
          <button
            ref="cancelBtn"
            class="btn-ghost flex-1"
            data-testid="submit-cancel"
            @click="confirming = false"
          >
            Qaytish
          </button>
          <button class="btn-primary flex-1" data-testid="submit-confirm" @click="doSubmit">
            Topshirish
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="warning"
      class="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="warn-title"
      data-testid="warning-dialog"
    >
      <div class="card w-full max-w-md space-y-4 border-2 border-warn">
        <div class="flex items-center gap-2 text-warn">
          <Icon name="alert" size="h-6 w-6" />
          <h2 id="warn-title" class="text-xl font-bold text-fg">Nazoratchidan ogohlantirish</h2>
        </div>
        <p class="whitespace-pre-line break-words text-lg" data-testid="warning-text">
          {{ warning.text }}
        </p>
        <button
          class="btn-primary w-full"
          data-testid="warning-ack"
          autofocus
          @click="store.ackWarning(warning.id)"
        >
          Tushundim
        </button>
      </div>
    </div>
  </div>
</template>
