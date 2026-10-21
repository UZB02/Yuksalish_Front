<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { attendanceStatusesApi } from '@/api/attendanceStatuses.api'
import { isApiError } from '@/api/errors'
import type {
  AttendanceCategory,
  AttendanceStatus,
  AttendanceStatusPayload,
  School,
} from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import ColorPicker from '@/components/ui/ColorPicker.vue'
import { useToast } from '@/composables/useToast'
import { CATEGORIES, CATEGORY_COLORS } from '@/utils/attendance'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { attendanceStatusSchema } from '@/validation/domain'

const props = defineProps<{
  open: boolean
  item: AttendanceStatus | null
  schools: School[]
  defaultSchoolId?: string
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const colorTouched = ref(false)
/** Tahrirlashda kategoriya odatda qulflangan (yozuvlar mavjud bo'lishi mumkin) */
const unlockCategory = ref(false)
const isEdit = computed(() => !!props.item)

const { errors, defineField, handleSubmit, resetForm, setErrors, setFieldValue } = useForm({
  validationSchema: toTypedSchema(attendanceStatusSchema(t)),
  initialValues: {
    name: '',
    shortName: '',
    category: 'present',
    color: CATEGORY_COLORS.present,
    order: '0',
    isDefault: false,
    schoolId: '',
  },
})
const [name, nameAttrs] = defineField('name')
const [shortName, shortAttrs] = defineField('shortName')
const [category, categoryAttrs] = defineField('category')
const [color] = defineField('color')
const [order, orderAttrs] = defineField('order')
const [isDefault] = defineField('isDefault')
const [schoolId, schoolAttrs] = defineField('schoolId')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const s = props.item
    resetForm({
      values: {
        name: s?.name ?? '',
        shortName: s?.shortName ?? '',
        category: s?.category ?? 'present',
        color: s?.color ?? CATEGORY_COLORS.present,
        order: String(s?.order ?? 0),
        isDefault: s?.isDefault ?? false,
        schoolId: s?.schoolId ?? props.defaultSchoolId ?? '',
      },
    })
    colorTouched.value = !!s
    unlockCategory.value = false
  },
  { immediate: true },
)

// Rang qo'lda tanlanmaguncha kategoriya bo'yicha standart rang
watch(category, (c) => {
  if (!colorTouched.value && c) setFieldValue('color', CATEGORY_COLORS[c as AttendanceCategory])
  if (c !== 'present') setFieldValue('isDefault', false)
})

function pickColor(c: string) {
  colorTouched.value = true
  setFieldValue('color', c)
}

const categoryOptions = computed(() =>
  CATEGORIES.map((c) => ({ value: c, label: t(`attendance.categories.${c}`) })),
)
const schoolOptions = computed(() => props.schools.map((s) => ({ value: s.id, label: s.name })))
const categoryLocked = computed(() => isEdit.value && !unlockCategory.value)

const FIELDS = ['name', 'shortName', 'category', 'color', 'order', 'isDefault', 'schoolId'] as const

const onSubmit = handleSubmit(async (v) => {
  submitting.value = true
  const payload: AttendanceStatusPayload = {
    name: v.name,
    shortName: v.shortName,
    category: v.category,
    color: v.color.toLowerCase(),
    order: Number(v.order),
    isDefault: v.isDefault,
  }
  try {
    if (props.item) {
      // Kategoriya qulflangan bo'lsa yuborilmaydi
      const { category: _c, ...rest } = payload
      await attendanceStatusesApi.update(props.item.id, categoryLocked.value ? rest : payload)
    } else {
      await attendanceStatusesApi.create({ ...payload, schoolId: v.schoolId || null })
    }
    toast.success(t(isEdit.value ? 'attendanceStatuses.updated' : 'attendanceStatuses.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') {
      // Yozuvlari bor holatda kategoriyani o'zgartirish 409
      if (props.item && unlockCategory.value)
        setErrors({ category: t('attendanceStatuses.categoryInUse') })
      else setErrors({ name: t('attendanceStatuses.nameTaken') })
    } else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('attendanceStatuses.edit') : t('attendanceStatuses.add')"
    persistent
    @close="emit('close')"
  >
    <form id="att-status-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <div class="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <BaseInput
          v-model="name"
          v-bind="nameAttrs"
          :label="t('attendanceStatuses.name')"
          :error="errors.name"
          required
        />
        <BaseInput
          v-model="shortName"
          v-bind="shortAttrs"
          maxlength="4"
          :label="t('attendanceStatuses.shortName')"
          :error="errors.shortName"
          required
        />
      </div>

      <div>
        <BaseSelect
          v-model="category"
          v-bind="categoryAttrs"
          :label="t('attendanceStatuses.category')"
          :options="categoryOptions"
          :disabled="categoryLocked"
          :error="errors.category"
          required
          data-testid="category-select"
        />
        <div v-if="isEdit" class="mt-1.5 text-xs text-fg-muted">
          <p>{{ t('attendanceStatuses.categoryLockedHint') }}</p>
          <label class="mt-1 inline-flex cursor-pointer items-center gap-2 text-fg">
            <input v-model="unlockCategory" type="checkbox" class="accent-primary-600" />
            {{ t('attendanceStatuses.unlockCategory') }}
          </label>
        </div>
      </div>

      <ColorPicker
        :model-value="color ?? ''"
        :label="t('behaviorTypes.color')"
        :error="errors.color"
        @update:model-value="pickColor"
      />

      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="order"
          v-bind="orderAttrs"
          type="number"
          inputmode="numeric"
          min="0"
          :label="t('behaviorTypes.order')"
          :error="errors.order"
          required
        />
        <div>
          <p class="mb-1.5 text-sm font-medium text-fg">{{ t('attendanceStatuses.default') }}</p>
          <BaseSwitch
            :model-value="!!isDefault"
            :disabled="category !== 'present'"
            :label="isDefault ? t('settings.yes') : t('settings.no')"
            @update:model-value="isDefault = $event"
          />
          <p class="mt-1 text-xs" :class="errors.isDefault ? 'text-danger' : 'text-fg-muted'">
            {{ errors.isDefault ?? t('attendanceStatuses.defaultHint') }}
          </p>
        </div>
      </div>

      <BaseSelect
        v-if="!isEdit"
        v-model="schoolId"
        v-bind="schoolAttrs"
        :label="t('behaviorTypes.scope')"
        :placeholder="t('behaviorTypes.global')"
        :options="schoolOptions"
        :error="errors.schoolId"
      />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="att-status-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
