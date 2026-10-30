<script setup lang="ts">
import { computed, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NeedsSchool from '@/components/domain/NeedsSchool.vue'
import ConductPanel from '@/components/grading/ConductPanel.vue'
import SubjectGradingPanel from '@/components/grading/SubjectGradingPanel.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { PERMISSIONS } from '@/constants/permissions'
import { useConfirm } from '@/composables/useConfirm'
import { useDirtySource } from '@/composables/useDirtyRegistry'
import { useNeedsSchool } from '@/composables/useNeedsSchool'
import { useAuthStore } from '@/stores/auth'

type Tab = 'subjects' | 'conduct'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { confirm } = useConfirm()
const needsSchool = useNeedsSchool()

const canSubjects = computed(
  () =>
    auth.hasPermission(PERMISSIONS.GRADES_CREATE) || auth.hasPermission(PERMISSIONS.GRADES_EDIT),
)
const canConduct = computed(
  () =>
    auth.hasPermission(PERMISSIONS.SCORES_CREATE) || auth.hasPermission(PERMISSIONS.SCORES_EDIT),
)
const tabs = computed(() => {
  const list: { key: Tab; label: string }[] = []
  if (canSubjects.value) list.push({ key: 'subjects', label: t('grading.tabs.subjects') })
  if (canConduct.value) list.push({ key: 'conduct', label: t('grading.tabs.conduct') })
  return list
})

const requested = computed<Tab>(() => (route.query.tab === 'conduct' ? 'conduct' : 'subjects'))
const tab = computed<Tab>(() =>
  tabs.value.some((x) => x.key === requested.value)
    ? requested.value
    : (tabs.value[0]?.key ?? 'subjects'),
)

const dirty = ref(false)

async function selectTab(next: Tab) {
  if (next === tab.value) return
  if (dirty.value) {
    const ok = await confirm({
      title: t('scoring.unsaved.title'),
      message: t('grading.unsavedChange'),
      confirmText: t('scoring.unsaved.discard'),
      variant: 'danger',
    })
    if (!ok) return
    dirty.value = false
  }
  await router.replace({ query: { ...route.query, tab: next } })
}

// Saqlanmagan fan baholari bilan sahifadan chiqishda ogohlantirish.
useDirtySource(() => dirty.value)
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return confirm({
    title: t('scoring.unsaved.title'),
    message: t('scoring.unsaved.leaveText'),
    confirmText: t('scoring.unsaved.leave'),
    variant: 'danger',
  })
})
</script>

<template>
  <PageHeader :title="t('grading.title')" :description="t('grading.description')" />

  <NeedsSchool v-if="needsSchool" />
  <template v-else>
    <div
      v-if="tabs.length > 1"
      role="tablist"
      :aria-label="t('grading.title')"
      class="mb-4 inline-flex rounded-lg border border-border bg-surface p-1"
    >
      <button
        v-for="x in tabs"
        :key="x.key"
        type="button"
        role="tab"
        :aria-selected="tab === x.key"
        class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
        :class="
          tab === x.key ? 'bg-primary-600 text-white' : 'text-fg-muted hover:bg-surface-muted'
        "
        :data-tab="x.key"
        @click="selectTab(x.key)"
      >
        {{ x.label }}
      </button>
    </div>

    <SubjectGradingPanel v-if="tab === 'subjects' && canSubjects" @dirty-change="dirty = $event" />
    <ConductPanel v-else-if="tab === 'conduct' && canConduct" />
  </template>
</template>
