<script setup lang="ts">
import type { CellState } from '../lib/grid'
import Icon from './Icon.vue'

export interface MapCell {
  index: number
  id: string
  state: CellState
  /** Belgilangan, lekin javob ham berilgan: katakda kichik yashil nuqta */
  answered: boolean
}
export interface MapGroup {
  key: string
  title: string
  cells: MapCell[]
}

const props = defineProps<{
  groups: MapGroup[]
  current: number
  /** Katak data-testid prefiksi (telefon paneli uchun 'm-') */
  prefix?: string
  gridTestid?: string
  /** Katak balandligi/ustunlar */
  cols?: string
  cellSize?: string
  /** Kompyuter: ustun kengayganda kataklar ham kattalashadi (ixcham, 2.25rem) */
  fluid?: boolean
}>()
const emit = defineEmits<{ goto: [index: number] }>()

const all = () => props.groups.flatMap((g) => g.cells)
const answered = () => all().filter((c) => c.answered).length
const total = () => all().length
const count = (st: CellState) => all().filter((c) => c.state === st).length
/** Javob berilgan (belgilangan bo'lsa ham) / belgilangan / javobsiz */
const legend = () => [
  { cls: 'bg-ok', text: 'Javob berilgan', n: answered() },
  { cls: 'bg-warn', text: 'Belgilangan', n: count('flagged') },
  { cls: 'border border-line bg-surface', text: 'Javobsiz', n: count('empty') },
]
const pct = () => (total() ? Math.round((answered() / total()) * 100) : 0)
const stateText = { answered: 'javob berilgan', flagged: 'belgilangan', empty: 'javobsiz' }
const label = (c: MapCell) => {
  const parts = [`${c.index + 1}-savol`]
  if (c.answered) parts.push('javob berilgan')
  if (c.state === 'flagged') parts.push('belgilangan')
  if (!c.answered && c.state !== 'flagged') parts.push(stateText.empty)
  if (c.index === props.current) parts.push('hozirgi')
  return parts.join(', ')
}
const cellCls = (c: MapCell) => [
  'relative flex w-full items-center justify-center rounded-lg border tabular-nums text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  props.fluid ? 'h-9 2xl:h-10' : (props.cellSize ?? 'h-10'),
  c.answered
    ? 'border-ok bg-ok text-white'
    : c.state === 'flagged'
      ? 'border-warn bg-warn/15 text-warn'
      : 'border-line bg-surface text-fg-soft',
  c.index === props.current ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : '',
]
const groupCount = (g: MapGroup) => g.cells.filter((c) => c.answered).length
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3" data-testid="map">
    <div
      class="h-2 w-full shrink-0 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="pct()"
      aria-label="Javob berilgan savollar"
    >
      <div class="h-full rounded-full bg-brand" :style="{ width: pct() + '%' }" />
    </div>
    <ul class="flex shrink-0 flex-wrap gap-x-3 gap-y-1 text-xs text-fg-soft">
      <li v-for="l in legend()" :key="l.text" class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full" :class="l.cls" />
        {{ l.text }} <b class="tabular-nums">{{ l.n }}</b>
      </li>
    </ul>
    <div class="map-scroll min-h-0 flex-1 space-y-4 overflow-y-auto" :data-testid="gridTestid">
      <section v-for="g in groups" :key="g.key" :aria-label="g.title || 'Savollar'">
        <div v-if="groups.length > 1" class="mb-2">
          <div class="flex items-center justify-between gap-2">
            <h3 class="min-w-0 truncate text-sm font-semibold">{{ g.title }}</h3>
            <span class="shrink-0 text-xs tabular-nums text-fg-soft"
              >{{ groupCount(g) }}/{{ g.cells.length }}</span
            >
          </div>
          <div class="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              class="h-full rounded-full bg-ok"
              :style="{
                width: (g.cells.length ? (groupCount(g) / g.cells.length) * 100 : 0) + '%',
              }"
            />
          </div>
        </div>
        <div
          class="grid"
          :class="fluid ? 'gap-1.5' : ['gap-2', cols ?? 'grid-cols-6']"
          :style="
            fluid ? { gridTemplateColumns: 'repeat(auto-fill, minmax(2.25rem, 1fr))' } : undefined
          "
          data-testid="map-cells"
        >
          <button
            v-for="c in g.cells"
            :key="c.id"
            type="button"
            :class="cellCls(c)"
            :data-state="c.state"
            :aria-current="c.index === current ? 'step' : undefined"
            :aria-label="label(c)"
            :data-testid="`${prefix ?? ''}cell-${c.index}`"
            @click="emit('goto', c.index)"
          >
            {{ c.index + 1 }}
            <Icon
              v-if="c.state === 'flagged'"
              name="flag"
              size="h-2.5 w-2.5"
              class="absolute right-0.5 top-0.5"
            />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.map-scroll {
  scrollbar-width: thin;
  padding-right: 4px;
}
.map-scroll::-webkit-scrollbar {
  width: 6px;
}
.map-scroll::-webkit-scrollbar-thumb {
  background: rgb(128 128 128 / 0.4);
  border-radius: 3px;
}
</style>
