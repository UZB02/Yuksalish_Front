<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Plus, Trash2 } from 'lucide-vue-next'
import { examsApi } from '@/api/exams.api'
import type { ExamSection, ExamSectionsPreview, QuestionType } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { errorMessage } from '@/utils/errors'
import QuestionPickerModal from './QuestionPickerModal.vue'
import { useTopicOptions } from './useTopicOptions'

/**
 * Bo'limlar muharriri: har bo'limda qo'lda tanlangan savollar va/yoki qoidalar (mavzu, soni, qiyinlik, tur).
 * Har o'zgarishdan keyin server "mavjud savollar" sonini tekshiradi (preview) va yetmasa xato ko'rsatadi.
 */
const props = defineProps<{ modelValue: ExamSection[]; subjectId?: string | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: ExamSection[]]
  preview: [value: ExamSectionsPreview | null]
}>()

const { t } = useI18n()
const router = useRouter()
/** Mavzu savollari sahifasi (yangi oynada: usta holati yo'qolmasin) */
const topicHref = (id: string) =>
  router.resolve({ name: 'exam-topic', params: { topicId: id } }).href
const { topics: allTopics, load: loadTopics } = useTopicOptions()
const topics = computed(() =>
  props.subjectId
    ? allTopics.value.filter((x) => x.subjectId === props.subjectId)
    : allTopics.value,
)
const topicOptions = computed(() => topics.value.map((x) => ({ value: x.id, label: x.label })))
const diffOptions = computed(() => [
  { value: '', label: t('examSessions.rule.anyDifficulty') },
  ...[1, 2, 3].map((d) => ({ value: String(d), label: t(`exams.difficulty.${d}`) })),
])
const typeOptions = computed(() => [
  { value: '', label: t('examSessions.rule.anyType') },
  ...(['single', 'multi', 'short', 'essay'] as const).map((k) => ({
    value: k,
    label: t(`exams.types.${k}`),
  })),
])

const preview = ref<ExamSectionsPreview | null>(null)
const previewError = ref('')
const pickerFor = ref<{ si: number; ii: number } | null>(null)

const clone = () => JSON.parse(JSON.stringify(props.modelValue)) as ExamSection[]
function update(mut: (s: ExamSection[]) => void) {
  const s = clone()
  mut(s)
  emit('update:modelValue', s)
}

const addSection = () =>
  update((s) =>
    s.push({ title: t('examSessions.section.defaultTitle', { n: s.length + 1 }), items: [] }),
  )
const removeSection = (si: number) => update((s) => void s.splice(si, 1))
const setTitle = (si: number, v: string) => update((s) => void (s[si]!.title = v))
const addManual = (si: number) =>
  update((s) => s[si]!.items.push({ kind: 'manual', questionIds: [] }))
const addRule = (si: number) =>
  update((s) =>
    s[si]!.items.push({
      kind: 'rule',
      topicId: topics.value[0]?.id ?? '',
      count: 5,
      difficulty: null,
      type: null,
    }),
  )
const removeItem = (si: number, ii: number) => update((s) => void s[si]!.items.splice(ii, 1))
function setRule(si: number, ii: number, patch: Record<string, unknown>) {
  update((s) => {
    const it = s[si]!.items[ii]!
    if (it.kind === 'rule') Object.assign(it, patch)
  })
}
function onPicked(ids: string[]) {
  const at = pickerFor.value
  pickerFor.value = null
  if (!at) return
  update((s) => {
    const it = s[at.si]!.items[at.ii]!
    if (it.kind === 'manual') it.questionIds = ids
  })
}
const pickerSelected = computed(() => {
  const at = pickerFor.value
  const it = at ? props.modelValue[at.si]?.items[at.ii] : null
  return it && it.kind === 'manual' ? it.questionIds : []
})

// Tekshiruv (preview): to'liq to'ldirilgan bo'lsa serverdan "mavjud N" ni olamiz
const complete = computed(
  () =>
    props.modelValue.length > 0 &&
    props.modelValue.every(
      (s) =>
        s.title.trim() &&
        s.items.length > 0 &&
        s.items.every((i) =>
          i.kind === 'manual' ? i.questionIds.length > 0 : !!i.topicId && i.count >= 1,
        ),
    ),
)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
function schedulePreview() {
  clearTimeout(timer)
  if (!complete.value) {
    preview.value = null
    previewError.value = ''
    emit('preview', null)
    return
  }
  timer = setTimeout(async () => {
    const my = ++seq
    try {
      const r = await examsApi.previewSections(props.modelValue)
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
onMounted(async () => {
  await loadTopics()
  schedulePreview()
})
onBeforeUnmount(() => clearTimeout(timer))

const infoOf = (si: number, ii: number) => preview.value?.sections[si]?.items[ii] ?? null
const typeValue = (v: QuestionType | null | undefined) => v ?? ''
</script>

<template>
  <div class="space-y-4" data-testid="sections-editor">
    <section
      v-for="(sec, si) in modelValue"
      :key="si"
      class="card space-y-3 p-4"
      :data-testid="`section-${si}`"
    >
      <div class="flex items-end gap-2">
        <BaseInput
          class="min-w-0 flex-1"
          :model-value="sec.title"
          :label="t('examSessions.section.title')"
          :maxlength="150"
          :data-testid="`section-title-${si}`"
          @update:model-value="setTitle(si, $event)"
        />
        <BaseButton
          variant="ghost"
          size="sm"
          :aria-label="t('examSessions.section.remove')"
          :data-testid="`section-remove-${si}`"
          @click="removeSection(si)"
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </BaseButton>
      </div>

      <ul class="space-y-3">
        <li
          v-for="(it, ii) in sec.items"
          :key="ii"
          class="rounded-lg border border-border bg-surface-muted/40 p-3"
          :data-testid="`item-${si}-${ii}`"
        >
          <template v-if="it.kind === 'manual'">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium text-fg">{{ t('examSessions.item.manual') }}</span>
              <span class="text-sm text-fg-muted" :data-testid="`manual-count-${si}-${ii}`">
                {{ t('examSessions.item.selectedN', { n: it.questionIds.length }) }}
              </span>
              <BaseButton
                variant="secondary"
                size="sm"
                :data-testid="`manual-pick-${si}-${ii}`"
                @click="pickerFor = { si, ii }"
              >
                {{ t('examSessions.item.pick') }}
              </BaseButton>
              <BaseButton
                class="ml-auto"
                variant="ghost"
                size="sm"
                :aria-label="t('examSessions.item.remove')"
                @click="removeItem(si, ii)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
            </div>
            <p
              v-if="infoOf(si, ii)"
              class="mt-1 text-xs"
              :class="infoOf(si, ii)!.ok ? 'text-fg-muted' : 'text-danger'"
              :data-testid="`item-info-${si}-${ii}`"
            >
              {{
                t('examSessions.item.manualInfo', {
                  available: infoOf(si, ii)!.available,
                  requested: infoOf(si, ii)!.requested,
                })
              }}
              <template v-if="infoOf(si, ii)!.draft">
                · {{ t('examSessions.item.manualDraft', { n: infoOf(si, ii)!.draft }) }}
              </template>
            </p>
          </template>
          <template v-else>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BaseSelect
                class="lg:col-span-2"
                :model-value="it.topicId"
                :label="t('examSessions.rule.topic')"
                :options="topicOptions"
                :data-testid="`rule-topic-${si}-${ii}`"
                @update:model-value="setRule(si, ii, { topicId: $event })"
              />
              <BaseInput
                :model-value="String(it.count)"
                type="number"
                inputmode="numeric"
                min="1"
                max="200"
                :label="t('examSessions.rule.count')"
                :data-testid="`rule-count-${si}-${ii}`"
                @update:model-value="setRule(si, ii, { count: Math.floor(Number($event)) || 0 })"
              />
              <BaseSelect
                :model-value="it.difficulty ? String(it.difficulty) : ''"
                :label="t('examSessions.rule.difficulty')"
                :options="diffOptions"
                :data-testid="`rule-difficulty-${si}-${ii}`"
                @update:model-value="
                  setRule(si, ii, { difficulty: $event ? Number($event) : null })
                "
              />
              <BaseSelect
                :model-value="typeValue(it.type)"
                :label="t('examSessions.rule.type')"
                :options="typeOptions"
                :data-testid="`rule-type-${si}-${ii}`"
                @update:model-value="setRule(si, ii, { type: $event || null })"
              />
            </div>
            <div class="mt-2 flex items-center gap-2">
              <p
                v-if="infoOf(si, ii)"
                class="text-xs"
                :class="infoOf(si, ii)!.ok ? 'text-success' : 'text-danger'"
                :data-testid="`item-info-${si}-${ii}`"
              >
                {{
                  t(
                    infoOf(si, ii)!.draft
                      ? 'examSessions.rule.availableDraft'
                      : 'examSessions.rule.available',
                    {
                      available: infoOf(si, ii)!.available,
                      requested: infoOf(si, ii)!.requested,
                      draft: infoOf(si, ii)!.draft ?? 0,
                    },
                  )
                }}
              </p>
              <a
                v-if="
                  infoOf(si, ii) &&
                  !infoOf(si, ii)!.ok &&
                  infoOf(si, ii)!.draft &&
                  infoOf(si, ii)!.topicId
                "
                :href="topicHref(infoOf(si, ii)!.topicId!)"
                target="_blank"
                rel="noopener"
                class="text-xs font-medium text-primary-600 underline"
                :data-testid="`activate-link-${si}-${ii}`"
              >
                {{ t('examSessions.rule.activateLink') }}
              </a>
              <BaseButton
                class="ml-auto"
                variant="ghost"
                size="sm"
                :aria-label="t('examSessions.item.remove')"
                @click="removeItem(si, ii)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </BaseButton>
            </div>
          </template>
        </li>
      </ul>

      <div class="flex flex-wrap gap-2">
        <BaseButton
          variant="secondary"
          size="sm"
          :data-testid="`add-manual-${si}`"
          @click="addManual(si)"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ t('examSessions.item.addManual') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          size="sm"
          :data-testid="`add-rule-${si}`"
          @click="addRule(si)"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ t('examSessions.item.addRule') }}
        </BaseButton>
      </div>
    </section>

    <BaseButton variant="secondary" data-testid="add-section" @click="addSection">
      <Plus class="h-4 w-4" aria-hidden="true" />
      {{ t('examSessions.section.add') }}
    </BaseButton>

    <p v-if="previewError" class="text-sm text-danger">{{ previewError }}</p>
    <div
      v-else-if="preview"
      class="rounded-lg border border-border p-3 text-sm"
      data-testid="preview-summary"
    >
      <p class="text-fg">
        {{ t('examSessions.preview.perParticipant', { n: preview.questionsPerParticipant }) }}
        ·
        {{ t('examSessions.preview.pool', { n: preview.poolSize }) }}
      </p>
      <ul
        v-if="preview.errors.length"
        class="mt-1 list-disc space-y-0.5 pl-5 text-danger"
        data-testid="preview-errors"
      >
        <li v-for="(e, i) in preview.errors" :key="i">{{ e }}</li>
      </ul>
    </div>

    <QuestionPickerModal
      :open="!!pickerFor"
      :topics="topics"
      :selected="pickerSelected"
      @close="pickerFor = null"
      @confirm="onPicked"
    />
  </div>
</template>
