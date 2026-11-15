<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExamsSettings } from '@/api/types'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import {
  EXAMS_KEYS,
  EXAMS_OWN_KEYS,
  RETENTION_MAX,
  RETENTION_MIN,
  type ExamsFormErrors,
  type ExamsKey,
} from '@/utils/examsSettings'
import { formatSetting } from '@/utils/settingsFormat'
import SettingRow from './SettingRow.vue'

const props = defineProps<{
  modelValue: ExamsSettings
  errors: ExamsFormErrors
  flags?: Record<ExamsKey, boolean>
  globalValues?: ExamsSettings
  /** Maktab admini rejimi: "Imtihon moduli yoqilgan" maydoni ko'rsatilmaydi (faqat superadmin) */
  ownSchool?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: ExamsSettings]
  'toggle-flag': [key: ExamsKey, on: boolean]
}>()
const { t } = useI18n()

const rows = computed<readonly ExamsKey[]>(() => (props.ownSchool ? EXAMS_OWN_KEYS : EXAMS_KEYS))
const enabled = (k: ExamsKey) => !props.flags || props.flags[k]
const flagOf = (k: ExamsKey) => (props.flags ? props.flags[k] : undefined)
const globalText = (k: ExamsKey) =>
  props.globalValues ? formatSetting(t, k, props.globalValues[k]) : ''

function set<K extends ExamsKey>(key: K, value: ExamsSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const num = (raw: string): number => (raw.trim() === '' ? NaN : Number(raw))
</script>

<template>
  <div class="divide-y divide-border">
    <p
      v-if="ownSchool && !modelValue.enabled"
      class="py-3.5 text-sm text-fg-muted"
      data-testid="exams-disabled-note"
    >
      {{ t('settingsExams.disabledNote') }}
    </p>
    <SettingRow
      v-for="k in rows"
      :key="k"
      :label="t(`settingsExams.fields.${k}.label`)"
      :hint="t(`settingsExams.fields.${k}.hint`)"
      :flag="flagOf(k)"
      :global-text="globalText(k)"
      @toggle="emit('toggle-flag', k, $event)"
    >
      <BaseInput
        v-if="k === 'candidateRetentionDays'"
        :model-value="
          Number.isNaN(modelValue.candidateRetentionDays) ? '' : modelValue.candidateRetentionDays
        "
        type="number"
        inputmode="numeric"
        :min="RETENTION_MIN"
        :max="RETENTION_MAX"
        :disabled="!enabled(k)"
        :aria-label="t('settingsExams.fields.candidateRetentionDays.label')"
        :error="errors.candidateRetentionDays"
        data-testid="retention-input"
        @update:model-value="set('candidateRetentionDays', num($event))"
      />
      <BaseSwitch
        v-else
        class="sm:justify-end"
        :model-value="modelValue[k]"
        :disabled="!enabled(k)"
        :label="modelValue[k] ? t('settings.yes') : t('settings.no')"
        :data-testid="`exams-switch-${k}`"
        @update:model-value="set(k, $event)"
      />
    </SettingRow>
  </div>
</template>
