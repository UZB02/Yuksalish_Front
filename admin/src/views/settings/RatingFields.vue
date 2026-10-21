<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RatingMethod, RatingPeriodType, RatingSettings, RefreshMode } from '@/api/types'
import BaseInput from '@/components/ui/BaseInput.vue'
import TieBreakEditor from '@/components/settings/TieBreakEditor.vue'
import { RATING_KEYS, type RatingErrors, type RatingKey } from '@/utils/ratingForm'
import { formatSetting } from '@/utils/settingsFormat'
import SettingRow from './SettingRow.vue'

const props = defineProps<{
  modelValue: RatingSettings
  errors: RatingErrors
  flags?: Record<RatingKey, boolean>
  globalValues?: RatingSettings
}>()
const emit = defineEmits<{
  'update:modelValue': [value: RatingSettings]
  'toggle-flag': [key: RatingKey, on: boolean]
}>()
const { t } = useI18n()

const PERIODS: RatingPeriodType[] = ['week', 'month', 'quarter', 'academic_year', 'custom']
const METHODS: RatingMethod[] = ['average', 'sum']
const MODES: RefreshMode[] = ['realtime', 'nightly']

// periodType override bo'lsa, custom sanalar ham birga boshqariladi.
const enabled = (k: RatingKey) => !props.flags || props.flags[k]
const rowKeys = RATING_KEYS.filter((k) => k !== 'customFrom' && k !== 'customTo')

function set<K extends RatingKey>(key: K, value: RatingSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const globalText = (k: RatingKey) =>
  props.globalValues ? formatSetting(t, k, props.globalValues[k]) : ''
const flagOf = (k: RatingKey) => (props.flags ? props.flags[k] : undefined)

function toggle(k: RatingKey, on: boolean) {
  emit('toggle-flag', k, on)
  // Davr turi bilan birga maxsus sanalar ham override qilinadi.
  if (k === 'periodType') {
    emit('toggle-flag', 'customFrom', on)
    emit('toggle-flag', 'customTo', on)
  }
}
</script>

<template>
  <div class="divide-y divide-border">
    <SettingRow
      v-for="k in rowKeys"
      :key="k"
      :label="t(`settings.fields.${k}.label`)"
      :hint="t(`settings.fields.${k}.hint`)"
      :flag="flagOf(k)"
      :global-text="globalText(k)"
      @toggle="toggle(k, $event)"
    >
      <div v-if="k === 'periodType'" class="space-y-3">
        <div
          role="radiogroup"
          :aria-label="t('settings.fields.periodType.label')"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="p in PERIODS"
            :key="p"
            type="button"
            role="radio"
            :aria-checked="modelValue.periodType === p"
            :disabled="!enabled(k)"
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60"
            :class="
              modelValue.periodType === p
                ? 'border-primary-600 bg-primary-50 text-primary-700'
                : 'border-border text-fg-muted hover:bg-surface-muted'
            "
            @click="set('periodType', p)"
          >
            {{ t(`settings.options.periodType.${p}`) }}
          </button>
        </div>
        <div v-if="modelValue.periodType === 'custom'" class="grid gap-3 sm:grid-cols-2">
          <BaseInput
            :model-value="modelValue.customFrom ?? ''"
            type="date"
            :label="t('scores.from')"
            :disabled="!enabled(k)"
            :max="modelValue.customTo ?? undefined"
            :error="errors.customFrom"
            @update:model-value="set('customFrom', $event || null)"
          />
          <BaseInput
            :model-value="modelValue.customTo ?? ''"
            type="date"
            :label="t('scores.to')"
            :disabled="!enabled(k)"
            :min="modelValue.customFrom ?? undefined"
            :error="errors.customTo"
            @update:model-value="set('customTo', $event || null)"
          />
        </div>
      </div>

      <div v-else-if="k === 'method'" class="space-y-2">
        <label
          v-for="m in METHODS"
          :key="m"
          class="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm"
          :class="modelValue.method === m ? 'border-primary-600 bg-primary-50' : ''"
        >
          <input
            type="radio"
            class="mt-1 accent-primary-600"
            :checked="modelValue.method === m"
            :disabled="!enabled(k)"
            @change="set('method', m)"
          />
          <span>
            <span class="block font-medium text-fg">{{ t(`settings.options.method.${m}`) }}</span>
            <span class="block text-xs text-fg-muted">{{ t(`settings.methodHelp.${m}`) }}</span>
          </span>
        </label>
      </div>

      <BaseInput
        v-else-if="k === 'minScoresCount'"
        :model-value="Number.isNaN(modelValue.minScoresCount) ? '' : modelValue.minScoresCount"
        type="number"
        inputmode="numeric"
        min="1"
        :disabled="!enabled(k)"
        :aria-label="t('settings.fields.minScoresCount.label')"
        :error="errors.minScoresCount"
        @update:model-value="set('minScoresCount', $event === '' ? NaN : Number($event))"
      />

      <TieBreakEditor
        v-else-if="k === 'tieBreak'"
        :model-value="modelValue.tieBreak"
        :disabled="!enabled(k)"
        @update:model-value="set('tieBreak', $event)"
      />

      <div v-else class="space-y-2">
        <label
          v-for="m in MODES"
          :key="m"
          class="flex cursor-pointer items-center gap-2 text-sm text-fg"
        >
          <input
            type="radio"
            class="accent-primary-600"
            :checked="modelValue.refreshMode === m"
            :disabled="!enabled(k)"
            @change="set('refreshMode', m)"
          />
          {{ t(`settings.options.refreshMode.${m}`) }}
        </label>
      </div>
    </SettingRow>
  </div>
</template>
