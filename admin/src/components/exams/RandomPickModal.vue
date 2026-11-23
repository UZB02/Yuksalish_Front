<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { examsApi } from '@/api/exams.api'
import type { QuestionType, RandomAvailability, RandomQuestion, RandomSel } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'
import BlocksView from './BlocksView.vue'

/**
 * "Daraja bo'yicha tasodifiy" (E8). Mavzular (bir nechta yoki hammasi), tur, daraja bo'yicha sonlar; jonli
 * mavjudlik. Rejim 1: server tasodifiy tanlaydi, ko'rinadi, almashtiriladi/olib tashlanadi, "N ta savolni qo'shish"
 * (qat'iy savollar). Rejim 2: qoida saqlanadi (har o'quvchiga boshqacha).
 */
const props = defineProps<{
  open: boolean
  sessionId: string
  blockId: string
  topics: { id: string; name: string }[]
}>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useI18n()
const toast = useToast()

const LEVELS = ['1', '2', '3'] as const
const KEYS = { '1': 'easy', '2': 'medium', '3': 'hard' } as const
const allTopics = ref(true)
const picked = ref<Set<string>>(new Set())
const type = ref('')
const counts = ref<Record<'1' | '2' | '3', string>>({ '1': '0', '2': '0', '3': '0' })
const mode = ref<'1' | '2'>('1')
const avail = ref<RandomAvailability | null>(null)
const items = ref<RandomQuestion[]>([])
const shortfall = ref<Record<string, number>>({})
const busy = ref(false)
const error = ref('')
const replaceBusy = ref('')

const typeOptions = computed(() => [
  { value: '', label: t('randomPick.anyType') },
  ...(['single', 'multi', 'short', 'essay'] as const).map((x) => ({
    value: x,
    label: t(`exams.types.${x}`),
  })),
])
const sel = computed<RandomSel>(() => ({
  ...(allTopics.value ? { allTopics: true } : { topicIds: [...picked.value] }),
  type: (type.value || null) as QuestionType | null,
}))
const hasTopics = computed(() => allTopics.value || picked.value.size > 0)
const n = (l: '1' | '2' | '3') =>
  Math.max(0, Math.min(100, Math.floor(Number(counts.value[l]) || 0)))
const total = computed(() => n('1') + n('2') + n('3'))

watch(
  () => props.open,
  (o) => {
    if (!o) return
    allTopics.value = true
    picked.value = new Set()
    type.value = ''
    counts.value = { '1': '0', '2': '0', '3': '0' }
    mode.value = '1'
    items.value = []
    shortfall.value = {}
    error.value = ''
    avail.value = null
    void loadAvail()
  },
  { immediate: true },
)

let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0
async function loadAvail() {
  if (!props.open || !hasTopics.value) {
    avail.value = null
    return
  }
  const my = ++seq
  try {
    const r = await examsApi.randomAvailability(props.sessionId, props.blockId, sel.value)
    if (my === seq) avail.value = r
  } catch (e) {
    if (my === seq) {
      avail.value = null
      error.value = errorMessage(e, t)
    }
  }
}
watch([allTopics, picked, type], () => {
  // tanlov o'zgarsa eski natija yaroqsiz
  items.value = []
  shortfall.value = {}
  error.value = ''
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void loadAvail(), 250)
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function toggleTopic(id: string, on: boolean) {
  const s = new Set(picked.value)
  if (on) s.add(id)
  else s.delete(id)
  picked.value = s
}

const availText = (l: '1' | '2' | '3') => {
  const a = avail.value?.difficulties[l]
  return a
    ? t('randomPick.avail', {
        level: t(`randomPick.levels.${l}`),
        total: a.total,
        inExam: a.inExam,
        available: a.available,
      })
    : ''
}

async function pick() {
  error.value = ''
  if (!hasTopics.value) {
    error.value = t('randomPick.noTopics')
    return
  }
  if (total.value < 1) {
    error.value = t('randomPick.nothing')
    return
  }
  busy.value = true
  try {
    const r = await examsApi.randomPreview(props.sessionId, props.blockId, {
      ...sel.value,
      counts: { easy: n('1'), medium: n('2'), hard: n('3') },
    })
    items.value = r.items
    shortfall.value = r.shortfall
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    busy.value = false
  }
}

const shortfallText = computed(() => {
  const parts = LEVELS.filter((l) => (shortfall.value[l] ?? 0) > 0).map((l) =>
    t('randomPick.shortfallPart', {
      level: t(`randomPick.levels.${l}`),
      want: n(l),
      have: n(l) - (shortfall.value[l] ?? 0),
    }),
  )
  return parts.length ? t('randomPick.shortfall', { parts: parts.join('; ') }) : ''
})

async function replaceOne(q: RandomQuestion) {
  replaceBusy.value = q.id
  try {
    const r = await examsApi.randomReplace(props.sessionId, props.blockId, {
      ...sel.value,
      difficulty: q.difficulty,
      exclude: items.value.map((x) => x.id),
    })
    items.value = items.value.map((x) => (x.id === q.id ? r.item : x))
  } catch (e) {
    toast.error(
      errorMessage(e, t) === t('errors.codes.CONFLICT')
        ? t('randomPick.noReplace')
        : errorMessage(e, t),
    )
  } finally {
    replaceBusy.value = ''
  }
}
const removeOne = (id: string) => {
  items.value = items.value.filter((x) => x.id !== id)
}

async function addPicked() {
  if (!items.value.length) return
  busy.value = true
  error.value = ''
  try {
    const r = await examsApi.addToBlock(
      props.sessionId,
      props.blockId,
      items.value.map((x) => x.id),
    )
    toast.success(t('randomPick.added', { n: r.added }))
    emit('changed')
    emit('close')
  } catch (e) {
    error.value = errorMessage(e, t)
  } finally {
    busy.value = false
  }
}

async function saveRules() {
  error.value = ''
  if (!hasTopics.value) {
    error.value = t('randomPick.noTopics')
    return
  }
  if (total.value < 1) {
    error.value = t('randomPick.nothing')
    return
  }
  busy.value = true
  let short = false
  try {
    for (const l of LEVELS) {
      if (n(l) < 1) continue
      const r = await examsApi.addBlockRule(props.sessionId, props.blockId, {
        ...sel.value,
        difficulty: Number(l),
        count: n(l),
      })
      if (!r.enough) short = true
    }
    toast.success(t('randomPick.ruleSaved'))
    if (short) toast.info(t('randomPick.ruleNotEnough'))
    emit('changed')
    emit('close')
  } catch (e) {
    error.value = errorMessage(e, t)
    emit('changed')
  } finally {
    busy.value = false
  }
}

const letter = (i: number) => String.fromCharCode(65 + i)
</script>

<template>
  <BaseModal
    :open="open"
    :title="t('randomPick.title')"
    size="xl"
    persistent
    @close="emit('close')"
  >
    <div class="space-y-4" data-testid="random-modal">
      <fieldset class="space-y-2">
        <legend class="mb-1 text-sm font-medium text-fg">{{ t('randomPick.topics') }}</legend>
        <BaseCheckbox v-model="allTopics" :label="t('randomPick.allTopics')" data-testid="rp-all" />
        <ul
          v-if="!allTopics"
          class="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2"
          data-testid="rp-topics"
        >
          <li v-for="tp in topics" :key="tp.id">
            <BaseCheckbox
              :model-value="picked.has(tp.id)"
              :label="tp.name"
              :data-testid="`rp-topic-${tp.id}`"
              @update:model-value="toggleTopic(tp.id, $event)"
            />
          </li>
        </ul>
      </fieldset>

      <BaseSelect
        v-model="type"
        :label="t('randomPick.type')"
        :options="typeOptions"
        data-testid="rp-type"
      />

      <div>
        <p class="mb-1 text-sm font-medium text-fg">{{ t('randomPick.counts') }}</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div v-for="l in LEVELS" :key="l">
            <BaseInput
              v-model="counts[l]"
              type="number"
              min="0"
              max="100"
              :label="t(`randomPick.levels.${l}`)"
              :data-testid="`rp-count-${KEYS[l]}`"
            />
            <p class="mt-1 text-xs text-fg-muted" :data-testid="`rp-avail-${KEYS[l]}`">
              {{ availText(l) }}
            </p>
          </div>
        </div>
      </div>

      <fieldset class="space-y-2">
        <legend class="mb-1 text-sm font-medium text-fg">{{ t('randomPick.mode') }}</legend>
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
          <input v-model="mode" type="radio" value="1" data-testid="rp-mode1" />
          <span class="text-sm">
            <b class="block text-fg">{{ t('randomPick.mode1') }}</b>
            <span class="text-fg-muted">{{ t('randomPick.mode1Hint') }}</span>
          </span>
        </label>
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
          <input v-model="mode" type="radio" value="2" data-testid="rp-mode2" />
          <span class="text-sm">
            <b class="block text-fg">{{ t('randomPick.mode2') }}</b>
            <span class="text-fg-muted">{{ t('randomPick.mode2Hint') }}</span>
          </span>
        </label>
      </fieldset>

      <p v-if="error" class="text-sm text-danger" data-testid="rp-error">{{ error }}</p>

      <div v-if="mode === '1'" class="space-y-3">
        <BaseButton
          variant="secondary"
          :loading="busy && !items.length"
          data-testid="rp-pick"
          @click="pick"
        >
          {{ items.length ? t('randomPick.repick') : t('randomPick.pick') }}
        </BaseButton>
        <p
          v-if="shortfallText"
          class="rounded-lg border border-warning bg-warning-soft px-3 py-2 text-sm text-warning"
          data-testid="rp-shortfall"
        >
          {{ shortfallText }}
        </p>
        <div v-if="items.length" data-testid="rp-preview">
          <p class="mb-2 text-sm font-semibold text-fg">
            {{ t('randomPick.preview') }} · {{ t('randomPick.total', { n: items.length }) }}
          </p>
          <ol class="max-h-96 space-y-3 overflow-y-auto pr-1">
            <li
              v-for="(q, i) in items"
              :key="q.id"
              class="space-y-2 rounded-lg border border-border p-3"
              :data-testid="`rp-item-${i}`"
              :data-qid="q.id"
            >
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="font-semibold text-fg">{{ i + 1 }}.</span>
                <BaseBadge
                  :tone="q.difficulty === 1 ? 'success' : q.difficulty === 2 ? 'warning' : 'danger'"
                >
                  {{ t(`randomPick.levels.${q.difficulty}`) }}
                </BaseBadge>
                <span class="text-fg-muted">{{ t(`exams.types.${q.type}`) }} · {{ q.points }}</span>
                <span class="ml-auto flex gap-1">
                  <BaseButton
                    size="sm"
                    variant="secondary"
                    :loading="replaceBusy === q.id"
                    :data-testid="`rp-replace-${i}`"
                    @click="replaceOne(q)"
                    >{{ t('randomPick.replace') }}</BaseButton
                  >
                  <BaseButton
                    size="sm"
                    variant="ghost"
                    :data-testid="`rp-remove-${i}`"
                    @click="removeOne(q.id)"
                    >{{ t('randomPick.remove') }}</BaseButton
                  >
                </span>
              </div>
              <BlocksView :blocks="q.content" />
              <ul v-if="q.options.length" class="space-y-1">
                <li
                  v-for="(o, oi) in q.options"
                  :key="o.id"
                  class="flex items-start gap-2 rounded-md px-2 py-1 text-sm"
                  :class="o.correct ? 'bg-success-soft text-success' : 'text-fg'"
                  :data-correct="o.correct ? 'true' : 'false'"
                >
                  <span class="w-5 shrink-0 font-semibold">{{ letter(oi) }}</span>
                  <BlocksView :blocks="o.content" inline class="min-w-0 flex-1" />
                </li>
              </ul>
              <p v-else-if="q.acceptedAnswers" class="text-sm text-success">
                {{ t('randomPick.answers') }}: {{ q.acceptedAnswers.join(' · ') }}
              </p>
              <p v-else-if="q.rubric" class="text-sm text-fg-muted">
                {{ t('randomPick.rubric') }}: {{ q.rubric }}
              </p>
            </li>
          </ol>
        </div>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton
        v-if="mode === '1'"
        :disabled="!items.length"
        :loading="busy && !!items.length"
        data-testid="rp-add"
        @click="addPicked"
      >
        {{ t('randomPick.addN', { n: items.length }) }}
      </BaseButton>
      <BaseButton v-else :loading="busy" data-testid="rp-save-rule" @click="saveRules">
        {{ t('randomPick.saveRule') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
