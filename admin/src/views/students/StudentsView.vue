<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useSchoolContextStore } from '@/stores/school-context'
import StudentsPanel from './StudentsPanel.vue'

const { t } = useI18n()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())
</script>

<template>
  <PageHeader :title="t('students.title')" :description="t('students.description')" />
  <NeedsSchool v-if="needsSchool" />
  <!-- Maktab o'zgarganda panel qayta yaratiladi (filtrlar va ro'yxat yangilanadi) -->
  <StudentsPanel v-else :key="schoolId ?? 'own'" />
</template>
