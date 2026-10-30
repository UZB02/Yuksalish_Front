<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CircleX, TriangleAlert } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { ActivatePayload, TimetableWarning } from '@/api/timetable.api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { isPastDate } from '@/utils/timetable'
import { buildIssues, type IssueContext } from '@/utils/timetableIssues'

/**
 * Faollashtirish oynasi: sana, ogohlantirishlar (sana bo'yicha qayta yuklanadi),
 * to'qnashuvda force + izoh, "biriktirishlarni yangilash", o'tmish sana tasdig'i.
 */
const props = defineProps<{
  open: boolean
  title: string
  defaultFrom: string
  today: string
  min?: string
  max?: string
  busy?: boolean
  /** Tanlangan sana uchun ogohlantirishlar (bitta versiya). Ommaviy rejimda berilmaydi. */
  loadWarnings?: (from: string) => Promise<TimetableWarning[]>
  /** Ommaviy rejimda ko'rsatiladigan sinflar soni */
  bulkCount?: number
  /** Ommaviy rejimda: oldindan ma'lum ogohlantirishlar (sinflar bo'yicha yig'ilgan) */
  presetWarnings?: TimetableWarning[]
  /** Muammo matnlari uchun fan/o'qituvchi nomlari (ixtiyoriy) */
  issueContext?: IssueContext
}>()
const emit = defineEmits<{ close: []; submit: [payload: ActivatePayload] }>()
const { t } = useI18n()

const from = ref('')
const warnings = ref<TimetableWarning[]>([])
const loadingWarnings = ref(false)
const force = ref(false)
const note = ref('')
const sync = ref(true)
const confirmPast = ref(false)
let seq = 0

async function refresh() {
  if (!props.loadWarnings || !from.value) {
    warnings.value = props.presetWarnings ?? []
    return
  }
  const my = ++seq
  loadingWarnings.value = true
  try {
    const w = await props.loadWarnings(from.value)
    if (my === seq) warnings.value = w
  } catch {
    if (my === seq) warnings.value = []
  } finally {
    if (my === seq) loadingWarnings.value = false
  }
}

watch(
  () => props.open,
  (o) => {
    if (!o) return
    from.value = props.defaultFrom
    force.value = false
    note.value = ''
    sync.value = true
    confirmPast.value = false
    void refresh()
  },
  { immediate: true },
)
watch(from, () => {
  confirmPast.value = false
  if (props.open) void refresh()
})

const issues = computed(() => buildIssues(warnings.value, t, props.issueContext))
const errors = computed(() => issues.value.filter((i) => i.severity === 'error'))
const others = computed(() => issues.value.filter((i) => i.severity !== 'error'))
const hasUnassigned = computed(() => warnings.value.some((w) => w.code === 'teacher_not_assigned'))
const past = computed(() => isPastDate(from.value, props.today))

const canSubmit = computed(() => {
  if (!from.value || props.busy || loadingWarnings.value) return false
  if (props.min && from.value < props.min) return false
  if (props.max && from.value > props.max) return false
  if (past.value && !confirmPast.value) return false
  if (errors.value.length && (!force.value || !note.value.trim())) return false
  return true
})

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    validFrom: from.value,
    force: errors.value.length ? true : undefined,
    note: note.value.trim() || null,
    syncAssignments: sync.value && hasUnassigned.value ? true : undefined,
    confirmPast: past.value ? true : undefined,
  })
}

const where = (i: { className?: string; cellLabel: string }) =>
  i.className ? `${i.className} · ${i.cellLabel}` : i.cellLabel
</script>

<template>
  <BaseModal :open="open" :title="title" size="lg" persistent @close="emit('close')">
    <div class="space-y-4" data-testid="activate-modal">
      <p v-if="bulkCount" class="text-sm text-fg-muted">
        {{ t('timetable.activate.bulkInfo', { n: bulkCount }) }}
      </p>
      <BaseInput
        v-model="from"
        type="date"
        :label="t('timetable.activate.from')"
        :min="min"
        :max="max"
        required
        data-testid="activate-from"
      />

      <div
        v-if="past"
        class="space-y-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2"
        data-testid="past-warning"
      >
        <p class="text-sm text-warning">{{ t('timetable.activate.pastWarning') }}</p>
        <BaseCheckbox
          v-model="confirmPast"
          :label="t('timetable.activate.pastConfirm')"
          data-testid="confirm-past"
        />
      </div>

      <div v-if="loadingWarnings" class="text-sm text-fg-muted">{{ t('common.loading') }}</div>

      <section v-if="errors.length" class="space-y-2" data-testid="block-warnings">
        <h3 class="flex items-center gap-1.5 text-sm font-semibold text-danger">
          <CircleX class="h-4 w-4" aria-hidden="true" />
          {{ t('timetable.activate.doubleBooked', { n: errors.length }) }}
        </h3>
        <ul class="max-h-48 space-y-2 overflow-y-auto rounded-lg bg-danger-soft px-3 py-2">
          <li v-for="i in errors" :key="i.key" class="text-xs" data-testid="block-item">
            <p class="font-semibold text-danger">{{ i.title }}</p>
            <p class="text-fg">{{ i.text }}</p>
            <p class="text-fg-muted">{{ where(i) }}</p>
          </li>
        </ul>
        <BaseCheckbox
          v-model="force"
          :label="t('timetable.activate.force')"
          :description="t('timetable.activate.forceHint')"
          data-testid="force"
        />
        <div v-if="force">
          <label class="mb-1.5 block text-sm font-medium text-fg" for="activate-note">
            {{ t('timetable.activate.note') }}<span class="ml-0.5 text-danger">*</span>
          </label>
          <textarea
            id="activate-note"
            v-model="note"
            rows="2"
            maxlength="500"
            class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500"
            data-testid="force-note"
          />
        </div>
      </section>

      <section v-if="others.length" class="space-y-2" data-testid="soft-warnings">
        <h3 class="flex items-center gap-1.5 text-sm font-semibold text-warning">
          <TriangleAlert class="h-4 w-4" aria-hidden="true" />
          {{ t('timetable.activate.warnings', { n: others.length }) }}
        </h3>
        <ul class="max-h-40 space-y-2 overflow-y-auto rounded-lg bg-warning-soft px-3 py-2">
          <li v-for="i in others" :key="i.key" class="text-xs" data-testid="soft-item">
            <p class="font-semibold text-warning">{{ i.title }}</p>
            <p class="text-fg">{{ i.text }}</p>
            <p class="text-fg-muted">{{ where(i) }}</p>
          </li>
        </ul>
      </section>

      <BaseCheckbox
        v-if="hasUnassigned"
        v-model="sync"
        :label="t('timetable.activate.sync')"
        :description="t('timetable.activate.syncHint')"
        data-testid="sync"
      />
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="emit('close')">
        {{ t('common.cancel') }}
      </BaseButton>
      <BaseButton
        :disabled="!canSubmit"
        :loading="busy"
        data-testid="activate-submit"
        @click="submit"
      >
        {{ t('timetable.activate.submit') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
