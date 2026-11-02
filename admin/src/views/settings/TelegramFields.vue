<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TelegramMessageSettings, TelegramNotifyToggles } from '@/api/types'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { formatTelegramSetting } from '@/utils/telegramFormat'
import {
  NOTIFY_KEYS,
  TELEGRAM_KEYS,
  WEEKDAYS,
  toggleWorkday,
  type TelegramFormErrors,
  type TelegramKey,
} from '@/utils/telegramForm'
import SettingRow from './SettingRow.vue'

const props = defineProps<{
  modelValue: TelegramMessageSettings
  errors: TelegramFormErrors
  flags?: Record<TelegramKey, boolean>
  globalValues?: TelegramMessageSettings
}>()
const emit = defineEmits<{
  'update:modelValue': [value: TelegramMessageSettings]
  'toggle-flag': [key: TelegramKey, on: boolean]
}>()
const { t } = useI18n()

const enabled = (k: TelegramKey) => !props.flags || props.flags[k]
const flagOf = (k: TelegramKey) => (props.flags ? props.flags[k] : undefined)
const globalText = (k: TelegramKey) =>
  props.globalValues ? formatTelegramSetting(t, k, props.globalValues[k]) : ''

function set<K extends TelegramKey>(key: K, value: TelegramMessageSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
function setNotify(k: keyof TelegramNotifyToggles, on: boolean) {
  set('notify', { ...props.modelValue.notify, [k]: on })
}

const manual = computed(() => props.modelValue.workdays !== null)
function setWorkdayMode(isManual: boolean) {
  // Qo'lda rejimga o'tganda dushanba-juma boshlang'ich qiymat bo'ladi
  set('workdays', isManual ? [1, 2, 3, 4, 5] : null)
}

const dayOptions = computed(() => [
  { value: 'auto', label: t('settingsTelegram.weeklyDayAuto') },
  ...WEEKDAYS.map((d) => ({
    value: String(d),
    label: t(`settingsTelegram.weekdaysFull.${d}`),
    // Ish kunlari qo'lda tanlangan bo'lsa faqat shu kunlar tanlanadi
    disabled: props.modelValue.workdays !== null && !props.modelValue.workdays.includes(d),
  })),
])
const weeklyDayValue = computed(() =>
  props.modelValue.weeklyReportDay === null ? 'auto' : String(props.modelValue.weeklyReportDay),
)
function setWeeklyDay(v: string) {
  set('weeklyReportDay', v === 'auto' ? null : Number(v))
}

const TIME_NOTIFY = {
  morningTime: 'morningSchedule',
  dailyReportTime: 'dailyReport',
  weeklyReportTime: 'weeklyReport',
} as const
const timeOff = (k: keyof typeof TIME_NOTIFY) =>
  !enabled(k) || !props.modelValue.notify[TIME_NOTIFY[k]]

const modeBtn = (active: boolean) =>
  active
    ? 'border-primary-600 bg-primary-50 text-primary-700'
    : 'border-border text-fg-muted hover:bg-surface-muted'
</script>

<template>
  <div class="divide-y divide-border" data-testid="telegram-fields">
    <SettingRow
      v-for="k in TELEGRAM_KEYS"
      :key="k"
      :label="t(`settingsTelegram.fields.${k}.label`)"
      :hint="t(`settingsTelegram.fields.${k}.hint`)"
      :flag="flagOf(k)"
      :global-text="globalText(k)"
      @toggle="emit('toggle-flag', k, $event)"
    >
      <div v-if="k === 'workdays'">
        <div
          role="radiogroup"
          :aria-label="t('settingsTelegram.fields.workdays.label')"
          class="flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="!manual"
            :disabled="!enabled(k)"
            class="rounded-lg border px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-60"
            :class="modeBtn(!manual)"
            data-testid="workdays-auto"
            @click="setWorkdayMode(false)"
          >
            {{ t('settingsTelegram.workdaysAuto') }}
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="manual"
            :disabled="!enabled(k)"
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60"
            :class="modeBtn(manual)"
            data-testid="workdays-manual"
            @click="setWorkdayMode(true)"
          >
            {{ t('settingsTelegram.workdaysManual') }}
          </button>
        </div>
        <div
          v-if="modelValue.workdays"
          class="mt-2 flex flex-wrap gap-1.5"
          role="group"
          :aria-label="t('settingsTelegram.fields.workdays.label')"
        >
          <button
            v-for="d in WEEKDAYS"
            :key="d"
            type="button"
            :aria-pressed="modelValue.workdays.includes(d)"
            :disabled="!enabled(k)"
            class="h-10 min-w-[2.75rem] rounded-lg border px-2 text-sm font-medium transition-colors disabled:opacity-60"
            :class="
              modelValue.workdays.includes(d)
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-border text-fg-muted hover:bg-surface-muted'
            "
            data-testid="workday"
            @click="set('workdays', toggleWorkday(modelValue.workdays, d))"
          >
            {{ t(`settingsAttendance.weekdays.${d}`) }}
          </button>
        </div>
        <p v-if="errors.workdays" class="mt-1 text-xs text-danger" role="alert">
          {{ errors.workdays }}
        </p>
      </div>

      <div v-else-if="k === 'notify'" class="space-y-3">
        <div v-for="n in NOTIFY_KEYS" :key="n">
          <BaseSwitch
            class="sm:justify-end"
            :model-value="modelValue.notify[n]"
            :disabled="!enabled(k)"
            :label="t(`settingsTelegram.notify.${n}.label`)"
            :data-testid="`notify-${n}`"
            @update:model-value="setNotify(n, $event)"
          />
          <p class="ml-14 mt-0.5 text-xs text-fg-muted">
            {{ t(`settingsTelegram.notify.${n}.hint`) }}
          </p>
        </div>
      </div>

      <BaseInput
        v-else-if="k === 'morningTime' || k === 'dailyReportTime' || k === 'weeklyReportTime'"
        :model-value="modelValue[k]"
        type="time"
        :disabled="timeOff(k)"
        :aria-label="t(`settingsTelegram.fields.${k}.label`)"
        :error="errors[k]"
        :data-testid="`time-${k}`"
        @update:model-value="set(k, $event)"
      />

      <BaseSwitch
        v-else-if="k === 'dailyReportAbsentNames'"
        class="sm:justify-end"
        :model-value="modelValue.dailyReportAbsentNames"
        :disabled="!enabled(k)"
        :label="modelValue.dailyReportAbsentNames ? t('settings.yes') : t('settings.no')"
        data-testid="absent-names"
        @update:model-value="set('dailyReportAbsentNames', $event)"
      />

      <BaseSelect
        v-else
        :model-value="weeklyDayValue"
        :options="dayOptions"
        :disabled="!enabled(k)"
        :aria-label="t('settingsTelegram.fields.weeklyReportDay.label')"
        :error="errors.weeklyReportDay"
        data-testid="weekly-day"
        @update:model-value="setWeeklyDay"
      />
    </SettingRow>
  </div>
</template>
