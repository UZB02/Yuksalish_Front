<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
} from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ExamImportPreview, ExamImportResult, ExamTopic, QuestionType } from '@/api/types'
import AcceptedAnswers from '@/components/exams/AcceptedAnswers.vue'
import QuestionPreview from '@/components/exams/QuestionPreview.vue'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useDirtySource } from '@/composables/useDirtyRegistry'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import {
  buildOverrides,
  changeType,
  isEdited,
  isRowImportable,
  rowErrors,
  toRowStates,
  type ImportRowState,
} from '@/utils/examImport'
import { DIFFICULTIES, QUESTION_LIMITS, QUESTION_TYPES, toggleCorrect } from '@/utils/examQuestion'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()

type Step = 'upload' | 'preview' | 'done'
const step = ref<Step>('upload')
const kind = ref<'word' | 'excel'>('word')
const file = ref<File | null>(null)
/** Import nishoni: mavzu (?topicId=). Barcha savollar shu mavzuga qo'shiladi */
const topicId = computed(() => String(route.query.topicId ?? ''))
/**
 * Blok rejimi (biriktirilgan o'qituvchi): `?blockSession=&block=`. Mavzu serverda avtomatik ("Imtihon: ‹nomi›"),
 * savollar FAOL holatda bankka va blokka qo'shiladi.
 */
const blockRef = computed(() =>
  route.query.blockSession && route.query.block
    ? { sessionId: String(route.query.blockSession), blockId: String(route.query.block) }
    : null,
)
const target = ref<ExamTopic | null>(null)
const loadingTarget = ref(true)
const uploading = ref(false)
const committing = ref(false)
/** Standart: qoralama. Belgilansa to'g'ri qatorlar darhol FAOL holatda qo'shiladi */
const importActive = ref(false)
const resultActive = ref(false)
const preview = ref<ExamImportPreview | null>(null)
const rows = ref<ImportRowState[]>([])
const result = ref<ExamImportResult | null>(null)
const openRows = ref<Set<number>>(new Set())

const ext = computed(() => (kind.value === 'word' ? '.docx' : '.xlsx'))
const rowLabel = (row: number) =>
  preview.value?.kind === 'excel'
    ? t('exams.import.rowExcel', { n: row })
    : t('exams.import.rowWord', { n: row })

const typeOptions = computed(() =>
  QUESTION_TYPES.map((v) => ({ value: v, label: t(`exams.types.${v}`) })),
)
const difficultyOptions = computed(() =>
  DIFFICULTIES.map((v) => ({ value: String(v), label: t(`exams.difficulty.${v}`) })),
)

/** Ball: 0 dan katta, maksimal QUESTION_LIMITS.maxPoints; 0,5 kabi kasr ham mumkin */
const validPoints = (n: number) => Number.isFinite(n) && n > 0 && n <= QUESTION_LIMITS.maxPoints
const parsePoints = (v: string | number) =>
  Math.round(Number(String(v).replace(',', '.')) * 100) / 100

function setPoints(r: ImportRowState, v: string | number) {
  const n = parsePoints(v)
  if (validPoints(n)) r.item.points = n
}
function setDifficulty(r: ImportRowState, v: string) {
  const n = Number(v)
  if (n === 1 || n === 2 || n === 3) r.item.difficulty = n
}

/** Barcha (chiqarib tashlanmagan) savollarga bir xil ball */
const bulkPoints = ref('')
const bulkPointsValid = computed(() => validPoints(parsePoints(bulkPoints.value)))
function applyBulkPoints() {
  if (!bulkPointsValid.value) return
  const n = parsePoints(bulkPoints.value)
  let changed = 0
  for (const r of rows.value) {
    if (r.excluded) continue
    r.item.points = n
    changed++
  }
  toast.success(t('exams.import.bulkPointsDone', { n: changed, points: n }))
}

const importable = computed(() => rows.value.filter((r) => isRowImportable(r, t)).length)
const withErrors = computed(
  () => rows.value.filter((r) => !r.excluded && rowErrors(r, t).length > 0).length,
)
const excludedCount = computed(() => rows.value.filter((r) => r.excluded).length)
const dirty = computed(() => step.value === 'preview')
useDirtySource(() => dirty.value)

async function loadTarget() {
  loadingTarget.value = true
  target.value = null
  if (blockRef.value) {
    try {
      const info = await examsApi.myBlock(blockRef.value.sessionId, blockRef.value.blockId)
      if (!info.block.locked) {
        importActive.value = true
        target.value = {
          id: '',
          name: `Imtihon: ${info.exam.title}`,
          subjectName: info.block.subjectName,
        } as unknown as ExamTopic
      }
    } catch {
      target.value = null
    } finally {
      loadingTarget.value = false
    }
    return
  }
  if (!topicId.value) {
    loadingTarget.value = false
    return
  }
  try {
    target.value = await examsApi.getTopic(topicId.value)
  } catch {
    target.value = null
  } finally {
    loadingTarget.value = false
  }
}
onMounted(() => {
  if (!needsSchool.value) void loadTarget()
})
// Maktab almashsa mavzu boshqa maktabga tegishli bo'lib qoladi: bankka qaytamiz
watch(
  () => schoolCtx.schoolId,
  () => {
    reset()
    void router.replace({ name: 'exam-questions' })
  },
)

function reset() {
  step.value = 'upload'
  file.value = null
  preview.value = null
  rows.value = []
  result.value = null
  openRows.value = new Set()
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  input.value = ''
  if (!f) return
  if (!f.name.toLowerCase().endsWith(ext.value)) {
    toast.error(t('exams.import.badExt', { ext: ext.value }))
    return
  }
  if (f.size > 5 * 1024 * 1024) {
    toast.error(t('exams.import.tooBig'))
    return
  }
  file.value = f
}

async function download() {
  try {
    await examsApi.downloadTemplate(kind.value)
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function upload() {
  if (!file.value) return
  uploading.value = true
  try {
    const p = blockRef.value
      ? await examsApi.blockImportPreview(
          blockRef.value.sessionId,
          blockRef.value.blockId,
          kind.value,
          file.value,
        )
      : await examsApi.importPreview(kind.value, file.value, topicId.value)
    preview.value = p
    rows.value = toRowStates(p.items)
    // Xatoli qatorlar ochiq turadi
    openRows.value = new Set(p.items.filter((i) => i.errors.length).map((i) => i.row))
    step.value = 'preview'
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    uploading.value = false
  }
}

function toggleOpen(row: number) {
  const s = new Set(openRows.value)
  if (s.has(row)) s.delete(row)
  else s.add(row)
  openRows.value = s
}
function excludeInvalid() {
  for (const r of rows.value) if (rowErrors(r, t).length) r.excluded = true
}
function includeAll() {
  for (const r of rows.value) r.excluded = false
}

function setType(r: ImportRowState, type: string) {
  r.item = changeType(r.item, type as QuestionType)
}
function setCorrectSingle(r: ImportRowState, id: string) {
  r.item.answer = { optionId: id }
}
function setCorrectMulti(r: ImportRowState, id: string) {
  r.item.answer = {
    ...r.item.answer,
    optionIds: toggleCorrect(r.item.answer.optionIds ?? [], id),
  }
}
function setAccepted(r: ImportRowState, list: string[]) {
  r.item.answer = { acceptedAnswers: list }
}

async function commit() {
  if (!preview.value || committing.value) return
  if (withErrors.value > 0) {
    const ok = await confirm({
      title: t('exams.import.skipTitle'),
      message: t('exams.import.skipText', { n: withErrors.value }),
      confirmText: t('exams.import.commit'),
    })
    if (!ok) return
  }
  committing.value = true
  try {
    const exclude = rows.value.filter((r) => r.excluded).map((r) => r.item.row)
    result.value = blockRef.value
      ? await examsApi.blockImportCommit(
          blockRef.value.sessionId,
          blockRef.value.blockId,
          preview.value.id,
          { exclude, overrides: buildOverrides(rows.value) },
        )
      : await examsApi.importCommit(preview.value.id, {
          exclude,
          overrides: buildOverrides(rows.value),
          status: importActive.value ? 'active' : 'draft',
        })
    resultActive.value = importActive.value
    step.value = 'done'
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    committing.value = false
  }
}

const previewOf = (r: ImportRowState) => ({
  type: r.item.type ?? ('essay' as QuestionType),
  content: r.item.content,
  options: r.item.type === 'single' || r.item.type === 'multi' ? r.item.options : [],
  points: r.item.points,
})
const backTo = computed(() =>
  blockRef.value
    ? {
        name: 'exam-my-block',
        params: { sessionId: blockRef.value.sessionId, blockId: blockRef.value.blockId },
      }
    : target.value
      ? { name: 'exam-topic', params: { topicId: target.value.id } }
      : { name: 'exam-questions' },
)
const letter = (i: number) => String.fromCharCode(65 + i)
</script>

<template>
  <header class="mb-6 flex max-w-5xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
    <RouterLink
      :to="backTo"
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('exams.editor.back') }}
    </RouterLink>
    <div class="min-w-0">
      <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl">
        {{ t('exams.import.title') }}
      </h1>
      <p class="mt-0.5 text-sm text-fg-muted" data-testid="import-target">
        <template v-if="target">{{
          t('exams.import.target', { subject: target.subjectName ?? '', topic: target.name })
        }}</template>
        <template v-else>{{ t('exams.import.description') }}</template>
      </p>
    </div>
  </header>

  <NeedsSchool v-if="needsSchool" />

  <div v-else-if="loadingTarget" class="card max-w-5xl p-5" aria-busy="true">
    <Skeleton class="h-10 w-full" />
  </div>

  <div v-else-if="!target" class="card max-w-5xl" data-testid="import-no-target">
    <EmptyState
      :title="t('exams.import.noTargetTitle')"
      :description="t('exams.import.noTargetText')"
    >
      <RouterLink :to="{ name: 'exam-questions' }">
        <BaseButton>{{ t('exams.import.toBank') }}</BaseButton>
      </RouterLink>
    </EmptyState>
  </div>

  <!-- 1-qadam: fayl tanlash -->
  <div
    v-else-if="step === 'upload'"
    class="card max-w-5xl space-y-5 p-4 sm:p-5"
    data-testid="import-upload"
  >
    <div role="tablist" class="inline-flex rounded-lg border border-border bg-surface-muted p-0.5">
      <button
        v-for="k in ['word', 'excel'] as const"
        :key="k"
        type="button"
        role="tab"
        :aria-selected="kind === k"
        class="inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium"
        :class="kind === k ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
        :data-testid="`kind-${k}`"
        @click="((kind = k), (file = null))"
      >
        <FileText v-if="k === 'word'" class="h-4 w-4" aria-hidden="true" />
        <FileSpreadsheet v-else class="h-4 w-4" aria-hidden="true" />
        {{ t(`exams.import.kinds.${k}`) }}
      </button>
    </div>

    <div class="rounded-lg bg-surface-muted p-3 text-sm text-fg-muted" data-testid="format-help">
      <p class="font-medium text-fg">{{ t('exams.import.formatTitle') }}</p>
      <ul class="mt-1 list-disc space-y-1 pl-5">
        <li v-for="n in 5" :key="n">{{ t(`exams.import.help.${kind}.${n}`) }}</li>
      </ul>
      <BaseButton
        variant="secondary"
        size="sm"
        class="mt-3"
        data-testid="download-template"
        @click="download"
      >
        <Download class="h-4 w-4" aria-hidden="true" /> {{ t('exams.import.template') }}
      </BaseButton>
    </div>

    <p class="text-xs text-fg-muted" data-testid="import-ignored-note">
      {{ t('exams.import.ignoredNote') }}
    </p>

    <div>
      <label
        class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-center hover:border-primary-600"
      >
        <Upload class="h-6 w-6 text-fg-muted" aria-hidden="true" />
        <span class="text-sm font-medium text-fg">{{
          file ? file.name : t('exams.import.choose', { ext })
        }}</span>
        <span class="text-xs text-fg-muted">{{ t('exams.import.limits') }}</span>
        <input
          type="file"
          :accept="ext"
          class="sr-only"
          data-testid="import-file"
          @change="onFile"
        />
      </label>
    </div>

    <div class="flex justify-end">
      <BaseButton
        :disabled="!file"
        :loading="uploading"
        data-testid="import-analyze"
        @click="upload"
      >
        {{ t('exams.import.analyze') }}
      </BaseButton>
    </div>
  </div>

  <!-- 2-qadam: oldindan ko'rish -->
  <div
    v-else-if="step === 'preview' && preview"
    class="max-w-5xl space-y-4 pb-28"
    data-testid="import-preview"
  >
    <div class="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <p class="text-sm text-fg">
        <span class="font-medium">{{ preview.fileName }}</span>
        ·
        {{
          t('exams.import.summary', { total: preview.stats.total, ok: importable, bad: withErrors })
        }}
      </p>
      <div class="ml-auto flex flex-wrap gap-2">
        <BaseButton
          v-if="withErrors"
          size="sm"
          variant="secondary"
          data-testid="exclude-invalid"
          @click="excludeInvalid"
        >
          {{ t('exams.import.excludeInvalid') }}
        </BaseButton>
        <BaseButton v-if="excludedCount" size="sm" variant="ghost" @click="includeAll">
          {{ t('exams.import.includeAll') }}
        </BaseButton>
        <BaseButton size="sm" variant="ghost" @click="reset">{{
          t('exams.import.another')
        }}</BaseButton>
      </div>
    </div>

    <form
      class="card flex flex-wrap items-end gap-3 p-4"
      data-testid="bulk-points"
      @submit.prevent="applyBulkPoints"
    >
      <label class="min-w-0 flex-1 sm:max-w-xs">
        <span class="mb-1.5 block text-sm font-medium text-fg">{{
          t('exams.import.bulkPoints')
        }}</span>
        <input
          v-model="bulkPoints"
          type="text"
          inputmode="decimal"
          :placeholder="t('exams.import.bulkPointsPlaceholder')"
          class="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-primary-500 focus:outline-none"
          data-testid="bulk-points-input"
        />
      </label>
      <BaseButton
        type="submit"
        variant="secondary"
        :disabled="!bulkPointsValid"
        data-testid="bulk-points-apply"
      >
        {{ t('exams.import.bulkPointsApply') }}
      </BaseButton>
      <p class="w-full text-xs text-fg-muted">
        {{ t('exams.import.bulkPointsHint', { max: QUESTION_LIMITS.maxPoints }) }}
      </p>
    </form>

    <ul v-if="preview.warnings.length" class="rounded-lg bg-warning-soft p-3 text-sm text-warning">
      <li v-for="w in preview.warnings" :key="w">{{ w }}</li>
    </ul>

    <article
      v-for="r in rows"
      :key="r.item.row"
      class="card overflow-hidden"
      :class="r.excluded ? 'opacity-60' : ''"
      data-testid="import-row"
    >
      <header class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span class="text-sm font-semibold text-fg">{{ rowLabel(r.item.row) }}</span>
        <BaseBadge v-if="r.excluded" tone="neutral">{{ t('exams.import.excluded') }}</BaseBadge>
        <BaseBadge v-else-if="rowErrors(r, t).length" tone="danger" data-testid="row-bad">
          {{ t('exams.import.hasErrors', { n: rowErrors(r, t).length }) }}
        </BaseBadge>
        <BaseBadge v-else tone="success" data-testid="row-ok">{{
          t('exams.import.ready')
        }}</BaseBadge>
        <BaseBadge v-if="r.item.warnings.length" tone="warning">
          {{ t('exams.import.hasWarnings', { n: r.item.warnings.length }) }}
        </BaseBadge>
        <BaseBadge v-if="isEdited(r)" tone="info">{{ t('exams.import.edited') }}</BaseBadge>
        <div class="ml-auto flex items-center gap-3">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input
              v-model="r.excluded"
              type="checkbox"
              class="h-4 w-4 accent-primary-600"
              data-testid="row-exclude"
            />
            {{ t('exams.import.exclude') }}
          </label>
          <button
            type="button"
            class="text-sm font-medium text-primary-700 hover:underline"
            :aria-expanded="openRows.has(r.item.row)"
            data-testid="row-toggle"
            @click="toggleOpen(r.item.row)"
          >
            {{ openRows.has(r.item.row) ? t('exams.import.hideFix') : t('exams.import.fix') }}
          </button>
        </div>
      </header>

      <div class="grid gap-4 p-4 lg:grid-cols-2">
        <QuestionPreview :question="previewOf(r)" />
        <div class="space-y-3">
          <ul v-if="rowErrors(r, t).length" class="space-y-1" data-testid="row-errors">
            <li
              v-for="(e, i) in rowErrors(r, t)"
              :key="i"
              class="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {{ e }}
            </li>
          </ul>
          <ul v-if="r.item.warnings.length" class="space-y-1" data-testid="row-warnings">
            <li
              v-for="(w, i) in r.item.warnings"
              :key="i"
              class="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              {{ w }}
            </li>
          </ul>

          <div
            v-if="openRows.has(r.item.row)"
            class="space-y-3 rounded-lg border border-border p-3"
            data-testid="row-fix"
          >
            <BaseSelect
              :model-value="r.item.type ?? ''"
              :label="t('exams.fields.type')"
              :options="typeOptions"
              :placeholder="t('exams.import.typePlaceholder')"
              data-testid="fix-type"
              @update:model-value="setType(r, $event)"
            />
            <div class="grid grid-cols-2 gap-3">
              <label>
                <span class="mb-1.5 block text-sm font-medium text-fg">{{
                  t('exams.fields.points')
                }}</span>
                <input
                  :value="r.item.points"
                  type="number"
                  min="0.5"
                  :max="QUESTION_LIMITS.maxPoints"
                  step="0.5"
                  inputmode="decimal"
                  class="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-primary-500 focus:outline-none"
                  data-testid="fix-points"
                  @change="setPoints(r, ($event.target as HTMLInputElement).value)"
                />
              </label>
              <BaseSelect
                :model-value="String(r.item.difficulty)"
                :label="t('exams.fields.difficulty')"
                :options="difficultyOptions"
                data-testid="fix-difficulty"
                @update:model-value="setDifficulty(r, $event)"
              />
            </div>
            <div v-if="r.item.type === 'single' || r.item.type === 'multi'">
              <p class="mb-1.5 text-sm font-medium text-fg">{{ t('exams.import.correct') }}</p>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="(o, i) in r.item.options"
                  :key="o.id"
                  class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm"
                >
                  <input
                    v-if="r.item.type === 'single'"
                    type="radio"
                    :name="`fix-correct-${r.item.row}`"
                    :checked="r.item.answer.optionId === o.id"
                    class="accent-primary-600"
                    data-testid="fix-correct"
                    @change="setCorrectSingle(r, o.id)"
                  />
                  <input
                    v-else
                    type="checkbox"
                    :checked="(r.item.answer.optionIds ?? []).includes(o.id)"
                    class="accent-primary-600"
                    data-testid="fix-correct"
                    @change="setCorrectMulti(r, o.id)"
                  />
                  {{ letter(i) }}
                </label>
              </div>
            </div>
            <AcceptedAnswers
              v-else-if="r.item.type === 'short'"
              :model-value="r.item.answer.acceptedAnswers ?? []"
              @update:model-value="setAccepted(r, $event)"
            />
          </div>
        </div>
      </div>
    </article>

    <div
      class="fixed inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6 lg:left-64"
      data-testid="import-actions"
    >
      <p class="mr-auto text-sm text-fg-muted">
        {{
          t(importActive ? 'exams.import.willImportActive' : 'exams.import.willImport', {
            n: importable,
          })
        }}
      </p>
      <BaseCheckbox
        v-if="!blockRef"
        v-model="importActive"
        :label="t('exams.import.importActive')"
        data-testid="import-active"
      />
      <BaseButton variant="secondary" @click="reset">{{ t('common.cancel') }}</BaseButton>
      <BaseButton
        :disabled="importable === 0"
        :loading="committing"
        data-testid="import-commit"
        @click="commit"
      >
        {{ t('exams.import.commit') }}
      </BaseButton>
    </div>
  </div>

  <!-- 3-qadam: natija -->
  <div
    v-else-if="step === 'done' && result"
    class="card max-w-3xl space-y-4 p-5"
    data-testid="import-done"
  >
    <div class="flex items-center gap-3">
      <CheckCircle2 class="h-8 w-8 text-success" aria-hidden="true" />
      <div>
        <h2 class="text-lg font-semibold text-fg">{{ t('exams.import.doneTitle') }}</h2>
        <p class="text-sm text-fg-muted" data-testid="done-summary">
          {{
            t('exams.import.doneText', {
              created: result.created,
              failed: result.failed.length,
              excluded: result.excluded,
            })
          }}
        </p>
      </div>
    </div>
    <p class="text-sm text-fg-muted" data-testid="done-note">
      {{ t(resultActive ? 'exams.import.activeNote' : 'exams.import.draftNote') }}
    </p>
    <ul v-if="result.failed.length" class="space-y-1" data-testid="done-failed">
      <li
        v-for="f in result.failed"
        :key="f.row"
        class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
      >
        <span class="font-medium">{{ rowLabel(f.row) }}:</span> {{ f.errors.join('; ') }}
      </li>
    </ul>
    <div class="flex flex-wrap gap-2">
      <BaseButton data-testid="to-bank" @click="router.push(backTo)">
        {{ t('exams.import.toBank') }}
      </BaseButton>
      <BaseButton variant="secondary" @click="reset">{{ t('exams.import.another') }}</BaseButton>
    </div>
  </div>
</template>
