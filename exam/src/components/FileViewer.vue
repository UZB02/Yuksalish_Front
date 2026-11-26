<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useStore } from '../inject'
import type { FileBlockView } from '../lib/types'

/**
 * Test fayli ko'rsatkichi ("Fayl + kalit" bloki): PDF (brauzerda pdfjs bilan, sahifalar ko'rinishga kelganda chiziladi,
 * uzoqlashganda tozalanadi: telefon xotirasi) yoki tartiblangan rasmlar. Kattalashtirish, sahifa navigatsiyasi.
 * Fayl token bilan olinadi (Authorization), blob URL/ArrayBuffer sifatida xotirada.
 */
const props = defineProps<{ file: FileBlockView }>()
const store = useStore()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorText = ref('')
const zoom = ref(1)
const page = ref(1)
const total = ref(0)
const scroller = ref<HTMLElement | null>(null)

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
const zoomPct = computed(() => Math.round(zoom.value * 100))

// ---------- rasmlar ----------
const imageUrls = ref<string[]>([])

// ---------- PDF ----------
interface PdfPageInfo {
  no: number
  w: number
  h: number
}
const pdfPages = ref<PdfPageInfo[]>([])
// pdfjs hujjati reaktiv bo'lmasligi kerak (ichki private maydonlar)
const pdfDoc = shallowRef<{
  getPage(n: number): Promise<{
    getViewport(o: { scale: number }): { width: number; height: number }
    render(o: unknown): { promise: Promise<void>; cancel(): void }
  }>
  destroy(): Promise<void>
} | null>(null)
const canvases = new Map<number, HTMLCanvasElement>()
const rendered = new Map<number, string>()
const tasks = new Map<number, { cancel(): void }>()
let observer: IntersectionObserver | null = null
let queue: Promise<void> = Promise.resolve()
let destroyed = false

/** iOS/Android canvas chegarasi: bitta canvas ~16 mln piksel */
const MAX_PIXELS = 12_000_000

const containerWidth = () => Math.max(240, (scroller.value?.clientWidth ?? 360) - 16)
const displayWidth = () => Math.round(containerWidth() * zoom.value)

function pageBox(p: PdfPageInfo) {
  const w = displayWidth()
  return { width: `${w}px`, height: `${Math.round((w * p.h) / p.w)}px` }
}

async function renderPage(no: number) {
  const doc = pdfDoc.value
  const canvas = canvases.get(no)
  const info = pdfPages.value[no - 1]
  if (!doc || !canvas || !info || destroyed) return
  const w = displayWidth()
  const key = `${w}`
  if (rendered.get(no) === key) return
  tasks.get(no)?.cancel()
  const pg = await doc.getPage(no)
  const natural = pg.getViewport({ scale: 1 })
  let dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssScale = w / natural.width
  while (natural.width * natural.height * (cssScale * dpr) ** 2 > MAX_PIXELS && dpr > 0.5)
    dpr -= 0.25
  const vp = pg.getViewport({ scale: cssScale * dpr })
  canvas.width = Math.floor(vp.width)
  canvas.height = Math.floor(vp.height)
  canvas.style.width = `${w}px`
  canvas.style.height = `${Math.round((w * info.h) / info.w)}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const task = pg.render({ canvasContext: ctx, viewport: vp })
  tasks.set(no, task)
  try {
    await task.promise
    rendered.set(no, key)
  } catch {
    /* bekor qilingan chizish (kattalashtirish/uzoqlashish) */
  } finally {
    tasks.delete(no)
  }
}

/** Chizish navbati: bir vaqtda bitta sahifa (telefon protsessori/xotirasi) */
function enqueue(no: number) {
  queue = queue.then(() => renderPage(no)).catch(() => undefined)
}

function release(no: number) {
  tasks.get(no)?.cancel()
  const c = canvases.get(no)
  if (c) {
    c.width = 0
    c.height = 0
  }
  rendered.delete(no)
}

function setCanvas(el: unknown, no: number) {
  if (el instanceof HTMLCanvasElement) {
    canvases.set(no, el)
    observer?.observe(el.parentElement ?? el)
  }
}

function startObserver() {
  observer?.disconnect()
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const no = Number((e.target as HTMLElement).dataset.page)
        if (!no) continue
        if (e.isIntersecting) enqueue(no)
        else release(no)
      }
    },
    { root: scroller.value, rootMargin: '900px 0px' },
  )
  for (const c of canvases.values()) observer.observe(c.parentElement ?? c)
}

async function loadPdf(blob: Blob) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const data = new Uint8Array(await blob.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
  if (destroyed) {
    void doc.destroy()
    return
  }
  pdfDoc.value = doc as never
  const infos: PdfPageInfo[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const vp = (await doc.getPage(n)).getViewport({ scale: 1 })
    infos.push({ no: n, w: vp.width, h: vp.height })
  }
  pdfPages.value = infos
  total.value = infos.length
  await nextTick()
  startObserver()
}

async function loadImages() {
  const urls: string[] = []
  for (const f of props.file.files) urls.push(URL.createObjectURL(await store.fetchFile(f.id)))
  if (destroyed) {
    urls.forEach((u) => URL.revokeObjectURL(u))
    return
  }
  imageUrls.value = urls
  total.value = urls.length
}

async function load() {
  status.value = 'loading'
  errorText.value = ''
  cleanup()
  destroyed = false
  try {
    if (props.file.kind === 'pdf') await loadPdf(await store.fetchFile(props.file.files[0]!.id))
    else await loadImages()
    status.value = 'ready'
  } catch (e) {
    status.value = 'error'
    errorText.value =
      e instanceof Error && e.message ? e.message : 'Fayl ochilmadi. Qayta urinib ko‘ring'
  }
}

function cleanup() {
  destroyed = true
  observer?.disconnect()
  observer = null
  for (const [n, t] of tasks) {
    t.cancel()
    tasks.delete(n)
  }
  canvases.clear()
  rendered.clear()
  void pdfDoc.value?.destroy()
  pdfDoc.value = null
  pdfPages.value = []
  imageUrls.value.forEach((u) => URL.revokeObjectURL(u))
  imageUrls.value = []
  total.value = 0
  page.value = 1
}

onMounted(load)
onBeforeUnmount(cleanup)
watch(() => props.file.files.map((f) => f.id).join(','), load)

// ---------- navigatsiya va kattalashtirish ----------
function pageEls(): HTMLElement[] {
  return Array.from(scroller.value?.querySelectorAll<HTMLElement>('[data-page]') ?? [])
}
function onScroll() {
  const el = scroller.value
  if (!el) return
  const probe = el.scrollTop + el.clientHeight / 3
  let cur = 1
  for (const p of pageEls()) {
    if (p.offsetTop - el.offsetTop <= probe) cur = Number(p.dataset.page)
  }
  page.value = cur
}
function goPage(n: number) {
  const target = Math.min(Math.max(1, n), total.value)
  const el = pageEls().find((p) => Number(p.dataset.page) === target)
  if (el && scroller.value)
    scroller.value.scrollTo({ top: el.offsetTop - scroller.value.offsetTop })
  page.value = target
}
function setZoom(next: number) {
  zoom.value = next
  // Kattalashtirilganda barcha sahifalar qayta chiziladi (ko'rinadiganlari kuzatuvchi orqali)
  for (const n of [...rendered.keys()]) release(n)
  void nextTick(startObserver)
}
const zoomIn = () => {
  const n = ZOOMS.find((z) => z > zoom.value + 0.001)
  if (n) setZoom(n)
}
const zoomOut = () => {
  const n = [...ZOOMS].reverse().find((z) => z < zoom.value - 0.001)
  if (n) setZoom(n)
}
const noCopy = (e: Event) => e.preventDefault()
</script>

<template>
  <div
    class="flex min-h-0 flex-col rounded-2xl border-2 border-line bg-muted"
    data-testid="file-viewer"
  >
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-surface px-2 py-1.5 text-sm"
    >
      <span class="whitespace-nowrap font-semibold" data-testid="file-variant"
        >{{ file.variant }} varianti</span
      >
      <span v-if="total" class="whitespace-nowrap text-fg-soft" data-testid="file-page-info">
        {{ page }} / {{ total }}{{ file.kind === 'pdf' ? '-sahifa' : '-rasm' }}
      </span>
      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          class="btn-ghost !min-h-9 !px-3"
          :disabled="page <= 1"
          aria-label="Oldingi sahifa"
          data-testid="file-prev"
          @click="goPage(page - 1)"
        >
          ‹
        </button>
        <button
          type="button"
          class="btn-ghost !min-h-9 !px-3"
          :disabled="page >= total"
          aria-label="Keyingi sahifa"
          data-testid="file-next"
          @click="goPage(page + 1)"
        >
          ›
        </button>
        <button
          type="button"
          class="btn-ghost !min-h-9 !px-3"
          :disabled="zoom <= ZOOMS[0]!"
          aria-label="Kichraytirish"
          data-testid="file-zoom-out"
          @click="zoomOut"
        >
          −
        </button>
        <span class="w-11 text-center tabular-nums" data-testid="file-zoom">{{ zoomPct }}%</span>
        <button
          type="button"
          class="btn-ghost !min-h-9 !px-3"
          :disabled="zoom >= ZOOMS[ZOOMS.length - 1]!"
          aria-label="Kattalashtirish"
          data-testid="file-zoom-in"
          @click="zoomIn"
        >
          +
        </button>
      </div>
    </div>

    <div
      ref="scroller"
      class="no-select min-h-0 flex-1 overflow-auto p-2"
      style="touch-action: pan-x pan-y pinch-zoom"
      data-testid="file-scroller"
      @scroll.passive="onScroll"
      @contextmenu="noCopy"
      @copy="noCopy"
      @dragstart="noCopy"
    >
      <p
        v-if="status === 'loading'"
        class="py-12 text-center text-fg-soft"
        data-testid="file-loading"
      >
        Fayl yuklanmoqda…
      </p>
      <div
        v-else-if="status === 'error'"
        class="space-y-3 py-12 text-center"
        data-testid="file-error"
      >
        <p class="text-bad">{{ errorText }}</p>
        <button type="button" class="btn-primary" data-testid="file-retry" @click="load">
          Qayta urinish
        </button>
      </div>
      <template v-else-if="file.kind === 'pdf'">
        <div
          v-for="p in pdfPages"
          :key="p.no"
          :data-page="p.no"
          class="mx-auto mb-3 bg-white shadow"
          :style="pageBox(p)"
          data-testid="file-page"
        >
          <canvas :ref="(el) => setCanvas(el, p.no)" class="block" />
        </div>
      </template>
      <template v-else>
        <img
          v-for="(u, i) in imageUrls"
          :key="u"
          :src="u"
          :data-page="i + 1"
          :style="{ width: `${zoom * 100}%`, maxWidth: 'none' }"
          class="mx-auto mb-3 block bg-white shadow"
          alt="Test sahifasi"
          draggable="false"
          data-testid="file-page"
        />
      </template>
    </div>
  </div>
</template>
