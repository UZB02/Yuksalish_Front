<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScoringSettings } from '@/api/types'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { SETTING_KEYS, type SettingErrors, type SettingKey } from '@/utils/settingsForm'
import { formatSetting } from '@/utils/settingsFormat'
import SettingRow from './SettingRow.vue'

const props = defineProps<{
  modelValue: ScoringSettings
  errors: SettingErrors
  /** Maktab rejimi: har bir maydon uchun "alohida sozlash" belgisi */
  flags?: Record<SettingKey, boolean>
  globalValues?: ScoringSettings
}>()
const emit = defineEmits<{
  'update:modelValue': [value: ScoringSettings]
  'toggle-flag': [key: SettingKey, on: boolean]
}>()
const { t } = useI18n()

const enabled = (k: SettingKey) => !props.flags || props.flags[k]

function set<K extends SettingKey>(key: K, value: ScoringSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const num = (raw: string): number => (raw.trim() === '' ? NaN : Number(raw))

const aggregationOptions = computed(() =>
  (['average', 'min', 'last'] as const).map((v) => ({
    value: v,
    label: t(`settings.aggregation.${v}`),
  })),
)
const globalText = (k: SettingKey) =>
  props.globalValues ? formatSetting(t, k, props.globalValues[k]) : ''
</script>

<template>
  <div class="divide-y divide-border">
    <SettingRow
      v-for="k in SETTING_KEYS"
      :key="k"
      :label="t(`settings.fields.${k}.label`)"
      :hint="t(`settings.fields.${k}.hint`)"
      :flag="flags ? flags[k] : undefined"
      :global-text="globalText(k)"
      @toggle="emit('toggle-flag', k, $event)"
    >
      <BaseInput
        v-if="
          k === 'minScore' || k === 'maxScore' || k === 'editWindowHours' || k === 'backdateDays'
        "
        :model-value="Number.isNaN(modelValue[k]) ? '' : modelValue[k]"
        type="number"
        inputmode="numeric"
        min="0"
        :disabled="!enabled(k)"
        :aria-label="t(`settings.fields.${k}.label`)"
        :error="errors[k]"
        @update:model-value="set(k, num($event))"
      />
      <BaseSwitch
        v-else-if="k === 'requireBehaviorType'"
        :model-value="modelValue.requireBehaviorType"
        :disabled="!enabled(k)"
        :label="modelValue.requireBehaviorType ? t('settings.yes') : t('settings.no')"
        @update:model-value="set('requireBehaviorType', $event)"
      />
      <div v-else-if="k === 'commentRequiredBelow'" class="space-y-2">
        <BaseSwitch
          :model-value="modelValue.commentRequiredBelow !== null"
          :disabled="!enabled(k)"
          :label="t('settings.thresholdEnabled')"
          @update:model-value="
            set(
              'commentRequiredBelow',
              $event ? Math.min(modelValue.maxScore, Math.max(modelValue.minScore + 1, 60)) : null,
            )
          "
        />
        <BaseInput
          v-if="modelValue.commentRequiredBelow !== null"
          :model-value="
            Number.isNaN(modelValue.commentRequiredBelow) ? '' : modelValue.commentRequiredBelow
          "
          type="number"
          inputmode="numeric"
          :disabled="!enabled(k)"
          :aria-label="t('settings.fields.commentRequiredBelow.label')"
          :error="errors.commentRequiredBelow"
          @update:model-value="set('commentRequiredBelow', num($event))"
        />
      </div>
      <BaseSelect
        v-else
        :model-value="modelValue.dailyAggregation"
        :options="aggregationOptions"
        :disabled="!enabled(k)"
        :aria-label="t('settings.fields.dailyAggregation.label')"
        :error="errors.dailyAggregation"
        @update:model-value="set('dailyAggregation', $event as ScoringSettings['dailyAggregation'])"
      />
    </SettingRow>
  </div>
</template>
