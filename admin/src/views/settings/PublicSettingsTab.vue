<script setup lang="ts">
import { applyChanges } from '@/utils/scopeSettings'
import { useI18n } from 'vue-i18n'
import type { PublicSettings } from '@/api/types'
import GlobalRatingBlock from '@/components/settings/GlobalRatingBlock.vue'
import PublicLink from '@/components/settings/PublicLink.vue'
import PublicPreview from '@/components/settings/PublicPreview.vue'
import { useSchoolContextStore } from '@/stores/school-context'
import {
  DEFAULT_PUBLIC,
  GLOBAL_ONLY_KEYS,
  PUBLIC_KEYS,
  validatePublic,
  type PublicKey,
} from '@/utils/publicForm'
import { formatSetting } from '@/utils/settingsFormat'
import PublicFields from './PublicFields.vue'
import SettingsScopeEditor from './SettingsScopeEditor.vue'

const { t } = useI18n()
const schoolCtx = useSchoolContextStore()
const schoolOf = (id: string) => schoolCtx.schools.find((s) => s.id === id)
</script>

<template>
  <SettingsScopeEditor
    kind="public"
    :keys="PUBLIC_KEYS"
    :global-only-keys="GLOBAL_ONLY_KEYS"
    :defaults="DEFAULT_PUBLIC"
    :validate="(v: PublicSettings) => validatePublic(v, t)"
    :format="(k: PublicKey, v: PublicSettings) => formatSetting(t, k, v[k])"
  >
    <template #fields="{ values, errors, flags, globalValues, set, toggleFlag }">
      <PublicFields
        :model-value="values"
        :errors="errors"
        :flags="flags"
        :global-values="globalValues"
        @update:model-value="applyChanges(values, $event, PUBLIC_KEYS, set)"
        @toggle-flag="toggleFlag"
      />
    </template>

    <template #global-extra="{ values, set }">
      <GlobalRatingBlock
        :model-value="values.globalRatingEnabled"
        @update:model-value="set('globalRatingEnabled', $event)"
      />
    </template>

    <template #school-extra="{ schoolId, values }">
      <div class="mt-4 rounded-xl border border-border p-4">
        <p class="mb-2 text-sm font-medium text-fg">{{ t('settingsPublic.link.title') }}</p>
        <PublicLink
          v-if="schoolOf(schoolId)"
          :slug="schoolOf(schoolId)!.slug"
          :enabled="values.enabled"
        />
      </div>
    </template>

    <template #preview="{ values, scope, schoolId }">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        {{ t('settingsPublic.preview.title') }}
      </p>
      <PublicPreview
        :settings="values"
        :school-name="scope === 'school' && schoolId ? schoolOf(schoolId)?.name : undefined"
      />
    </template>
  </SettingsScopeEditor>
</template>
