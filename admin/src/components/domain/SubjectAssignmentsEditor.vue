<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import type { Subject, Teacher } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { hasDuplicatePair } from '@/utils/classSubjects'

/**
 * Sinf uchun "fan -> o'qituvchi" qatorlari. Bo'sh qator (fan yoki o'qituvchi tanlanmagan) saqlanmaydi.
 * Bir fanga bir nechta o'qituvchi biriktirish mumkin (har bir juftlik alohida kurs):
 * faqat aynan bir xil (fan, o'qituvchi) juftligi takrorlanmaydi.
 */
export interface AssignmentRow {
  subjectId: string
  teacherId: string
}

const props = defineProps<{
  modelValue: AssignmentRow[]
  subjects: Subject[]
  teachers: Teacher[]
  /** Fan/o'qituvchilar ro'yxati yuklanmadi */
  failed?: boolean
  showErrors?: boolean
  /** Sarlavha va izohni ota komponent o'zi ko'rsatsa (bo'lim kartasi ichida) */
  hideHeader?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AssignmentRow[]] }>()
const { t } = useI18n()

/** Fan har doim tanlanadi (boshqa o'qituvchi uchun ham): faqat nofaol fan yangi qatorga taklif qilinmaydi */
function subjectOptions(index: number) {
  const current = props.modelValue[index]?.subjectId
  return props.subjects
    .filter((s) => s.isActive || s.id === current)
    .map((s) => ({
      value: s.id,
      label: s.isActive ? s.name : `${s.name} (${t('common.inactive')})`,
    }))
}
/** Shu fan boshqa qatorlarda allaqachon biriktirilgan o'qituvchilar qayta tanlanmaydi (aynan takror juftlik) */
function teacherOptions(index: number) {
  const row = props.modelValue[index]
  const taken = new Set(
    row?.subjectId
      ? props.modelValue
          .filter((r, i) => i !== index && r.subjectId === row.subjectId)
          .map((r) => r.teacherId)
      : [],
  )
  return props.teachers
    .filter((tc) => !taken.has(tc.id) || tc.id === row?.teacherId)
    .map((tc) => ({ value: tc.id, label: tc.fullName }))
}

/** Backend chegarasi: sinfga ko'pi bilan 40 ta biriktirish */
const MAX_ROWS = 40
const canAdd = computed(() => props.modelValue.length < MAX_ROWS)
const duplicate = computed(() => hasDuplicatePair(props.modelValue))

function setRow(index: number, change: Partial<AssignmentRow>) {
  emit(
    'update:modelValue',
    props.modelValue.map((r, i) => (i === index ? { ...r, ...change } : r)),
  )
}
const add = () => emit('update:modelValue', [...props.modelValue, { subjectId: '', teacherId: '' }])
const remove = (index: number) =>
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
const incomplete = (r: AssignmentRow) => !r.subjectId || !r.teacherId
</script>

<template>
  <fieldset class="space-y-2" data-testid="subject-assignments">
    <legend :class="hideHeader ? 'sr-only' : 'mb-1 text-sm font-medium text-fg'">
      {{ t('classes.subjectsSection') }}
    </legend>
    <p v-if="!hideHeader" class="text-xs text-fg-muted">{{ t('classes.subjectsHint') }}</p>
    <p v-if="failed" class="text-xs text-danger" role="alert">{{ t('classes.subjectsFailed') }}</p>

    <p v-if="modelValue.length === 0" class="py-2 text-sm text-fg-muted">
      {{ t('classes.noSubjects') }}
    </p>
    <div
      v-for="(row, i) in modelValue"
      :key="i"
      class="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      data-testid="assignment-row"
    >
      <BaseSelect
        :model-value="row.subjectId"
        :aria-label="t('classes.subject')"
        :placeholder="t('classes.pickSubject')"
        :options="subjectOptions(i)"
        :error="showErrors && incomplete(row) && !row.subjectId ? t('validation.required') : ''"
        @update:model-value="setRow(i, { subjectId: $event })"
      />
      <BaseSelect
        :model-value="row.teacherId"
        :aria-label="t('classes.subjectTeacher')"
        :placeholder="t('classes.pickTeacher')"
        :options="teacherOptions(i)"
        :error="showErrors && incomplete(row) && !row.teacherId ? t('validation.required') : ''"
        @update:model-value="setRow(i, { teacherId: $event })"
      />
      <BaseButton
        variant="ghost"
        size="sm"
        class="justify-self-end"
        :aria-label="t('classes.removeSubject')"
        :title="t('classes.removeSubject')"
        @click="remove(i)"
      >
        <Trash2 class="h-4 w-4 text-danger" />
      </BaseButton>
    </div>

    <p v-if="duplicate" class="text-xs text-danger" role="alert" data-testid="assignment-duplicate">
      {{ t('classes.duplicatePair') }}
    </p>
    <BaseButton variant="secondary" size="sm" :disabled="!canAdd" @click="add">
      <Plus class="h-4 w-4" /> {{ t('classes.addSubject') }}
    </BaseButton>
  </fieldset>
</template>
