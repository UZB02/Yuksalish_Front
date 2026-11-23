<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  FileText,
  Lock,
  Pencil,
  PenLine,
  ScanText,
  TypeOutline,
} from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import type {
  MyBlockDetail,
  PasteCommitResult,
  Question,
  QuestionDifficulty,
  QuestionType,
} from '@/api/types'
import AcceptedAnswers from '@/components/exams/AcceptedAnswers.vue'
import BlockEditor from '@/components/exams/BlockEditor.vue'
import OptionsEditor from '@/components/exams/OptionsEditor.vue'
import PasteQuestions from '@/components/exams/PasteQuestions.vue'

/** OCR: faqat "Rasm / PDF" usuli tanlanganda yuklanadi */
const OcrQuestions = defineAsyncComponent(() => import('@/components/exams/OcrQuestions.vue'))
import SharingControl from '@/components/exams/SharingControl.vue'
import QuestionPreview from '@/components/exams/QuestionPreview.vue'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useDirtySource } from '@/composables/useDirtyRegistry'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import {
  DIFFICULTIES,
  QUESTION_LIMITS,
  QUESTION_TYPES,
  defaultForm,
  formFromQuestion,
  removeOption,
  toPayload,
  validateForm,
  type QuestionForm,
} from '@/utils/examQuestion'

/** Ikki marshrut uchun bitta sahifa: `exam-question-create` va `exam-question-edit` */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const schoolCtx = useSchoolContextStore()

const questionId = computed(() =>
  route.name === 'exam-question-edit' ? String(route.params.id) : null,
)
/**
 * Blok rejimi (biriktirilgan o'qituvchi): `?blockSession=<imtihon>&block=<blok>`. Fan/mavzu/holat/ulashish
 * ko'rsatilmaydi: savol server tomonida blok fanidagi "Imtihon: ‹nomi›" mavzusiga FAOL va yopiq holda saqlanadi.
 */
const blockRef = computed(() =>
  !questionId.value && route.query.blockSession && route.query.block
    ? { sessionId: String(route.query.blockSession), blockId: String(route.query.block) }
    : null,
)
const blockMode = computed(() => !!blockRef.value)
const isCreate = computed(() => !questionId.value && !blockMode.value)
const blockInfo = ref<MyBlockDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const question = ref<Question | null>(null)
const subjects = ref<{ value: string; label: string }[]>([])
const form = ref<QuestionForm>(defaultForm())
const initialJson = ref('')
const showErrors = ref(false)
const saving = ref(false)
const serverErrors = ref<Record<string, string>>({})
/** Mobil: "Tahrirlash" yoki "Ko'rinish" tabi (keng ekranda ikkalasi ham yonma-yon) */
const tab = ref<'edit' | 'preview'>('edit')
const skipLeaveGuard = ref(false)
/** Yangi savol usullari: Matnni joylash (standart), Bittalab, Word, Excel. Tahrirlash va blok rejimida faqat forma */
type Method = 'paste' | 'ocr' | 'single' | 'word' | 'excel'
const METHODS: { key: Method; icon: typeof FileText }[] = [
  { key: 'paste', icon: TypeOutline },
  { key: 'ocr', icon: ScanText },
  { key: 'single', icon: PenLine },
  { key: 'word', icon: FileText },
  { key: 'excel', icon: FileSpreadsheet },
]
const method = ref<Method>('paste')
/** Fan · Mavzu ixcham sarlavhasi va "o'zgartirish" paneli */
const ctxOpen = ref(false)
const pastedTotal = ref(0)

/** Faqat o'qish: boshqa muallifning savoli (javob kaliti kelmagan) */
const readOnly = computed(() => !!question.value && !question.value.canEdit)
const archived = computed(() => question.value?.status === 'archived')
const showContext = computed(
  () => !blockMode.value && !readOnly.value && !loading.value && !loadError.value,
)
const dirty = computed(
  () =>
    !readOnly.value && !skipLeaveGuard.value && JSON.stringify(form.value) !== initialJson.value,
)
const errors = computed(() => ({
  ...(showErrors.value ? validateForm(form.value, t) : {}),
  ...serverErrors.value,
}))

/** Orqaga: savol mavzusi sahifasi (mavzu ma'lum bo'lsa), aks holda bank */
const backTarget = computed(() => {
  if (blockRef.value) {
    return {
      name: 'exam-my-block',
      params: { sessionId: blockRef.value.sessionId, blockId: blockRef.value.blockId },
    }
  }
  const id = form.value.topicId || String(route.query.topicId ?? '')
  return id ? { name: 'exam-topic', params: { topicId: id } } : { name: 'exam-questions' }
})
const subjectOptions = computed(() => subjects.value)
/** Tanlangan fan mavzulari (mavzu tanlash va tez yaratish uchun) */
const topics = ref<{ value: string; label: string }[]>([])
const newTopic = ref('')
const creatingTopic = ref(false)
const topicOptions = computed(() => topics.value)
const ctxText = computed(() => {
  const subj = subjects.value.find((x) => x.value === form.value.subjectId)?.label
  const topic = topics.value.find((x) => x.value === form.value.topicId)?.label
  return [subj, topic].filter(Boolean).join(' · ')
})

async function loadTopics(subjectId: string) {
  topics.value = []
  if (!subjectId) return
  try {
    const r = await examsApi.listTopics(subjectId)
    topics.value = r.topics.map((x) => ({ value: x.id, label: x.name }))
  } catch {
    topics.value = []
  }
}

/** Fan almashsa mavzu tanlovi tozalanadi va yangi fan mavzulari yuklanadi */
async function setSubject(id: string) {
  if (id === form.value.subjectId) return
  form.value = { ...form.value, subjectId: id, topicId: '' }
  delete serverErrors.value.topicId
  await loadTopics(id)
}

async function quickCreateTopic() {
  const name = newTopic.value.trim()
  if (!name || !form.value.subjectId || creatingTopic.value) return
  creatingTopic.value = true
  try {
    const created = await examsApi.createTopic(form.value.subjectId, { name })
    topics.value = [...topics.value, { value: created.id, label: created.name }]
    set('topicId', created.id)
    newTopic.value = ''
    toast.success(t('exams.topics.toast.created'))
  } catch (e) {
    toast.error(
      isApiError(e) && e.code === 'CONFLICT'
        ? t('exams.topics.errors.duplicate')
        : errorMessage(e, t),
    )
  } finally {
    creatingTopic.value = false
  }
}
const needsOptions = computed(() => form.value.type === 'single' || form.value.type === 'multi')
const optionsType = computed(() => (form.value.type === 'multi' ? 'multi' : 'single'))
const statusOptions = computed(() => [
  { value: 'draft', label: t('exams.status.draft') },
  { value: 'active', label: t('exams.status.active') },
])

/** Ko'rinish (preview) uchun: javob kalitisiz */
const previewQuestion = computed(() => ({
  type: form.value.type,
  content: form.value.content,
  options: needsOptions.value ? form.value.options : [],
  points: form.value.points,
}))

function snapshot() {
  initialJson.value = JSON.stringify(form.value)
}

async function load() {
  loading.value = true
  loadError.value = ''
  question.value = null
  if (needsSchool.value) {
    loading.value = false
    return
  }
  try {
    if (blockRef.value) {
      const info = await examsApi.myBlock(blockRef.value.sessionId, blockRef.value.blockId)
      if (info.block.locked) {
        loadError.value = t('examBlocks.myBlock.locked')
        return
      }
      blockInfo.value = info
      // Mavzu serverda avtomatik: formadagi qiymat faqat tekshiruvdan o'tish uchun (yuborilmaydi)
      form.value = { ...defaultForm(info.block.subjectId ?? '', 'auto'), status: 'active' }
      snapshot()
      return
    }
    const presetTopicId = String(route.query.topicId ?? '')
    const [subj, q, preset] = await Promise.all([
      examsApi.subjects(),
      questionId.value ? examsApi.getQuestion(questionId.value) : Promise.resolve(null),
      !questionId.value && presetTopicId
        ? examsApi.getTopic(presetTopicId).catch(() => null)
        : Promise.resolve(null),
    ])
    subjects.value = subj.subjects.map((s) => ({ value: s.id, label: s.name }))
    question.value = q
    form.value = q
      ? formFromQuestion(q)
      : preset
        ? defaultForm(preset.subjectId, preset.id)
        : defaultForm(subj.subjects.length === 1 ? subj.subjects[0]!.id : '')
    await loadTopics(form.value.subjectId)
    ctxOpen.value = !questionId.value && !form.value.topicId
    snapshot()
  } catch (e) {
    loadError.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}

function setType(type: QuestionType) {
  if (type === form.value.type) return
  const next: QuestionForm = { ...form.value, type }
  if ((type === 'single' || type === 'multi') && next.options.length < 2) {
    const base = defaultForm()
    next.options = base.options
  }
  form.value = next
  delete serverErrors.value.answer
}

const set = <K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) => {
  form.value = { ...form.value, [key]: value }
  if (key in serverErrors.value) delete serverErrors.value[key as string]
}

const setStatus = (v: string) => set('status', v === 'active' ? 'active' : 'draft')

/** "Saqlash va yana qo'shish": mavzu, tur, qiyinlik, ball, holat va ulashish saqlanadi; matn va variantlar tozalanadi */
function resetForNext(saved: QuestionForm) {
  const keep = { ...defaultForm(saved.subjectId, saved.topicId) }
  form.value = {
    ...keep,
    type: saved.type,
    difficulty: saved.difficulty,
    points: saved.points,
    status: saved.status,
    sharing: saved.sharing,
    partialCredit: saved.partialCredit,
  }
  // Tur variantsiz bo'lsa ham bo'sh variantlar defaultForm dan keladi (setType ularni kerak bo'lganda tiklaydi)
  showErrors.value = false
  serverErrors.value = {}
  tab.value = 'edit'
  snapshot()
}

async function save(addAnother = false) {
  showErrors.value = true
  serverErrors.value = {}
  const local = validateForm(form.value, t)
  if (Object.keys(local).length) {
    tab.value = 'edit'
    if (local.subjectId || local.topicId) ctxOpen.value = true
    return
  }
  saving.value = true
  try {
    const payload = toPayload(form.value)
    const entered = form.value
    if (blockRef.value) {
      const {
        topicId: _t,
        subjectId: _s,
        status: _st,
        sharing: _sh,
        ...rest
      } = payload as unknown as Record<string, unknown>
      void [_t, _s, _st, _sh]
      await examsApi.createInBlock(blockRef.value.sessionId, blockRef.value.blockId, rest)
      toast.success(t('exams.toast.created'))
      if (addAnother) {
        resetForNext(entered)
        return
      }
      skipLeaveGuard.value = true
      await router.push(backTarget.value)
      return
    }
    const saved = questionId.value
      ? await examsApi.updateQuestion(questionId.value, payload)
      : await examsApi.createQuestion(payload)
    toast.success(t(questionId.value ? 'exams.toast.updated' : 'exams.toast.created'))
    const wasNew = !questionId.value
    if (wasNew && addAnother) {
      resetForNext(entered)
      return
    }
    question.value = saved
    form.value = formFromQuestion(saved)
    snapshot()
    // Yangi savol saqlangach tahrirlash manziliga o'tamiz (forma allaqachon joyida)
    if (wasNew) await router.replace({ name: 'exam-question-edit', params: { id: saved.id } })
  } catch (e) {
    if (isApiError(e) && e.details.length) {
      // Server xatolarini maydonlarga bog'laymiz (content.0.text -> content, answer.optionId -> answer)
      const map: Record<string, string> = {}
      for (const d of e.details) {
        const key = d.path.split('.')[0] ?? ''
        if (key && !map[key]) map[key] = d.message
      }
      serverErrors.value = map
    }
    toast.error(errorMessage(e, t))
  } finally {
    saving.value = false
  }
}

/** Ulashilgan (faqat o'qish) savoldan o'z qoralamangizga nusxa olish */
const duplicating = ref(false)
async function duplicateShared() {
  if (!questionId.value) return
  duplicating.value = true
  try {
    const copy = await examsApi.duplicateQuestion(questionId.value)
    toast.success(t('exams.toast.duplicated'))
    await router.push({ name: 'exam-question-edit', params: { id: copy.id } })
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    duplicating.value = false
  }
}

function onPasted(r: PasteCommitResult) {
  pastedTotal.value += r.created
}
/** Word/Excel: mavjud import oqimi, mavzu oldindan tanlangan */
function goImport(kind: 'word' | 'excel') {
  if (!form.value.topicId) return
  void router.push({ name: 'exam-question-import', query: { topicId: form.value.topicId, kind } })
}

async function backToList() {
  await router.push(backTarget.value)
}

useDirtySource(() => dirty.value)
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return confirm({
    title: t('scoring.unsaved.title'),
    message: t('exams.editor.unsavedText'),
    confirmText: t('scoring.unsaved.leave'),
    variant: 'danger',
  })
})
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void load()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
// Maktab almashsa savol boshqa maktabga tegishli bo'lib qoladi: ro'yxatga qaytamiz
watch(
  () => schoolCtx.schoolId,
  () => {
    skipLeaveGuard.value = true
    void router.replace({ name: 'exam-questions' })
  },
)
// Bir sahifadan boshqa savolga o'tilganda (masalan, saqlangandan keyin) qayta yuklanadi
watch(questionId, (id, prev) => {
  if (id && prev === null) return // yangi savol saqlandi: forma allaqachon joyida
  void load()
})
</script>

<template>
  <header class="mb-4 flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
    <RouterLink
      :to="backTarget"
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg text-sm text-fg-muted transition-colors hover:text-fg lg:self-auto lg:border lg:border-border lg:px-3 lg:py-2 lg:hover:bg-surface-muted"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> {{ t('exams.editor.back') }}
    </RouterLink>
    <div v-if="!needsSchool && !loadError" class="min-w-0">
      <h1 class="truncate text-xl font-semibold text-fg sm:text-2xl">
        {{
          readOnly
            ? t('exams.editor.viewTitle')
            : questionId
              ? t('exams.editor.editTitle')
              : t('exams.editor.createTitle')
        }}
      </h1>
      <p v-if="question" class="mt-0.5 text-xs text-fg-muted">
        {{ t('exams.editor.versionInfo', { n: question.version }) }}
      </p>
      <p
        v-if="showContext"
        class="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted"
        data-testid="ctx-line"
      >
        <span class="min-w-0 truncate font-medium text-fg" data-testid="ctx-text">
          {{ ctxText || t('exams.editor.noTopic') }}
        </span>
        <button
          type="button"
          class="inline-flex items-center gap-0.5 text-primary-700 hover:underline"
          :aria-expanded="ctxOpen"
          data-testid="ctx-change"
          @click="ctxOpen = !ctxOpen"
        >
          {{ t('exams.editor.change') }}
          <ChevronDown class="h-3.5 w-3.5" :class="ctxOpen && 'rotate-180'" aria-hidden="true" />
        </button>
      </p>
    </div>
  </header>

  <NeedsSchool v-if="needsSchool" />

  <div v-else-if="loading" class="max-w-6xl space-y-4" data-testid="editor-skeleton">
    <Skeleton class="h-10 w-full" />
    <Skeleton class="h-64 w-full" />
  </div>

  <div v-else-if="loadError" class="card max-w-6xl">
    <EmptyState :title="t('errors.loadFailed')" :description="loadError">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <div v-else class="max-w-6xl pb-24 lg:pb-0">
    <p
      v-if="subjectOptions.length === 0 && !blockMode"
      class="mb-4 rounded-lg bg-warning-soft p-3 text-sm text-warning"
      data-testid="no-subjects"
    >
      {{ t('exams.editor.noSubjects') }}
    </p>

    <!-- Fan va mavzu: ixcham sarlavhadagi "o'zgartirish" bilan ochiladi; yangi mavzu ham shu yerda -->
    <section v-if="showContext && ctxOpen" class="card mb-4 space-y-3 p-4" data-testid="ctx-panel">
      <div class="grid gap-3 sm:grid-cols-2">
        <BaseSelect
          :model-value="form.subjectId"
          :label="t('exams.fields.subject')"
          :options="subjectOptions"
          :placeholder="t('exams.fields.subjectPlaceholder')"
          :error="errors.subjectId"
          required
          data-testid="field-subject"
          @update:model-value="setSubject"
        />
        <BaseSelect
          :model-value="form.topicId"
          :label="t('exams.fields.topic')"
          :options="topicOptions"
          :placeholder="t('exams.fields.topicPlaceholder')"
          :disabled="!form.subjectId"
          :error="errors.topicId"
          required
          data-testid="field-topic"
          @update:model-value="set('topicId', $event)"
        />
      </div>
      <div v-if="form.subjectId" class="flex flex-col gap-2 sm:flex-row" data-testid="quick-topic">
        <input
          v-model="newTopic"
          type="text"
          maxlength="150"
          :placeholder="t('exams.topics.quickPlaceholder')"
          :aria-label="t('exams.topics.quickPlaceholder')"
          class="block h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          data-testid="quick-topic-input"
          @keydown.enter.prevent="quickCreateTopic"
        />
        <BaseButton
          variant="secondary"
          :disabled="!newTopic.trim()"
          :loading="creatingTopic"
          data-testid="quick-topic-add"
          @click="quickCreateTopic"
        >
          {{ t('exams.topics.quickAdd') }}
        </BaseButton>
      </div>
      <div class="flex justify-end">
        <BaseButton size="sm" variant="secondary" data-testid="ctx-done" @click="ctxOpen = false">
          {{ t('exams.editor.ctxDone') }}
        </BaseButton>
      </div>
    </section>

    <!-- Usullar: Matnni joylash (standart), Bittalab, Word, Excel -->
    <div
      v-if="isCreate && !readOnly"
      role="tablist"
      class="mb-4 grid grid-cols-5 gap-1 rounded-lg border border-border bg-surface-muted p-0.5 sm:inline-grid"
      data-testid="method-tabs"
    >
      <button
        v-for="m in METHODS"
        :key="m.key"
        type="button"
        role="tab"
        :aria-selected="method === m.key"
        class="inline-flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-center text-xs font-medium sm:px-3 sm:text-sm"
        :class="method === m.key ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'"
        :data-testid="`method-${m.key}`"
        @click="method = m.key"
      >
        <component :is="m.icon" class="hidden h-4 w-4 sm:block" aria-hidden="true" />
        {{ t(`exams.editor.methods.${m.key}`) }}
      </button>
    </div>

    <div v-if="isCreate && method === 'paste'" class="card p-4" data-testid="method-panel-paste">
      <p
        v-if="!form.topicId"
        class="rounded-lg bg-warning-soft p-3 text-sm text-warning"
        data-testid="paste-need-topic"
      >
        {{ t('exams.editor.needTopic') }}
      </p>
      <PasteQuestions
        v-else
        :key="form.topicId"
        mode="bank"
        :topic-id="form.topicId"
        @committed="onPasted"
      />
      <p v-if="pastedTotal > 0" class="mt-3 text-sm text-fg-muted" data-testid="paste-done">
        {{ t('exams.editor.pastedTotal', { n: pastedTotal }) }}
        <RouterLink
          :to="{ name: 'exam-topic', params: { topicId: form.topicId } }"
          class="ml-1 font-medium text-primary-700 hover:underline"
          data-testid="paste-to-topic"
        >
          {{ t('exams.editor.openTopic') }}
        </RouterLink>
      </p>
    </div>

    <div v-else-if="isCreate && method === 'ocr'" class="card p-4" data-testid="method-panel-ocr">
      <p
        v-if="!form.topicId"
        class="rounded-lg bg-warning-soft p-3 text-sm text-warning"
        data-testid="ocr-need-topic"
      >
        {{ t('exams.editor.needTopic') }}
      </p>
      <OcrQuestions
        v-else
        :key="form.topicId"
        mode="bank"
        :topic-id="form.topicId"
        @committed="onPasted"
      />
      <p v-if="pastedTotal > 0" class="mt-3 text-sm text-fg-muted" data-testid="ocr-done">
        {{ t('exams.editor.pastedTotal', { n: pastedTotal }) }}
      </p>
    </div>

    <div
      v-else-if="isCreate && (method === 'word' || method === 'excel')"
      class="card space-y-3 p-4"
      :data-testid="`method-panel-${method}`"
    >
      <p class="text-sm text-fg-muted">{{ t(`exams.editor.methodHelp.${method}`) }}</p>
      <p v-if="!form.topicId" class="text-sm text-warning" data-testid="import-need-topic">
        {{ t('exams.editor.needTopic') }}
      </p>
      <BaseButton
        variant="secondary"
        :disabled="!form.topicId"
        :data-testid="`go-import-${method}`"
        @click="goImport(method)"
      >
        <FileText v-if="method === 'word'" class="h-4 w-4" aria-hidden="true" />
        <FileSpreadsheet v-else class="h-4 w-4" aria-hidden="true" />
        {{ t(method === 'word' ? 'examTasks.chooseWord' : 'examTasks.chooseExcel') }}
      </BaseButton>
    </div>

    <template v-else>
      <!-- Mobil tablar -->
      <div
        v-if="!readOnly"
        role="tablist"
        class="mb-4 inline-flex rounded-lg border border-border bg-surface-muted p-0.5 lg:hidden"
        data-testid="editor-tabs"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'edit'"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          :class="tab === 'edit' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
          data-testid="tab-edit"
          @click="tab = 'edit'"
        >
          <Pencil class="h-4 w-4" aria-hidden="true" /> {{ t('exams.editor.tabEdit') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'preview'"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          :class="tab === 'preview' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
          data-testid="tab-preview"
          @click="tab = 'preview'"
        >
          <Eye class="h-4 w-4" aria-hidden="true" /> {{ t('exams.editor.tabPreview') }}
        </button>
      </div>

      <p
        v-if="readOnly"
        class="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg-muted"
        data-testid="readonly-note"
      >
        <Lock class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span class="flex-1">{{
          t('exams.editor.readOnly', { name: question?.authorName ?? '' })
        }}</span>
        <BaseButton
          size="sm"
          variant="secondary"
          :loading="duplicating"
          data-testid="duplicate-shared"
          @click="duplicateShared"
        >
          {{ t('exams.actions.duplicate') }}
        </BaseButton>
      </p>
      <p
        v-if="archived && !readOnly"
        class="mb-4 rounded-lg bg-warning-soft p-3 text-sm text-warning"
        data-testid="archived-note"
      >
        {{ t('exams.editor.archivedNote') }}
      </p>

      <div
        class="grid gap-4"
        :class="readOnly ? '' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]'"
      >
        <!-- Tahrirlash -->
        <form
          v-if="!readOnly"
          class="space-y-4"
          :class="tab === 'preview' ? 'hidden lg:block' : ''"
          novalidate
          data-testid="question-form"
          @submit.prevent="save(false)"
        >
          <section class="card space-y-3 p-4">
            <p
              v-if="blockMode && blockInfo"
              class="rounded-lg bg-surface-muted p-3 text-sm text-fg"
              data-testid="block-mode-note"
            >
              {{
                t('examBlocks.myBlock.newInBlock', {
                  subject: blockInfo.block.subjectName ?? '',
                  exam: blockInfo.exam.title,
                })
              }}
            </p>

            <!-- Tur, qiyinlik, ball va holat: bitta qatorda -->
            <div class="flex flex-wrap items-end gap-x-5 gap-y-3" data-testid="meta-row">
              <div>
                <p class="mb-1 text-xs font-medium text-fg-muted">{{ t('exams.fields.type') }}</p>
                <div
                  role="radiogroup"
                  :aria-label="t('exams.fields.type')"
                  class="flex flex-wrap gap-1"
                >
                  <button
                    v-for="ty in QUESTION_TYPES"
                    :key="ty"
                    type="button"
                    role="radio"
                    :aria-checked="form.type === ty"
                    class="rounded-lg border px-2.5 py-1 text-sm transition-colors"
                    :class="
                      form.type === ty
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-border text-fg-muted hover:bg-surface-muted'
                    "
                    data-testid="type-option"
                    @click="setType(ty)"
                  >
                    {{ t(`exams.types.${ty}`) }}
                  </button>
                </div>
              </div>
              <div>
                <p class="mb-1 text-xs font-medium text-fg-muted">
                  {{ t('exams.fields.difficulty') }}
                </p>
                <div
                  role="radiogroup"
                  :aria-label="t('exams.fields.difficulty')"
                  class="flex gap-1"
                >
                  <button
                    v-for="d in DIFFICULTIES"
                    :key="d"
                    type="button"
                    role="radio"
                    :aria-checked="form.difficulty === d"
                    class="rounded-lg border px-2.5 py-1 text-sm transition-colors"
                    :class="
                      form.difficulty === d
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-border text-fg-muted hover:bg-surface-muted'
                    "
                    data-testid="difficulty-option"
                    @click="set('difficulty', d as QuestionDifficulty)"
                  >
                    {{ t(`exams.difficulty.${d}`) }}
                  </button>
                </div>
              </div>
              <BaseInput
                :model-value="form.points"
                type="number"
                inputmode="decimal"
                min="0.5"
                :max="QUESTION_LIMITS.maxPoints"
                step="0.5"
                :label="t('exams.fields.points')"
                :error="errors.points"
                class="w-24"
                data-testid="field-points"
                @update:model-value="set('points', Number($event))"
              />
              <BaseSelect
                v-if="!blockMode"
                :model-value="form.status"
                :label="t('exams.fields.status')"
                :options="statusOptions"
                class="w-36"
                data-testid="field-status"
                @update:model-value="setStatus"
              />
            </div>
            <p class="text-xs text-fg-muted">{{ t(`exams.typeHints.${form.type}`) }}</p>
          </section>

          <!-- Savol matni va variantlar: bitta kartada -->
          <section class="card space-y-4 p-4">
            <div class="space-y-2">
              <h2 class="text-sm font-semibold text-fg">{{ t('exams.editor.contentTitle') }}</h2>
              <BlockEditor
                :model-value="form.content"
                :error="errors.content"
                @update:model-value="set('content', $event)"
              />
            </div>

            <div v-if="needsOptions" class="space-y-2">
              <h2 class="text-sm font-semibold text-fg">{{ t('exams.editor.optionsTitle') }}</h2>
              <OptionsEditor
                :type="optionsType"
                :options="form.options"
                :correct-option-id="form.correctOptionId"
                :correct-option-ids="form.correctOptionIds"
                :partial-credit="form.partialCredit"
                :error="errors.options"
                :answer-error="errors.answer"
                @update:options="set('options', $event)"
                @update:correct-option-id="set('correctOptionId', $event)"
                @update:correct-option-ids="set('correctOptionIds', $event)"
                @update:partial-credit="set('partialCredit', $event)"
                @remove="form = removeOption(form, $event)"
              />
            </div>

            <div v-else-if="form.type === 'short'" class="space-y-2">
              <h2 class="text-sm font-semibold text-fg">{{ t('exams.editor.shortTitle') }}</h2>
              <AcceptedAnswers
                :model-value="form.acceptedAnswers"
                :error="errors.answer"
                @update:model-value="set('acceptedAnswers', $event)"
              />
            </div>

            <div v-else class="space-y-2">
              <h2 class="text-sm font-semibold text-fg">{{ t('exams.editor.rubricTitle') }}</h2>
              <textarea
                :value="form.rubric"
                rows="3"
                :maxlength="QUESTION_LIMITS.rubricChars"
                :placeholder="t('exams.editor.rubricPlaceholder')"
                :aria-label="t('exams.editor.rubricTitle')"
                class="block w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                data-testid="field-rubric"
                @input="set('rubric', ($event.target as HTMLTextAreaElement).value)"
              />
              <p class="text-xs text-fg-muted">{{ t('exams.editor.rubricHint') }}</p>
            </div>
          </section>

          <!-- Ulashish: yig'iladigan bo'lim -->
          <details v-if="!blockMode" class="card p-4" data-testid="sharing-section">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-2">
              <h2 class="text-sm font-semibold text-fg">{{ t('exams.sharing.title') }}</h2>
              <span class="text-xs text-fg-muted">
                {{ t(`exams.sharing.modes.${form.sharing.mode}`) }}
              </span>
            </summary>
            <div class="mt-3">
              <SharingControl
                :model-value="form.sharing"
                :subject-id="form.subjectId"
                :error="errors.sharing"
                @update:model-value="set('sharing', $event)"
              />
            </div>
          </details>

          <!-- Tugmalar: mobilda pastki yopishqoq panel -->
          <div
            class="fixed inset-x-0 bottom-0 z-10 flex flex-wrap gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0"
            data-testid="editor-actions"
          >
            <BaseButton
              variant="secondary"
              class="flex-1 px-2 text-xs lg:flex-none lg:px-4 lg:text-sm"
              @click="backToList"
            >
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton
              v-if="!questionId"
              variant="secondary"
              class="flex-[2] px-2 text-xs lg:flex-none lg:px-4 lg:text-sm"
              :loading="saving"
              data-testid="save-and-add"
              @click="save(true)"
            >
              {{ t('exams.editor.saveAndAdd') }}
            </BaseButton>
            <BaseButton
              type="submit"
              class="flex-1 lg:flex-none"
              :loading="saving"
              :disabled="archived"
              data-testid="save-question"
            >
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>

        <!-- Ko'rinish: o'quvchi ko'rgandek, javob kalitisiz -->
        <aside
          :class="[
            tab === 'edit' && !readOnly ? 'hidden lg:block' : '',
            readOnly ? 'max-w-2xl' : 'lg:sticky lg:top-20 lg:self-start',
          ]"
          :aria-label="t('exams.editor.previewTitle')"
          data-testid="preview-panel"
        >
          <h2 class="mb-2 text-sm font-semibold text-fg">{{ t('exams.editor.previewTitle') }}</h2>
          <QuestionPreview :question="previewQuestion" />
          <p class="mt-2 text-xs text-fg-muted">{{ t('exams.editor.previewHint') }}</p>
        </aside>
      </div>
    </template>
  </div>
</template>
