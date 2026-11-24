<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  sectionAverage,
  type BoardRow,
  type BoardSection,
  type BoardStage,
} from '@/utils/examBoard'
import StudentTile from './StudentTile.vue'

/** Bitta sinf (yoki "Nomzodlar"/"Mehmonlar") bo'limi: sarlavha (belgilash, soni, o'rtacha) va o'quvchi kataklari. */
const props = defineProps<{
  section: BoardSection
  /** Bo'limdagi jami (filtrsiz) o'quvchilar soni */
  total: number
  stage: BoardStage
  selectable: boolean
  selected: string[]
  activeKey: string | null
  gridClass: string
}>()
const emit = defineEmits<{
  open: [key: string]
  toggle: [key: string]
  toggleAll: [keys: string[], on: boolean]
}>()
const { t } = useI18n()

const title = computed(() => {
  const s = props.section
  if (s.kind === 'class') return s.title
  if (s.kind === 'candidate') return t('examBoard.section.candidates')
  if (s.kind === 'guest') return t('examBoard.section.guests')
  return t('examBoard.section.others')
})
const keys = computed(() => props.section.rows.map((r) => r.key))
const allOn = computed(
  () => keys.value.length > 0 && keys.value.every((k) => props.selected.includes(k)),
)
const avg = computed(() => sectionAverage(props.section.rows, props.stage))
/** Sinfsiz (mehmon/nomzod) kataklar tagida qayerdan kelgani */
const originOf = (r: BoardRow) => (props.section.kind === 'class' ? null : r.origin)
</script>

<template>
  <section class="mb-3" data-testid="class-section" :data-section="section.id">
    <div class="mb-1.5 flex h-7 items-center gap-2 px-2">
      <input
        v-if="selectable"
        type="checkbox"
        class="h-[18px] w-[18px] accent-primary-600"
        :checked="allOn"
        :aria-label="t('examBoard.section.selectAll', { name: title })"
        data-testid="section-check"
        @change="emit('toggleAll', keys, !allOn)"
      />
      <h2 class="text-sm font-semibold text-fg" data-testid="section-title">{{ title }}</h2>
      <span class="text-xs text-fg-muted" data-testid="section-count">{{
        section.rows.length === total
          ? t('examBoard.section.count', { n: total })
          : t('examBoard.section.partial', { a: section.rows.length, b: total })
      }}</span>
      <span class="h-px flex-1 bg-border" aria-hidden="true" />
      <span v-if="avg !== null && stage === 'during'" class="text-xs text-fg-muted">{{
        t('examBoard.section.done', { n: avg })
      }}</span>
      <span v-else-if="avg !== null && stage === 'after'" class="text-xs text-fg-muted">{{
        t('examBoard.section.avg', { n: avg })
      }}</span>
    </div>
    <div class="grid gap-1.5" :class="gridClass">
      <div v-for="r in section.rows" :key="r.key" class="min-w-0">
        <StudentTile
          :row="r"
          :stage="stage"
          :selectable="selectable"
          :selected="selected.includes(r.key)"
          :active="activeKey === r.key"
          @open="emit('open', $event)"
          @toggle="emit('toggle', $event)"
        />
        <p
          v-if="originOf(r)"
          class="truncate px-2 text-[11px] leading-4 text-fg-muted"
          data-testid="tile-origin"
        >
          {{ originOf(r) }}
        </p>
      </div>
    </div>
  </section>
</template>
