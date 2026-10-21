<script setup lang="ts">
import { applyChanges } from '@/utils/scopeSettings'
import { useI18n } from 'vue-i18n'
import type { ScoringSettings } from '@/api/types'
import { DEFAULT_SCORING } from '@/utils/scoring'
import { SETTING_KEYS, validateScoringSettings, type SettingKey } from '@/utils/settingsForm'
import { formatSetting } from '@/utils/settingsFormat'
import ScoringFields from './ScoringFields.vue'
import SettingsScopeEditor from './SettingsScopeEditor.vue'

const { t } = useI18n()
</script>

<template>
  <SettingsScopeEditor
    kind="scoring"
    :keys="SETTING_KEYS"
    :defaults="DEFAULT_SCORING"
    :validate="(v: ScoringSettings) => validateScoringSettings(v, t)"
    :format="(k: SettingKey, v: ScoringSettings) => formatSetting(t, k, v[k])"
  >
    <template #fields="{ values, errors, flags, globalValues, set, toggleFlag }">
      <ScoringFields
        :model-value="values"
        :errors="errors"
        :flags="flags"
        :global-values="globalValues"
        @update:model-value="applyChanges(values, $event, SETTING_KEYS, set)"
        @toggle-flag="toggleFlag"
      />
    </template>
  </SettingsScopeEditor>
</template>
