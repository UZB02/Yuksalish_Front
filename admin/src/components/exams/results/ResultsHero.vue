<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Ban, Download, ExternalLink, MoreVertical } from 'lucide-vue-next'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu.vue'

/** Natijalar sarlavhasi (gradient, SessionDetail uslubida): orqaga, nom + "natijalar", e'lon holati, Excel/PDF, e'lon qilish, ⋮ */
const props = defineProps<{
  title: string
  meta: string
  /** E'lon holati belgisi matni */
  pill: string
  pillTestId: string
  busy: boolean
  /** "E'londan keyin" rejimida va hali e'lon qilinmagan */
  canPublish: boolean
  /** E'lon qilingan (menyuda "E'londan olish") */
  canUnpublish: boolean
  /** Imtihon o'chirilmagan: menyuda "Imtihon sahifasi" */
  hasExamPage: boolean
}>()
const emit = defineEmits<{
  back: []
  excel: []
  pdf: []
  publish: []
  unpublish: []
  examPage: []
}>()
const { t } = useI18n()

const items = computed<DropdownItem[]>(() => {
  const out: DropdownItem[] = []
  if (props.hasExamPage)
    out.push({ key: 'examPage', label: t('examResults.hero.examPage'), icon: ExternalLink })
  if (props.canUnpublish)
    out.push({
      key: 'unpublish',
      label: t('examResults.hero.unpublish'),
      icon: Ban,
      danger: true,
      separator: out.length > 0,
    })
  return out
})
function onSelect(key: string) {
  if (key === 'examPage') emit('examPage')
  else if (key === 'unpublish') emit('unpublish')
}

const btnBase =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60 sm:px-4'
const btnPrimary = `${btnBase} bg-white text-indigo-950 hover:opacity-90`
const btnGhost = `${btnBase} border border-white/50 text-white hover:bg-white/10`
const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'
</script>

<template>
  <header
    class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 text-white"
    style="background: linear-gradient(90deg, #4338ca, #6d28d9)"
    data-testid="results-hero"
  >
    <button
      type="button"
      class="-ml-1 shrink-0"
      :class="iconBtn"
      :aria-label="t('examResults.hero.back')"
      data-testid="hero-back"
      @click="emit('back')"
    >
      <ArrowLeft class="h-5 w-5" aria-hidden="true" />
    </button>
    <div class="min-w-0 flex-1 basis-56">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h1 class="truncate text-lg font-semibold leading-6" data-testid="hero-title">
          {{ title }} · {{ t('examResults.title').toLowerCase() }}
        </h1>
        <span
          class="max-w-full rounded-full bg-white/20 px-2 py-0.5 text-xs"
          :data-testid="pillTestId"
          >{{ pill }}</span
        >
      </div>
      <p class="truncate text-xs leading-5 text-indigo-100" data-testid="hero-meta">{{ meta }}</p>
    </div>
    <div class="flex w-full items-center gap-2 sm:w-auto">
      <button
        type="button"
        :class="btnGhost"
        :disabled="busy"
        data-testid="export-xlsx"
        @click="emit('excel')"
      >
        <Download class="h-4 w-4" aria-hidden="true" />{{ t('examResults.export.xlsx') }}
      </button>
      <button
        type="button"
        :class="btnGhost"
        :disabled="busy"
        data-testid="export-pdf"
        @click="emit('pdf')"
      >
        <Download class="h-4 w-4" aria-hidden="true" />{{ t('examResults.export.pdf') }}
      </button>
      <button
        v-if="canPublish"
        type="button"
        :class="btnPrimary"
        :disabled="busy"
        data-testid="publish"
        @click="emit('publish')"
      >
        {{ t('examResults.hero.publish') }}
      </button>
      <span v-if="canUnpublish || hasExamPage" class="ml-auto sm:ml-0">
        <DropdownMenu
          :items="items"
          :label="t('examResults.hero.more')"
          :trigger-class="iconBtn"
          @select="onSelect"
        >
          <template #trigger><MoreVertical class="h-5 w-5" aria-hidden="true" /></template>
        </DropdownMenu>
      </span>
    </div>
  </header>
</template>
