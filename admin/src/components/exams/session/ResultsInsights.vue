<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** Keyin bosqichida o'quvchilar ustida: natijalar taqsimoti (10 ta ustun) va fanlar bo'yicha o'rtacha foiz. */
const props = defineProps<{
  bins: number[]
  subjects: { id: string; name: string; pct: number }[]
}>()
const { t } = useI18n()
const max = computed(() => Math.max(1, ...props.bins))
const total = computed(() => props.bins.reduce((a, b) => a + b, 0))
</script>

<template>
  <div class="mb-3 grid gap-3 md:grid-cols-2" data-testid="results-insights">
    <section class="card p-3" data-testid="dist-card">
      <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('examBoard.dist.title') }}</h3>
      <p v-if="total === 0" class="text-sm text-fg-muted">{{ t('examBoard.dist.empty') }}</p>
      <template v-else>
        <div class="flex h-24 items-end gap-1" role="list">
          <div
            v-for="(n, i) in bins"
            :key="i"
            class="flex h-full flex-1 flex-col justify-end"
            role="listitem"
            :aria-label="
              t('examBoard.dist.bar', { from: i * 10, to: i === 9 ? 100 : i * 10 + 9, n })
            "
            data-testid="dist-bar"
            :data-count="n"
          >
            <span class="mb-0.5 text-center text-[10px] tabular-nums text-fg-muted">{{
              n || ''
            }}</span>
            <div
              class="w-full rounded-t bg-primary-600"
              :style="{ height: (n / max) * 100 + '%', minHeight: n ? '2px' : '0' }"
            />
          </div>
        </div>
        <div class="mt-1 flex gap-1 text-[10px] text-fg-muted" aria-hidden="true">
          <span v-for="(_, i) in bins" :key="i" class="flex-1 text-center">{{ i * 10 }}</span>
        </div>
      </template>
    </section>
    <section class="card p-3" data-testid="subject-avg-card">
      <h3 class="mb-2 text-sm font-semibold text-fg">{{ t('examBoard.dist.subjects') }}</h3>
      <p v-if="!subjects.length" class="text-sm text-fg-muted">{{ t('examBoard.dist.empty') }}</p>
      <div v-for="x in subjects" :key="x.id" class="mb-2 last:mb-0" data-testid="subject-avg">
        <p class="mb-1 flex justify-between text-xs">
          <span class="text-fg">{{ x.name }}</span
          ><b class="tabular-nums text-fg">{{ x.pct }}%</b>
        </p>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div class="h-full rounded-full bg-primary-600" :style="{ width: x.pct + '%' }" />
        </div>
      </div>
    </section>
  </div>
</template>
