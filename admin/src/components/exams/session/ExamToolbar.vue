<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { BellRing, Plus, Search, Square, Timer, X } from 'lucide-vue-next'

/**
 * Asboblar qatori (min balandlik 44 px): varaqlar (tab), qidiruv va "Qo'shish". O'quvchilar tanlansa shu joyda
 * "N ta tanlandi" va ommaviy amallar (ruxsatga qarab) ko'rinadi.
 */
defineProps<{
  tabs: { key: string; label: string }[]
  tab: string
  q: string
  showSearch: boolean
  canAdd: boolean
  selectedCount: number
  canWarn: boolean
  canGrant: boolean
  canStop: boolean
}>()
const emit = defineEmits<{
  'update:tab': [key: string]
  'update:q': [value: string]
  add: []
  warn: []
  grant: []
  stop: []
  clear: []
}>()
const { t } = useI18n()

const btn =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors'
</script>

<template>
  <div
    class="mb-3 flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border px-2 py-1"
    :class="selectedCount ? 'border-primary-600 bg-primary-50' : 'border-border bg-surface'"
    data-testid="exam-toolbar"
  >
    <template v-if="selectedCount">
      <b class="px-2 text-sm text-primary-700" data-testid="sel-count" aria-live="polite">{{
        t('examBoard.toolbar.selected', { n: selectedCount })
      }}</b>
      <span class="flex-1" />
      <button
        v-if="canWarn"
        type="button"
        :class="[btn, 'bg-primary-600 text-white hover:bg-primary-700']"
        data-testid="bulk-warn"
        @click="emit('warn')"
      >
        <BellRing class="h-4 w-4" aria-hidden="true" />{{ t('examBoard.toolbar.warn') }}
      </button>
      <button
        v-if="canGrant"
        type="button"
        :class="[btn, 'border border-border bg-surface text-fg hover:bg-surface-muted']"
        data-testid="bulk-grant"
        @click="emit('grant')"
      >
        <Timer class="h-4 w-4" aria-hidden="true" />{{ t('examBoard.toolbar.grant') }}
      </button>
      <button
        v-if="canStop"
        type="button"
        :class="[btn, 'text-danger hover:bg-danger-soft']"
        data-testid="bulk-stop"
        @click="emit('stop')"
      >
        <Square class="h-4 w-4" aria-hidden="true" />{{ t('examBoard.toolbar.stop') }}
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted"
        :aria-label="t('examBoard.toolbar.clear')"
        data-testid="bulk-clear"
        @click="emit('clear')"
      >
        <X class="h-4 w-4" aria-hidden="true" />
      </button>
    </template>
    <template v-else>
      <div class="flex gap-1" role="tablist" :aria-label="t('examBoard.tabsAria')">
        <button
          v-for="x in tabs"
          :key="x.key"
          type="button"
          role="tab"
          :aria-selected="tab === x.key"
          class="h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium"
          :class="tab === x.key ? 'bg-primary-100 text-primary-700' : 'text-fg-muted hover:text-fg'"
          :data-testid="`tab-${x.key}`"
          @click="emit('update:tab', x.key)"
        >
          {{ x.label }}
        </button>
      </div>
      <span class="flex-1" />
      <div v-if="showSearch" class="flex w-full items-center gap-2 sm:w-auto">
        <label class="relative block min-w-0 flex-1 sm:w-56 sm:flex-none">
          <Search
            class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-fg-muted"
            aria-hidden="true"
          />
          <input
            :value="q"
            type="search"
            class="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-2 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            :placeholder="t('examBoard.toolbar.search')"
            :aria-label="t('examBoard.toolbar.search')"
            data-testid="board-search"
            @input="emit('update:q', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <button
          v-if="canAdd"
          type="button"
          :class="[btn, 'bg-primary-600 text-white hover:bg-primary-700']"
          data-testid="toggle-add"
          @click="emit('add')"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />{{ t('examBoard.toolbar.add') }}
        </button>
      </div>
    </template>
  </div>
</template>
