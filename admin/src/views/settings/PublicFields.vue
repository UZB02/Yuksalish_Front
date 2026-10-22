<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import type { PublicSettings } from '@/api/types'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import {
  OVERRIDABLE_KEYS,
  TOP_PRESETS,
  topMode,
  type PublicErrors,
  type PublicKey,
} from '@/utils/publicForm'
import { formatSetting } from '@/utils/settingsFormat'
import SettingRow from './SettingRow.vue'

const props = defineProps<{
  modelValue: PublicSettings
  errors: PublicErrors
  flags?: Record<PublicKey, boolean>
  globalValues?: PublicSettings
}>()
const emit = defineEmits<{
  'update:modelValue': [value: PublicSettings]
  'toggle-flag': [key: PublicKey, on: boolean]
}>()
const { t } = useI18n()

const PALETTE = [
  '#4f46e5',
  '#2563eb',
  '#0284c7',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0f172a',
]
const enabled = (k: PublicKey) => !props.flags || props.flags[k]
const flagOf = (k: PublicKey) => (props.flags ? props.flags[k] : undefined)
const globalText = (k: PublicKey) =>
  props.globalValues ? formatSetting(t, k, props.globalValues[k]) : ''

function set<K extends PublicKey>(key: K, value: PublicSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const SWITCHES = [
  'enabled',
  'includeInGlobal',
  'showClasses',
  'showStudents',
  'showScores',
  'showMedals',
  'showTrend',
  'showPhotos',
] as const
type SwitchKey = (typeof SWITCHES)[number]
const isSwitch = (k: PublicKey): k is SwitchKey => (SWITCHES as readonly string[]).includes(k)

const mode = computed(() => topMode(props.modelValue.topStudents))
const topOptions = computed(() => [
  ...TOP_PRESETS.map((n) => ({ value: String(n), label: t('settingsPublic.top.n', { n }) })),
  { value: 'all', label: t('settings.options.topStudents.all') },
  { value: 'custom', label: t('settingsPublic.top.custom') },
])
function onTop(v: string) {
  if (v === 'all') set('topStudents', null)
  else if (v === 'custom') set('topStudents', props.modelValue.topStudents ?? 25)
  else set('topStudents', Number(v))
}
const numOrNaN = (raw: string) => (raw.trim() === '' ? NaN : Number(raw))
const textOrNull = (raw: string) => (raw === '' ? null : raw)
</script>

<template>
  <div class="divide-y divide-border">
    <SettingRow
      v-for="k in OVERRIDABLE_KEYS"
      :key="k"
      :label="t(`settings.fields.${k}.label`)"
      :hint="t(`settings.fields.${k}.hint`)"
      :flag="flagOf(k)"
      :global-text="globalText(k)"
      @toggle="emit('toggle-flag', k, $event)"
    >
      <div v-if="isSwitch(k)">
        <BaseSwitch
          :model-value="modelValue[k]"
          :disabled="!enabled(k)"
          :label="modelValue[k] ? t('settings.yes') : t('settings.no')"
          @update:model-value="set(k, $event)"
        />
        <p
          v-if="k === 'showPhotos' && modelValue.showPhotos"
          class="mt-2 rounded-lg border border-warning/40 bg-warning-soft p-2.5 text-xs text-fg"
          role="note"
          data-testid="photos-warning"
        >
          {{ t('settingsPublic.photosWarning') }}
        </p>
      </div>

      <div v-else-if="k === 'showScope'" class="space-y-2">
        <label
          v-for="s in ['own', 'global'] as const"
          :key="s"
          class="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm"
          :class="modelValue.showScope === s ? 'border-primary-600 bg-primary-50' : ''"
        >
          <input
            type="radio"
            class="mt-1 accent-primary-600"
            :checked="modelValue.showScope === s"
            :disabled="!enabled(k)"
            @change="set('showScope', s)"
          />
          <span>
            <span class="block font-medium text-fg">{{
              t(`settings.options.showScope.${s}`)
            }}</span>
            <span class="block text-xs text-fg-muted">{{
              t(`settingsPublic.scopeHelp.${s}`)
            }}</span>
          </span>
        </label>
      </div>

      <div v-else-if="k === 'topStudents'" class="space-y-2">
        <BaseSelect
          :model-value="String(mode)"
          :options="topOptions"
          :disabled="!enabled(k)"
          :aria-label="t('settings.fields.topStudents.label')"
          @update:model-value="onTop"
        />
        <BaseInput
          v-if="mode === 'custom'"
          :model-value="modelValue.topStudents ?? ''"
          type="number"
          inputmode="numeric"
          min="1"
          max="500"
          :disabled="!enabled(k)"
          :aria-label="t('settingsPublic.top.custom')"
          :error="errors.topStudents"
          @update:model-value="set('topStudents', numOrNaN($event))"
        />
      </div>

      <div v-else-if="k === 'title' || k === 'subtitle'">
        <BaseInput
          :model-value="modelValue[k] ?? ''"
          :disabled="!enabled(k)"
          :maxlength="k === 'title' ? 80 : 160"
          :aria-label="t(`settings.fields.${k}.label`)"
          :error="errors[k]"
          @update:model-value="set(k, textOrNull($event))"
        />
      </div>

      <div v-else-if="k === 'primaryColor'" class="space-y-2">
        <div
          class="flex flex-wrap items-center gap-2"
          role="radiogroup"
          :aria-label="t('settings.fields.primaryColor.label')"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="modelValue.primaryColor === null"
            :disabled="!enabled(k)"
            class="rounded-lg border px-2 py-1 text-xs"
            :class="
              modelValue.primaryColor === null ? 'border-fg text-fg' : 'border-border text-fg-muted'
            "
            @click="set('primaryColor', null)"
          >
            {{ t('settingsPublic.defaultColor') }}
          </button>
          <button
            v-for="c in PALETTE"
            :key="c"
            type="button"
            role="radio"
            :aria-checked="modelValue.primaryColor?.toLowerCase() === c"
            :aria-label="c"
            :disabled="!enabled(k)"
            class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-transparent text-white"
            :class="modelValue.primaryColor?.toLowerCase() === c ? '!border-fg' : ''"
            :style="{ backgroundColor: c }"
            @click="set('primaryColor', c)"
          >
            <Check
              v-if="modelValue.primaryColor?.toLowerCase() === c"
              class="h-3.5 w-3.5"
              aria-hidden="true"
            />
          </button>
        </div>
        <BaseInput
          :model-value="modelValue.primaryColor ?? ''"
          class="w-36"
          placeholder="#4f46e5"
          :disabled="!enabled(k)"
          :aria-label="t('behaviorTypes.hex')"
          :error="errors.primaryColor"
          @update:model-value="set('primaryColor', textOrNull($event))"
        />
      </div>

      <BaseInput
        v-else
        :model-value="
          Number.isNaN(modelValue[k as 'autoRefreshSeconds'])
            ? ''
            : modelValue[k as 'autoRefreshSeconds']
        "
        type="number"
        inputmode="numeric"
        :disabled="!enabled(k)"
        :aria-label="t(`settings.fields.${k}.label`)"
        :error="errors[k]"
        @update:model-value="set(k as 'autoRefreshSeconds', numOrNaN($event))"
      />
    </SettingRow>
  </div>
</template>
