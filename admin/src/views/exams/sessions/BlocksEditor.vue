<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type {
  BlockQuestionRow,
  ExamBlock,
  ExamBlockInput,
  ExamScoringMode,
  ExamSectionItem,
  ExamSectionsPreview,
  ExamSessionMeta,
  ExamTimingMode,
} from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import SectionsEditor from './SectionsEditor.vue'

/**
 * Bloklar muharriri (tuzuvchi): har blok bitta fan. Blokda: maqsad savollar soni, koeffitsiyent (koeffitsiyent
 * rejimida), davomiylik (blokma-blok vaqtda), biriktirilgan o'qituvchilar (shu fanni o'qitadiganlar) va savol
 * elementlari (qo'lda tanlash / qoida). Saqlangan imtihonda o'qituvchilar qo'shgan savollar va "tayyor" holati ko'rinadi.
 */
const props = defineProps<{
  modelValue: ExamBlockInput[]
  subjects: { id: string; name: string }[]
  meta: ExamSessionMeta | null
  scoringMode: ExamScoringMode
  timingMode: ExamTimingMode
  /** Serverdagi (saqlangan) bloklar: o'qituvchi savollari va tayyorlik uchun */
  serverBlocks?: ExamBlock[]
  sessionId?: string | null
  /** Ma'muriyat ustasi: savollar/elementlar tanlanmaydi, hamma sozlama ochiq, o'qituvchilar avtomatik taklif qilinadi */
  simple?: boolean
  /** Tanlangan sinflar: o'qituvchi taklifi uchun */
  classIds?: string[]
}>()
const emit = defineEmits<{
  'update:modelValue': [value: ExamBlockInput[]]
  preview: [value: ExamSectionsPreview | null]
  changed: []
}>()

const { t } = useI18n()
const toast = useToast()
const preview = ref<ExamSectionsPreview | null>(null)
const previewError = ref('')

const subjectOptions = computed(() => [
  { value: '', label: t('examBlocks.chooseSubject') },
  ...props.subjects.map((s) => ({ value: s.id, label: s.name })),
])

const clone = () => JSON.parse(JSON.stringify(props.modelValue)) as ExamBlockInput[]
function update(mut: (b: ExamBlockInput[]) => void) {
  const b = clone()
  mut(b)
  emit('update:modelValue', b)
}
const addBlock = () =>
  update((b) =>
    b.push({
      subjectId: '',
      title: '',
      targetCount: 10,
      coefficient: 1,
      durationMin: 30,
      contributorIds: [],
      items: [],
    }),
  )
/** Qo'lda o'zgartirilgan bloklar (indeks): avtomatik taklif ularning o'qituvchilarini bosib yubormaydi */
const touched = ref<Set<number>>(new Set())
/** Fan -> shu sinflarda o'qitadigan o'qituvchilar (taklif natijasi) */
const suggested = ref<Record<string, string[]>>({})
const removeBlock = (i: number) => {
  touched.value = new Set([...touched.value].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)))
  update((b) => void b.splice(i, 1))
}

/** Fan va sinflar bo'yicha shu fanni o'qitadigan o'qituvchilarni avtomatik belgilaydi (yangi, tegilmagan blok uchun) */
async function suggestFor(i: number) {
  const blk = props.modelValue[i]
  if (!props.simple || !blk?.subjectId || blk.blockId || touched.value.has(i)) return
  try {
    const r = await examsApi.suggestTeachers(blk.subjectId, props.classIds ?? [])
    suggested.value = { ...suggested.value, [blk.subjectId]: r.teacherIds }
    const cur = props.modelValue[i]
    if (cur && cur.subjectId === blk.subjectId && !touched.value.has(i)) {
      patch(i, { contributorIds: r.teacherIds })
    }
  } catch {
    /* taklif ixtiyoriy: admin qo'lda tanlaydi */
  }
}
watch(
  () => (props.classIds ?? []).join(','),
  () => {
    for (let i = 0; i < props.modelValue.length; i++) void suggestFor(i)
  },
)
const noSuggestion = (i: number) => {
  const blk = props.modelValue[i]
  const s = blk?.subjectId ? suggested.value[blk.subjectId] : undefined
  return !!blk && !blk.blockId && s !== undefined && s.length === 0 && !touched.value.has(i)
}
const patch = (i: number, p: Partial<ExamBlockInput>) => update((b) => void Object.assign(b[i]!, p))
const num = (v: string) => Number(String(v).replace(',', '.'))

function setSubject(i: number, subjectId: string) {
  update((b) => {
    const blk = b[i]!
    if (blk.subjectId !== subjectId) {
      blk.subjectId = subjectId
      // Fan o'zgarsa elementlar va o'qituvchilar yaroqsiz bo'ladi
      blk.items = []
      blk.contributorIds = []
      blk.title = ''
    }
  })
  touched.value.delete(i)
  void nextTick(() => suggestFor(i))
}

/** Blok fanini o'qitadigan o'qituvchilar (maktab admini istalgan fanga) */
const contributorsOf = (subjectId: string) =>
  (props.meta?.contributors ?? []).filter(
    (u) => !subjectId || u.subjectIds === null || u.subjectIds.includes(subjectId),
  )
function toggleContributor(i: number, id: string, on: boolean) {
  touched.value.add(i)
  update((b) => {
    const blk = b[i]!
    blk.contributorIds = on
      ? [...new Set([...blk.contributorIds, id])]
      : blk.contributorIds.filter((x) => x !== id)
  })
}

// ---- Tekshiruv (preview) ----
const serverOf = (i: number): ExamBlock | null => {
  const id = props.modelValue[i]?.blockId
  return id ? (props.serverBlocks?.find((s) => s.id === id) ?? null) : null
}
const contribCount = (i: number) => serverOf(i)?.contribQuestions.length ?? 0

const itemsComplete = (b: ExamBlockInput) =>
  b.items.every((it: ExamSectionItem) =>
    it.kind === 'manual' ? it.questionIds.length > 0 : !!it.topicId && it.count >= 1,
  )
const previewable = computed(
  () =>
    props.modelValue.length > 0 && props.modelValue.every((b) => !!b.subjectId && itemsComplete(b)),
)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
function schedulePreview() {
  clearTimeout(timer)
  if (props.simple) return
  if (!previewable.value) {
    preview.value = null
    previewError.value = ''
    emit('preview', null)
    return
  }
  timer = setTimeout(async () => {
    const my = ++seq
    try {
      const r = await examsApi.previewBlocks(props.modelValue)
      if (my !== seq) return
      preview.value = r
      previewError.value = ''
      emit('preview', r)
    } catch (e) {
      if (my !== seq) return
      preview.value = null
      previewError.value = errorMessage(e, t)
      emit('preview', null)
    }
  }, 350)
}
watch(() => props.modelValue, schedulePreview, { deep: true })
onMounted(() => {
  schedulePreview()
  // Qadamga qaytilganda: tegilmagan, o'qituvchisiz yangi fanlar uchun taklifni qayta hisoblaymiz
  props.modelValue.forEach((b, i) => {
    if (!b.blockId && b.subjectId && b.contributorIds.length === 0) void suggestFor(i)
  })
})
onBeforeUnmount(() => clearTimeout(timer))

/** Ichki SectionsEditor uchun bitta yashirin bo'lim */
const sectionsOf = (b: ExamBlockInput) => [{ title: b.title || 'items', items: b.items }]
const externalPreviewOf = (i: number): ExamSectionsPreview | null => {
  const blk = preview.value?.blocks?.[i]
  return blk
    ? {
        sections: [{ title: '', items: blk.items }],
        errors: [],
        poolSize: 0,
        questionsPerParticipant: blk.count,
        ok: blk.ok,
      }
    : null
}
const countOf = (i: number) => (preview.value?.blocks?.[i]?.count ?? 0) + contribCount(i)

// ---- O'qituvchilar qo'shgan savollar (saqlangan imtihon) ----
const open = ref<Record<string, boolean>>({})
const lists = ref<Record<string, BlockQuestionRow[]>>({})
async function toggleList(blockId: string) {
  open.value[blockId] = !open.value[blockId]
  if (open.value[blockId] && props.sessionId) {
    try {
      lists.value[blockId] = (
        await examsApi.composerBlockQuestions(props.sessionId, blockId)
      ).questions
    } catch (e) {
      toast.error(errorMessage(e, t))
    }
  }
}
async function removeQ(blockId: string, qid: string) {
  if (!props.sessionId) return
  try {
    await examsApi.composerRemoveBlockQuestion(props.sessionId, blockId, qid)
    lists.value[blockId] = (
      await examsApi.composerBlockQuestions(props.sessionId, blockId)
    ).questions
    emit('changed')
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
async function setReady(blockId: string, ready: boolean) {
  if (!props.sessionId) return
  try {
    await examsApi.setBlockReady(props.sessionId, blockId, ready)
    emit('changed')
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
}
</script>

<template>
  <div class="space-y-4" data-testid="blocks-editor">
    <section
      v-for="(b, i) in modelValue"
      :key="b.blockId ?? `new-${i}`"
      class="card space-y-4 p-4"
      :data-testid="`block-${i}`"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-sm font-semibold text-fg">
          {{ t('examBlocks.blockN', { n: i + 1 }) }}
          <span
            v-if="serverOf(i)?.status === 'ready'"
            class="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-normal text-success"
            :data-testid="`block-ready-badge-${i}`"
          >
            {{ t('examBlocks.ready') }}
          </span>
        </h3>
        <BaseButton
          variant="ghost"
          size="sm"
          :aria-label="t('examBlocks.removeBlock')"
          :data-testid="`block-remove-${i}`"
          @click="removeBlock(i)"
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </BaseButton>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BaseSelect
          class="lg:col-span-2"
          :model-value="b.subjectId"
          :label="t('examBlocks.subject')"
          :options="subjectOptions"
          :data-testid="`block-subject-${i}`"
          @update:model-value="setSubject(i, $event)"
        />
        <BaseInput
          :model-value="String(b.targetCount)"
          type="number"
          inputmode="numeric"
          min="0"
          max="500"
          :label="t('examBlocks.target')"
          :data-testid="`block-target-${i}`"
          @update:model-value="patch(i, { targetCount: Math.max(0, Math.floor(num($event)) || 0) })"
        />
        <BaseInput
          v-if="simple || scoringMode === 'coefficient'"
          :model-value="String(b.coefficient)"
          type="number"
          inputmode="decimal"
          step="0.1"
          min="0.1"
          :label="t('examBlocks.coefficient')"
          :data-testid="`block-coef-${i}`"
          @update:model-value="patch(i, { coefficient: num($event) || 0 })"
        />
        <BaseInput
          v-if="simple || timingMode === 'per_block'"
          :model-value="b.durationMin ? String(b.durationMin) : ''"
          type="number"
          inputmode="numeric"
          min="1"
          max="600"
          :label="t('examBlocks.duration')"
          :data-testid="`block-duration-${i}`"
          @update:model-value="patch(i, { durationMin: Math.floor(num($event)) || null })"
        />
      </div>
      <BaseInput
        :model-value="b.title ?? ''"
        :label="t('examBlocks.titleOptional')"
        :maxlength="150"
        :data-testid="`block-title-${i}`"
        @update:model-value="patch(i, { title: $event })"
      />

      <p v-if="!b.subjectId" class="text-sm text-fg-muted">
        {{ t('examBlocks.pickSubjectFirst') }}
      </p>
      <template v-else>
        <fieldset>
          <legend class="mb-1 text-sm font-medium text-fg">
            {{ t('examBlocks.contributors') }}
          </legend>
          <p class="mb-2 text-xs text-fg-muted">{{ t('examBlocks.contributorsHint') }}</p>
          <p
            v-if="noSuggestion(i)"
            class="mb-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning"
            :data-testid="`block-no-suggestion-${i}`"
          >
            {{ t('examBlocks.noSuggestion') }}
          </p>
          <p
            v-if="contributorsOf(b.subjectId).length === 0"
            class="text-sm text-fg-muted"
            :data-testid="`block-no-teachers-${i}`"
          >
            {{ t('examBlocks.noTeachers') }}
          </p>
          <ul v-else class="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
            <li v-for="u in contributorsOf(b.subjectId)" :key="u.id">
              <BaseCheckbox
                :model-value="b.contributorIds.includes(u.id)"
                :label="
                  suggested[b.subjectId]?.includes(u.id)
                    ? `${u.fullName} (${t('examBlocks.inClasses')})`
                    : u.fullName
                "
                :data-testid="`block-contrib-${i}-${u.id}`"
                @update:model-value="toggleContributor(i, u.id, $event)"
              />
            </li>
          </ul>
        </fieldset>

        <div v-if="!simple">
          <p class="mb-2 text-sm font-medium text-fg">{{ t('examBlocks.questions') }}</p>
          <SectionsEditor
            single
            :model-value="sectionsOf(b)"
            :subject-id="b.subjectId"
            :external-preview="externalPreviewOf(i)"
            @update:model-value="patch(i, { items: $event[0]?.items ?? [] })"
          />
        </div>

        <div
          v-if="!simple"
          class="rounded-lg border border-border p-3 text-sm"
          :data-testid="`block-progress-${i}`"
        >
          <p
            :class="
              countOf(i) >= b.targetCount && (preview?.blocks?.[i]?.ok ?? true)
                ? 'text-success'
                : 'text-fg'
            "
          >
            {{ t('examBlocks.progress', { n: countOf(i), target: b.targetCount }) }}
            <template v-if="contribCount(i)">
              · {{ t('examBlocks.fromTeachers', { n: contribCount(i) }) }}
            </template>
          </p>
          <div v-if="serverOf(i)" class="mt-2 flex flex-wrap gap-2">
            <BaseButton
              v-if="contribCount(i)"
              variant="secondary"
              size="sm"
              :data-testid="`block-toggle-list-${i}`"
              @click="toggleList(serverOf(i)!.id)"
            >
              {{ open[serverOf(i)!.id] ? t('examBlocks.hideList') : t('examBlocks.showList') }}
            </BaseButton>
            <BaseButton
              variant="secondary"
              size="sm"
              :data-testid="`block-ready-${i}`"
              @click="setReady(serverOf(i)!.id, serverOf(i)!.status !== 'ready')"
            >
              {{
                serverOf(i)!.status === 'ready' ? t('examBlocks.reopen') : t('examBlocks.markReady')
              }}
            </BaseButton>
          </div>
          <ul
            v-if="serverOf(i) && open[serverOf(i)!.id]"
            class="mt-2 space-y-1"
            :data-testid="`block-list-${i}`"
          >
            <li
              v-for="q in lists[serverOf(i)!.id] ?? []"
              :key="q.id"
              class="flex items-center gap-2 rounded border border-border px-2 py-1"
            >
              <span class="min-w-0 flex-1 truncate">{{ q.preview || '—' }}</span>
              <span class="text-xs text-fg-muted">{{ q.addedByName ?? t('examBlocks.you') }}</span>
              <BaseButton
                variant="ghost"
                size="sm"
                :aria-label="t('examBlocks.removeQuestion')"
                @click="removeQ(serverOf(i)!.id, q.id)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
            </li>
          </ul>
        </div>
      </template>
    </section>

    <BaseButton variant="secondary" data-testid="add-block" @click="addBlock">
      <Plus class="h-4 w-4" aria-hidden="true" />
      {{ t('examBlocks.add') }}
    </BaseButton>

    <p v-if="previewError" class="text-sm text-danger">{{ previewError }}</p>
    <div
      v-else-if="preview"
      class="rounded-lg border border-border p-3 text-sm"
      data-testid="blocks-preview-summary"
    >
      <p class="text-fg">
        {{ t('examSessions.preview.perParticipant', { n: preview.questionsPerParticipant }) }}
        ·
        {{ t('examSessions.preview.pool', { n: preview.poolSize }) }}
      </p>
      <ul
        v-if="preview.errors.length"
        class="mt-1 list-disc space-y-0.5 pl-5 text-danger"
        data-testid="blocks-preview-errors"
      >
        <li v-for="(e, i) in preview.errors" :key="i">{{ e }}</li>
      </ul>
    </div>
  </div>
</template>
