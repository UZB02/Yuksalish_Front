<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TimetableAttendanceSettings } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { applyChanges } from '@/utils/scopeSettings'
import {
  DEFAULT_TIMETABLE_FORM,
  TIMETABLE_KEYS,
  validateTimetableSettings,
  type TimetableKey,
} from '@/utils/timetableForm'
import { formatSetting } from '@/utils/settingsFormat'
import SettingsScopeEditor from './SettingsScopeEditor.vue'
import TimetableFields from './TimetableFields.vue'

const { t } = useI18n()
const auth = useAuthStore()
// Davomat sozlamalari bilan bir xil ruxsat: maktab admini faqat o'z maktabi, superadmin - global + maktab
const ownSchool = computed(() => !auth.isSuperadmin)
</script>

<template>
  <SettingsScopeEditor
    kind="timetable"
    :keys="TIMETABLE_KEYS"
    :defaults="DEFAULT_TIMETABLE_FORM"
    :own-school="ownSchool"
    label-prefix="settingsTimetable.fields"
    :validate="(v: TimetableAttendanceSettings) => validateTimetableSettings(v, t)"
    :format="(k: TimetableKey, v: TimetableAttendanceSettings) => formatSetting(t, k, v[k])"
  >
    <template #fields="{ values, errors, flags, globalValues, set, toggleFlag }">
      <TimetableFields
        :model-value="values"
        :errors="errors"
        :flags="flags"
        :global-values="globalValues"
        @update:model-value="applyChanges(values, $event, TIMETABLE_KEYS, set)"
        @toggle-flag="toggleFlag"
      />
    </template>
  </SettingsScopeEditor>
</template>
