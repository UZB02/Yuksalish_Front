<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { schoolsApi } from '@/api/schools.api'
import { isApiError } from '@/api/errors'
import type { School, SchoolPayload } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import { slugify } from '@/utils/slug'
import { schoolSchema } from '@/validation/schemas'

const props = defineProps<{ open: boolean; school: School | null }>()
const emit = defineEmits<{ close: []; saved: [school: School] }>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const slugTouched = ref(false)
const isEdit = computed(() => !!props.school)

const { errors, defineField, handleSubmit, resetForm, setErrors, setFieldValue } = useForm({
  validationSchema: toTypedSchema(schoolSchema(t)),
  initialValues: { name: '', slug: '', address: '', phone: '', logoUrl: '' },
})
const [name, nameAttrs] = defineField('name')
const [slug, slugAttrs] = defineField('slug')
const [address, addressAttrs] = defineField('address')
const [phone, phoneAttrs] = defineField('phone')
const [logoUrl, logoUrlAttrs] = defineField('logoUrl')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const s = props.school
    resetForm({
      values: {
        name: s?.name ?? '',
        slug: s?.slug ?? '',
        address: s?.address ?? '',
        phone: s?.phone ?? '',
        logoUrl: s?.logoUrl ?? '',
      },
    })
    // Tahrirlashda mavjud slug nom o'zgarganda o'zgarib ketmasligi kerak.
    slugTouched.value = !!s
  },
  { immediate: true },
)

// Nom kiritilganda slug avtomatik generatsiya qilinadi (qo'lda tahrirlanmaguncha).
watch(name, (value) => {
  if (!slugTouched.value) setFieldValue('slug', slugify(value ?? ''))
})

const FIELDS = ['name', 'slug', 'address', 'phone', 'logoUrl'] as const

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  try {
    let saved: School
    if (props.school) {
      // Tahrirlashda bo'sh maydon null sifatida yuboriladi (tozalash).
      saved = await schoolsApi.update(props.school.id, {
        name: values.name,
        slug: values.slug,
        address: values.address || null,
        phone: values.phone || null,
        logoUrl: values.logoUrl || null,
      })
    } else {
      const payload: SchoolPayload = { name: values.name, slug: values.slug }
      if (values.address) payload.address = values.address
      if (values.phone) payload.phone = values.phone
      if (values.logoUrl) payload.logoUrl = values.logoUrl
      saved = await schoolsApi.create(payload)
    }
    toast.success(t(isEdit.value ? 'schools.updated' : 'schools.created'))
    emit('saved', saved)
    emit('close')
  } catch (e) {
    if (applyServerErrors(e, setErrors, FIELDS)) return
    if (isApiError(e) && e.code === 'CONFLICT') setErrors({ slug: t('schools.slugTaken') })
    else toast.error(errorMessage(e, t))
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? t('schools.edit') : t('schools.add')"
    persistent
    @close="emit('close')"
  >
    <form id="school-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseInput
        v-model="name"
        v-bind="nameAttrs"
        :label="t('schools.name')"
        :error="errors.name"
        required
      />
      <BaseInput
        v-model="slug"
        v-bind="slugAttrs"
        :label="t('schools.slug')"
        :hint="t('schools.slugHint')"
        :error="errors.slug"
        autocapitalize="none"
        spellcheck="false"
        required
        @input="slugTouched = true"
      />
      <BaseInput
        v-model="address"
        v-bind="addressAttrs"
        :label="t('schools.address')"
        :error="errors.address"
      />
      <BaseInput
        v-model="phone"
        v-bind="phoneAttrs"
        type="tel"
        placeholder="+998 90 123 45 67"
        :label="t('schools.phone')"
        :error="errors.phone"
      />
      <BaseInput
        v-model="logoUrl"
        v-bind="logoUrlAttrs"
        type="url"
        placeholder="https://"
        :label="t('schools.logoUrl')"
        :error="errors.logoUrl"
      />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="submit" form="school-form" :loading="submitting">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
