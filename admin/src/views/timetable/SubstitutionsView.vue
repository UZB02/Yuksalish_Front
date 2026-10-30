<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CalendarOff, ChevronLeft, ChevronRight, Plus, Undo2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  timetableApi,
  type DayLessonDto,
  type OverrideDto,
  type TimetableOptions,
} from '@/api/timetable.api'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import OverrideModal, {
  type OverrideLesson,
  type OverrideMode,
} from '@/components/timetable/OverrideModal.vue'
import OverrideTypeBadge from '@/components/timetable/OverrideTypeBadge.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'
import { addDaysIso } from '@/utils/timetable'

/** Almashtirishlar: o'qituvchi yo'q kuni o'rinbosar, bekor, ko'chirish, fan almashtirish, qo'shimcha dars */
const { t } = useI18n()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()
const toast = useToast()
const { confirm } = useConfirm()

function todayIso() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const date = ref(todayIso())
const weekday = computed(() => {
  const [y, m, d] = date.value.split('-').map(Number)
  if (!y || !m || !d) return 0
  return new Date(y, m - 1, d).getDay() || 7
})

const teachers = ref<TimetableOptions['teachers']>([])
const teacherId = ref('')
const teacherOptions = computed(() =>
  teachers.value.map((x) => ({ value: x.id, label: x.fullName })),
)

const lessons = ref<DayLessonDto[]>([])
const isWorkday = ref(true)
const lessonsLoading = ref(false)
const lessonsError = ref('')

const overrides = ref<OverrideDto[]>([])
const overridesLoading = ref(true)
const overridesError = ref('')

const modal = ref<{ mode: OverrideMode; lesson: OverrideLesson | null } | null>(null)
let seq = 0

const sortedOverrides = computed(() =>
  [...overrides.value].sort(
    (a, b) =>
      a.class.name.localeCompare(b.class.name, 'uz', { numeric: true }) || a.lessonNo - b.lessonNo,
  ),
)

async function loadTeachers() {
  try {
    teachers.value = (await timetableApi.options()).teachers
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function loadOverrides() {
  overridesLoading.value = true
  overridesError.value = ''
  const my = seq
  try {
    const res = await timetableApi.overrides(date.value)
    if (my === seq) overrides.value = res.items
  } catch (e) {
    if (my === seq) overridesError.value = errorMessage(e, t)
  } finally {
    if (my === seq) overridesLoading.value = false
  }
}

async function loadLessons() {
  lessonsError.value = ''
  if (!teacherId.value) {
    lessons.value = []
    isWorkday.value = true
    return
  }
  lessonsLoading.value = true
  const my = seq
  try {
    const res = await timetableApi.teacherDay(date.value, teacherId.value)
    if (my !== seq) return
    lessons.value = [...res.lessons].sort((a, b) => a.lessonNo - b.lessonNo)
    isWorkday.value = res.isWorkday
  } catch (e) {
    if (my === seq) lessonsError.value = errorMessage(e, t)
  } finally {
    if (my === seq) lessonsLoading.value = false
  }
}

function reload() {
  seq++
  return Promise.all([loadOverrides(), loadLessons()])
}

function shift(n: number) {
  date.value = addDaysIso(date.value, n)
}

function load() {
  if (needsSchool.value) return
  void loadTeachers()
  void reload()
}

onMounted(load)
watch(
  () => schoolCtx.schoolId,
  () => {
    teacherId.value = ''
    load()
  },
)
watch([date, teacherId], () => {
  if (date.value && !needsSchool.value) void reload()
})

const toModalLesson = (l: DayLessonDto): OverrideLesson => ({
  classId: l.classId,
  className: l.class.name,
  lessonNo: l.lessonNo,
  subjectId: l.subject.id,
  subjectName: l.subject.name,
})
const openModal = (mode: OverrideMode, l: DayLessonDto | null = null) => {
  modal.value = { mode, lesson: l ? toModalLesson(l) : null }
}
async function onDone() {
  modal.value = null
  await reload()
}

const overrideById = (id: string | null) => overrides.value.find((o) => o.id === id)
const isMoved = (id: string | null) => !!overrideById(id)?.moveGroupId

async function undo(id: string, label: string, moved: boolean) {
  const ok = await confirm({
    title: t('substitutions.undo.title'),
    message: t(moved ? 'substitutions.undo.textMove' : 'substitutions.undo.text', {
      lesson: label,
    }),
    confirmText: t('substitutions.undo.confirm'),
    cancelText: t('substitutions.undo.keep'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await timetableApi.deleteOverride(id)
    toast.success(t('substitutions.toast.undone'))
    await reload()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
const lessonLabel = (cls: string, no: number) =>
  `${cls} · ${t('substitutions.lessonNo', { n: no })}`
</script>

<template>
  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <PageHeader :title="t('substitutions.title')" :description="t('substitutions.description')">
      <template #actions>
        <BaseButton data-testid="add-extra" @click="openModal('extra')">
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ t('substitutions.extra.button') }}
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Sana navigatori -->
    <div class="mb-4 flex flex-wrap items-end gap-2">
      <BaseButton
        variant="secondary"
        size="sm"
        :aria-label="t('substitutions.prevDay')"
        data-testid="day-prev"
        @click="shift(-1)"
      >
        <ChevronLeft class="h-4 w-4" />
      </BaseButton>
      <BaseInput
        v-model="date"
        type="date"
        :aria-label="t('substitutions.date')"
        class="w-44"
        data-testid="sub-date"
      />
      <BaseButton
        variant="secondary"
        size="sm"
        :aria-label="t('substitutions.nextDay')"
        data-testid="day-next"
        @click="shift(1)"
      >
        <ChevronRight class="h-4 w-4" />
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="date = todayIso()">
        {{ t('substitutions.today') }}
      </BaseButton>
      <span class="text-sm text-fg-muted" data-testid="sub-weekday">
        <template v-if="weekday">
          {{ t(`journal.weekdayLong.${weekday}`) }}, {{ formatDate(date) }}
        </template>
      </span>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <!-- O'qituvchi yo'q -->
      <section class="card p-4 sm:p-5" data-testid="absent-section">
        <h2 class="mb-3 text-base font-semibold text-fg">{{ t('substitutions.teacherAbsent') }}</h2>
        <BaseSelect
          v-model="teacherId"
          :placeholder="t('substitutions.teacherPlaceholder')"
          :options="teacherOptions"
          :aria-label="t('substitutions.teacherAbsent')"
          data-testid="absent-teacher"
        />

        <div
          v-if="teacherId && !isWorkday && !lessonsLoading"
          class="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning"
          data-testid="not-workday"
        >
          <CalendarOff class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ t('substitutions.notWorkday') }}
        </div>

        <div class="mt-4">
          <p v-if="!teacherId" class="py-6 text-center text-sm text-fg-muted">
            {{ t('substitutions.pickTeacher') }}
          </p>
          <div v-else-if="lessonsLoading" class="space-y-2" data-testid="lessons-loading">
            <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
          </div>
          <div
            v-else-if="lessonsError"
            class="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm"
          >
            <p class="text-danger" data-testid="lessons-error">{{ lessonsError }}</p>
            <BaseButton class="mt-2" size="sm" variant="secondary" @click="loadLessons()">
              {{ t('common.retry') }}
            </BaseButton>
          </div>
          <p
            v-else-if="lessons.length === 0"
            class="py-6 text-center text-sm text-fg-muted"
            data-testid="lessons-empty"
          >
            {{ t('substitutions.noLessons') }}
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="l in lessons"
              :key="`${l.classId}-${l.lessonNo}`"
              class="rounded-xl border border-border p-3"
              data-testid="day-lesson"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p
                  class="min-w-0 flex-1 text-sm font-medium text-fg"
                  :class="l.cancelled ? 'line-through opacity-70' : ''"
                >
                  {{ lessonLabel(l.class.name, l.lessonNo) }} · {{ l.subject.name }}
                </p>
                <OverrideTypeBadge :type="l.overrideType" :moved="isMoved(l.overrideId)" />
              </div>
              <p v-if="l.originalTeacher" class="mt-0.5 text-xs text-fg-muted">
                {{
                  t('substitutions.arrow', {
                    from: l.originalTeacher.fullName,
                    to: l.teacher.fullName,
                  })
                }}
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <BaseButton
                  v-if="l.overrideId"
                  size="sm"
                  variant="secondary"
                  data-testid="lesson-undo"
                  @click="
                    undo(l.overrideId, lessonLabel(l.class.name, l.lessonNo), isMoved(l.overrideId))
                  "
                >
                  <Undo2 class="h-4 w-4" aria-hidden="true" />
                  {{ t('substitutions.actions.undo') }}
                </BaseButton>
                <template v-else>
                  <BaseButton
                    size="sm"
                    data-testid="act-substitute"
                    @click="openModal('substitute', l)"
                  >
                    {{ t('substitutions.actions.substitute') }}
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="secondary"
                    data-testid="act-cancel"
                    @click="openModal('cancel', l)"
                  >
                    {{ t('substitutions.actions.cancel') }}
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="secondary"
                    data-testid="act-move"
                    @click="openModal('move', l)"
                  >
                    {{ t('substitutions.actions.move') }}
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    variant="secondary"
                    data-testid="act-replace"
                    @click="openModal('replace', l)"
                  >
                    {{ t('substitutions.actions.replace') }}
                  </BaseButton>
                </template>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Shu kungi o'zgarishlar -->
      <section class="card p-4 sm:p-5" data-testid="changes-section">
        <h2 class="mb-3 text-base font-semibold text-fg">{{ t('substitutions.changes.title') }}</h2>
        <div v-if="overridesLoading" class="space-y-2" data-testid="changes-loading">
          <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
        </div>
        <div
          v-else-if="overridesError"
          class="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm"
        >
          <p class="text-danger" data-testid="changes-error">{{ overridesError }}</p>
          <BaseButton class="mt-2" size="sm" variant="secondary" @click="loadOverrides()">
            {{ t('common.retry') }}
          </BaseButton>
        </div>
        <EmptyState
          v-else-if="sortedOverrides.length === 0"
          :title="t('substitutions.changes.empty')"
          :description="t('substitutions.changes.emptyText')"
          data-testid="changes-empty"
        />
        <ul v-else class="space-y-2">
          <li
            v-for="o in sortedOverrides"
            :key="o.id"
            class="rounded-xl border border-border p-3"
            data-testid="change-item"
          >
            <div class="flex flex-wrap items-center gap-2">
              <p class="min-w-0 flex-1 text-sm font-medium text-fg">
                {{ lessonLabel(o.class.name, o.lessonNo) }}
                <template v-if="o.subject ?? o.originalSubject">
                  · {{ (o.subject ?? o.originalSubject)!.name }}
                </template>
              </p>
              <OverrideTypeBadge :type="o.type" :moved="!!o.moveGroupId" />
              <BaseBadge v-if="o.moveGroupId" tone="neutral">{{ formatDate(o.date) }}</BaseBadge>
            </div>
            <p
              v-if="o.originalTeacher || o.teacher"
              class="mt-0.5 text-xs text-fg-muted"
              data-testid="change-teacher"
            >
              <template
                v-if="o.originalTeacher && o.teacher && o.originalTeacher.id !== o.teacher.id"
              >
                {{
                  t('substitutions.arrow', {
                    from: o.originalTeacher.fullName,
                    to: o.teacher.fullName,
                  })
                }}
              </template>
              <template v-else>{{ (o.teacher ?? o.originalTeacher)!.fullName }}</template>
            </p>
            <p
              v-if="o.originalSubject && o.subject && o.originalSubject.id !== o.subject.id"
              class="text-xs text-fg-muted"
              data-testid="change-subject"
            >
              {{ t('substitutions.arrow', { from: o.originalSubject.name, to: o.subject.name }) }}
            </p>
            <p v-if="o.reason" class="mt-0.5 text-xs text-fg-muted">
              {{ t('substitutions.changes.reason', { reason: o.reason }) }}
            </p>
            <div class="mt-2 flex items-center justify-between gap-2">
              <span class="truncate text-xs text-fg-muted">
                <template v-if="o.createdBy">
                  {{ t('substitutions.changes.by', { name: o.createdBy.fullName }) }}
                </template>
              </span>
              <BaseButton
                size="sm"
                variant="ghost"
                data-testid="change-undo"
                @click="undo(o.id, lessonLabel(o.class.name, o.lessonNo), !!o.moveGroupId)"
              >
                <Undo2 class="h-4 w-4" aria-hidden="true" />
                {{ t('substitutions.actions.undo') }}
              </BaseButton>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <OverrideModal
      :open="!!modal"
      :mode="modal?.mode ?? 'substitute'"
      :date="date"
      :lesson="modal?.lesson ?? null"
      @close="modal = null"
      @done="onDone"
    />
  </template>
</template>
