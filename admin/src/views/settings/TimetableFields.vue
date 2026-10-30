<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TimetableAttendanceSettings } from '@/api/types'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import {
  ENFORCEMENT_MODES,
  TIMETABLE_KEYS,
  type TimetableFormErrors,
  type TimetableKey,
} from '@/utils/timetableForm'
import { formatSetting } from '@/utils/settingsFormat'
import SettingRow from './SettingRow.vue'

const props = defineProps<{
  modelValue: TimetableAttendanceSettings
  errors: TimetableFormErrors
  flags?: Record<TimetableKey, boolean>
  globalValues?: TimetableAttendanceSettings
}>()
const emit = defineEmits<{
  'update:modelValue': [value: TimetableAttendanceSettings]
  'toggle-flag': [key: TimetableKey, on: boolean]
}>()
const { t } = useI18n()

const NO_TIMETABLE = ['manual', 'block'] as const

const enabled = (k: TimetableKey) => !props.flags || props.flags[k]
const flagOf = (k: TimetableKey) => (props.flags ? props.flags[k] : undefined)
const globalText = (k: TimetableKey) =>
  props.globalValues ? formatSetting(t, k, props.globalValues[k]) : ''
// "Jadvalsiz sinf" faqat qat'iy rejimda ma'noga ega
const rows = () =>
  TIMETABLE_KEYS.filter(
    (k) => k !== 'strictNoTimetable' || props.modelValue.enforcement === 'strict',
  )

function set<K extends TimetableKey>(key: K, value: TimetableAttendanceSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="divide-y divide-border">
    <SettingRow
      v-for="k in rows()"
      :key="k"
      :label="t(`settingsTimetable.fields.${k}.label`)"
      :hint="t(`settingsTimetable.fields.${k}.hint`)"
      :flag="flagOf(k)"
      :global-text="globalText(k)"
      @toggle="emit('toggle-flag', k, $event)"
    >
      <div v-if="k === 'enforcement'">
        <div
          role="radiogroup"
          :aria-label="t('settingsTimetable.fields.enforcement.label')"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="m in ENFORCEMENT_MODES"
            :key="m"
            type="button"
            role="radio"
            :aria-checked="modelValue.enforcement === m"
            :disabled="!enabled(k)"
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60"
            :class="
              modelValue.enforcement === m
                ? 'border-primary-600 bg-primary-50 text-primary-700'
                : 'border-border text-fg-muted hover:bg-surface-muted'
            "
            data-testid="enforcement-option"
            @click="set('enforcement', m)"
          >
            {{ t(`settings.options.enforcement.${m}`) }}
          </button>
        </div>
        <p class="mt-2 text-xs text-fg-muted" data-testid="enforcement-help">
          {{ t(`settingsTimetable.enforcementHelp.${modelValue.enforcement}`) }}
        </p>
        <p v-if="errors.enforcement" class="mt-1 text-xs text-danger" role="alert">
          {{ errors.enforcement }}
        </p>
      </div>

      <BaseSwitch
        v-else-if="k === 'homeroomCanTakeAnyLesson'"
        :model-value="modelValue.homeroomCanTakeAnyLesson"
        :disabled="!enabled(k)"
        :label="modelValue.homeroomCanTakeAnyLesson ? t('settings.yes') : t('settings.no')"
        data-testid="homeroom-switch"
        @update:model-value="set('homeroomCanTakeAnyLesson', $event)"
      />

      <div
        v-else
        role="radiogroup"
        :aria-label="t('settingsTimetable.fields.strictNoTimetable.label')"
        class="flex flex-wrap gap-1.5"
      >
        <button
          v-for="m in NO_TIMETABLE"
          :key="m"
          type="button"
          role="radio"
          :aria-checked="modelValue.strictNoTimetable === m"
          :disabled="!enabled(k)"
          class="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60"
          :class="
            modelValue.strictNoTimetable === m
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-border text-fg-muted hover:bg-surface-muted'
          "
          data-testid="no-timetable-option"
          @click="set('strictNoTimetable', m)"
        >
          {{ t(`settings.options.strictNoTimetable.${m}`) }}
        </button>
      </div>
    </SettingRow>
  </div>
</template>
