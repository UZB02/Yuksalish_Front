<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { behaviorTypesApi } from '@/api/behaviorTypes.api'
import { isApiError } from '@/api/errors'
import type { BehaviorKind, BehaviorType, BehaviorTypePayload, School } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ColorPicker from '@/components/ui/ColorPicker.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { behaviorTypeSchema } from '@/validation/domain'

const props = defineProps<{
  open: boolean
  item: BehaviorType | null
  schools: School[]
  /** Yaratishda oldindan tanlangan maktab (id) yoki '' - global */
  defaultSchoolId?: string
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const colorTouched = ref(false)
const isEdit = computed(() => !!props.item)

const KIND_DEFAULT: Record<BehaviorKind, string> = {
  positive: '#16a34a',
  negative: '#dc2626',
  neutral: '#64748b',
}

const { errors, defineField, handleSubmit, resetForm, setErrors, setFieldValue } = useForm({
  validationSchema: toTypedSchema(behaviorTypeSchema(t)),
  initialValues: {
    name: '',
    kind: 'positive',
    color: KIND_DEFAULT.positive,
    order: '0',
    minScore: '',
    maxScore: '',
    schoolId: '',
  },
})
const [name, nameAttrs] = defineField('name')
const [kind, kindAttrs] = defineField('kind')
const [color] = defineField('color')
const [order, orderAttrs] = defineField('order')
const [minScore, minAttrs] = defineField('minScore')
const [maxScore, maxAttrs] = defineField('maxScore')
const [schoolId, schoolAttrs] = defineField('schoolId')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const b = props.item
    resetForm({
      values: {
        name: b?.name ?? '',
        kind: b?.kind ?? 'positive',
        color: b?.color ?? KIND_DEFAULT.positive,
        order: String(b?.order ?? 0),
        minScore: b?.minScore != null ? String(b.minScore) : '',
        maxScore: b?.maxScore != null ? String(b.maxScore) : '',
        schoolId: b?.schoolId ?? props.defaultSchoolId ?? '',
      },
    })
    colorTouched.value = !!b
  },
  { immediate: true },
)

// Rang qo'lda tanlanmaguncha tur bo'yicha standart rang qo'llanadi.
watch(kind, (k) => {
  if (!colorTouched.value && k) setFieldValue('color', KIND_DEFAULT[k as BehaviorKind])
})

function pickColor(c: string) {
  colorTouched.value = true
  setFieldValue('color', c)
}

const kindOptions = computed(() =>
  (['positive', 'negative', 'neutral'] as BehaviorKind[]).map((k) => ({
    value: k,
    label: t(`scoring.kinds.${k}`),
  })),
)
const schoolOptions = computed(() => props.schools.map((s) => ({ value: s.id, label: s.name })))

const FIELDS = ['name', 'kind', 'color', 'order', 'minScore', 'maxScore', 'schoolId'] as const

const onSubmit = handleSubmit(async (v) => {
  submitting.value = true
  const payload: BehaviorTypePayload = {
    name: v.name,
    kind: v.kind,
    color: v.color.toLowerCase(),
    order: Number(v.order),
    minScore: v.minScore === '' ? null : Number(v.minScore),
    maxScore: v.maxScore === '' ? null : Number(v.maxScore),
  }
  try {
    if (props.item) await behaviorTypesApi.update(props.item.id, payload)
    else await behaviorTypesApi.create({ ...payload, schoolId: v.schoolId || null })
    toast.success(t(isEdit.value ? 'behaviorTypes.updated' : 'behaviorTypes.created'))
    emit('saved')
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') setErrors({ name: t('behaviorTypes.nameTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('behaviorTypes.edit') : t('behaviorTypes.add')"
    persistent
    @close="emit('close')"
  >
    <form id="behavior-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="name"
        v-bind="nameAttrs"
        :label="t('behaviorTypes.name')"
        :error="errors.name"
        required
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseSelect
          v-model="kind"
          v-bind="kindAttrs"
          :label="t('behaviorTypes.kind')"
          :options="kindOptions"
          :error="errors.kind"
          required
        />
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
      </div>

      <ColorPicker
        :model-value="color ?? ''"
        :error="errors.color"
        @update:model-value="pickColor"
      />

      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="minScore"
          v-bind="minAttrs"
          type="number"
          inputmode="numeric"
          min="0"
          :label="t('behaviorTypes.minScore')"
          :hint="t('behaviorTypes.rangeHint')"
          :error="errors.minScore"
        />
        <BaseInput
          v-model="maxScore"
          v-bind="maxAttrs"
          type="number"
          inputmode="numeric"
          min="0"
          :label="t('behaviorTypes.maxScore')"
          :error="errors.maxScore"
        />
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
      <BaseButton type="submit" form="behavior-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
