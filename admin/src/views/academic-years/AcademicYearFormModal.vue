<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { Plus, Trash2 } from 'lucide-vue-next'
import { academicYearsApi } from '@/api/academicYears.api'
import { isApiError } from '@/api/errors'
import type { AcademicPeriod, AcademicYear } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { toDateInput } from '@/utils/format'
import {
  academicYearSchema,
  hasPeriodErrors,
  validatePeriods,
  type PeriodError,
} from '@/validation/domain'

const props = defineProps<{ open: boolean; year: AcademicYear | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const isEdit = computed(() => !!props.year)
const periods = ref<AcademicPeriod[]>([])
const periodErrors = ref<PeriodError[]>([])

const { errors, defineField, handleSubmit, resetForm, setErrors, values } = useForm({
  validationSchema: toTypedSchema(academicYearSchema(t)),
  initialValues: { name: '', startDate: '', endDate: '' },
})
const [name, nameAttrs] = defineField('name')
const [startDate, startAttrs] = defineField('startDate')
const [endDate, endAttrs] = defineField('endDate')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const y = props.year
    resetForm({
      values: {
        name: y?.name ?? '',
        startDate: toDateInput(y?.startDate),
        endDate: toDateInput(y?.endDate),
      },
    })
    periods.value = (y?.periods ?? []).map((p) => ({
      name: p.name,
      startDate: toDateInput(p.startDate),
      endDate: toDateInput(p.endDate),
    }))
    periodErrors.value = []
  },
  { immediate: true },
)

function addPeriod() {
  periods.value.push({ name: '', startDate: '', endDate: '' })
}
function removePeriod(i: number) {
  periods.value.splice(i, 1)
  periodErrors.value.splice(i, 1)
}

const FIELDS = ['name', 'startDate', 'endDate'] as const

const onSubmit = handleSubmit(async (v) => {
  periodErrors.value = validatePeriods(periods.value, v, t)
  if (hasPeriodErrors(periodErrors.value)) return
  submitting.value = true
  const payload = {
    name: v.name,
    startDate: v.startDate,
    endDate: v.endDate,
    periods: periods.value.map((p) => ({ ...p, name: p.name.trim() })),
  }
  try {
    if (props.year) await academicYearsApi.update(props.year.id, payload)
    else await academicYearsApi.create(payload)
    toast.success(t(isEdit.value ? 'academicYears.updated' : 'academicYears.createdInactive'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') setErrors({ name: t('academicYears.nameTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('academicYears.edit') : t('academicYears.add')"
    size="lg"
    persistent
    @close="emit('close')"
  >
    <form id="year-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="name"
        v-bind="nameAttrs"
        :label="t('academicYears.name')"
        placeholder="2026-2027"
        :error="errors.name"
        required
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="startDate"
          v-bind="startAttrs"
          type="date"
          :label="t('academicYears.startDate')"
          :error="errors.startDate"
          required
        />
        <BaseInput
          v-model="endDate"
          v-bind="endAttrs"
          type="date"
          :label="t('academicYears.endDate')"
          :error="errors.endDate"
          required
        />
      </div>

      <section :aria-label="t('academicYears.periods')">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-medium text-fg">{{ t('academicYears.periods') }}</h3>
          <BaseButton size="sm" variant="secondary" @click="addPeriod">
            <Plus class="h-4 w-4" /> {{ t('academicYears.addPeriod') }}
          </BaseButton>
        </div>
        <p v-if="periods.length === 0" class="text-sm text-fg-muted">
          {{ t('academicYears.noPeriods') }}
        </p>
        <ul class="space-y-3">
          <li
            v-for="(p, i) in periods"
            :key="i"
            class="grid items-start gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_9rem_9rem_auto]"
          >
            <BaseInput
              v-model="p.name"
              :aria-label="t('academicYears.periodName')"
              :placeholder="t('academicYears.periodName')"
              :error="periodErrors[i]?.name"
            />
            <BaseInput
              v-model="p.startDate"
              type="date"
              :aria-label="t('academicYears.startDate')"
              :error="periodErrors[i]?.startDate"
              :min="values.startDate"
              :max="values.endDate"
            />
            <BaseInput
              v-model="p.endDate"
              type="date"
              :aria-label="t('academicYears.endDate')"
              :error="periodErrors[i]?.endDate"
              :min="values.startDate"
              :max="values.endDate"
            />
            <BaseButton
              variant="ghost"
              size="sm"
              class="sm:mt-1"
              :aria-label="t('academicYears.removePeriod')"
              @click="removePeriod(i)"
            >
              <Trash2 class="h-4 w-4 text-danger" />
            </BaseButton>
          </li>
        </ul>
      </section>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="year-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
