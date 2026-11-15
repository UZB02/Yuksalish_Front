<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExamsSettings } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useFeaturesStore } from '@/stores/features'
import {
  DEFAULT_EXAMS_FORM,
  EXAMS_KEYS,
  EXAMS_OWN_KEYS,
  validateExamsSettings,
  type ExamsKey,
} from '@/utils/examsSettings'
import { applyChanges } from '@/utils/scopeSettings'
import { formatSetting } from '@/utils/settingsFormat'
import ExamsFields from './ExamsFields.vue'
import SettingsScopeEditor from './SettingsScopeEditor.vue'

const { t } = useI18n()
const auth = useAuthStore()
const features = useFeaturesStore()
// Superadmin: global + maktab (enabled ham); maktab admini (exams.manage): faqat o'z maktabi, enabled dan tashqari
const ownSchool = computed(() => !auth.isSuperadmin)
const keys = computed<readonly ExamsKey[]>(() => (ownSchool.value ? EXAMS_OWN_KEYS : EXAMS_KEYS))
</script>

<template>
  <SettingsScopeEditor
    kind="exams"
    :keys="keys"
    :defaults="DEFAULT_EXAMS_FORM"
    :own-school="ownSchool"
    :global-only-keys="ownSchool ? ['enabled'] : []"
    label-prefix="settingsExams.fields"
    :validate="(v: ExamsSettings) => validateExamsSettings(v, t)"
    :format="(k: ExamsKey, v: ExamsSettings) => formatSetting(t, k, v[k])"
    @saved="features.refresh()"
  >
    <template #fields="{ values, errors, flags, globalValues, set, toggleFlag }">
      <ExamsFields
        :model-value="values"
        :errors="errors"
        :flags="flags"
        :global-values="globalValues"
        :own-school="ownSchool"
        @update:model-value="applyChanges(values, $event, keys, set)"
        @toggle-flag="toggleFlag"
      />
    </template>
  </SettingsScopeEditor>
</template>
