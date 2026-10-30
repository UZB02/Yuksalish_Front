<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TimetableOptions, TimetableWarning } from '@/api/timetable.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import {
  defaultTeacherFor,
  subjectOptions,
  teacherOptions,
  type CellValue,
} from '@/utils/timetable'

/**
 * Katakni tahrirlash: fan (sinfga biriktirilganlar birinchi), o'qituvchi (fandan kelib chiqib
 * sukut bo'yicha ClassSubject'dagi), xona. Pastki ekranda pastdan ochiladigan oyna (BaseModal).
 */
const props = defineProps<{
  open: boolean
  weekday: number
  lessonNo: number
  value?: CellValue
  options: TimetableOptions
  warnings?: TimetableWarning[]
}>()
const emit = defineEmits<{ close: []; save: [value: CellValue]; clear: [] }>()
const { t } = useI18n()

const subjectId = ref('')
const teacherId = ref('')
const room = ref('')
const teacherTouched = ref(false)

watch(
  () => [props.open, props.weekday, props.lessonNo] as const,
  ([open]) => {
    if (!open) return
    subjectId.value = props.value?.subjectId ?? ''
    teacherId.value = props.value?.teacherId ?? ''
    room.value = props.value?.room ?? ''
    teacherTouched.value = !!props.value
  },
  { immediate: true },
)

const extraSubject = computed(() =>
  props.value ? [{ id: props.value.subjectId, name: props.value.subjectName ?? '?' }] : [],
)
const extraTeacher = computed(() =>
  props.value ? [{ id: props.value.teacherId, fullName: props.value.teacherName ?? '?' }] : [],
)
const subjectItems = computed(() =>
  subjectOptions(props.options, extraSubject.value).map((s) => ({ value: s.id, label: s.label })),
)
const subjectGroupsHint = computed(() => props.options.classAssignments.length > 0)
const teacherGroups = computed(() =>
  teacherOptions(props.options, subjectId.value, extraTeacher.value),
)
const teacherItems = computed(() =>
  teacherGroups.value.flatMap((g) =>
    g.items.map((i) => ({
      value: i.id,
      label: g.key === 'assigned' ? `${i.label} · ${t('timetable.assignedTeacher')}` : i.label,
    })),
  ),
)

function onSubject(v: string) {
  subjectId.value = v
  // O'qituvchi qo'lda tanlanmagan bo'lsa, sinfga biriktirilgani avtomatik qo'yiladi
  if (!teacherTouched.value) teacherId.value = defaultTeacherFor(props.options, v) ?? ''
}
function onTeacher(v: string) {
  teacherId.value = v
  teacherTouched.value = true
}

const canSave = computed(() => !!subjectId.value && !!teacherId.value)
function save() {
  if (!canSave.value) return
  const s = subjectItems.value.find((i) => i.value === subjectId.value)
  const tt = teacherItems.value.find((i) => i.value === teacherId.value)
  emit('save', {
    subjectId: subjectId.value,
    teacherId: teacherId.value,
    room: room.value.trim() || null,
    subjectName: s?.label,
    teacherName: tt?.label.replace(` · ${t('timetable.assignedTeacher')}`, ''),
  })
}
const title = computed(() =>
  t('timetable.cellTitle', { day: t(`journal.weekdayLong.${props.weekday}`), no: props.lessonNo }),
)
</script>

<template>
  <BaseModal :open="open" :title="title" size="md" @close="emit('close')">
    <form class="space-y-4" data-testid="cell-editor" @submit.prevent="save">
      <ul
        v-if="warnings?.length"
        class="space-y-1 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning"
      >
        <li v-for="(w, i) in warnings" :key="i">{{ w.message }}</li>
      </ul>
      <BaseSelect
        :model-value="subjectId"
        :options="subjectItems"
        :label="t('timetable.subject')"
        :placeholder="t('timetable.chooseSubject')"
        searchable
        required
        data-testid="cell-subject"
        @update:model-value="onSubject"
      />
      <p v-if="subjectGroupsHint" class="-mt-2 text-xs text-fg-muted">
        {{ t('timetable.subjectHint') }}
      </p>
      <BaseSelect
        :model-value="teacherId"
        :options="teacherItems"
        :label="t('timetable.teacher')"
        :placeholder="t('timetable.chooseTeacher')"
        searchable
        required
        data-testid="cell-teacher"
        @update:model-value="onTeacher"
      />
      <BaseInput v-model="room" :label="t('timetable.room')" maxlength="30" />
    </form>
    <template #footer>
      <BaseButton v-if="value" variant="ghost" class="sm:mr-auto" @click="emit('clear')">
        {{ t('timetable.clearCell') }}
      </BaseButton>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :disabled="!canSave" data-testid="cell-save" @click="save">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
