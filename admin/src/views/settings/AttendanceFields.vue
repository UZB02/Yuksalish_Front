<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AttendanceCategory, AttendanceMode, AttendanceSettings } from '@/api/types'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { CATEGORIES } from '@/utils/attendance'
import {
  ATTENDANCE_KEYS,
  toggleWeekday,
  type AttendanceFormErrors,
  type AttendanceKey,
} from '@/utils/attendanceForm'
import { formatSetting } from '@/utils/settingsFormat'
import SettingRow from './SettingRow.vue'

const props = defineProps<{
  modelValue: AttendanceSettings
  errors: AttendanceFormErrors
  flags?: Record<AttendanceKey, boolean>
  globalValues?: AttendanceSettings
}>()
const emit = defineEmits<{
  'update:modelValue': [value: AttendanceSettings]
  'toggle-flag': [key: AttendanceKey, on: boolean]
}>()
const { t } = useI18n()

const MODES: AttendanceMode[] = ['daily', 'lesson']
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

const enabled = (k: AttendanceKey) => !props.flags || props.flags[k]
const flagOf = (k: AttendanceKey) => (props.flags ? props.flags[k] : undefined)
const globalText = (k: AttendanceKey) =>
  props.globalValues ? formatSetting(t, k, props.globalValues[k]) : ''
// Dars soni faqat dars rejimida ko'rinadi (override rejimida ham joriy qiymatga qarab)
const rows = () =>
  ATTENDANCE_KEYS.filter((k) => k !== 'lessonsPerDay' || props.modelValue.mode === 'lesson')

function set<K extends AttendanceKey>(key: K, value: AttendanceSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const num = (raw: string): number => (raw.trim() === '' ? NaN : Number(raw))

function toggleCategory(c: AttendanceCategory, on: boolean) {
  const cur = props.modelValue.noteRequiredCategories
  set(
    'noteRequiredCategories',
    on ? [...cur.filter((x) => x !== c), c] : cur.filter((x) => x !== c),
  )
}

function setImpact(patch: Partial<AttendanceSettings['ratingImpact']>) {
  set('ratingImpact', { ...props.modelValue.ratingImpact, ...patch })
}

const PENALTIES = ['penaltyLate', 'penaltyAbsentExcused', 'penaltyAbsentUnexcused'] as const
</script>

<template>
  <div class="divide-y divide-border">
    <SettingRow
      v-for="k in rows()"
      :key="k"
      :label="t(`settingsAttendance.fields.${k}.label`)"
      :hint="t(`settingsAttendance.fields.${k}.hint`)"
      :flag="flagOf(k)"
      :global-text="globalText(k)"
      @toggle="emit('toggle-flag', k, $event)"
    >
      <div
        v-if="k === 'mode'"
        role="radiogroup"
        :aria-label="t('settingsAttendance.fields.mode.label')"
        class="flex flex-wrap gap-1.5"
      >
        <button
          v-for="m in MODES"
          :key="m"
          type="button"
          role="radio"
          :aria-checked="modelValue.mode === m"
          :disabled="!enabled(k)"
          class="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60"
          :class="
            modelValue.mode === m
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-border text-fg-muted hover:bg-surface-muted'
          "
          data-testid="mode-option"
          @click="set('mode', m)"
        >
          {{ t(`settings.options.mode.${m}`) }}
        </button>
      </div>

      <BaseInput
        v-else-if="k === 'lessonsPerDay'"
        :model-value="Number.isNaN(modelValue.lessonsPerDay) ? '' : modelValue.lessonsPerDay"
        type="number"
        inputmode="numeric"
        min="1"
        max="12"
        :disabled="!enabled(k)"
        :aria-label="t('settingsAttendance.fields.lessonsPerDay.label')"
        :error="errors.lessonsPerDay"
        data-testid="lessons-input"
        @update:model-value="set('lessonsPerDay', num($event))"
      />

      <div v-else-if="k === 'workingWeekdays'">
        <div
          class="flex flex-wrap gap-1.5"
          role="group"
          :aria-label="t('settingsAttendance.fields.workingWeekdays.label')"
        >
          <button
            v-for="d in WEEKDAYS"
            :key="d"
            type="button"
            :aria-pressed="modelValue.workingWeekdays.includes(d)"
            :disabled="!enabled(k)"
            class="h-10 min-w-[2.75rem] rounded-lg border px-2 text-sm font-medium transition-colors disabled:opacity-60"
            :class="
              modelValue.workingWeekdays.includes(d)
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-border text-fg-muted hover:bg-surface-muted'
            "
            data-testid="weekday"
            @click="set('workingWeekdays', toggleWeekday(modelValue.workingWeekdays, d))"
          >
            {{ t(`settingsAttendance.weekdays.${d}`) }}
          </button>
        </div>
        <p v-if="errors.workingWeekdays" class="mt-1 text-xs text-danger" role="alert">
          {{ errors.workingWeekdays }}
        </p>
      </div>

      <BaseInput
        v-else-if="k === 'editWindowHours' || k === 'backdateDays'"
        :model-value="Number.isNaN(modelValue[k]) ? '' : modelValue[k]"
        type="number"
        inputmode="numeric"
        min="0"
        :disabled="!enabled(k)"
        :aria-label="t(`settingsAttendance.fields.${k}.label`)"
        :error="errors[k]"
        @update:model-value="set(k, num($event))"
      />

      <div v-else-if="k === 'noteRequiredCategories'" class="space-y-2">
        <BaseCheckbox
          v-for="c in CATEGORIES"
          :key="c"
          :model-value="modelValue.noteRequiredCategories.includes(c)"
          :disabled="!enabled(k)"
          :label="t(`attendance.categories.${c}`)"
          @update:model-value="toggleCategory(c, $event)"
        />
      </div>

      <div v-else class="space-y-3" data-testid="rating-impact">
        <BaseSwitch
          :model-value="modelValue.ratingImpact.enabled"
          :disabled="!enabled(k)"
          :label="modelValue.ratingImpact.enabled ? t('settings.yes') : t('settings.no')"
          @update:model-value="setImpact({ enabled: $event })"
        />
        <template v-if="modelValue.ratingImpact.enabled">
          <BaseInput
            v-for="p in PENALTIES"
            :key="p"
            :model-value="
              Number.isNaN(modelValue.ratingImpact[p]) ? '' : modelValue.ratingImpact[p]
            "
            type="number"
            inputmode="decimal"
            min="0"
            step="0.1"
            :disabled="!enabled(k)"
            :label="t(`settingsAttendance.penalty.${p}`)"
            @update:model-value="setImpact({ [p]: num($event) })"
          />
          <p v-if="errors.ratingImpact" class="text-xs text-danger" role="alert">
            {{ errors.ratingImpact }}
          </p>
          <p class="text-xs text-fg-muted">{{ t('settingsAttendance.impactHelp') }}</p>
        </template>
      </div>
    </SettingRow>
  </div>
</template>
