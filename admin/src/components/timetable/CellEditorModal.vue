<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleX, Plus, Trash2, TriangleAlert } from 'lucide-vue-next'
import type { BusyTeacher, TimetableOptions } from '@/api/timetable.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import {
  defaultTeacherFor,
  pairOptions,
  subjectOptions,
  teacherOptions,
  type CellValue,
} from '@/utils/timetable'
import {
  buildIssues,
  busyClassesOf,
  issueContextFrom,
  previewCellWarnings,
  type TimetableIssue,
} from '@/utils/timetableIssues'

/**
 * Katakni tahrirlash. Katakda bir yoki bir nechta dars bo'lishi mumkin (parallel o'qituvchilar:
 * "Ingliz tili · Aliyeva" va "Ingliz tili · G'aniyeva" bir soatda). Har bir dars — fan (sinfga
 * biriktirilganlar birinchi), o'qituvchi (fandan kelib chiqib sukut bo'yicha ClassSubject'dagi) va xona.
 * Sinfga biriktirilgan har bir (fan, o'qituvchi) juftligi alohida variant sifatida taklif qilinadi.
 */
const props = defineProps<{
  open: boolean
  weekday: number
  lessonNo: number
  /** Katakdagi hozirgi darslar */
  value?: CellValue[]
  options: TimetableOptions
  /** Saqlangan holat bo'yicha shu katakning muammolari (tanlov o'zgarmaguncha ko'rsatiladi) */
  issues?: TimetableIssue[]
  /** Shu vaqtda boshqa sinflarda band o'qituvchilar */
  busy?: BusyTeacher[]
}>()
const emit = defineEmits<{ close: []; save: [value: CellValue[]]; clear: [] }>()
const { t } = useI18n()

interface Line {
  subjectId: string
  teacherId: string
  room: string
  teacherTouched: boolean
}
const blank = (): Line => ({ subjectId: '', teacherId: '', room: '', teacherTouched: false })
const lines = ref<Line[]>([blank()])

watch(
  () => [props.open, props.weekday, props.lessonNo] as const,
  ([open]) => {
    if (!open) return
    const saved = props.value ?? []
    lines.value = saved.length
      ? saved.map((v) => ({
          subjectId: v.subjectId,
          teacherId: v.teacherId,
          room: v.room ?? '',
          teacherTouched: true,
        }))
      : [blank()]
  },
  { immediate: true },
)

const extraSubject = computed(() =>
  (props.value ?? []).map((v) => ({ id: v.subjectId, name: v.subjectName ?? '?' })),
)
const extraTeacher = computed(() =>
  (props.value ?? []).map((v) => ({ id: v.teacherId, fullName: v.teacherName ?? '?' })),
)
const subjectItems = computed(() =>
  subjectOptions(props.options, extraSubject.value).map((s) => ({ value: s.id, label: s.label })),
)
const subjectGroupsHint = computed(() => props.options.classAssignments.length > 0)
const pairItems = computed(() =>
  pairOptions(props.options).map((p) => ({ value: p.key, label: p.label })),
)

function teacherItemsFor(line: Line) {
  return teacherOptions(props.options, line.subjectId, extraTeacher.value).flatMap((g) =>
    g.items.map((i) => {
      const busyIn = busyClassesOf(props.busy ?? [], i.id)
      return {
        value: i.id,
        name: i.label,
        label: [
          i.label,
          g.key === 'assigned' ? t('timetable.assignedTeacher') : '',
          busyIn.length ? `${t('timetable.issues.busy')} · ${busyIn.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }
    }),
  )
}

function onSubject(i: number, v: string) {
  const line = lines.value[i]
  if (!line) return
  line.subjectId = v
  // O'qituvchi qo'lda tanlanmagan bo'lsa, sinfga biriktirilgani avtomatik qo'yiladi
  if (!line.teacherTouched) line.teacherId = defaultTeacherFor(props.options, v) ?? ''
}
function onTeacher(i: number, v: string) {
  const line = lines.value[i]
  if (!line) return
  line.teacherId = v
  line.teacherTouched = true
}

/** Biriktirilgan juftlikdan dars qo'shish ("Ingliz tili · Aliyeva"); bo'sh oxirgi qator to'ldiriladi */
function addPair(key: string) {
  const [subjectId, teacherId] = key.split(':') as [string, string]
  if (!subjectId || !teacherId) return
  if (lines.value.some((l) => l.teacherId === teacherId)) return
  const last = lines.value[lines.value.length - 1]
  const fill = { subjectId, teacherId, teacherTouched: true }
  if (last && !last.subjectId && !last.teacherId) Object.assign(last, fill)
  else lines.value.push({ ...blank(), ...fill })
}
const addLine = () => lines.value.push(blank())
const removeLine = (i: number) => {
  lines.value.splice(i, 1)
  if (!lines.value.length) lines.value.push(blank())
}

/** Bir o'qituvchi bir katakda ikki marta bo'lmaydi */
const duplicateTeacher = computed(() => {
  const seen = new Set<string>()
  for (const l of lines.value) {
    if (!l.teacherId) continue
    if (seen.has(l.teacherId)) return true
    seen.add(l.teacherId)
  }
  return false
})
const canSave = computed(
  () => lines.value.every((l) => !!l.subjectId && !!l.teacherId) && !duplicateTeacher.value,
)
function save() {
  if (!canSave.value) return
  emit(
    'save',
    lines.value.map((l) => ({
      subjectId: l.subjectId,
      teacherId: l.teacherId,
      room: l.room.trim() || null,
      subjectName: subjectItems.value.find((i) => i.value === l.subjectId)?.label,
      teacherName: teacherItemsFor(l).find((i) => i.value === l.teacherId)?.name,
    })),
  )
}
const ctx = computed(() =>
  issueContextFrom(props.options, props.value ? { cell: props.value } : {}),
)
/** Jonli ko'rinish: dars o'zgarmagan bo'lsa serverdagi muammolar, aks holda mijozda hisoblangan */
const liveIssues = computed<TimetableIssue[]>(() => {
  const out = new Map<string, TimetableIssue>()
  for (const l of lines.value) {
    const unchanged = (props.value ?? []).some(
      (v) => v.subjectId === l.subjectId && v.teacherId === l.teacherId,
    )
    const list = unchanged
      ? (props.issues ?? []).filter((i) => !i.teacherId || i.teacherId === l.teacherId)
      : buildIssues(
          previewCellWarnings({
            weekday: props.weekday,
            lessonNo: props.lessonNo,
            subjectId: l.subjectId,
            teacherId: l.teacherId,
            options: props.options,
            busy: props.busy ?? [],
          }),
          t,
          ctx.value,
        )
    for (const i of list) out.set(i.key, i)
  }
  return [...out.values()]
})
const title = computed(() =>
  t('timetable.cellTitle', { day: t(`journal.weekdayLong.${props.weekday}`), no: props.lessonNo }),
)
const tid = (base: string, i: number) => (i === 0 ? base : `${base}-${i}`)
</script>

<template>
  <BaseModal :open="open" :title="title" size="md" @close="emit('close')">
    <form class="space-y-4" data-testid="cell-editor" @submit.prevent="save">
      <ul v-if="liveIssues.length" class="space-y-2" aria-live="polite" data-testid="cell-issues">
        <li
          v-for="i in liveIssues"
          :key="i.key"
          class="flex items-start gap-2 rounded-lg px-3 py-2"
          :class="i.severity === 'error' ? 'bg-danger-soft' : 'bg-warning-soft'"
          :data-severity="i.severity"
        >
          <CircleX
            v-if="i.severity === 'error'"
            class="mt-0.5 h-4 w-4 shrink-0 text-danger"
            aria-hidden="true"
          />
          <TriangleAlert v-else class="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div class="min-w-0 text-sm">
            <p
              class="font-semibold"
              :class="i.severity === 'error' ? 'text-danger' : 'text-warning'"
            >
              <span class="sr-only">{{ t(`timetable.issues.severity.${i.severity}`) }}: </span
              >{{ i.title }}
            </p>
            <p class="text-fg">{{ i.text }}</p>
          </div>
        </li>
      </ul>

      <BaseSelect
        v-if="pairItems.length"
        :model-value="''"
        :options="pairItems"
        :label="t('timetable.pairPick')"
        :placeholder="t('timetable.pairPickPlaceholder')"
        searchable
        data-testid="cell-pair"
        @update:model-value="addPair"
      />

      <fieldset
        v-for="(line, i) in lines"
        :key="i"
        class="space-y-3 rounded-xl border border-border p-3"
        :data-testid="`cell-line-${i}`"
      >
        <legend v-if="lines.length > 1" class="px-1 text-xs font-medium text-fg-muted">
          {{ t('timetable.lineN', { n: i + 1 }) }}
        </legend>
        <BaseSelect
          :model-value="line.subjectId"
          :options="subjectItems"
          :label="t('timetable.subject')"
          :placeholder="t('timetable.chooseSubject')"
          searchable
          required
          :data-testid="tid('cell-subject', i)"
          @update:model-value="onSubject(i, $event)"
        />
        <p v-if="i === 0 && subjectGroupsHint" class="-mt-2 text-xs text-fg-muted">
          {{ t('timetable.subjectHint') }}
        </p>
        <BaseSelect
          :model-value="line.teacherId"
          :options="teacherItemsFor(line)"
          :label="t('timetable.teacher')"
          :placeholder="t('timetable.chooseTeacher')"
          searchable
          required
          :data-testid="tid('cell-teacher', i)"
          @update:model-value="onTeacher(i, $event)"
        />
        <div class="flex items-end gap-2">
          <BaseInput
            v-model="line.room"
            class="flex-1"
            :label="t('timetable.room')"
            maxlength="30"
          />
          <BaseButton
            v-if="lines.length > 1"
            type="button"
            variant="ghost"
            size="sm"
            :aria-label="t('timetable.removeLine')"
            :title="t('timetable.removeLine')"
            :data-testid="`cell-remove-line-${i}`"
            @click="removeLine(i)"
          >
            <Trash2 class="h-4 w-4 text-danger" />
          </BaseButton>
        </div>
      </fieldset>

      <p v-if="duplicateTeacher" class="text-sm text-danger" role="alert" data-testid="cell-dup">
        {{ t('timetable.duplicateTeacher') }}
      </p>
      <BaseButton
        type="button"
        variant="secondary"
        size="sm"
        data-testid="cell-add-line"
        @click="addLine"
      >
        <Plus class="h-4 w-4" /> {{ t('timetable.addParallel') }}
      </BaseButton>
    </form>
    <template #footer>
      <BaseButton v-if="value?.length" variant="ghost" class="sm:mr-auto" @click="emit('clear')">
        {{ t('timetable.clearCell') }}
      </BaseButton>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :disabled="!canSave" data-testid="cell-save" @click="save">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
