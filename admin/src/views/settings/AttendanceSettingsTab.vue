<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AttendanceSettings } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { applyChanges } from '@/utils/scopeSettings'
import {
  ATTENDANCE_KEYS,
  DEFAULT_ATTENDANCE_FORM,
  ratingImpactBeingEnabled,
  validateAttendanceSettings,
  type AttendanceKey,
} from '@/utils/attendanceForm'
import { formatSetting } from '@/utils/settingsFormat'
import AttendanceFields from './AttendanceFields.vue'
import SettingsScopeEditor from './SettingsScopeEditor.vue'

const { t } = useI18n()
const auth = useAuthStore()
// Maktab admini (attendance.settings) faqat o'z maktabi uchun; superadmin - global + maktab bo'yicha
const ownSchool = computed(() => !auth.isSuperadmin)

const warnings = (before: AttendanceSettings, after: AttendanceSettings) =>
  ratingImpactBeingEnabled(before, after) ? [t('settingsAttendance.confirmImpact')] : []
</script>

<template>
  <SettingsScopeEditor
    kind="attendance"
    :keys="ATTENDANCE_KEYS"
    :defaults="DEFAULT_ATTENDANCE_FORM"
    :own-school="ownSchool"
    label-prefix="settingsAttendance.fields"
    :validate="(v: AttendanceSettings) => validateAttendanceSettings(v, t)"
    :format="(k: AttendanceKey, v: AttendanceSettings) => formatSetting(t, k, v[k])"
    :warnings="warnings"
  >
    <template #fields="{ values, errors, flags, globalValues, set, toggleFlag }">
      <AttendanceFields
        :model-value="values"
        :errors="errors"
        :flags="flags"
        :global-values="globalValues"
        @update:model-value="applyChanges(values, $event, ATTENDANCE_KEYS, set)"
        @toggle-flag="toggleFlag"
      />
    </template>
  </SettingsScopeEditor>
</template>
