<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ratingsApi } from '@/api/ratings.api'
import type { RatingResultDetail } from '@/api/types'
import { useSchoolContextStore } from '@/stores/school-context'
import { winnersTitle } from '@/utils/ratingResults'
import RankBadge from './RankBadge.vue'

const emit = defineEmits<{ 'open-archive': [] }>()
const { t } = useI18n()
const schoolCtx = useSchoolContextStore()

const result = ref<RatingResultDetail | null>(null)

/** Oxirgi e'lon qilingan davr (bo'sh bo'lmagan). Xato yoki yo'q bo'lsa karta ko'rinmaydi. */
async function load() {
  result.value = null
  try {
    const list = await ratingsApi.results({ page: 1, limit: 5 })
    const latest = list.items.find((r) => r.studentsCount > 0)
    if (latest) result.value = await ratingsApi.result(latest.id)
  } catch {
    // Karta ixtiyoriy
  }
}

onMounted(load)
watch(() => schoolCtx.schoolId, load)
</script>

<template>
  <section
    v-if="result && result.students.length > 0"
    class="border-b border-border bg-surface-muted/40 p-4"
    data-testid="latest-winners"
  >
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-fg">
        🏆 {{ winnersTitle(t, result.periodType) }}
        <span class="font-normal text-fg-muted">({{ result.label }})</span>
      </h2>
      <button
        type="button"
        class="text-sm text-primary-700 hover:underline"
        @click="emit('open-archive')"
      >
        {{ t('ratings.top.all') }}
      </button>
    </div>
    <ol class="grid gap-1 sm:grid-cols-3">
      <li
        v-for="s in result.students.slice(0, 3)"
        :key="s.studentId"
        class="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      >
        <RankBadge :rank="s.rank" />
        <span class="min-w-0 flex-1 truncate text-fg">
          {{ s.fullName }}
          <span class="text-xs text-fg-muted">{{ s.className }}</span>
        </span>
        <b class="text-fg">{{ s.score }}</b>
      </li>
    </ol>
  </section>
</template>
