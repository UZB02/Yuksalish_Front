<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Crown, Info, KeyRound, Plus, Power, ShieldCheck } from 'lucide-vue-next'
import { superadminsApi } from '@/api/superadmins.api'
import type { Superadmin } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTable, { type TableColumn } from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import SuperadminActionModal from './SuperadminActionModal.vue'
import SuperadminCreateModal from './SuperadminCreateModal.vue'

type ActionKind = 'toggle' | 'reset' | 'transfer'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const items = ref<Superadmin[]>([])
const loading = ref(false)
const error = ref<unknown>(null)
const createOpen = ref(false)
const action = ref<{ kind: ActionKind; target: Superadmin } | null>(null)

const isOwner = computed(() => auth.isOwner)

const columns = computed<TableColumn[]>(() => [
  { key: 'fullName', label: t('common.fullName') },
  { key: 'lastLoginAt', label: t('common.lastLogin'), class: 'hidden md:table-cell' },
  { key: 'isActive', label: t('common.status') },
  ...(isOwner.value
    ? [{ key: 'actions', label: t('common.actions'), align: 'right' as const }]
    : []),
])

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = await superadminsApi.list()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}
onMounted(load)

const target = computed(() => action.value?.target ?? null)
const modal = computed(() => {
  const a = action.value
  if (!a) return null
  const name = a.target.fullName
  if (a.kind === 'reset') {
    return {
      title: t('superadmins.resetTitle'),
      message: t('superadmins.resetText', { name }),
      confirmText: t('resetPassword.submit'),
      withNewPassword: true,
      danger: false,
      warning: undefined,
    }
  }
  if (a.kind === 'transfer') {
    return {
      title: t('superadmins.transferTitle'),
      message: undefined,
      warning: t('superadmins.transferWarning', { name }),
      confirmText: t('superadmins.transferConfirm'),
      withNewPassword: false,
      danger: true,
    }
  }
  const next = !a.target.isActive
  return {
    title: t(next ? 'superadmins.activateTitle' : 'superadmins.deactivateTitle'),
    message: t(next ? 'superadmins.activateText' : 'superadmins.deactivateText', { name }),
    confirmText: t(next ? 'common.activate' : 'common.deactivate'),
    withNewPassword: false,
    danger: !next,
    warning: undefined,
  }
})

async function submitAction(p: { currentPassword: string; newPassword?: string }) {
  const a = action.value!
  if (a.kind === 'reset') {
    await superadminsApi.update(a.target.id, {
      password: p.newPassword,
      currentPassword: p.currentPassword,
    })
    toast.success(t('superadmins.resetDone'))
  } else if (a.kind === 'transfer') {
    await superadminsApi.transferOwnership(a.target.id, p.currentPassword)
    toast.success(t('superadmins.transferred'))
    // Endi asosiy superadmin emasmiz: joriy foydalanuvchi holatini yangilaymiz
    await auth.fetchMe()
  } else {
    const next = !a.target.isActive
    await superadminsApi.update(a.target.id, {
      isActive: next,
      currentPassword: p.currentPassword,
    })
    toast.success(t(next ? 'superadmins.activated' : 'superadmins.deactivated'))
  }
}
</script>

<template>
  <PageHeader :title="t('superadmins.title')" :description="t('superadmins.description')">
    <template v-if="isOwner" #actions>
      <BaseButton data-testid="superadmin-add" @click="createOpen = true">
        <Plus class="h-4 w-4" /> {{ t('superadmins.add') }}
      </BaseButton>
    </template>
  </PageHeader>

  <div
    v-if="!isOwner"
    class="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg-muted"
    role="note"
    data-testid="readonly-note"
  >
    <Info class="mt-0.5 h-4 w-4 shrink-0" />
    <p>{{ t('superadmins.readOnlyNote') }}</p>
  </div>

  <div class="card">
    <div v-if="error" class="p-4">
      <EmptyState :title="t('errors.loadFailed')" :description="errorMessage(error, t)">
        <BaseButton variant="secondary" @click="load">{{ t('common.retry') }}</BaseButton>
      </EmptyState>
    </div>
    <BaseTable
      v-else-if="loading || items.length > 0"
      :columns="columns"
      :rows="items"
      :loading="loading"
      :caption="t('superadmins.title')"
    >
      <template #cell-fullName="{ row }">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-medium text-fg">{{ row.fullName }}</p>
          <BaseBadge v-if="row.isOwner" tone="warning" data-testid="badge-owner">
            <Crown class="mr-1 h-3 w-3" /> {{ t('superadmins.owner') }}
          </BaseBadge>
          <BaseBadge v-if="row.id === auth.user?.id" tone="info">
            {{ t('superadmins.you') }}
          </BaseBadge>
        </div>
        <p class="text-xs text-fg-muted">{{ row.username }}</p>
      </template>
      <template #cell-lastLoginAt="{ row }">
        {{ formatDateTime(row.lastLoginAt) || t('common.never') }}
      </template>
      <template #cell-isActive="{ row }">
        <BaseBadge
          :tone="row.isActive ? 'success' : 'neutral'"
          :data-testid="row.isActive ? undefined : 'badge-inactive'"
        >
          {{ row.isActive ? t('common.active') : t('common.inactive') }}
        </BaseBadge>
      </template>
      <template #cell-actions="{ row }">
        <div v-if="!row.isOwner" class="flex justify-end gap-1">
          <BaseButton
            size="sm"
            variant="ghost"
            data-testid="act-reset"
            :aria-label="`${t('superadmins.resetTitle')}: ${row.fullName}`"
            :title="t('superadmins.resetTitle')"
            @click="action = { kind: 'reset', target: row }"
          >
            <KeyRound class="h-4 w-4" />
          </BaseButton>
          <BaseButton
            v-if="row.isActive"
            size="sm"
            variant="ghost"
            data-testid="act-transfer"
            :aria-label="`${t('superadmins.transfer')}: ${row.fullName}`"
            :title="t('superadmins.transfer')"
            @click="action = { kind: 'transfer', target: row }"
          >
            <Crown class="h-4 w-4" />
          </BaseButton>
          <BaseButton
            size="sm"
            variant="ghost"
            data-testid="act-toggle"
            :aria-label="`${row.isActive ? t('common.deactivate') : t('common.activate')}: ${row.fullName}`"
            :title="row.isActive ? t('common.deactivate') : t('common.activate')"
            @click="action = { kind: 'toggle', target: row }"
          >
            <Power class="h-4 w-4" :class="row.isActive ? 'text-danger' : 'text-success'" />
          </BaseButton>
        </div>
      </template>
    </BaseTable>
    <EmptyState v-else :icon="ShieldCheck" :title="t('superadmins.emptyTitle')" />
  </div>

  <SuperadminCreateModal :open="createOpen" @close="createOpen = false" @saved="load" />
  <SuperadminActionModal
    v-if="modal"
    :open="!!action"
    :title="modal.title"
    :target-name="target?.fullName"
    :message="modal.message"
    :warning="modal.warning"
    :confirm-text="modal.confirmText"
    :danger="modal.danger"
    :with-new-password="modal.withNewPassword"
    :submit="submitAction"
    @close="action = null"
    @done="load"
  />
</template>
