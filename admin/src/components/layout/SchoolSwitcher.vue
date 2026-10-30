<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { School as SchoolIcon } from 'lucide-vue-next'
import { resolvePhotoUrl } from '@/utils/photo'
import { useSchoolContextStore } from '@/stores/school-context'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/utils/errors'

const { t } = useI18n()
const toast = useToast()
const ctx = useSchoolContextStore()
const { schoolId, schools, loading, selectedSchool } = storeToRefs(ctx)

onMounted(async () => {
  if (ctx.loaded) return
  try {
    await ctx.loadSchools()
  } catch (e) {
    toast.error(errorMessage(e, t))
  }
})

function onChange(e: Event) {
  ctx.select((e.target as HTMLSelectElement).value || null)
}
</script>

<template>
  <div class="relative min-w-0">
    <label for="school-switcher" class="sr-only">{{ t('schoolSwitcher.label') }}</label>
    <img
      v-if="selectedSchool?.logoUrl"
      :src="resolvePhotoUrl(selectedSchool.logoUrl) ?? ''"
      alt=""
      class="pointer-events-none absolute left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 object-contain"
      data-testid="school-switcher-logo"
    />
    <SchoolIcon
      v-else
      class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
      aria-hidden="true"
    />
    <select
      id="school-switcher"
      :value="schoolId ?? ''"
      :disabled="loading"
      class="h-10 w-full max-w-[14rem] truncate rounded-lg border border-border bg-surface pl-9 pr-8 text-sm text-fg focus:border-primary-500 sm:max-w-xs"
      @change="onChange"
    >
      <option value="">{{ t('schoolSwitcher.none') }}</option>
      <option v-for="s in schools" :key="s.id" :value="s.id">
        {{ s.name }}{{ s.isActive ? '' : ` (${t('common.inactive')})` }}
      </option>
    </select>
  </div>
</template>
