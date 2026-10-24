<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from 'lucide-vue-next'
import { classesApi } from '@/api/classes.api'
import { subjectsApi } from '@/api/subjects.api'
import type { SchoolClass, Subject, Teacher } from '@/api/types'
import SubjectAssignmentsEditor, {
  type AssignmentRow,
} from '@/components/domain/SubjectAssignmentsEditor.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

/**
 * Sinfga o'qituvchilarni biriktirish: sinf rahbari, fan -> o'qituvchi va (ixtiyoriy) fansiz o'qituvchilar.
 * Bitta PATCH bilan saqlanadi: backend rahbar, fan o'qituvchilari va qo'shimchalarni teacherIds ga birlashtiradi
 * va sinfdan chiqarilganlarning fan biriktirishlarini o'chiradi.
 */
const props = defineProps<{
  open: boolean
  schoolClass: SchoolClass | null
  teachers: Teacher[]
  loading?: boolean
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const homeroomId = ref('')
const rows = ref<AssignmentRow[]>([])
/** Fan biriktirilmagan, lekin sinfga qo'shilgan o'qituvchilar */
const extras = ref<string[]>([])
const subjects = ref<Subject[]>([])
const subjectsFailed = ref(false)
const showErrors = ref(false)
const submitting = ref(false)

async function loadSubjects() {
  subjectsFailed.value = false
  try {
    subjects.value = (await subjectsApi.list()).items
  } catch {
    subjects.value = []
    subjectsFailed.value = true
  }
}

watch(
  () => props.open,
  (isOpen) => {
    const c = props.schoolClass
    if (!isOpen || !c) return
    homeroomId.value = c.homeroomTeacherId ?? ''
    rows.value = (c.subjects ?? []).map((s) => ({ subjectId: s.subjectId, teacherId: s.teacherId }))
    const subjectTeachers = new Set(rows.value.map((r) => r.teacherId))
    extras.value = c.teacherIds.filter(
      (id) => !subjectTeachers.has(id) && id !== c.homeroomTeacherId,
    )
    showErrors.value = false
    void loadSubjects()
  },
  { immediate: true },
)

const teacherOptions = computed(() =>
  props.teachers.map((tc) => ({ value: tc.id, label: tc.fullName })),
)
/** Qo'shimcha ro'yxatda rahbar va fan o'qituvchilari ko'rsatilmaydi (ular baribir sinfga qo'shiladi) */
const extraCandidates = computed(() => {
  const busy = new Set([homeroomId.value, ...rows.value.map((r) => r.teacherId)])
  return props.teachers.filter((tc) => !busy.has(tc.id))
})
const extrasCount = computed(
  () => extras.value.filter((id) => extraCandidates.value.some((tc) => tc.id === id)).length,
)

function toggleExtra(id: string, value: boolean) {
  extras.value = value ? [...extras.value, id] : extras.value.filter((x) => x !== id)
}

async function save() {
  const c = props.schoolClass
  if (!c) return
  showErrors.value = true
  if (rows.value.some((r) => !r.subjectId || !r.teacherId)) return
  submitting.value = true
  try {
    const busy = new Set([homeroomId.value, ...rows.value.map((r) => r.teacherId)])
    await classesApi.update(c.id, {
      homeroomTeacherId: homeroomId.value || null,
      teacherIds: extras.value.filter((id) => !busy.has(id)),
      subjects: rows.value,
    })
    toast.success(t('classes.teachersSaved'))
    emit('saved')
    emit('close')
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('classes.assignTeachers')"
    :description="schoolClass?.name"
    size="lg"
    persistent
    @close="emit('close')"
  >
    <p v-if="!loading && teachers.length === 0" class="text-sm text-fg-muted">
      {{ t('classes.noTeachers') }}
    </p>
    <div v-else class="space-y-6">
      <section aria-labelledby="assign-homeroom-title">
        <h3 id="assign-homeroom-title" class="text-sm font-semibold text-fg">
          {{ t('classes.homeroom') }}
        </h3>
        <p class="mb-2 text-xs text-fg-muted">{{ t('classes.homeroomHint') }}</p>
        <BaseSelect
          v-model="homeroomId"
          :aria-label="t('classes.homeroom')"
          :placeholder="t('classes.noHomeroom')"
          :options="teacherOptions"
          searchable
          data-testid="assign-homeroom"
        />
      </section>

      <section aria-labelledby="assign-subjects-title">
        <h3 id="assign-subjects-title" class="text-sm font-semibold text-fg">
          {{ t('classes.subjectsSection') }}
        </h3>
        <p class="mb-2 text-xs text-fg-muted">{{ t('classes.subjectsHint') }}</p>
        <SubjectAssignmentsEditor
          v-model="rows"
          :subjects="subjects"
          :teachers="teachers"
          :failed="subjectsFailed"
          :show-errors="showErrors"
          hide-header
        />
      </section>

      <details class="group rounded-xl border border-border" data-testid="assign-extras">
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-fg"
        >
          <span>
            {{ t('classes.extraTeachers') }}
            <span v-if="extrasCount" class="ml-1 text-fg-muted">({{ extrasCount }})</span>
          </span>
          <ChevronDown
            class="h-4 w-4 text-fg-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div class="border-t border-border px-4 py-3">
          <p class="mb-2 text-xs text-fg-muted">{{ t('classes.extraTeachersHint') }}</p>
          <p v-if="extraCandidates.length === 0" class="text-sm text-fg-muted">
            {{ t('classes.extraTeachersNone') }}
          </p>
          <ul v-else class="max-h-48 space-y-2 overflow-y-auto">
            <li v-for="tc in extraCandidates" :key="tc.id">
              <BaseCheckbox
                :model-value="extras.includes(tc.id)"
                :label="tc.fullName"
                @update:model-value="toggleExtra(tc.id, $event)"
              />
            </li>
          </ul>
        </div>
      </details>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="submitting" data-testid="assign-save" @click="save">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
