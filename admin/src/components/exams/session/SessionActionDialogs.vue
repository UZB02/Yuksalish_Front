<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Printer } from 'lucide-vue-next'
import type { ExamSession } from '@/api/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import type { useSessionActions } from '@/composables/useSessionActions'

/** Imtihon darajasidagi oynalar: rad etish, qayta ochish, hammaga vaqt, o'chirish va PIN kartochkalari (sinf tanlash). */
const props = defineProps<{ s: ExamSession; a: ReturnType<typeof useSessionActions> }>()
const { t } = useI18n()
const A = props.a

const classOptions = computed(() => {
  const names = [
    ...new Set(props.s.participants.map((p) => p.className).filter(Boolean)),
  ] as string[]
  return [
    { value: '', label: t('examSessions.detail.allClasses') },
    ...names.map((n) => ({ value: n, label: n })),
  ]
})
</script>

<template>
  <BaseModal
    :open="A.deleteOpen.value"
    :title="t('examSessions.detail.deleteTitle')"
    persistent
    @close="A.deleteOpen.value = false"
  >
    <div class="space-y-4" data-testid="delete-dialog">
      <p class="text-sm text-fg-muted">{{ t('examSessions.detail.deleteChoice') }}</p>
      <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
        <input
          v-model="A.deleteMode.value"
          type="radio"
          value="exam_only"
          data-testid="delete-exam-only"
        />
        <span class="text-sm">
          <b class="block text-fg">{{ t('examSessions.detail.deleteExamOnly') }}</b>
          {{ t('examSessions.detail.deleteExamOnlyHint') }}
        </span>
      </label>
      <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-danger p-3">
        <input
          v-model="A.deleteMode.value"
          type="radio"
          value="with_results"
          data-testid="delete-with-results"
        />
        <span class="text-sm">
          <b class="block text-danger">{{ t('examSessions.detail.deleteWithResults') }}</b>
          {{ t('examSessions.detail.deleteWithResultsHint') }}
        </span>
      </label>
      <div
        v-if="A.deleteMode.value === 'with_results'"
        class="space-y-2"
        data-testid="delete-confirm-box"
      >
        <p class="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {{ t('examSessions.detail.deleteIrreversible') }}
        </p>
        <BaseInput
          v-model="A.deleteTitle.value"
          :label="t('examSessions.detail.deleteTypeTitle', { title: s.title })"
          :error="A.deleteError.value"
          data-testid="delete-title"
        />
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="A.deleteOpen.value = false">{{
        t('common.cancel')
      }}</BaseButton>
      <BaseButton
        variant="danger"
        :loading="A.busy.value"
        :disabled="A.deleteMode.value === 'with_results' && A.deleteTitle.value !== s.title"
        data-testid="delete-confirm"
        @click="A.doDelete"
      >
        {{ t('common.delete') }}
      </BaseButton>
    </template>
  </BaseModal>

  <BaseModal
    :open="A.reopenOpen.value"
    :title="t('examSessions.detail.reopenTitle')"
    persistent
    @close="A.reopenOpen.value = false"
  >
    <div class="space-y-4">
      <p class="text-sm text-fg-muted">{{ t('examSessions.detail.reopenHint') }}</p>
      <BaseInput
        v-model="A.reopenReason.value"
        :label="t('examSessions.detail.reopenReason')"
        :error="A.reopenError.value.reason"
        :maxlength="500"
        data-testid="reopen-reason"
      />
      <BaseInput
        v-model="A.reopenEnd.value"
        type="datetime-local"
        :label="t('examSessions.detail.reopenEnd')"
        :error="A.reopenError.value.end"
        data-testid="reopen-end"
      />
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="A.reopenOpen.value = false">{{
        t('common.cancel')
      }}</BaseButton>
      <BaseButton :loading="A.busy.value" data-testid="reopen-confirm" @click="A.doReopen">{{
        t('examSessions.detail.reopen')
      }}</BaseButton>
    </template>
  </BaseModal>

  <BaseModal
    :open="A.extendOpen.value"
    :title="t('examSessions.detail.extendTitle')"
    persistent
    @close="A.extendOpen.value = false"
  >
    <div class="space-y-4">
      <p class="text-sm text-fg-muted">{{ t('examSessions.detail.extendHint') }}</p>
      <BaseInput
        v-model="A.extendMinutes.value"
        type="number"
        inputmode="numeric"
        min="1"
        max="180"
        :label="t('examSessions.detail.extendMinutes')"
        :error="A.extendError.value"
        data-testid="extend-minutes"
      />
      <BaseInput
        v-model="A.extendReason.value"
        :label="t('examSessions.detail.extendReason')"
        :maxlength="500"
        data-testid="extend-reason"
      />
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="A.extendOpen.value = false">{{
        t('common.cancel')
      }}</BaseButton>
      <BaseButton :loading="A.busy.value" data-testid="extend-confirm" @click="A.doExtend">{{
        t('examSessions.detail.extend')
      }}</BaseButton>
    </template>
  </BaseModal>

  <BaseModal
    :open="A.rejectOpen.value"
    :title="t('examSessions.detail.rejectTitle')"
    persistent
    @close="A.rejectOpen.value = false"
  >
    <BaseInput
      v-model="A.rejectReason.value"
      :label="t('examSessions.detail.reason')"
      :error="A.rejectError.value"
      :maxlength="500"
      data-testid="reject-reason"
    />
    <template #footer>
      <BaseButton variant="secondary" @click="A.rejectOpen.value = false">{{
        t('common.cancel')
      }}</BaseButton>
      <BaseButton variant="danger" data-testid="reject-confirm" @click="A.doReject">{{
        t('examSessions.detail.reject')
      }}</BaseButton>
    </template>
  </BaseModal>

  <BaseModal
    :open="A.printOpen.value"
    :title="t('examSessions.detail.printPins')"
    @close="A.printOpen.value = false"
  >
    <div class="space-y-3" data-testid="print-block">
      <BaseSelect
        v-model="A.printClass.value"
        :label="t('examSessions.detail.printFor')"
        :options="classOptions"
        data-testid="print-class"
      />
      <p class="text-xs text-fg-muted">{{ t('examSessions.detail.printHint') }}</p>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="A.printOpen.value = false">{{
        t('common.cancel')
      }}</BaseButton>
      <BaseButton :loading="A.busy.value" data-testid="print-pins" @click="A.print">
        <Printer class="h-4 w-4" aria-hidden="true" />
        {{ t('examSessions.detail.printPins') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
