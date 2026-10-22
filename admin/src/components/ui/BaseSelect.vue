<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useAttrs,
  useId,
  watch,
  type CSSProperties,
} from 'vue'
import { Check, ChevronDown, Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { matchesSearch } from '@/utils/searchText'

defineOptions({ inheritAttrs: false })

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

/**
 * Tanlash maydoni. Variantlar soni `searchThreshold` dan oshsa avtomatik ravishda
 * qidiruvli combobox, aks holda oddiy native `<select>` ko'rsatiladi.
 * `searchable` bilan majburan yoqish/o'chirish mumkin.
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    options: SelectOption[]
    label?: string
    placeholder?: string
    error?: string
    required?: boolean
    disabled?: boolean
    /** undefined = avtomatik (variantlar soni > searchThreshold) */
    searchable?: boolean
    searchThreshold?: number
  }>(),
  { searchable: undefined, searchThreshold: 8 },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const attrs = useAttrs()
const id = useId()
const listId = `${id}-list`
const describedBy = computed(() => (props.error ? `${id}-error` : undefined))

const isSearchable = computed(
  () => props.searchable ?? props.options.length > props.searchThreshold,
)

/** class/style ildizga, vee-validate `onBlur` esa combobox yopilganda qo'lda chaqiriladi */
const selectAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})
const triggerAttrs = computed(() => {
  const { onBlur: _b, ...rest } = selectAttrs.value
  return rest
})

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}

// ---------- combobox ----------
interface Item extends SelectOption {
  empty?: boolean
}

const open = ref(false)
const query = ref('')
const active = ref(-1)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const panelStyle = ref<CSSProperties>({})
const listMaxHeight = ref(256)

const current = computed(() => props.modelValue ?? '')
const selectedOption = computed(() => props.options.find((o) => o.value === current.value))
const triggerText = computed(() => selectedOption.value?.label ?? props.placeholder ?? '')

const items = computed<Item[]>(() => {
  const q = query.value.trim()
  const list = props.options.filter((o) => matchesSearch(o.label, q))
  // Bo'sh tanlov ("Barchasi", "Tayinlanmagan"...) faqat qidiruv bo'sh bo'lganda ko'rsatiladi
  return props.placeholder !== undefined && q === ''
    ? [{ value: '', label: props.placeholder, empty: true }, ...list]
    : list
})
const optionId = (i: number) => `${id}-opt-${i}`
const activeDescendant = computed(() =>
  open.value && active.value >= 0 ? optionId(active.value) : undefined,
)

function firstEnabled(from = 0, dir = 1): number {
  for (let i = from; i >= 0 && i < items.value.length; i += dir) {
    if (!items.value[i]!.disabled) return i
  }
  return -1
}

function resetActive() {
  const sel = items.value.findIndex((o) => o.value === current.value && !o.disabled)
  active.value = query.value.trim() === '' && sel >= 0 ? sel : firstEnabled()
}

watch(query, () => {
  resetActive()
  void scrollActive()
})

function move(dir: 1 | -1) {
  const next = firstEnabled(active.value + dir, dir)
  if (next >= 0) active.value = next
  void scrollActive()
}

async function scrollActive() {
  await nextTick()
  document.getElementById(optionId(active.value))?.scrollIntoView?.({ block: 'nearest' })
}

function callBlur() {
  const handler = attrs.onBlur
  const list = Array.isArray(handler) ? handler : [handler]
  for (const fn of list) if (typeof fn === 'function') fn(new FocusEvent('blur'))
}

function updatePosition() {
  const el = trigger.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 4
  const margin = 8
  const chrome = 56 // qidiruv maydoni balandligi
  const width = Math.min(Math.max(r.width, 192), vw - margin * 2)
  const left = Math.max(margin, Math.min(r.left, vw - width - margin))
  const below = vh - r.bottom - margin - gap
  const above = r.top - margin - gap
  const flip = below < 240 && above > below
  const space = flip ? above : below
  listMaxHeight.value = Math.max(120, Math.min(256, space - chrome))
  panelStyle.value = flip
    ? { left: `${left}px`, width: `${width}px`, bottom: `${vh - r.top + gap}px` }
    : { left: `${left}px`, width: `${width}px`, top: `${r.bottom + gap}px` }
}

function onViewportChange(e: Event) {
  if (e.target instanceof Node && panel.value?.contains(e.target)) return
  updatePosition()
}

function onOutside(e: Event) {
  const target = e.target as Node
  if (panel.value?.contains(target) || trigger.value?.contains(target)) return
  close(false)
}

function openPanel(initialQuery = '') {
  if (props.disabled || open.value) return
  query.value = initialQuery
  updatePosition()
  open.value = true
  resetActive()
  void nextTick(() => {
    searchInput.value?.focus({ preventScroll: true })
    void scrollActive()
  })
}

function close(refocus: boolean) {
  if (!open.value) return
  open.value = false
  query.value = ''
  if (refocus) trigger.value?.focus()
  callBlur()
}

function choose(i: number) {
  const item = items.value[i]
  if (!item || item.disabled) return
  emit('update:modelValue', item.value)
  close(true)
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openPanel()
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    openPanel(e.key)
  }
}

function onTriggerBlur() {
  if (!open.value) callBlur()
}

function onSearchKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      move(-1)
      break
    case 'Home':
      e.preventDefault()
      active.value = firstEnabled()
      void scrollActive()
      break
    case 'End':
      e.preventDefault()
      active.value = firstEnabled(items.value.length - 1, -1)
      void scrollActive()
      break
    case 'Enter':
      e.preventDefault()
      choose(active.value)
      break
    case 'Escape':
      e.preventDefault()
      e.stopPropagation()
      close(true)
      break
    case 'Tab':
      // fokus triggerga qaytadi, brauzerning Tab harakati undan keyingi elementga o'tadi
      trigger.value?.focus()
      close(false)
      break
  }
}

watch(open, (isOpen) => {
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onOutside, true)
  window[method]('resize', updatePosition)
  window[method]('scroll', onViewportChange, true)
})
watch(isSearchable, (on) => {
  if (!on) open.value = false
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <div :class="$attrs.class" :style="$attrs.style as string">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-fg">
      {{ label }}<span v-if="required" class="ml-0.5 text-danger" aria-hidden="true">*</span>
    </label>
    <select
      v-if="!isSearchable"
      v-bind="selectAttrs"
      :id="id"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :required="required"
      :aria-invalid="!!error"
      :aria-describedby="describedBy"
      class="h-10 w-full rounded-lg border bg-surface px-3 text-sm text-fg transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
      :class="error ? 'border-danger' : 'border-border'"
      @change="onChange"
    >
      <option v-if="placeholder !== undefined" value="">{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value" :disabled="o.disabled">
        {{ o.label }}
      </option>
    </select>
    <template v-else>
      <button
        v-bind="triggerAttrs"
        :id="id"
        ref="trigger"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="activeDescendant"
        :aria-required="required || undefined"
        :aria-invalid="!!error"
        :aria-describedby="describedBy"
        :disabled="disabled"
        class="flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left text-sm text-fg transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
        :class="[error ? 'border-danger' : 'border-border', open && 'border-primary-500']"
        @click="open ? close(true) : openPanel()"
        @keydown="onTriggerKeydown"
        @blur="onTriggerBlur"
      >
        <span class="min-w-0 flex-1 truncate">{{ triggerText }}</span>
        <ChevronDown
          class="h-4 w-4 shrink-0 text-fg-muted transition-transform"
          :class="open && 'rotate-180'"
          aria-hidden="true"
        />
      </button>
      <Teleport to="body">
        <div
          v-if="open"
          ref="panel"
          class="fixed z-[100] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          :style="panelStyle"
          data-testid="select-panel"
        >
          <div class="relative border-b border-border p-2">
            <Search
              class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
              aria-hidden="true"
            />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              :aria-controls="listId"
              :aria-activedescendant="activeDescendant"
              :aria-label="label || String($attrs['aria-label'] ?? t('common.search'))"
              :placeholder="t('common.searchPlaceholder')"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              enterkeyhint="done"
              class="h-10 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-base text-fg focus:border-primary-500 sm:h-9 sm:text-sm"
              @keydown="onSearchKeydown"
            />
          </div>
          <ul
            :id="listId"
            role="listbox"
            :aria-label="label || String($attrs['aria-label'] ?? '')"
            class="overflow-y-auto overscroll-contain py-1"
            :style="{ maxHeight: `${listMaxHeight}px` }"
          >
            <li
              v-for="(item, i) in items"
              :id="optionId(i)"
              :key="item.empty ? '__empty' : item.value"
              role="option"
              :data-value="item.value"
              :aria-selected="item.value === current"
              :aria-disabled="item.disabled || undefined"
              class="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm sm:min-h-9 sm:py-1.5"
              :class="[
                i === active ? 'bg-surface-muted' : '',
                item.disabled ? 'cursor-not-allowed opacity-50' : 'text-fg',
                item.value === current ? 'font-medium text-primary-700' : '',
              ]"
              @mousedown.prevent
              @mousemove="!item.disabled && (active = i)"
              @click="choose(i)"
            >
              <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
              <Check
                v-if="item.value === current"
                class="h-4 w-4 shrink-0 text-primary-600"
                aria-hidden="true"
              />
            </li>
            <li
              v-if="items.length === 0"
              class="px-3 py-3 text-center text-sm text-fg-muted"
              role="presentation"
            >
              {{ t('common.noResults') }}
            </li>
          </ul>
        </div>
      </Teleport>
    </template>
    <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs text-danger" role="alert">
      {{ error }}
    </p>
  </div>
</template>
