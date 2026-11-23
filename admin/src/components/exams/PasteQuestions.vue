<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import type { PasteCommitResult, PastePreview, PasteQuestion } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import BlocksView from './BlocksView.vue'

/**
 * "Matnni joylash": chapda matn, o'ngda jonli ko'rinish (server tahlili, ~300 ms kechikish bilan).
 * Tahlil faqat backendda (yagona haqiqat manbai); bu komponent faqat ko'rsatadi va tuzatishlarni (javob
 * tanlash, qo'shmaslik) saqlashda matn bilan birga qaytaradi. Hal qilinmagan ogohlantirishli savollar saqlanmaydi.
 */
const props = defineProps<{
  mode: 'block' | 'bank'
  sessionId?: string
  blockId?: string
  /** Bank: majburiy mavzu. Vazifa: tanlangan mavzu (bo'sh = avtomatik "Imtihon: ‹nomi›") */
  topicId?: string
  topics?: { id: string; name: string }[]
  examTitle?: string
}>()
const emit = defineEmits<{ committed: [result: PasteCommitResult] }>()

const { t } = useI18n()
const toast = useToast()

const DEBOUNCE_MS = 300
const RESOLVABLE = ['noAnswer', 'badAnswer', 'conflict']

const text = ref('')
const preview = ref<PastePreview | null>(null)
const error = ref('')
const loading = ref(false)
const committing = ref(false)
const difficulty = ref('2')
const points = ref('1')
const chosenTopic = ref('')
const activate = ref(false)
const excluded = ref<Set<number>>(new Set())
/** Foydalanuvchi tanlagan javoblar: savol tarkibi (imzo) o'zgarsa bekor bo'ladi */
const picks = reactive<Record<number, { sig: string; answer: string[] }>>({})
const lastResult = ref<PasteCommitResult | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

const sigOf = (q: PasteQuestion) => JSON.stringify([q.content, q.options])
const pickOf = (q: PasteQuestion): string[] | null => {
  const p = picks[q.idx]
  return p && p.sig === sigOf(q) ? p.answer : null
}
const blockingLeft = (q: PasteQuestion) =>
  q.warnings.filter((w) => w.blocking && !(pickOf(q) && RESOLVABLE.includes(w.code)))
const infoWarnings = (q: PasteQuestion) => q.warnings.filter((w) => !w.blocking)
const correctOf = (q: PasteQuestion) => pickOf(q) ?? q.correct

const items = computed(() => preview.value?.items ?? [])
const savable = computed(() =>
  items.value.filter((q) => !excluded.value.has(q.idx) && blockingLeft(q).length === 0),
)
const problems = computed(
  () => items.value.filter((q) => !excluded.value.has(q.idx) && blockingLeft(q).length > 0).length,
)

const topicOptions = computed(() => [
  {
    value: '',
    label: t('examTasks.paste.autoTopic', { exam: props.examTitle ?? '' }),
  },
  ...(props.topics ?? []).map((x) => ({ value: x.id, label: x.name })),
])
const difficultyOptions = [1, 2, 3].map((n) => ({
  value: String(n),
  label: t(`exams.difficulty.${n}`),
}))

function serverMessage(e: unknown): string {
  if (isApiError(e) && e.details.length) return e.details[0]!.message
  return errorMessage(e, t)
}

async function run() {
  const my = ++seq
  const body = text.value
  try {
    const r =
      props.mode === 'block'
        ? await examsApi.blockPastePreview(props.sessionId!, props.blockId!, body)
        : await examsApi.pastePreview(body)
    if (my !== seq) return
    preview.value = r
    error.value = ''
    // Endi mavjud bo'lmagan savollar uchun tanlov/chiqarib tashlash qoldiqlari tozalanadi
    const idxs = new Set(r.items.map((q) => q.idx))
    excluded.value = new Set([...excluded.value].filter((i) => idxs.has(i)))
    for (const k of Object.keys(picks)) {
      if (!idxs.has(Number(k))) delete picks[Number(k)]
    }
  } catch (e) {
    if (my !== seq) return
    preview.value = null
    error.value = serverMessage(e)
  } finally {
    if (my === seq) loading.value = false
  }
}

watch(text, (v) => {
  clearTimeout(timer)
  if (!v.trim()) {
    seq++
    preview.value = null
    error.value = ''
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(() => void run(), DEBOUNCE_MS)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  seq++
})

/** Tashqaridan (masalan, OCR natijasi) matn qo'yish: jonli ko'rinish odatdagidek ishlaydi */
defineExpose({ setText: (v: string) => (text.value = v) })

/** Bosish: bitta javob; Ctrl/Shift/Cmd bilan bosish: ko'p javobli savol uchun qo'shish/olib tashlash */
function onPick(q: PasteQuestion, id: string, ev: MouseEvent) {
  if (!(ev.ctrlKey || ev.shiftKey || ev.metaKey)) {
    picks[q.idx] = { sig: sigOf(q), answer: [id] }
    return
  }
  const cur = pickOf(q) ?? []
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  if (next.length) picks[q.idx] = { sig: sigOf(q), answer: next.sort() }
  else delete picks[q.idx]
}
function toggleSkip(idx: number) {
  const s = new Set(excluded.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  excluded.value = s
}

const validPoints = computed(() => {
  const n = Number(String(points.value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= 100
})
const needsTopic = computed(() => props.mode === 'bank' && !props.topicId)
const canCommit = computed(
  () => savable.value.length > 0 && validPoints.value && !committing.value && !needsTopic.value,
)

async function commit() {
  if (!canCommit.value) return
  committing.value = true
  clearTimeout(timer)
  try {
    const body = {
      text: text.value,
      difficulty: Number(difficulty.value),
      points: Math.round(Number(String(points.value).replace(',', '.')) * 100) / 100,
      picks: Object.entries(picks).map(([idx, p]) => ({ idx: Number(idx), answer: p.answer })),
      exclude: [...excluded.value],
      ...(props.mode === 'bank'
        ? {
            topicId: props.topicId,
            status: activate.value ? ('active' as const) : ('draft' as const),
          }
        : chosenTopic.value
          ? { topicId: chosenTopic.value }
          : {}),
    }
    const r =
      props.mode === 'block'
        ? await examsApi.blockPasteCommit(props.sessionId!, props.blockId!, body)
        : await examsApi.pasteCommit(body)
    lastResult.value = r
    toast.success(t('examTasks.paste.added', { n: r.created }))
    if (r.skipped.length || r.failed.length) {
      toast.info(t('examTasks.paste.notAdded', { n: r.skipped.length + r.failed.length }))
    }
    seq++
    text.value = ''
    for (const k of Object.keys(picks)) delete picks[Number(k)]
    excluded.value = new Set()
    emit('committed', r)
  } catch (e) {
    toast.error(serverMessage(e))
  } finally {
    committing.value = false
  }
}

function insertSample() {
  text.value = t('examTasks.paste.sample')
}
const letter = (id: string) => id
</script>

<template>
  <div class="space-y-4" data-testid="paste-root">
    <div class="grid gap-4 lg:grid-cols-2">
      <!-- Chap: matn -->
      <section class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <label for="paste-text" class="text-sm font-medium text-fg">
            {{ t('examTasks.paste.textLabel') }}
          </label>
          <button
            type="button"
            class="text-xs text-primary-700 hover:underline"
            data-testid="paste-sample"
            @click="insertSample"
          >
            {{ t('examTasks.paste.insertSample') }}
          </button>
        </div>
        <textarea
          id="paste-text"
          v-model="text"
          rows="10"
          spellcheck="false"
          class="block min-h-[12rem] sm:min-h-[22rem] w-full rounded-lg border border-border bg-surface p-3 font-mono text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          :placeholder="t('examTasks.paste.placeholder')"
          data-testid="paste-text"
        />
        <details class="rounded-lg bg-surface-muted p-3 text-sm text-fg-muted">
          <summary class="cursor-pointer font-medium text-fg">
            {{ t('examTasks.paste.helpTitle') }}
          </summary>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li v-for="n in 6" :key="n">{{ t(`examTasks.paste.help.${n}`) }}</li>
          </ul>
        </details>
      </section>

      <!-- O'ng: jonli ko'rinish -->
      <section class="space-y-3" aria-live="polite" data-testid="paste-preview">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold text-fg" data-testid="paste-count">
            <template v-if="preview">
              {{ t('examTasks.paste.found', { n: preview.stats.total }) }}
            </template>
            <template v-else>{{ t('examTasks.paste.previewTitle') }}</template>
          </h3>
          <BaseBadge v-if="preview && preview.stats.total" tone="success" data-testid="paste-ok">
            {{ t('examTasks.paste.okCount', { n: savable.length }) }}
          </BaseBadge>
          <BaseBadge v-if="problems" tone="warning" data-testid="paste-problems">
            {{ t('examTasks.paste.problemCount', { n: problems }) }}
          </BaseBadge>
          <span v-if="loading" class="text-xs text-fg-muted" data-testid="paste-loading">
            {{ t('examTasks.paste.checking') }}
          </span>
        </div>

        <p
          v-if="error"
          class="rounded-lg border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="paste-error"
        >
          {{ error }}
        </p>
        <p
          v-else-if="!text.trim()"
          class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-muted"
          data-testid="paste-empty"
        >
          {{ t('examTasks.paste.empty') }}
        </p>
        <p
          v-else-if="preview && preview.stats.total === 0"
          class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-muted"
          data-testid="paste-none"
        >
          {{ t('examTasks.paste.none') }}
        </p>

        <ul v-if="items.length" class="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
          <li
            v-for="q in items"
            :key="q.idx"
            class="rounded-xl border p-3"
            :class="[
              excluded.has(q.idx)
                ? 'border-border bg-surface-muted opacity-60'
                : blockingLeft(q).length
                  ? 'border-warning bg-warning-soft/30'
                  : 'border-border bg-surface',
            ]"
            :data-testid="`paste-q-${q.idx}`"
          >
            <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <BaseBadge>{{ q.idx }}</BaseBadge>
              <BaseBadge v-if="q.type === 'multi'" tone="info">
                {{ t('exams.types.multi') }}
              </BaseBadge>
              <CheckCircle2
                v-if="!blockingLeft(q).length && !excluded.has(q.idx)"
                class="h-4 w-4 text-success"
                aria-hidden="true"
              />
              <label class="ml-auto inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  :checked="excluded.has(q.idx)"
                  :data-testid="`paste-skip-${q.idx}`"
                  @change="toggleSkip(q.idx)"
                />
                {{ t('examTasks.paste.skip') }}
              </label>
            </div>
            <BlocksView :blocks="q.content" inline />
            <ul class="mt-2 space-y-1 text-sm">
              <li
                v-for="o in q.options"
                :key="o.id"
                class="flex items-start gap-2 rounded-md px-2 py-1"
                :class="correctOf(q).includes(o.id) ? 'bg-success-soft text-success' : 'text-fg'"
                :data-testid="`paste-opt-${q.idx}-${o.id}`"
              >
                <span class="w-5 shrink-0 font-semibold">{{ letter(o.id) }}</span>
                <BlocksView :blocks="o.content" inline class="min-w-0 flex-1" />
              </li>
            </ul>

            <ul v-if="q.warnings.length" class="mt-2 space-y-1 text-xs">
              <li
                v-for="(w, wi) in blockingLeft(q)"
                :key="`b${wi}`"
                class="flex items-start gap-1.5 text-warning"
                :data-testid="`paste-warn-${q.idx}-${w.code}`"
              >
                <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {{ w.message }}
              </li>
              <li
                v-for="(w, wi) in infoWarnings(q)"
                :key="`i${wi}`"
                class="flex items-start gap-1.5 text-fg-muted"
                :data-testid="`paste-info-${q.idx}-${w.code}`"
              >
                <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {{ w.message }}
              </li>
            </ul>

            <div
              v-if="q.pickable"
              class="mt-2 flex flex-wrap items-center gap-2"
              :data-testid="`paste-pick-${q.idx}`"
            >
              <span class="text-xs text-fg-muted">{{ t('examTasks.paste.pickAnswer') }}</span>
              <button
                v-for="o in q.options"
                :key="o.id"
                type="button"
                class="h-7 w-7 rounded-md border text-xs font-semibold"
                :class="
                  (pickOf(q) ?? []).includes(o.id)
                    ? 'border-success bg-success text-white'
                    : 'border-border bg-surface text-fg hover:border-primary-600'
                "
                :aria-pressed="(pickOf(q) ?? []).includes(o.id)"
                :data-testid="`paste-pick-${q.idx}-${o.id}`"
                @click="onPick(q, o.id, $event)"
              >
                {{ o.id }}
              </button>
            </div>
          </li>
        </ul>

        <p v-if="preview?.ignored.length" class="text-xs text-fg-muted" data-testid="paste-ignored">
          {{ t('examTasks.paste.ignored', { n: preview.ignored.length }) }}
        </p>
      </section>
    </div>

    <!-- Umumiy maydonlar va saqlash -->
    <div class="card flex flex-wrap items-end gap-3 p-4" data-testid="paste-common">
      <BaseSelect
        v-if="mode === 'block' && (topics?.length ?? 0) > 0"
        v-model="chosenTopic"
        :label="t('examTasks.paste.topic')"
        :options="topicOptions"
        class="min-w-56"
        data-testid="paste-topic"
      />
      <BaseSelect
        v-model="difficulty"
        :label="t('exams.fields.difficulty')"
        :options="difficultyOptions"
        class="w-36"
        data-testid="paste-difficulty"
      />
      <div class="w-28">
        <label for="paste-points" class="mb-1.5 block text-sm font-medium text-fg">
          {{ t('exams.fields.points') }}
        </label>
        <input
          id="paste-points"
          v-model="points"
          type="text"
          inputmode="decimal"
          class="block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary-600/20"
          :class="validPoints ? 'border-border' : 'border-danger'"
          data-testid="paste-points"
        />
      </div>
      <BaseCheckbox
        v-if="mode === 'bank'"
        v-model="activate"
        :label="t('examTasks.paste.activate')"
        data-testid="paste-active"
      />
      <BaseButton
        class="ml-auto"
        :loading="committing"
        :disabled="!canCommit"
        data-testid="paste-commit"
        @click="commit"
      >
        {{ t('examTasks.paste.commit', { n: savable.length }) }}
      </BaseButton>
    </div>
    <p v-if="lastResult" class="text-sm text-fg-muted" data-testid="paste-result">
      {{ t('examTasks.paste.result', { n: lastResult.created }) }}
    </p>
  </div>
</template>
