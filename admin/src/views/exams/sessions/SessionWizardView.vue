<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { examsApi } from '@/api/exams.api'
import type {
  ExamClassOption,
  ExamResultsMode,
  ExamSectionsPreview,
  ExamSession,
  ExamSessionMeta,
  ExamSessionType,
  ExamTemplate,
  ExamSection,
} from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import { fmtDateTime, isoToLocal, localToIso, nowLocal } from '@/utils/examSessions'
import ParticipantsPanel from './ParticipantsPanel.vue'
import SectionsEditor from './SectionsEditor.vue'

/**
 * Imtihon yaratish ustasi: 1) tur/nom/fan/sinflar 2) savollar (shablon, bo'limlar) 3) vaqt va sozlamalar
 * 4) ishtirokchilar 5) tekshirish va yuborish. 3-qadamdan 4-ga o'tishda QORALAMA saqlanadi (ishtirokchi
 * qo'shish uchun imtihon id si kerak); yuborilmaguncha u ro'yxatda "Qoralama" bo'lib turadi.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const needsSchool = useNeedsSchool()

const STEPS = ['basic', 'questions', 'time', 'participants', 'review'] as const
const step = ref(0)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const meta = ref<ExamSessionMeta | null>(null)
const subjects = ref<{ id: string; name: string }[]>([])
const classOptions = ref<ExamClassOption[]>([])
const templates = ref<ExamTemplate[]>([])
const session = ref<ExamSession | null>(null)
const preview = ref<ExamSectionsPreview | null>(null)
const errors = reactive<Record<string, string>>({})
const saveTemplate = ref(false)
const templateName = ref('')

const form = reactive({
  type: 'quiz' as ExamSessionType,
  title: '',
  subjectId: '',
  classIds: [] as string[],
  templateId: '',
  sections: [] as ExamSection[],
  start: nowLocal(24 * 60).slice(0, 11) + '09:00',
  durationMin: '40',
  shuffleQuestions: true,
  shuffleOptions: true,
  resultsMode: 'score' as ExamResultsMode,
  supervisorIds: [] as string[],
})

const typeOptions = computed(() =>
  (meta.value?.allowedTypes ?? []).map((k) => ({ value: k, label: t(`examSessions.type.${k}`) })),
)
const subjectOptions = computed(() => [
  { value: '', label: t('examSessions.wizard.noSubject') },
  ...subjects.value.map((s) => ({ value: s.id, label: s.name })),
])
const templateOptions = computed(() => [
  { value: '', label: t('examSessions.wizard.noTemplate') },
  ...templates.value.map((x) => ({ value: x.id, label: x.title })),
])
const resultsOptions = computed(() =>
  (['score', 'score_answers', 'after_publish', 'never'] as const).map((k) => ({
    value: k,
    label: t(`examSessions.results.${k}`),
  })),
)
const needsApproval = computed(
  () => !meta.value?.isAdministration && !!meta.value?.teacherQuizNeedsApproval,
)
const isTeacher = computed(() => !!meta.value && !meta.value.isAdministration)

async function loadClasses() {
  try {
    classOptions.value = await examsApi.classOptions(form.subjectId || undefined)
    form.classIds = form.classIds.filter((id) => classOptions.value.some((c) => c.id === id))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

function applySession(s: ExamSession) {
  session.value = s
  form.type = s.type
  form.title = s.title
  form.subjectId = s.subjectId ?? ''
  form.classIds = s.classes.map((c) => c.id)
  form.sections = JSON.parse(JSON.stringify(s.sections)) as ExamSection[]
  form.start = isoToLocal(s.scheduledStart)
  form.durationMin = String(s.durationMin)
  form.shuffleQuestions = s.shuffleQuestions
  form.shuffleOptions = s.shuffleOptions
  form.resultsMode = s.resultsMode
  form.supervisorIds = s.supervisors.map((x) => x.id)
}

async function init() {
  if (needsSchool.value) return
  loading.value = true
  loadError.value = ''
  try {
    const [m, subs, tpls] = await Promise.all([
      examsApi.sessionMeta(),
      examsApi.subjects(),
      examsApi.listTemplates().catch(() => [] as ExamTemplate[]),
    ])
    meta.value = m
    subjects.value = subs.subjects.map((s) => ({ id: s.id, name: s.name }))
    templates.value = tpls
    form.type = m.allowedTypes[0] ?? 'quiz'
    const id = typeof route.query.id === 'string' ? route.query.id : ''
    if (id) {
      const s = await examsApi.getSession(id)
      if (s.status === 'draft') applySession(s)
    } else if (subs.subjects.length === 1 && isTeacher.value) {
      form.subjectId = subs.subjects[0]!.id
    }
    await loadClasses()
  } catch (e) {
    loadError.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(init)
watch(
  () => form.subjectId,
  () => {
    if (!loading.value) void loadClasses()
  },
)

function onTemplate(id: string) {
  form.templateId = id
  const tpl = templates.value.find((x) => x.id === id)
  if (!tpl) return
  form.sections = JSON.parse(JSON.stringify(tpl.sections)) as ExamSection[]
  form.shuffleQuestions = tpl.shuffleQuestions
  form.shuffleOptions = tpl.shuffleOptions
  if (tpl.subjectId && !form.subjectId) form.subjectId = tpl.subjectId
}

function toggleClass(id: string, on: boolean) {
  form.classIds = on ? [...new Set([...form.classIds, id])] : form.classIds.filter((x) => x !== id)
}
function toggleSupervisor(id: string, on: boolean) {
  form.supervisorIds = on
    ? [...new Set([...form.supervisorIds, id])]
    : form.supervisorIds.filter((x) => x !== id)
}

function clearErrors() {
  for (const k of Object.keys(errors)) delete errors[k]
}
function validate(s: number): boolean {
  clearErrors()
  if (s === 0) {
    if (!form.title.trim()) errors.title = t('examSessions.errors.titleRequired')
    if (isTeacher.value && !form.subjectId)
      errors.subject = t('examSessions.errors.subjectRequired')
    if (isTeacher.value && form.classIds.length === 0)
      errors.classes = t('examSessions.errors.classesRequired')
  }
  if (s === 1) {
    const incomplete =
      form.sections.length === 0 ||
      form.sections.some(
        (x) =>
          !x.title.trim() ||
          x.items.length === 0 ||
          x.items.some((i) =>
            i.kind === 'manual' ? i.questionIds.length === 0 : !i.topicId || i.count < 1,
          ),
      )
    if (incomplete) errors.sections = t('examSessions.errors.sectionsIncomplete')
    else if (!preview.value) errors.sections = t('examSessions.errors.sectionsChecking')
    else if (!preview.value.ok) errors.sections = t('examSessions.errors.sectionsInvalid')
  }
  if (s === 2) {
    const dur = Number(form.durationMin)
    if (!form.start) errors.start = t('examSessions.errors.startRequired')
    else if (new Date(localToIso(form.start)).getTime() + dur * 60_000 <= Date.now()) {
      errors.start = t('examSessions.errors.startPast')
    }
    if (!Number.isInteger(dur) || dur < 5 || dur > 600)
      errors.duration = t('examSessions.errors.durationRange')
  }
  if (s === 3 && (session.value?.participants.length ?? 0) === 0) {
    errors.participants = t('examSessions.errors.participantsRequired')
  }
  return Object.keys(errors).length === 0
}

const body = () => ({
  title: form.title.trim(),
  type: form.type,
  subjectId: form.subjectId || null,
  classIds: form.classIds,
  sections: form.sections,
  scheduledStart: localToIso(form.start),
  durationMin: Number(form.durationMin),
  shuffleQuestions: form.shuffleQuestions,
  shuffleOptions: form.shuffleOptions,
  resultsMode: form.resultsMode,
  supervisorIds: form.supervisorIds,
})

async function saveDraft(): Promise<boolean> {
  saving.value = true
  try {
    session.value = session.value
      ? await examsApi.updateSession(session.value.id, body())
      : await examsApi.createSession(body())
    return true
  } catch (e) {
    toast.error(errorMessage(e, t))
    return false
  } finally {
    saving.value = false
  }
}

async function refreshSession() {
  if (!session.value) return
  try {
    session.value = await examsApi.getSession(session.value.id)
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function next() {
  if (!validate(step.value)) return
  if (step.value === 2 && !(await saveDraft())) return
  step.value++
}
function back() {
  clearErrors()
  if (step.value > 0) step.value--
}

async function doSaveTemplate() {
  if (!templateName.value.trim()) {
    errors.templateName = t('examSessions.errors.titleRequired')
    return
  }
  try {
    const tpl = await examsApi.createTemplate({
      title: templateName.value.trim(),
      subjectId: form.subjectId || null,
      sections: form.sections,
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
    })
    templates.value = [tpl, ...templates.value]
    saveTemplate.value = false
    templateName.value = ''
    toast.success(t('examSessions.wizard.templateSaved'))
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function submit() {
  if (!session.value) return
  saving.value = true
  try {
    const s = await examsApi.sessionAction(session.value.id, 'submit')
    toast.success(
      t(
        s.status === 'pending_approval'
          ? 'examSessions.toast.pending'
          : 'examSessions.toast.scheduled',
      ),
    )
    void router.replace({ name: 'exam-session', params: { id: s.id } })
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    saving.value = false
  }
}

const classNames = computed(() =>
  classOptions.value
    .filter((c) => form.classIds.includes(c.id))
    .map((c) => c.name)
    .join(', '),
)
</script>

<template>
  <PageHeader
    :title="t('examSessions.wizard.title')"
    :description="t('examSessions.wizard.description')"
  />

  <NeedsSchool v-if="needsSchool" />
  <div v-else-if="loading" class="space-y-3" aria-busy="true">
    <Skeleton class="h-10 w-full" />
    <Skeleton class="h-64 w-full" />
  </div>
  <div v-else-if="loadError" class="card p-5 text-sm text-danger">{{ loadError }}</div>
  <p
    v-else-if="(meta?.allowedTypes.length ?? 0) === 0"
    class="card p-5 text-sm text-fg-muted"
    data-testid="wizard-forbidden"
  >
    {{ t('examSessions.wizard.forbidden') }}
  </p>

  <template v-else>
    <ol class="mb-5 flex flex-wrap gap-2 text-sm" data-testid="wizard-steps">
      <li
        v-for="(s, i) in STEPS"
        :key="s"
        class="rounded-full px-3 py-1"
        :class="
          i === step
            ? 'bg-primary-600 text-white'
            : i < step
              ? 'bg-primary-100 text-primary-700'
              : 'bg-surface-muted text-fg-muted'
        "
        :aria-current="i === step ? 'step' : undefined"
      >
        {{ i + 1 }}. {{ t(`examSessions.wizard.steps.${s}`) }}
      </li>
    </ol>

    <div class="card space-y-5 p-4 sm:p-6">
      <!-- 1: asosiy -->
      <div v-if="step === 0" class="space-y-4" data-testid="step-basic">
        <BaseSelect
          v-model="form.type"
          :label="t('examSessions.wizard.type')"
          :options="typeOptions"
          data-testid="wz-type"
        />
        <BaseInput
          v-model="form.title"
          :label="t('examSessions.wizard.name')"
          :error="errors.title"
          :maxlength="150"
          required
          data-testid="wz-title"
        />
        <BaseSelect
          v-model="form.subjectId"
          :label="t('examSessions.wizard.subject')"
          :options="subjectOptions"
          :error="errors.subject"
          data-testid="wz-subject"
        />
        <fieldset>
          <legend class="mb-1.5 text-sm font-medium text-fg">
            {{ t('examSessions.wizard.classes') }}
          </legend>
          <p v-if="classOptions.length === 0" class="text-sm text-fg-muted">
            {{ t('examSessions.participants.noClasses') }}
          </p>
          <ul v-else class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="c in classOptions" :key="c.id">
              <BaseCheckbox
                :model-value="form.classIds.includes(c.id)"
                :label="`${c.name} (${c.studentsCount})`"
                :data-testid="`wz-class-${c.id}`"
                @update:model-value="toggleClass(c.id, $event)"
              />
            </li>
          </ul>
          <p v-if="errors.classes" class="mt-1 text-sm text-danger" data-testid="err-classes">
            {{ errors.classes }}
          </p>
        </fieldset>
      </div>

      <!-- 2: savollar -->
      <div v-else-if="step === 1" class="space-y-4" data-testid="step-questions">
        <BaseSelect
          :model-value="form.templateId"
          :label="t('examSessions.wizard.template')"
          :options="templateOptions"
          data-testid="wz-template"
          @update:model-value="onTemplate"
        />
        <SectionsEditor
          v-model="form.sections"
          :subject-id="form.subjectId || null"
          @preview="preview = $event"
        />
        <p v-if="errors.sections" class="text-sm text-danger" data-testid="err-sections">
          {{ errors.sections }}
        </p>
        <div class="rounded-lg border border-border p-3">
          <BaseCheckbox
            v-model="saveTemplate"
            :label="t('examSessions.wizard.saveAsTemplate')"
            data-testid="wz-save-template"
          />
          <div v-if="saveTemplate" class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <BaseInput
              v-model="templateName"
              class="flex-1"
              :label="t('examSessions.wizard.templateName')"
              :error="errors.templateName"
              :maxlength="150"
              data-testid="wz-template-name"
            />
            <BaseButton
              variant="secondary"
              :disabled="!preview?.ok"
              data-testid="wz-template-save"
              @click="doSaveTemplate"
            >
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- 3: vaqt -->
      <div v-else-if="step === 2" class="space-y-4" data-testid="step-time">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.start"
            type="datetime-local"
            :label="t('examSessions.wizard.start')"
            :error="errors.start"
            required
            data-testid="wz-start"
          />
          <BaseInput
            v-model="form.durationMin"
            type="number"
            inputmode="numeric"
            min="5"
            max="600"
            :label="t('examSessions.wizard.duration')"
            :error="errors.duration"
            required
            data-testid="wz-duration"
          />
        </div>
        <p class="text-xs text-fg-muted">{{ t('examSessions.wizard.timeHint') }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <BaseSwitch
            v-model="form.shuffleQuestions"
            :label="t('examSessions.wizard.shuffleQuestions')"
          />
          <BaseSwitch
            v-model="form.shuffleOptions"
            :label="t('examSessions.wizard.shuffleOptions')"
          />
        </div>
        <BaseSelect
          v-model="form.resultsMode"
          :label="t('examSessions.wizard.resultsMode')"
          :options="resultsOptions"
          data-testid="wz-results"
        />
        <fieldset>
          <legend class="mb-1.5 text-sm font-medium text-fg">
            {{ t('examSessions.wizard.supervisors') }}
          </legend>
          <p class="mb-2 text-xs text-fg-muted">{{ t('examSessions.wizard.supervisorsHint') }}</p>
          <ul class="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
            <li v-for="u in meta?.supervisors ?? []" :key="u.id">
              <BaseCheckbox
                :model-value="form.supervisorIds.includes(u.id)"
                :label="u.fullName"
                @update:model-value="toggleSupervisor(u.id, $event)"
              />
            </li>
          </ul>
        </fieldset>
      </div>

      <!-- 4: ishtirokchilar -->
      <div v-else-if="step === 3 && session" class="space-y-4" data-testid="step-participants">
        <p class="text-sm text-fg" data-testid="participants-total">
          {{ t('examSessions.participants.total', { n: session.participants.length }) }}
        </p>
        <p v-if="errors.participants" class="text-sm text-danger" data-testid="err-participants">
          {{ errors.participants }}
        </p>
        <p v-if="meta && !meta.pinSecretConfigured" class="text-sm text-danger">
          {{ t('examSessions.pinSecretMissing') }}
        </p>
        <ParticipantsPanel :session="session" :meta="meta" @changed="refreshSession" />
      </div>

      <!-- 5: tekshirish -->
      <div v-else-if="step === 4 && session" class="space-y-3" data-testid="step-review">
        <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-fg-muted">{{ t('examSessions.wizard.name') }}</dt>
            <dd class="text-fg">{{ form.title }}</dd>
          </div>
          <div>
            <dt class="text-fg-muted">{{ t('examSessions.wizard.type') }}</dt>
            <dd class="text-fg">{{ t(`examSessions.type.${form.type}`) }}</dd>
          </div>
          <div>
            <dt class="text-fg-muted">{{ t('examSessions.wizard.classes') }}</dt>
            <dd class="text-fg">{{ classNames || '—' }}</dd>
          </div>
          <div>
            <dt class="text-fg-muted">{{ t('examSessions.wizard.start') }}</dt>
            <dd class="text-fg">
              {{ fmtDateTime(localToIso(form.start)) }},
              {{ t('examSessions.minutes', { n: form.durationMin }) }}
            </dd>
          </div>
          <div>
            <dt class="text-fg-muted">{{ t('examSessions.wizard.questionsPerParticipant') }}</dt>
            <dd class="text-fg">{{ preview?.questionsPerParticipant ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-fg-muted">{{ t('examSessions.wizard.resultsMode') }}</dt>
            <dd class="text-fg">{{ t(`examSessions.results.${form.resultsMode}`) }}</dd>
          </div>
          <div>
            <dt class="text-fg-muted">{{ t('examSessions.participants.title') }}</dt>
            <dd class="text-fg" data-testid="review-participants">
              {{ session.participants.length }}
            </dd>
          </div>
        </dl>
        <p
          v-if="needsApproval"
          class="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"
          data-testid="needs-approval-note"
        >
          {{ t('examSessions.wizard.needsApproval') }}
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
      <BaseButton
        variant="secondary"
        :disabled="step === 0 || saving"
        data-testid="wz-back"
        @click="back"
      >
        {{ t('examSessions.wizard.back') }}
      </BaseButton>
      <BaseButton
        v-if="step < STEPS.length - 1"
        :loading="saving"
        data-testid="wz-next"
        @click="next"
      >
        {{ t('examSessions.wizard.next') }}
      </BaseButton>
      <BaseButton v-else :loading="saving" data-testid="wz-submit" @click="submit">
        {{
          needsApproval ? t('examSessions.wizard.submitApproval') : t('examSessions.wizard.submit')
        }}
      </BaseButton>
    </div>
  </template>
</template>
