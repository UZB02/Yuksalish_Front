<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, ExternalLink } from 'lucide-vue-next'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import { useToast } from '@/composables/useToast'
import { copyText, publicRatingUrl } from '@/utils/publicUrl'

const props = defineProps<{
  /** Maktab slug yoki 'global' */
  slug: string
  enabled?: boolean
  compact?: boolean
}>()
const { t } = useI18n()
const toast = useToast()
const url = computed(() => publicRatingUrl(props.slug))

async function copy() {
  const ok = await copyText(url.value)
  if (ok) toast.success(t('settingsPublic.link.copied'))
  else toast.error(t('settingsPublic.link.copyFailed'))
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <a
      v-if="!compact"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="truncate text-sm text-primary-700 hover:underline"
      data-testid="public-url"
    >
      {{ url }}
    </a>
    <BaseBadge v-if="enabled !== undefined" :tone="enabled ? 'success' : 'neutral'">
      {{ enabled ? t('settingsPublic.link.on') : t('settingsPublic.link.off') }}
    </BaseBadge>
    <button
      type="button"
      class="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
      :aria-label="t('settingsPublic.link.copy')"
      :title="t('settingsPublic.link.copy')"
      data-testid="copy-link"
      @click="copy"
    >
      <Copy class="h-4 w-4" />
    </button>
    <a
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
      :aria-label="t('settingsPublic.link.open')"
      :title="t('settingsPublic.link.open')"
    >
      <ExternalLink class="h-4 w-4" />
    </a>
  </div>
</template>
