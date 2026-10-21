<script setup lang="ts">
import { applyChanges } from '@/utils/scopeSettings'
import { useI18n } from 'vue-i18n'
import type { RatingSettings } from '@/api/types'
import RatingPeriodInfo from '@/components/settings/RatingPeriodInfo.vue'
import { useSchoolContextStore } from '@/stores/school-context'
import { DEFAULT_RATING, RATING_KEYS, validateRating, type RatingKey } from '@/utils/ratingForm'
import { formatSetting } from '@/utils/settingsFormat'
import RatingFields from './RatingFields.vue'
import SettingsScopeEditor from './SettingsScopeEditor.vue'

const { t } = useI18n()
const schoolCtx = useSchoolContextStore()
</script>

<template>
  <SettingsScopeEditor
    kind="rating"
    :keys="RATING_KEYS"
    :defaults="DEFAULT_RATING"
    :validate="(v: RatingSettings) => validateRating(v, t)"
    :format="(k: RatingKey, v: RatingSettings) => formatSetting(t, k, v[k])"
  >
    <template #fields="{ values, errors, flags, globalValues, set, toggleFlag }">
      <RatingFields
        :model-value="values"
        :errors="errors"
        :flags="flags"
        :global-values="globalValues"
        @update:model-value="applyChanges(values, $event, RATING_KEYS, set)"
        @toggle-flag="toggleFlag"
      />
    </template>
    <template #global-extra>
      <RatingPeriodInfo :school-id="schoolCtx.schoolId ?? undefined" />
    </template>
    <template #school-extra="{ schoolId }">
      <RatingPeriodInfo :school-id="schoolId" />
    </template>
  </SettingsScopeEditor>
</template>
