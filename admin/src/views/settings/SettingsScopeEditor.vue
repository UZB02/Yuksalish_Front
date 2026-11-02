<script setup lang="ts" generic="T extends object">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { settingsApi, type SettingsKind } from '@/api/settings.api'
import type { SettingsResponse } from '@/api/types'
import { Building2 } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useDirtySource } from '@/composables/useDirtyRegistry'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { applyServerErrors, errorMessage } from '@/utils/errors'
import SettingsCard from './SettingsCard.vue'
import SettingsSaveBar from './SettingsSaveBar.vue'
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
const auth = useAuthStore()

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
// Server `details[].path` xatolari (masalan values.morningTime) maydonga bog'lanadi
const globalFieldErrors = ref<Record<string, string>>({})
const globalErrors = computed(() => ({
  ...props.validate(globalForm.value),
  ...globalFieldErrors.value,
}))
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
  globalFieldErrors.value = {}
  try {
    const res = (await settingsApi.save(props.kind as 'scoring', {
      scope: 'global',
      values: values as never,
    })) as unknown as SettingsResponse<T>
    applyGlobal(res)
    return true
  } catch (e) {
    // Maktab override'lari bilan ziddiyat (400) - server xabari formada ko'rsatiladi.
    if (applyServerErrors(e, (m) => (globalFieldErrors.value = m), props.keys)) return false
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
  if (key in globalFieldErrors.value) {
    const { [key]: _drop, ...rest } = globalFieldErrors.value
    globalFieldErrors.value = rest
  }
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
const schoolFieldErrors = ref<Record<string, string>>({})
const schoolErrors = computed(() => ({
  ...props.validate(schoolForm.value),
  ...schoolFieldErrors.value,
}))
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
  schoolFieldErrors.value = {}
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
  if (key in schoolFieldErrors.value) {
    const { [key]: _drop, ...rest } = schoolFieldErrors.value
    schoolFieldErrors.value = rest
  }
  schoolForm.value = { ...schoolForm.value, [key]: value }
}

async function persistSchool(values: Partial<T> | null) {
  schoolSaving.value = true
  schoolServerError.value = ''
  schoolFieldErrors.value = {}
  try {
    await settingsApi.save(props.kind as 'scoring', {
      scope: 'school',
      ...(props.ownSchool ? {} : { schoolId: schoolId.value }),
      values: values ? (omitKeys(values, props.globalOnlyKeys ?? []) as never) : null,
    })
    await loadSchool()
    return true
  } catch (e) {
    if (applyServerErrors(e, (m) => (schoolFieldErrors.value = m), props.keys)) return false
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

// ---- Qamrov (scope) almashtirgich va saqlanmagan o'zgarishlar ----
const scope = ref<'global' | 'school'>(props.ownSchool ? 'school' : 'global')
const selectKey = ref(0)
const ownSchoolName = computed(
  () =>
    schoolCtx.schools.find((s) => s.id === auth.user?.schoolId)?.name ?? t('settings.ownSchool'),
)
const dirty = computed(() =>
  scope.value === 'global'
    ? globalChanged.value.length > 0
    : !!schoolId.value && !schoolLoading.value && overrideChanged.value,
)
const canSave = computed(() =>
  scope.value === 'global' ? Object.keys(globalErrors.value).length === 0 : !schoolHasErrors.value,
)
const saving = computed(() => (scope.value === 'global' ? globalSaving.value : schoolSaving.value))
useDirtySource(() => dirty.value)

function discard() {
  if (scope.value === 'global') {
    globalForm.value = { ...globalSaved.value }
    globalFieldErrors.value = {}
    globalServerError.value = ''
  } else void loadSchool()
}
function save() {
  return scope.value === 'global' ? saveGlobal() : saveSchool()
}

/** Saqlanmagan o'zgarish bo'lsa, davom etishdan oldin tasdiq so'raydi (rad etilsa false) */
async function confirmLeave() {
  if (!dirty.value) return true
  const ok = await confirm({
    title: t('settings.leave.title'),
    message: t('settings.leave.text'),
    confirmText: t('settings.leave.confirm'),
    variant: 'danger',
  })
  if (ok) discard()
  return ok
}
async function setScope(next: 'global' | 'school') {
  if (next === scope.value || props.ownSchool) return
  if (!(await confirmLeave())) return
  scope.value = next
  if (next === 'school' && !schoolId.value) schoolId.value = schoolCtx.schoolId ?? ''
}
async function pickSchool(id: string) {
  if (id === schoolId.value) return
  if (!(await confirmLeave())) {
    selectKey.value++
    return
  }
  schoolId.value = id
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
  <div v-if="loading" class="card divide-y divide-border px-5" aria-busy="true">
    <div v-for="n in 5" :key="n" class="flex items-center justify-between gap-6 py-4">
      <div class="w-1/2 space-y-2">
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="h-3 w-full" />
      </div>
      <Skeleton class="h-9 w-48" />
    </div>
  </div>
  <div v-else-if="loadError" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="loadError">
      <BaseButton variant="secondary" @click="loadGlobal">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else class="space-y-4 pb-24" data-testid="scope-editor">
    <!-- Qamrov paneli -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="scope-bar">
      <template v-if="!ownSchool">
        <div
          role="group"
          :aria-label="t('settings.scope.label')"
          class="inline-flex rounded-lg border border-border bg-surface-muted p-0.5"
        >
          <button
            v-for="s in ['global', 'school'] as const"
            :key="s"
            type="button"
            :aria-pressed="scope === s"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
            :class="scope === s ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'"
            :data-testid="`scope-${s}`"
            @click="setScope(s)"
          >
            {{ t(`settings.scope.${s}`) }}
            <span v-if="s === 'global'" class="hidden font-normal text-fg-muted sm:inline">
              {{ t('settings.scope.globalHint') }}
            </span>
          </button>
        </div>
        <BaseSelect
          v-if="scope === 'school'"
          :key="selectKey"
          :model-value="schoolId"
          class="w-full sm:w-64"
          :aria-label="t('settings.school')"
          :placeholder="t('settings.selectSchool')"
          :options="schoolOptions"
          @update:model-value="pickSchool"
        />
      </template>
      <span
        v-else
        class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm font-medium text-fg"
        data-testid="own-school-badge"
      >
        <Building2 class="h-4 w-4 text-fg-muted" aria-hidden="true" />
        {{ t('settings.scope.schoolOf', { name: ownSchoolName }) }}
      </span>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <BaseButton
          v-if="scope === 'global'"
          variant="ghost"
          :disabled="globalSaving"
          @click="resetGlobal"
        >
          {{ t('settings.defaults') }}
        </BaseButton>
        <BaseButton
          v-else-if="schoolId && !schoolLoading && hasOverride"
          variant="secondary"
          :disabled="schoolSaving"
          @click="resetSchool"
        >
          {{ t('settings.reset') }}
        </BaseButton>
      </div>
    </div>

    <!-- Global -->
    <template v-if="scope === 'global'">
      <p
        v-if="globalServerError"
        class="rounded-lg bg-danger-soft p-3 text-sm text-danger"
        role="alert"
      >
        {{ globalServerError }}
      </p>
      <SettingsCard>
        <slot
          name="fields"
          scope="global"
          :values="globalForm"
          :errors="globalErrors"
          :set="setGlobal"
          :toggle-flag="() => undefined"
        />
      </SettingsCard>
      <slot name="global-extra" :values="globalForm" :set="setGlobal" />
      <div v-if="$slots.preview">
        <slot name="preview" scope="global" :values="globalForm" />
      </div>
    </template>

    <!-- Maktab -->
    <template v-else>
      <p v-if="!schoolId" class="card p-5 text-sm text-fg-muted">
        {{ t('settings.selectSchool') }}
      </p>
      <template v-else>
        <div v-if="schoolLoading" class="card divide-y divide-border px-5" aria-busy="true">
          <div v-for="n in 4" :key="n" class="flex items-center justify-between gap-6 py-4">
            <Skeleton class="h-4 w-1/3" />
            <Skeleton class="h-9 w-48" />
          </div>
        </div>
        <template v-else>
          <p class="text-xs" :class="hasOverride ? 'text-primary-700' : 'text-fg-muted'">
            {{ hasOverride ? t('settings.hasOverride') : t('settings.noOverride') }}
          </p>
          <p
            v-if="schoolServerError"
            class="rounded-lg bg-danger-soft p-3 text-sm text-danger"
            role="alert"
          >
            {{ schoolServerError }}
          </p>
          <SettingsCard>
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
          </SettingsCard>
          <slot name="school-extra" :school-id="schoolId" :values="schoolForm" />
          <div v-if="$slots.preview">
            <slot name="preview" scope="school" :values="schoolForm" :school-id="schoolId" />
          </div>
        </template>
      </template>
    </template>

    <SettingsSaveBar
      :dirty="dirty"
      :saving="saving"
      :can-save="canSave"
      @discard="discard"
      @save="save"
    />
  </div>
</template>
