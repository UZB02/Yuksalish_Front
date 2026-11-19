<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Plus, UserRound } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import type { ApiMeta, ExamCandidate } from '@/api/types'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ProfileExamResults from '@/components/exams/ProfileExamResults.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BasePagination from '@/components/ui/BasePagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'

/** Kirish imtihoni nomzodlari (faqat ma'muriyat). Ro'yxatda telefon maskalangan, tahrirlashda to'liq */
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())

const items = ref<ExamCandidate[]>([])
const meta = ref<ApiMeta | null>(null)
const loading = ref(true)
const error = ref('')
const q = ref('')
const page = ref(1)

const formOpen = ref(false)
/** Nomzod natijalari oynasi */
const resultsFor = ref<ExamCandidate | null>(null)
const loadCandidateResults = () => examsApi.candidateResults(resultsFor.value!.id)
const editId = ref<string | null>(null)
const saving = ref(false)
const f = reactive({ fullName: '', birthDate: '', targetGrade: '', parentPhone: '', notes: '' })
const errors = reactive<Record<string, string>>({})

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  try {
    const r = await examsApi.listCandidates({
      page: page.value,
      limit: 20,
      q: q.value.trim() || undefined,
    })
    items.value = r.items
    meta.value = r.meta
  } catch (e) {
    items.value = []
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)
let timer: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})
watch(schoolId, () => {
  page.value = 1
  void load()
})

function resetForm(c?: ExamCandidate) {
  f.fullName = c?.fullName ?? ''
  f.birthDate = c?.birthDate ? c.birthDate.slice(0, 10) : ''
  f.targetGrade = c?.targetGrade ? String(c.targetGrade) : ''
  f.parentPhone = c?.parentPhone ?? ''
  f.notes = c?.notes ?? ''
  for (const k of Object.keys(errors)) delete errors[k]
}
function openCreate() {
  editId.value = null
  resetForm()
  formOpen.value = true
}
async function openEdit(c: ExamCandidate) {
  try {
    // To'liq (maskalanmagan) ma'lumot faqat batafsil ko'rinishda keladi
    resetForm(await examsApi.getCandidate(c.id))
    editId.value = c.id
    formOpen.value = true
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}

async function save() {
  for (const k of Object.keys(errors)) delete errors[k]
  const grade = f.targetGrade.trim() ? Number(f.targetGrade) : null
  if (f.fullName.trim().length < 2) errors.fullName = t('examCandidates.errors.name')
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 11)) {
    errors.targetGrade = t('examCandidates.errors.grade')
  }
  if (f.parentPhone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(f.parentPhone.trim())) {
    errors.parentPhone = t('examCandidates.errors.phone')
  }
  if (Object.keys(errors).length) return
  const body = {
    fullName: f.fullName.trim(),
    birthDate: f.birthDate || null,
    targetGrade: grade,
    parentPhone: f.parentPhone.trim() || null,
    notes: f.notes.trim(),
  }
  saving.value = true
  try {
    if (editId.value) await examsApi.updateCandidate(editId.value, body)
    else await examsApi.createCandidate(body)
    toast.success(t(editId.value ? 'examCandidates.toast.updated' : 'examCandidates.toast.created'))
    formOpen.value = false
    await load()
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    saving.value = false
  }
}

async function remove(c: ExamCandidate) {
  const ok = await confirm({
    title: t('examCandidates.deleteTitle'),
    message: t('examCandidates.deleteText', { name: c.fullName }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await examsApi.removeCandidate(c.id)
    toast.success(t('examCandidates.toast.deleted'))
    await load()
  } catch (e) {
    toast.error(
      isApiError(e) && e.code === 'CONFLICT' ? t('examCandidates.inUse') : errorMessage(e, t),
    )
  }
}
</script>

<template>
  <PageHeader :title="t('examCandidates.title')" :description="t('examCandidates.description')">
    <template #actions>
      <BaseButton data-testid="candidate-add" @click="openCreate">
        <Plus class="h-4 w-4" aria-hidden="true" />
        {{ t('examCandidates.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <RouterLink
      :to="{ name: 'exam-sessions' }"
      class="mb-3 inline-block text-sm text-primary-700 hover:underline"
      data-testid="candidates-back"
    >
      ← {{ t('examCandidates.back') }}
    </RouterLink>
    <div class="mb-4 max-w-md">
      <BaseInput
        v-model="q"
        type="search"
        :label="t('examCandidates.search')"
        data-testid="candidate-search"
      />
    </div>
    <div v-if="loading" class="space-y-3" aria-busy="true">
      <Skeleton v-for="n in 4" :key="n" class="h-14 w-full" />
    </div>
    <div v-else-if="error" class="card">
      <EmptyState :title="t('errors.loadFailed')" :description="error">
        <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <div v-else-if="items.length === 0" class="card" data-testid="candidates-empty">
      <EmptyState
        :icon="UserRound"
        :title="t('examCandidates.emptyTitle')"
        :description="t('examCandidates.emptyText')"
      />
    </div>
    <div v-else class="card overflow-hidden">
      <ul class="divide-y divide-border" data-testid="candidates-list">
        <li
          v-for="c in items"
          :key="c.id"
          class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
          data-testid="candidate-row"
        >
          <div class="min-w-0 flex-1">
            <p class="break-words font-medium text-fg">{{ c.fullName }}</p>
            <p class="text-xs text-fg-muted">
              <template v-if="c.targetGrade">{{
                t('examCandidates.gradeN', { n: c.targetGrade })
              }}</template>
              <template v-if="c.parentPhone">
                · <span data-testid="candidate-phone">{{ c.parentPhone }}</span></template
              >
            </p>
          </div>
          <BaseBadge v-if="c.piiPurged" tone="neutral">{{ t('examCandidates.purged') }}</BaseBadge>
          <div class="flex gap-1">
            <BaseButton
              size="sm"
              variant="ghost"
              data-testid="candidate-results"
              @click="resultsFor = c"
              >{{ t('profileExams.title') }}</BaseButton
            >
            <BaseButton
              size="sm"
              variant="secondary"
              data-testid="candidate-edit"
              @click="openEdit(c)"
              >{{ t('common.edit') }}</BaseButton
            >
            <BaseButton
              size="sm"
              variant="ghost"
              data-testid="candidate-delete"
              @click="remove(c)"
              >{{ t('common.delete') }}</BaseButton
            >
          </div>
        </li>
      </ul>
      <BasePagination
        v-if="meta && meta.totalPages > 1"
        :page="meta.page"
        :total-pages="meta.totalPages"
        :total="meta.total"
        :limit="meta.limit"
        @change="
          (p: number) => {
            page = p
            void load()
          }
        "
      />
    </div>

    <BaseModal
      :open="!!resultsFor"
      :title="resultsFor ? `${t('profileExams.title')}: ${resultsFor.fullName}` : ''"
      @close="resultsFor = null"
    >
      <ProfileExamResults v-if="resultsFor" :key="resultsFor.id" :load="loadCandidateResults" />
    </BaseModal>

    <BaseModal
      :open="formOpen"
      :title="editId ? t('examCandidates.editTitle') : t('examCandidates.addTitle')"
      persistent
      @close="formOpen = false"
    >
      <form id="candidate-form" class="space-y-4" novalidate @submit.prevent="save">
        <BaseInput
          v-model="f.fullName"
          :label="t('examCandidates.fullName')"
          :error="errors.fullName"
          :maxlength="100"
          required
          data-testid="cand-name"
        />
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="f.birthDate"
            type="date"
            :label="t('examCandidates.birthDate')"
            data-testid="cand-birth"
          />
          <BaseInput
            v-model="f.targetGrade"
            type="number"
            inputmode="numeric"
            min="1"
            max="11"
            :label="t('examCandidates.targetGrade')"
            :error="errors.targetGrade"
            data-testid="cand-grade"
          />
        </div>
        <BaseInput
          v-model="f.parentPhone"
          type="tel"
          :label="t('examCandidates.parentPhone')"
          :error="errors.parentPhone"
          :maxlength="20"
          data-testid="cand-phone"
        />
        <BaseInput
          v-model="f.notes"
          :label="t('examCandidates.notes')"
          :maxlength="1000"
          data-testid="cand-notes"
        />
        <p class="text-xs text-fg-muted">{{ t('examCandidates.retentionHint') }}</p>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen = false">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton type="submit" form="candidate-form" :loading="saving" data-testid="cand-save">{{
          t('common.save')
        }}</BaseButton>
      </template>
    </BaseModal>
  </template>
</template>
