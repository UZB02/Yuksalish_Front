import { computed, reactive, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { classesApi } from '@/api/classes.api'
import { isApiError } from '@/api/errors'
import { subjectsApi } from '@/api/subjects.api'
import type { AcademicYear, ClassPayload, SchoolClass, Subject } from '@/api/types'
import type { AssignmentRow } from '@/components/domain/SubjectAssignmentsEditor.vue'
import { useToast } from '@/composables/useToast'
import { hasDuplicatePair } from '@/utils/classSubjects'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { classSchema } from '@/validation/domain'

const FIELDS = ['name', 'grade', 'section', 'academicYearId', 'homeroomTeacherId'] as const

/**
 * Sinf yaratish/tahrirlash formasi: maydonlar, validatsiya (classSchema), fanlar ro'yxati,
 * o'zgarish (dirty) holati va saqlash. `schoolClass` null bo'lsa - yaratish.
 */
export function useClassForm(schoolClass: Ref<SchoolClass | null>, years: Ref<AcademicYear[]>) {
  const { t } = useI18n()
  const toast = useToast()
  const submitting = ref(false)
  const nameTouched = ref(false)
  const subjectRows = ref<AssignmentRow[]>([])
  const subjectList = ref<Subject[]>([])
  const subjectsFailed = ref(false)
  const rowsSubmitted = ref(false)
  const initial = ref('')
  const isEdit = computed(() => !!schoolClass.value)

  const { errors, values, defineField, handleSubmit, resetForm, setErrors, setFieldValue } =
    useForm({
      validationSchema: toTypedSchema(classSchema(t)),
      initialValues: {
        name: '',
        grade: '',
        section: '',
        academicYearId: '',
        homeroomTeacherId: '',
      },
    })
  const [name, nameAttrs] = defineField('name')
  const [grade, gradeAttrs] = defineField('grade')
  const [section, sectionAttrs] = defineField('section')
  const [academicYearId, yearAttrs] = defineField('academicYearId')
  const [homeroomTeacherId, homeroomAttrs] = defineField('homeroomTeacherId')

  const snapshot = () => JSON.stringify([values, subjectRows.value])
  /** Formadagi qiymatlar boshlang'ich holatdan farq qiladimi */
  const dirty = computed(() => snapshot() !== initial.value)

  async function loadSubjects() {
    subjectsFailed.value = false
    try {
      // Faol fanlar; sinfda allaqachon biriktirilgan nofaol fanlar ham tanlanadigan bo'lib qoladi.
      subjectList.value = (await subjectsApi.list()).items
    } catch {
      subjectList.value = []
      subjectsFailed.value = true
    }
  }

  /** Sinf va o'quv yillari yuklangach chaqiriladi: formani boshlang'ich qiymatlar bilan to'ldiradi. */
  function init() {
    const c = schoolClass.value
    resetForm({
      values: {
        name: c?.name ?? '',
        grade: c ? String(c.grade) : '',
        section: c?.section ?? '',
        academicYearId: c?.academicYearId ?? years.value.find((y) => y.isActive)?.id ?? '',
        homeroomTeacherId: c?.homeroomTeacherId ?? '',
      },
    })
    nameTouched.value = !!c
    rowsSubmitted.value = false
    subjectRows.value = (c?.subjects ?? []).map((s) => ({
      subjectId: s.subjectId,
      teacherId: s.teacherId,
    }))
    initial.value = snapshot()
    void loadSubjects()
  }

  // Sinf nomi parallel va harfdan avtomatik yig'iladi (7-A), qo'lda tahrirlanmaguncha.
  watch([grade, section], ([g, s]) => {
    if (!nameTouched.value) setFieldValue('name', g ? `${g}${s ? `-${s.toUpperCase()}` : ''}` : '')
  })

  /** Muvaffaqiyatda saqlangan sinfni, aks holda null qaytaradi. */
  const submit = handleSubmit(async (v): Promise<SchoolClass | null> => {
    rowsSubmitted.value = true
    // To'liq bo'lmagan qator (fan yoki o'qituvchi tanlanmagan) saqlashga yo'l qo'ymaydi.
    if (subjectRows.value.some((r) => !r.subjectId || !r.teacherId)) return null
    if (hasDuplicatePair(subjectRows.value)) return null
    submitting.value = true
    try {
      let saved: SchoolClass
      if (schoolClass.value) {
        saved = await classesApi.update(schoolClass.value.id, {
          name: v.name,
          grade: Number(v.grade),
          section: v.section || null,
          homeroomTeacherId: v.homeroomTeacherId || null,
          subjects: subjectRows.value.map((r) => ({ ...r })),
        })
      } else {
        const payload: ClassPayload = { name: v.name, grade: Number(v.grade) }
        if (v.section) payload.section = v.section
        if (v.academicYearId) payload.academicYearId = v.academicYearId
        if (v.homeroomTeacherId) payload.homeroomTeacherId = v.homeroomTeacherId
        if (subjectRows.value.length) payload.subjects = subjectRows.value.map((r) => ({ ...r }))
        saved = await classesApi.create(payload)
      }
      toast.success(t(isEdit.value ? 'classes.updated' : 'classes.created'))
      return saved
    } catch (e) {
      if (applyServerErrors(e, setErrors, FIELDS)) return null
      if (isApiError(e) && e.code === 'CONFLICT') setErrors({ name: t('classes.nameTaken') })
      else toast.error(errorMessage(e, t))
      return null
    } finally {
      submitting.value = false
    }
  })

  // reactive: shablonda `form.grade`, `form.dirty` kabi ref'larsiz ishlatiladi.
  return reactive({
    isEdit,
    errors,
    name,
    nameAttrs,
    grade,
    gradeAttrs,
    section,
    sectionAttrs,
    academicYearId,
    yearAttrs,
    homeroomTeacherId,
    homeroomAttrs,
    nameTouched,
    subjectRows,
    subjectList,
    subjectsFailed,
    rowsSubmitted,
    submitting,
    dirty,
    init,
    submit,
  })
}

export type ClassFormState = ReturnType<typeof useClassForm>
