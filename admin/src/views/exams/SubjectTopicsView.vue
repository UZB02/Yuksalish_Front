<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ArrowDown, ArrowUp, FileQuestion, Layers, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import type { ExamTopic, ExamTopicsResponse } from '@/api/types'
import ExamBreadcrumb from '@/components/exams/ExamBreadcrumb.vue'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useToast } from '@/composables/useToast'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import TopicFormModal from './TopicFormModal.vue'

/** Savollar banki: 2-daraja - fan ichidagi MAVZU kartalari */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()
const { schoolId } = storeToRefs(useSchoolContextStore())

const subjectId = computed(() => String(route.params.subjectId))
const data = ref<ExamTopicsResponse | null>(null)
const loading = ref(true)
const error = ref('')
const forbidden = ref(false)
const formOpen = ref(false)
const editing = ref<ExamTopic | null>(null)
const busy = ref(false)

/** Tartibni faqat hamma mavzuni o'zgartira oladigan foydalanuvchi (ma'muriyat) ko'radi */
const canReorder = computed(
  () => (data.value?.topics.length ?? 0) > 1 && data.value!.topics.every((x) => x.canEdit),
)

async function load() {
  if (needsSchool.value) return
  loading.value = true
  error.value = ''
  forbidden.value = false
  try {
    data.value = await examsApi.listTopics(subjectId.value)
  } catch (e) {
    data.value = null
    if (isApiError(e) && (e.status === 403 || e.status === 404)) forbidden.value = true
    else error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(subjectId, load)
// Maktab almashsa fan boshqa maktabga tegishli bo'lib qoladi
watch(schoolId, () => void router.replace({ name: 'exam-questions' }))

function openCreate() {
  editing.value = null
  formOpen.value = true
}
function openEdit(x: ExamTopic) {
  editing.value = x
  formOpen.value = true
}
function onSaved() {
  formOpen.value = false
  void load()
}

async function remove(x: ExamTopic) {
  if (!x.canDelete) return
  const ok = await confirm({
    title: t('exams.topics.deleteTitle'),
    message: t('exams.topics.deleteText', { name: x.name }),
    confirmText: t('common.delete'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await examsApi.removeTopic(x.id)
    toast.success(t('exams.topics.toast.deleted'))
    await load()
  } catch (e) {
    toast.error(
      isApiError(e) && e.code === 'CONFLICT' ? t('exams.topics.notEmpty') : errorMessage(e, t),
    )
    await load()
  }
}

async function move(index: number, delta: -1 | 1) {
  if (!data.value || busy.value) return
  const ids = data.value.topics.map((x) => x.id)
  const to = index + delta
  if (to < 0 || to >= ids.length) return
  ;[ids[index], ids[to]] = [ids[to]!, ids[index]!]
  busy.value = true
  try {
    data.value = await examsApi.reorderTopics(subjectId.value, ids)
  } catch (e) {
    toast.error(errorMessage(e, t))
  } finally {
    busy.value = false
  }
}

const deleteHint = (x: ExamTopic) =>
  !x.canEdit
    ? t('exams.topics.cantEdit')
    : !x.canDelete
      ? t('exams.topics.notEmpty')
      : t('common.delete')

const crumbs = computed(() => [
  { label: t('exams.bank.title'), to: { name: 'exam-questions' } },
  { label: data.value?.subject.name ?? '…' },
])
</script>

<template>
  <NeedsSchool v-if="needsSchool" />

  <div v-else-if="loading" aria-busy="true">
    <Skeleton class="mb-4 h-5 w-64" />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Skeleton v-for="n in 6" :key="n" class="h-32 w-full" />
    </div>
  </div>

  <div v-else-if="forbidden" class="card" data-testid="subject-forbidden">
    <EmptyState
      :title="t('exams.topics.forbiddenTitle')"
      :description="t('exams.topics.forbiddenText')"
    >
      <RouterLink :to="{ name: 'exam-questions' }">
        <BaseButton>{{ t('exams.bank.title') }}</BaseButton>
      </RouterLink>
    </EmptyState>
  </div>

  <div v-else-if="error" class="card">
    <EmptyState :title="t('errors.loadFailed')" :description="error">
      <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
    </EmptyState>
  </div>

  <template v-else-if="data">
    <ExamBreadcrumb :items="crumbs" />
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold text-fg sm:text-2xl">{{ data.subject.name }}</h1>
        <p class="mt-1 text-sm text-fg-muted">{{ t('exams.topics.description2') }}</p>
      </div>
      <BaseButton v-if="data.subject.isActive" data-testid="add-topic" @click="openCreate">
        <Plus class="h-4 w-4" aria-hidden="true" /> {{ t('exams.topics.add') }}
      </BaseButton>
    </div>

    <div v-if="data.topics.length === 0" class="card" data-testid="no-topics">
      <EmptyState
        :icon="Layers"
        :title="t('exams.topics.emptyTitle')"
        :description="t('exams.topics.emptyText')"
      >
        <BaseButton v-if="data.subject.isActive" @click="openCreate">{{
          t('exams.topics.add')
        }}</BaseButton>
      </EmptyState>
    </div>

    <ul v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="topic-grid">
      <li
        v-for="(x, i) in data.topics"
        :key="x.id"
        class="card flex flex-col"
        data-testid="topic-card"
      >
        <RouterLink
          :to="{ name: 'exam-topic', params: { topicId: x.id } }"
          class="flex flex-1 flex-col gap-2 rounded-t-xl p-5 hover:bg-surface-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
        >
          <h2 class="break-words text-lg font-semibold text-fg" data-testid="topic-name-text">
            {{ x.name }}
          </h2>
          <p v-if="x.description" class="line-clamp-2 text-sm text-fg-muted">{{ x.description }}</p>
          <div
            class="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm text-fg-muted"
          >
            <span class="inline-flex items-center gap-1.5" data-testid="topic-questions">
              <FileQuestion class="h-4 w-4" aria-hidden="true" />
              {{ t('exams.bank.questionsCount', { n: x.questionsCount }) }}
            </span>
            <span v-if="x.createdByName" class="truncate text-xs">
              {{ x.isMine ? t('exams.questions.you') : x.createdByName }}
            </span>
          </div>
        </RouterLink>
        <div class="flex items-center justify-end gap-1 border-t border-border px-3 py-2">
          <template v-if="canReorder">
            <BaseButton
              size="sm"
              variant="ghost"
              :disabled="i === 0 || busy"
              :aria-label="t('exams.blocks.up')"
              data-testid="topic-up"
              @click="move(i, -1)"
            >
              <ArrowUp class="h-4 w-4" />
            </BaseButton>
            <BaseButton
              size="sm"
              variant="ghost"
              :disabled="i === data.topics.length - 1 || busy"
              :aria-label="t('exams.blocks.down')"
              data-testid="topic-down"
              @click="move(i, 1)"
            >
              <ArrowDown class="h-4 w-4" />
            </BaseButton>
          </template>
          <BaseButton
            size="sm"
            variant="ghost"
            :disabled="!x.canEdit"
            :title="x.canEdit ? t('common.edit') : t('exams.topics.cantEdit')"
            :aria-label="`${t('common.edit')}: ${x.name}`"
            data-testid="topic-edit"
            @click="openEdit(x)"
          >
            <Pencil class="h-4 w-4" />
          </BaseButton>
          <BaseButton
            size="sm"
            variant="ghost"
            :disabled="!x.canDelete"
            :title="deleteHint(x)"
            :aria-label="`${t('common.delete')}: ${x.name}`"
            data-testid="topic-delete"
            @click="remove(x)"
          >
            <Trash2 class="h-4 w-4" :class="x.canDelete ? 'text-danger' : ''" />
          </BaseButton>
        </div>
      </li>
    </ul>

    <TopicFormModal
      :open="formOpen"
      :subject-id="subjectId"
      :item="editing"
      @close="formOpen = false"
      @saved="onSaved"
    />
  </template>
</template>
