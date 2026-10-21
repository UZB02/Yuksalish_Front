<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy } from 'lucide-vue-next'
import type { AuditLogItem } from '@/api/types'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { actionLabel, actionTone, diffAudit, entityLabel, formatDiffValue } from '@/utils/audit'
import { formatDateTimeTashkent } from '@/utils/format'

const props = defineProps<{ item: AuditLogItem | null }>()
const emit = defineEmits<{ close: [] }>()
const { t, te } = useI18n()
const toast = useToast()

const showRaw = ref(false)
const copied = ref(false)
watch(
  () => props.item,
  () => {
    showRaw.value = false
    copied.value = false
  },
)

const diff = computed(() => (props.item ? diffAudit(props.item.before, props.item.after) : null))
const raw = computed(() =>
  props.item ? JSON.stringify({ before: props.item.before, after: props.item.after }, null, 2) : '',
)

const kindClass = {
  added: 'text-success',
  removed: 'text-danger',
  changed: 'text-sky-600 dark:text-sky-400',
}

async function copy() {
  try {
    await navigator.clipboard.writeText(raw.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    toast.error(t('audit.copyFailed'))
  }
}
</script>

<template>
  <BaseModal :open="!!item" :title="t('audit.detailTitle')" size="lg" @close="emit('close')">
    <div v-if="item" class="space-y-4 text-sm" data-testid="audit-detail">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt class="text-fg-muted">{{ t('audit.cols.time') }}</dt>
        <dd>{{ formatDateTimeTashkent(item.createdAt) }}</dd>
        <dt class="text-fg-muted">{{ t('audit.cols.user') }}</dt>
        <dd>
          {{ item.user ? `${item.user.fullName} (${item.user.username})` : t('audit.system') }}
        </dd>
        <dt class="text-fg-muted">{{ t('audit.cols.action') }}</dt>
        <dd>
          <BaseBadge :tone="actionTone(item.action)">{{
            actionLabel(item.action, t, te)
          }}</BaseBadge>
          <span class="ml-2 text-xs text-fg-muted">{{ item.action }}</span>
        </dd>
        <dt class="text-fg-muted">{{ t('audit.cols.entity') }}</dt>
        <dd class="break-all">
          {{ entityLabel(item.entity, t, te) }}
          <span v-if="item.entityId" class="text-xs text-fg-muted">#{{ item.entityId }}</span>
        </dd>
        <template v-if="item.school">
          <dt class="text-fg-muted">{{ t('audit.cols.school') }}</dt>
          <dd>{{ item.school.name }}</dd>
        </template>
        <dt class="text-fg-muted">IP</dt>
        <dd>{{ item.ip ?? '-' }}</dd>
      </dl>

      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold text-fg">
          {{ showRaw ? t('audit.rawJson') : t('audit.changes') }}
        </h3>
        <div class="flex gap-2">
          <BaseButton size="sm" variant="ghost" @click="showRaw = !showRaw">
            {{ showRaw ? t('audit.showDiff') : t('audit.showRaw') }}
          </BaseButton>
          <BaseButton v-if="showRaw" size="sm" variant="secondary" @click="copy">
            <component :is="copied ? Check : Copy" class="h-3.5 w-3.5" aria-hidden="true" />
            {{ copied ? t('audit.copied') : t('audit.copy') }}
          </BaseButton>
        </div>
      </div>

      <pre
        v-if="showRaw"
        class="max-h-96 overflow-auto rounded-lg bg-surface-muted p-3 text-xs"
        data-testid="audit-raw"
        >{{ raw }}</pre>
      <template v-else-if="diff">
        <p v-if="diff.truncated" class="text-xs text-warning" data-testid="audit-truncated">
          {{ t('audit.truncated') }}
        </p>
        <p v-if="diff.changes.length === 0" class="py-4 text-center text-fg-muted">
          {{ t('audit.noChanges') }}
        </p>
        <ul
          v-else
          class="divide-y divide-border rounded-lg border border-border"
          data-testid="audit-diff"
        >
          <li v-for="c in diff.changes" :key="c.path" class="space-y-0.5 p-2.5" :data-kind="c.kind">
            <div class="flex flex-wrap items-center gap-2">
              <code class="break-all text-xs font-semibold text-fg">{{ c.path }}</code>
              <span class="text-xs" :class="kindClass[c.kind]">{{
                t(`audit.kinds.${c.kind}`)
              }}</span>
            </div>
            <div class="break-all font-mono text-xs">
              <template v-if="c.kind === 'changed'">
                <span class="text-danger line-through">{{ formatDiffValue(c.before) }}</span>
                <span class="mx-1 text-fg-muted">-></span>
                <span class="text-success">{{ formatDiffValue(c.after) }}</span>
              </template>
              <span v-else-if="c.kind === 'added'" class="text-success">{{
                formatDiffValue(c.after)
              }}</span>
              <span v-else class="text-danger line-through">{{ formatDiffValue(c.before) }}</span>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </BaseModal>
</template>
