<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import type { FileTestFileInfo } from '@/api/types'
import { errorMessage } from '@/utils/errors'

/**
 * "Fayl + kalit" bloki fayli ko'rinishi (tuzuvchi/o'qituvchi): PDF (pdfjs, sahifalar ketma-ket chiziladi) yoki rasmlar.
 * Fayl token bilan olinadi (blob). O'quvchi ko'radigan narsaning aynan o'zi: kalitni tekshirishda yonma-yon qaraladi.
 */
const props = defineProps<{
  sessionId: string
  blockId: string
  kind: 'pdf' | 'image'
  files: FileTestFileInfo[]
}>()
const { t } = useI18n()

const MAX_PDF_PAGES = 60
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const error = ref('')
const urls = ref<string[]>([])
const pagesHost = ref<HTMLElement | null>(null)
const pageCount = ref(0)
let seq = 0
let pdfDestroy: (() => Promise<void>) | null = null

function cleanup() {
  urls.value.forEach((u) => URL.revokeObjectURL(u))
  urls.value = []
  void pdfDestroy?.()
  pdfDestroy = null
  pageCount.value = 0
  if (pagesHost.value) pagesHost.value.replaceChildren()
}

async function renderPdf(blob: Blob, my: number) {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  pdfDestroy = () => doc.destroy()
  pageCount.value = doc.numPages
  const host = pagesHost.value
  if (!host) return
  const width = Math.min(900, Math.max(320, host.clientWidth - 16))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES); n++) {
    if (my !== seq) return
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const vp = page.getViewport({ scale: (width / base.width) * dpr })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(vp.width)
    canvas.height = Math.floor(vp.height)
    canvas.style.width = `${width}px`
    canvas.style.height = `${Math.round((width * base.height) / base.width)}px`
    canvas.className = 'mx-auto mb-3 block bg-white shadow'
    canvas.dataset.testid = 'preview-page'
    host.appendChild(canvas)
    const ctx = canvas.getContext('2d')
    if (ctx) await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
  }
}

async function load() {
  const my = ++seq
  cleanup()
  if (!props.files.length) {
    status.value = 'idle'
    return
  }
  status.value = 'loading'
  error.value = ''
  try {
    if (props.kind === 'pdf') {
      const blob = await examsApi.fetchTestFile(props.sessionId, props.blockId, props.files[0]!.id)
      if (my !== seq) return
      status.value = 'ready'
      await renderPdf(blob, my)
    } else {
      const out: string[] = []
      for (const f of props.files) {
        const blob = await examsApi.fetchTestFile(props.sessionId, props.blockId, f.id)
        out.push(URL.createObjectURL(blob))
      }
      if (my !== seq) {
        out.forEach((u) => URL.revokeObjectURL(u))
        return
      }
      urls.value = out
      pageCount.value = out.length
      status.value = 'ready'
    }
  } catch (e) {
    if (my !== seq) return
    status.value = 'error'
    error.value = errorMessage(e, t)
  }
}
watch(() => [props.kind, props.files.map((f) => f.id).join(',')], load, { immediate: true })
onBeforeUnmount(() => {
  seq++
  cleanup()
})
</script>

<template>
  <div
    class="max-h-[70vh] overflow-auto rounded-lg border border-border bg-surface-muted p-2"
    data-testid="file-preview"
  >
    <p v-if="status === 'idle'" class="py-10 text-center text-sm text-fg-muted">
      {{ t('fileTest.previewEmpty') }}
    </p>
    <p v-else-if="status === 'loading'" class="py-10 text-center text-sm text-fg-muted">
      {{ t('fileTest.previewLoading') }}
    </p>
    <p v-else-if="status === 'error'" class="py-10 text-center text-sm text-danger">{{ error }}</p>
    <template v-if="status === 'ready'">
      <p class="mb-2 text-xs text-fg-muted" data-testid="preview-count">
        {{ t(kind === 'pdf' ? 'fileTest.pagesCount' : 'fileTest.imagesCount', { n: pageCount }) }}
      </p>
      <img
        v-for="(u, i) in urls"
        :key="u"
        :src="u"
        :alt="t('fileTest.pageAlt', { n: i + 1 })"
        class="mx-auto mb-3 block max-w-full bg-white shadow"
        data-testid="preview-page"
      />
      <div ref="pagesHost" data-testid="preview-pages" />
    </template>
  </div>
</template>
