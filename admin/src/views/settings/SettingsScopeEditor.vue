<script setup lang="ts" generic="T extends object">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { settingsApi, type SettingsKind } from '@/api/settings.api'
import type { SettingsResponse } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import {
  diffValues,
  flagsFromOverride,
  mergeValues,
  omitKeys,
  pickOverride,
  resetFlagValue,
  type Flags,
} from '@/utils/scopeSettings'

type K = keyof T & string

const props = defineProps<{
  kind: SettingsKind
  keys: readonly K[]
  defaults: T
  validate: (values: T) => Record<string, string>
  format: (key: K, values: T) => string
  /** Faqat global bo'lishi mumkin bo'lgan kalitlar (maktab override ga kirmaydi) */
  globalOnlyKeys?: readonly K[]
  /** O'z maktabi rejimi (maktab admini): global bo'lim va maktab tanlagich yo'q, saqlashda schoolId yuborilmaydi */
  ownSchool?: boolean
  /** Maydon yorliqlari i18n prefiksi (standart: settings.fields) */
  labelPrefix?: string
  /** Saqlashdan oldin tasdiq dialogiga qo'shiladigan ogohlantirishlar */
  warnings?: (before: T, after: T) => string[]
}>()

defineSlots<{
  fields(p: {
    scope: 'global' | 'school'
    values: T
    errors: Record<string, string>
    flags?: Flags<K>
    globalValues?: T
    set: (key: K, value: T[K]) => void
    toggleFlag: (key: K, on: boolean) => void
  }): unknown
  preview(p: { scope: 'global' | 'school'; values: T; schoolId?: string }): unknown
  'global-extra'(p: { values: T; set: (key: K, value: T[K]) => void }): unknown
  'school-extra'(p: { schoolId: string; values: T }): unknown
}>()

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const schoolCtx = useSchoolContextStore()

const label = (k: string) => t(`${props.labelPrefix ?? 'settings.fields'}.${k}.label`)
const overridable = computed(() => props.keys.filter((k) => !props.globalOnlyKeys?.includes(k)))

const summary = (keys: K[], before: T, after: T) => {
  const lines = keys.map(
    (k) => `${label(k)}: ${props.format(k, before)} -> ${props.format(k, after)}`,
  )
  const warn = props.warnings?.(before, after) ?? []
  return [...lines, ...(warn.length ? ['', ...warn] : [])].join('\n')
}
const OWN = '__own__'
/** API ga yuboriladigan maktab id si: o'z maktabi rejimida yuborilmaydi (server o'zining maktabini oladi). */
const apiSchoolId = (id: string) => (props.ownSchool ? undefined : id)

// ---- Global ----
const loading = ref(true)
const loadError = ref('')
// Generic T uchun ref turi unwrap qilinmasligi kerak.
const r = <V,>(v: V) => ref(v) as Ref<V>
const globalSaved = r<T>({ ...props.defaults })
const globalForm = r<T>({ ...props.defaults })
const globalSaving = ref(false)
const globalServerError = ref('')
const globalErrors = computed(() => props.validate(globalForm.value))
const globalChanged = computed(() => diffValues(globalSaved.value, globalForm.value, props.keys))

function applyGlobal(res: SettingsResponse<T>) {
  globalSaved.value = res.global
  globalForm.value = { ...res.global }
}

async function loadGlobal() {
  loading.value = true
  loadError.value = ''
  try {
    applyGlobal((await settingsApi.get(props.kind as 'scoring')) as unknown as SettingsResponse<T>)
  } catch (e) {
    loadError.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

async function persistGlobal(values: T | null) {
  globalSaving.value = true
  globalServerError.value = ''
  try {
    const res = (await settingsApi.save(props.kind as 'scoring', {
      scope: 'global',
      values: values as never,
    })) as unknown as SettingsResponse<T>
    applyGlobal(res)
    return true
  } catch (e) {
    // Maktab override'lari bilan ziddiyat (400) - server xabari formada ko'rsatiladi.
    if (isApiError(e) && e.code === 'VALIDATION_ERROR' && e.message)
      globalServerError.value = e.message
    else toast.error(errorMessage(e, t))
    return false
  } finally {
    globalSaving.value = false
  }
}

async function saveGlobal() {
  if (Object.keys(globalErrors.value).length || globalChanged.value.length === 0) return
  const ok = await confirm({
    title: t('settings.confirmGlobalTitle'),
    message: `${t('settings.confirmChanges')}\n${summary(globalChanged.value, globalSaved.value, globalForm.value)}`,
    confirmText: t('common.save'),
  })
  if (!ok) return
  if (await persistGlobal(globalForm.value)) {
    toast.success(t('settings.saved'))
    if (schoolId.value) void loadSchool()
  }
}

async function resetGlobal() {
  const ok = await confirm({
    title: t('settings.defaultsTitle'),
    message: t('settings.defaultsText'),
    confirmText: t('settings.defaults'),
    variant: 'danger',
  })
  if (ok && (await persistGlobal(null))) toast.success(t('settings.defaultsDone'))
}

function setGlobal(key: K, value: T[K]) {
  globalForm.value = { ...globalForm.value, [key]: value }
}

// ---- Maktab bo'yicha alohida ----
const schoolId = ref('')
const schoolLoading = ref(false)
const schoolSaving = ref(false)
const schoolGlobal = r<T>({ ...props.defaults })
const schoolSavedOverride = r<Partial<T> | null>(null)
const schoolForm = r<T>({ ...props.defaults })
const flags = r<Flags<K>>(flagsFromOverride<T, K>(null, props.keys))
const schoolServerError = ref('')

const schoolOptions = computed(() => schoolCtx.schools.map((s) => ({ value: s.id, label: s.name })))
const schoolName = () =>
  props.ownSchool
    ? t('settings.ownSchool')
    : (schoolOptions.value.find((s) => s.value === schoolId.value)?.label ?? '')
const schoolErrors = computed(() => props.validate(schoolForm.value))
const hasOverride = computed(() => schoolSavedOverride.value !== null)
const savedMerged = computed(() => mergeValues(schoolGlobal.value, schoolSavedOverride.value))
const pendingOverride = computed(() =>
  pickOverride(schoolForm.value, flags.value, overridable.value),
)
const schoolChanged = computed(() =>
  diffValues(savedMerged.value, mergeValues(schoolGlobal.value, pendingOverride.value), props.keys),
)
const overrideChanged = computed(
  () => JSON.stringify(pendingOverride.value) !== JSON.stringify(schoolSavedOverride.value),
)
const schoolHasErrors = computed(() =>
  // Faqat override qilingan maydonlar xatosi saqlashni to'sadi.
  Object.keys(schoolErrors.value).some((k) => flags.value[k as K]),
)

async function loadSchool() {
  if (!schoolId.value) return
  schoolLoading.value = true
  schoolServerError.value = ''
  try {
    const res = (await settingsApi.get(
      props.kind as 'scoring',
      apiSchoolId(schoolId.value),
    )) as unknown as SettingsResponse<T>
    schoolGlobal.value = res.global
    schoolSavedOverride.value = res.override
    flags.value = flagsFromOverride<T, K>(res.override, props.keys)
    schoolForm.value = mergeValues(res.global, res.override)
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    schoolLoading.value = false
  }
}

function toggleFlag(k: K, on: boolean) {
  flags.value = { ...flags.value, [k]: on }
  schoolForm.value = resetFlagValue(schoolForm.value, schoolGlobal.value, k, on)
}
function setSchool(key: K, value: T[K]) {
  schoolForm.value = { ...schoolForm.value, [key]: value }
}

async function persistSchool(values: Partial<T> | null) {
  schoolSaving.value = true
  schoolServerError.value = ''
  try {
    await settingsApi.save(props.kind as 'scoring', {
      scope: 'school',
      ...(props.ownSchool ? {} : { schoolId: schoolId.value }),
      values: values ? (omitKeys(values, props.globalOnlyKeys ?? []) as never) : null,
    })
    await loadSchool()
    return true
  } catch (e) {
    if (isApiError(e) && e.code === 'VALIDATION_ERROR' && e.message)
      schoolServerError.value = e.message
    else toast.error(errorMessage(e, t))
    return false
  } finally {
    schoolSaving.value = false
  }
}

async function saveSchool() {
  if (schoolHasErrors.value || !overrideChanged.value) return
  const next = mergeValues(schoolGlobal.value, pendingOverride.value)
  const ok = await confirm({
    title: t('settings.confirmSchoolTitle', { name: schoolName() }),
    message: `${t('settings.confirmChanges')}\n${summary(schoolChanged.value, savedMerged.value, next) || t('settings.noValueChanges')}`,
    confirmText: t('common.save'),
  })
  if (ok && (await persistSchool(pendingOverride.value))) toast.success(t('settings.saved'))
}

async function resetSchool() {
  const ok = await confirm({
    title: t('settings.resetTitle'),
    message: t('settings.resetText', { name: schoolName() }),
    confirmText: t('settings.reset'),
    variant: 'danger',
  })
  if (ok && (await persistSchool(null))) toast.success(t('settings.resetDone'))
}

onMounted(async () => {
  if (props.ownSchool) {
    // Maktab admini: faqat o'z maktabi (global bo'lim va maktab tanlagich yo'q)
    loading.value = false
    schoolId.value = OWN
    return
  }
  void loadGlobal()
  if (!schoolCtx.loaded) await schoolCtx.loadSchools().catch(() => undefined)
  schoolId.value = schoolCtx.schoolId ?? ''
})
watch(schoolId, loadSchool)
</script>

<template>
  <div v-if="loading" class="space-y-3">
    <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
  </div>
  <div v-else-if="loadError" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="loadError">
      <BaseButton variant="secondary" @click="loadGlobal">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else class="space-y-6">
    <section v-if="!ownSchool" class="card p-5">
      <h2 class="text-base font-semibold text-fg">{{ t('settings.globalTitle') }}</h2>
      <p class="mt-1 text-sm text-fg-muted">{{ t('settings.globalText') }}</p>
      <div class="mt-2 grid gap-6" :class="$slots.preview ? 'lg:grid-cols-[1fr_22rem]' : ''">
        <div>
          <slot
            name="fields"
            scope="global"
            :values="globalForm"
            :errors="globalErrors"
            :set="setGlobal"
            :toggle-flag="() => undefined"
          />
          <slot name="global-extra" :values="globalForm" :set="setGlobal" />
        </div>
        <div v-if="$slots.preview" class="lg:sticky lg:top-20 lg:self-start">
          <slot name="preview" scope="global" :values="globalForm" />
        </div>
      </div>
      <p
        v-if="globalServerError"
        class="mt-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
        role="alert"
      >
        {{ globalServerError }}
      </p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <BaseButton variant="ghost" :disabled="globalSaving" @click="resetGlobal">
          {{ t('settings.defaults') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          :disabled="globalChanged.length === 0"
          @click="globalForm = { ...globalSaved }"
        >
          {{ t('settings.undo') }}
        </BaseButton>
        <BaseButton
          :loading="globalSaving"
          :disabled="globalChanged.length === 0 || Object.keys(globalErrors).length > 0"
          @click="saveGlobal"
        >
          {{ t('common.save') }}
        </BaseButton>
      </div>
    </section>

    <section class="card p-5">
      <h2 class="text-base font-semibold text-fg">
        {{ ownSchool ? t('settings.ownSchoolTitle') : t('settings.schoolTitle') }}
      </h2>
      <p class="mt-1 text-sm text-fg-muted">
        {{ ownSchool ? t('settings.ownSchoolText') : t('settings.schoolText') }}
      </p>
      <div v-if="!ownSchool" class="mt-4 sm:max-w-sm">
        <BaseSelect
          v-model="schoolId"
          :label="t('settings.school')"
          :placeholder="t('settings.selectSchool')"
          :options="schoolOptions"
        />
      </div>

      <template v-if="schoolId">
        <Skeleton v-if="schoolLoading" class="mt-4 h-40 w-full" />
        <template v-else>
          <p class="mt-3 text-sm" :class="hasOverride ? 'text-primary-700' : 'text-fg-muted'">
            {{ hasOverride ? t('settings.hasOverride') : t('settings.noOverride') }}
          </p>
          <div class="mt-2 grid gap-6" :class="$slots.preview ? 'lg:grid-cols-[1fr_22rem]' : ''">
            <div>
              <slot
                name="fields"
                scope="school"
                :values="schoolForm"
                :errors="schoolErrors"
                :flags="flags"
                :global-values="schoolGlobal"
                :set="setSchool"
                :toggle-flag="toggleFlag"
              />
              <slot name="school-extra" :school-id="schoolId" :values="schoolForm" />
            </div>
            <div v-if="$slots.preview" class="lg:sticky lg:top-20 lg:self-start">
              <slot name="preview" scope="school" :values="schoolForm" :school-id="schoolId" />
            </div>
          </div>
          <p
            v-if="schoolServerError"
            class="mt-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
            role="alert"
          >
            {{ schoolServerError }}
          </p>
          <div class="mt-4 flex flex-wrap justify-end gap-2">
            <BaseButton
              v-if="hasOverride"
              variant="secondary"
              :disabled="schoolSaving"
              @click="resetSchool"
            >
              {{ t('settings.reset') }}
            </BaseButton>
            <BaseButton
              :loading="schoolSaving"
              :disabled="!overrideChanged || schoolHasErrors"
              @click="saveSchool"
            >
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </template>
      </template>
    </section>
  </div>
</template>
