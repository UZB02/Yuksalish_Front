<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import type { Subject, Teacher } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'

/** Sinf uchun "fan -> o'qituvchi" qatorlari. Bo'sh qator (fan yoki o'qituvchi tanlanmagan) saqlanmaydi. */
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
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AssignmentRow[]] }>()
const { t } = useI18n()

const teacherOptions = computed(() =>
  props.teachers.map((tc) => ({ value: tc.id, label: tc.fullName })),
)
/** Boshqa qatorlarda tanlangan fan qayta tanlanmaydi (bir fan - bir o'qituvchi). */
function subjectOptions(index: number) {
  const taken = new Set(props.modelValue.filter((_, i) => i !== index).map((r) => r.subjectId))
  const current = props.modelValue[index]?.subjectId
  return props.subjects
    .filter((s) => (s.isActive || s.id === current) && !taken.has(s.id))
    .map((s) => ({
      value: s.id,
      label: s.isActive ? s.name : `${s.name} (${t('common.inactive')})`,
    }))
}

const canAdd = computed(() => props.modelValue.length < props.subjects.length)

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
    <legend class="mb-1 text-sm font-medium text-fg">{{ t('classes.subjectsSection') }}</legend>
    <p class="text-xs text-fg-muted">{{ t('classes.subjectsHint') }}</p>
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
        :options="teacherOptions"
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

    <BaseButton variant="secondary" size="sm" :disabled="!canAdd" @click="add">
      <Plus class="h-4 w-4" /> {{ t('classes.addSubject') }}
    </BaseButton>
  </fieldset>
</template>
