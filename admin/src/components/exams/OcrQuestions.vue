<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Camera, FileImage, RotateCw, Trash2 } from 'lucide-vue-next'
import type { PasteCommitResult } from '@/api/types'
import PasteQuestions from '@/components/exams/PasteQuestions.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'
import { cleanOcrText } from '@/utils/ocrText'
import type { PrepMode } from '@/utils/ocrPreprocess'
import type { OcrLang, OcrSession, PdfHandle } from '@/utils/ocr-engine'

/**
 * "Rasm / PDF (OCR)": rasm yoki skanerlangan PDF o'qituvchining BRAUZERIDA o'qiladi (serverga hech narsa yuborilmaydi),
 * matn tahrirlanadigan oynada chiqadi va mavjud "Matnni joylash" tahlilchisi (jonli ko'rinish, saqlash) bilan davom etadi.
 * Og'ir kutubxonalar (tesseract.js, pdfjs-dist) faqat "Tanib olish" bosilganda yuklanadi.
 */
defineProps<{
  mode: 'block' | 'bank'
  sessionId?: string
  blockId?: string
  topicId?: string
  topics?: { id: string; name: string }[]
  examTitle?: string
}>()
const emit = defineEmits<{ committed: [result: PasteCommitResult] }>()

const { t } = useI18n()
const { confirm } = useConfirm()
const auth = useAuthStore()

interface Item {
  id: number
  file: File
  kind: 'image' | 'pdf'
  rotate: number
}
const LANG_ORDER: OcrLang[] = ['uzb', 'uzb_cyrl', 'rus', 'eng']
const DEFAULT: OcrLang[] = ['uzb', 'eng']
const storeKey = () => `exams.ocr.langs.${auth.user?.id ?? 'anon'}`

function loadLangs(): OcrLang[] {
  try {
    const raw = localStorage.getItem(storeKey())
    const v = raw ? (JSON.parse(raw) as unknown) : null
    if (Array.isArray(v)) {
      const ok = LANG_ORDER.filter((l) => v.includes(l))
      if (ok.length) return ok
    }
  } catch {
    /* localStorage yo'q yoki buzilgan: standart */
  }
  return [...DEFAULT]
}
const langs = ref<OcrLang[]>(loadLangs())
watch(
  langs,
  (v) => {
    try {
      localStorage.setItem(storeKey(), JSON.stringify(v))
    } catch {
      /* yozib bo'lmasa ham ishlayveradi */
    }
  },
  { deep: true },
)
function toggleLang(l: OcrLang, on: boolean) {
  const s = new Set(langs.value)
  if (on) s.add(l)
  else s.delete(l)
  langs.value = LANG_ORDER.filter((x) => s.has(x))
}

const items = ref<Item[]>([])
const prep = ref<PrepMode>('none')
const running = ref(false)
const phase = ref<'idle' | 'loading' | 'recognizing'>('idle')
const progress = ref(0)
const page = ref(0)
const total = ref(0)
const error = ref('')
const hasText = ref(false)
const cancelled = ref(false)
const pasteRef = ref<InstanceType<typeof PasteQuestions> | null>(null)
let seq = 0
let session: OcrSession | null = null
const handles: PdfHandle[] = []

const prepOptions = computed(() => [
  { value: 'none', label: t('ocr.prep.none') },
  { value: 'stretch', label: t('ocr.prep.stretch') },
  { value: 'binarize', label: t('ocr.prep.binarize') },
])
const canStart = computed(() => items.value.length > 0 && langs.value.length > 0 && !running.value)
const percent = computed(() =>
  total.value
    ? Math.min(100, Math.round(((page.value - 1 + progress.value) / total.value) * 100))
    : 0,
)
const statusText = computed(() => {
  if (phase.value === 'loading')
    return t('ocr.loadingLangs', { n: Math.round(progress.value * 100) })
  if (phase.value === 'recognizing')
    return t('ocr.pageOf', {
      page: page.value,
      total: total.value,
      n: Math.round(progress.value * 100),
    })
  return ''
})

function addFiles(list: FileList | null) {
  if (!list) return
  error.value = ''
  for (const f of Array.from(list)) {
    const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    const img = f.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp)$/i.test(f.name)
    if (!pdf && !img) {
      error.value = t('ocr.badFile', { name: f.name })
      continue
    }
    items.value.push({ id: ++seq, file: f, kind: pdf ? 'pdf' : 'image', rotate: 0 })
  }
}
const onPick = (e: Event) => {
  const el = e.target as HTMLInputElement
  addFiles(el.files)
  el.value = ''
}
function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= items.value.length) return
  const a = items.value
  ;[a[i], a[j]] = [a[j]!, a[i]!]
}
const removeAt = (i: number) => items.value.splice(i, 1)
const rotateAt = (i: number) => {
  const it = items.value[i]
  if (it) it.rotate = (it.rotate + 1) % 4
}
const sizeText = (f: File) =>
  f.size > 1_048_576
    ? `${(f.size / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(f.size / 1024))} KB`

async function cleanup() {
  const s = session
  session = null
  if (s) await s.terminate().catch(() => undefined)
  while (handles.length)
    await handles
      .pop()!
      .destroy()
      .catch(() => undefined)
}

async function start() {
  if (!canStart.value) return
  error.value = ''
  cancelled.value = false
  running.value = true
  phase.value = 'loading'
  progress.value = 0
  page.value = 0
  total.value = 0
  const parts: string[] = []
  try {
    const eng = await import('@/utils/ocr-engine')
    // 1) jami sahifalar (PDF lar ochiladi; sahifalar keyin birma-bir chiziladi)
    const plan: { item: Item; pdf?: PdfHandle }[] = []
    let count = 0
    for (const it of items.value) {
      if (it.kind === 'pdf') {
        const h = await eng.openPdf(it.file)
        handles.push(h)
        plan.push({ item: it, pdf: h })
        count += h.pages
      } else {
        plan.push({ item: it })
        count += 1
      }
    }
    total.value = count
    if (count > eng.MANY_PAGES) {
      const ok = await confirm({
        title: t('ocr.manyTitle'),
        message: t('ocr.manyText', { n: count }),
        confirmText: t('ocr.manyGo'),
      })
      if (!ok) return
    }
    // 2) ishchi: til fayllari bir marta yuklanadi va keshlanadi
    session = await eng.createOcrSession([...langs.value], (s) => {
      if (phase.value === 'loading' || s.phase === 'recognizing') {
        phase.value = s.phase
        progress.value = s.progress
      }
    })
    phase.value = 'recognizing'
    // 3) sahifalar KETMA-KET (xotirani tejash): chizish -> tayyorlash -> o'qish -> kanvasni bo'shatish
    for (const p of plan) {
      const n = p.pdf ? p.pdf.pages : 1
      for (let k = 1; k <= n; k++) {
        if (cancelled.value) break
        page.value++
        progress.value = 0
        const canvas = p.pdf
          ? await p.pdf.render(k, p.item.rotate)
          : await eng.imageToCanvas(p.item.file, p.item.rotate)
        eng.prepareCanvas(canvas, prep.value)
        const text = await session!.recognize(canvas)
        eng.freeCanvas(canvas)
        if (text.trim()) parts.push(text.trim())
      }
      if (cancelled.value) break
    }
  } catch (e) {
    // to'xtatilgan bo'lsa (ishchi o'chirilgan) xato emas; aks holda tushunarli xabar
    if (!cancelled.value)
      error.value = t('ocr.failed', { msg: e instanceof Error ? e.message : '' })
  } finally {
    await cleanup()
    running.value = false
    phase.value = 'idle'
  }
  if (parts.length) {
    hasText.value = true
    await nextTick()
    pasteRef.value?.setText(cleanOcrText(parts.join('\n\n')))
  }
}

async function cancel() {
  cancelled.value = true
  await cleanup()
}
onBeforeUnmount(() => {
  cancelled.value = true
  void cleanup()
})
</script>

<template>
  <div class="space-y-4" data-testid="ocr-panel">
    <section class="space-y-3 rounded-lg border border-border p-4">
      <p class="text-sm text-fg" data-testid="ocr-hint">{{ t('ocr.hint') }}</p>
      <p class="text-xs text-fg-muted">{{ t('ocr.privacy') }}</p>

      <div class="flex flex-wrap gap-2">
        <label
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg hover:bg-surface-muted"
        >
          <FileImage class="h-4 w-4" aria-hidden="true" />
          {{ t('ocr.pickFiles') }}
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf"
            class="sr-only"
            data-testid="ocr-file"
            @change="onPick"
          />
        </label>
        <label
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg hover:bg-surface-muted"
        >
          <Camera class="h-4 w-4" aria-hidden="true" />
          {{ t('ocr.camera') }}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            class="sr-only"
            data-testid="ocr-camera"
            @change="onPick"
          />
        </label>
      </div>
      <p v-if="error" class="text-sm text-danger" data-testid="ocr-error">{{ error }}</p>

      <ol v-if="items.length" class="space-y-1" data-testid="ocr-files">
        <li
          v-for="(it, i) in items"
          :key="it.id"
          class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
          :data-testid="`ocr-item-${i}`"
        >
          <span class="w-5 shrink-0 text-fg-muted">{{ i + 1 }}</span>
          <span class="min-w-0 flex-1 truncate text-fg" data-testid="ocr-name">{{
            it.file.name
          }}</span>
          <span class="hidden text-xs text-fg-muted sm:inline">{{ sizeText(it.file) }}</span>
          <span v-if="it.rotate" class="text-xs text-fg-muted" :data-testid="`ocr-rot-${i}`"
            >{{ it.rotate * 90 }}°</span
          >
          <template v-if="!running">
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="t('ocr.up')"
              :data-testid="`ocr-up-${i}`"
              @click="move(i, -1)"
            >
              <ArrowUp class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="t('ocr.down')"
              :data-testid="`ocr-down-${i}`"
              @click="move(i, 1)"
            >
              <ArrowDown class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="t('ocr.rotate')"
              :data-testid="`ocr-rotate-${i}`"
              @click="rotateAt(i)"
            >
              <RotateCw class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :aria-label="t('common.delete')"
              :data-testid="`ocr-remove-${i}`"
              @click="removeAt(i)"
            >
              <Trash2 class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
          </template>
        </li>
      </ol>

      <fieldset class="space-y-1">
        <legend class="text-sm font-medium text-fg">{{ t('ocr.langs') }}</legend>
        <div class="grid gap-1 sm:grid-cols-2">
          <BaseCheckbox
            v-for="l in LANG_ORDER"
            :key="l"
            :model-value="langs.includes(l)"
            :label="t(`ocr.lang.${l}`)"
            :disabled="running"
            :data-testid="`ocr-lang-${l}`"
            @update:model-value="toggleLang(l, $event)"
          />
        </div>
        <p v-if="!langs.length" class="text-xs text-danger" data-testid="ocr-no-lang">
          {{ t('ocr.needLang') }}
        </p>
      </fieldset>

      <BaseSelect
        v-model="prep"
        :label="t('ocr.prepLabel')"
        :options="prepOptions"
        :disabled="running"
        data-testid="ocr-prep"
      />

      <div class="flex flex-wrap items-center gap-2">
        <BaseButton :disabled="!canStart" data-testid="ocr-start" @click="start">
          {{ t('ocr.start') }}
        </BaseButton>
        <BaseButton v-if="running" variant="secondary" data-testid="ocr-cancel" @click="cancel">
          {{ t('common.cancel') }}
        </BaseButton>
      </div>

      <div v-if="running" class="space-y-1" role="status" data-testid="ocr-progress">
        <div class="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div class="h-full bg-primary-600 transition-all" :style="{ width: percent + '%' }" />
        </div>
        <p class="text-sm text-fg-muted" data-testid="ocr-status">{{ statusText }}</p>
      </div>
    </section>

    <section v-if="hasText" data-testid="ocr-result">
      <p class="mb-2 text-sm text-fg-muted">{{ t('ocr.fix') }}</p>
      <PasteQuestions
        ref="pasteRef"
        :mode="mode"
        :session-id="sessionId"
        :block-id="blockId"
        :topic-id="topicId"
        :topics="topics"
        :exam-title="examTitle"
        @committed="emit('committed', $event)"
      />
    </section>
  </div>
</template>
