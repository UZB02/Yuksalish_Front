<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import type { QuestionListItem } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { errorMessage } from '@/utils/errors'
import type { TopicOption } from './useTopicOptions'

/**
 * Qo'lda tanlash: Mavzu -> savollar (faqat FAOL savollar), belgilash. Tanlov mavzular o'rtasida saqlanadi;
 * tasdiqlanganda faqat savol id lari qaytadi.
 */
const props = defineProps<{ open: boolean; topics: TopicOption[]; selected: string[] }>()
const emit = defineEmits<{ close: []; confirm: [ids: string[]] }>()

const { t } = useI18n()
const topicId = ref('')
const questions = ref<QuestionListItem[]>([])
const loading = ref(false)
const error = ref('')
const picked = ref<Set<string>>(new Set())

const options = computed(() =>
  props.topics.map((x) => ({ value: x.id, label: `${x.label} (${x.questionsCount})` })),
)

watch(
  () => props.open,
  (o) => {
    if (!o) return
    picked.value = new Set(props.selected)
    topicId.value = props.topics[0]?.id ?? ''
    error.value = ''
  },
  { immediate: true },
)

async function load() {
  if (!topicId.value) {
    questions.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const r = await examsApi.listQuestions({ topicId: topicId.value, status: 'active', limit: 100 })
    questions.value = r.items
  } catch (e) {
    questions.value = []
    error.value = errorMessage(e, t)
  } finally {
    loading.value = false
  }
}
watch(topicId, load, { immediate: true })

const allShown = computed(
  () => questions.value.length > 0 && questions.value.every((q) => picked.value.has(q.id)),
)
function toggle(id: string, on: boolean) {
  const s = new Set(picked.value)
  if (on) s.add(id)
  else s.delete(id)
  picked.value = s
}
function toggleAll(on: boolean) {
  const s = new Set(picked.value)
  for (const q of questions.value) {
    if (on) s.add(q.id)
    else s.delete(q.id)
  }
  picked.value = s
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('examSessions.picker.title')"
    size="xl"
    persistent
    @close="emit('close')"
  >
    <BaseSelect
      v-model="topicId"
      :label="t('examSessions.picker.topic')"
      :options="options"
      data-testid="picker-topic"
    />
    <p v-if="error" class="mt-3 text-sm text-danger">{{ error }}</p>
    <p v-else-if="loading" class="mt-3 text-sm text-fg-muted">{{ t('common.loading') }}</p>
    <p
      v-else-if="questions.length === 0"
      class="mt-3 text-sm text-fg-muted"
      data-testid="picker-empty"
    >
      {{ t('examSessions.picker.empty') }}
    </p>
    <template v-else>
      <div class="mt-3 border-b border-border pb-2">
        <BaseCheckbox
          :model-value="allShown"
          :label="t('examSessions.picker.selectAll')"
          @update:model-value="toggleAll"
        />
      </div>
      <ul class="max-h-80 divide-y divide-border overflow-y-auto" data-testid="picker-list">
        <li v-for="q in questions" :key="q.id" class="py-2">
          <BaseCheckbox
            :model-value="picked.has(q.id)"
            :label="q.preview || t('examSessions.picker.noText')"
            :description="`${t(`exams.difficulty.${q.difficulty}`)} · ${t(`exams.types.${q.type}`)} · ${q.points}`"
            :data-testid="`pick-${q.id}`"
            @update:model-value="toggle(q.id, $event)"
          />
        </li>
      </ul>
    </template>
    <template #footer>
      <span class="mr-auto text-sm text-fg-muted" data-testid="picker-count">
        {{ t('examSessions.picker.selected', { n: picked.size }) }}
      </span>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton data-testid="picker-confirm" @click="emit('confirm', [...picked])">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
