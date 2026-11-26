<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../inject'
import Icon from './Icon.vue'
import ScreenShell from './ScreenShell.vue'

const store = useStore()
const p = computed(() => store.state.pending)

/** Toshkent vaqti: "25.11.2026 09:00" */
function fmt(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
  return `${g('day')}.${g('month')}.${g('year')} ${g('hour')}:${g('minute')}`
}
const initials = computed(() =>
  (p.value?.participant.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join(''),
)
const blocked = computed(() => p.value?.exam.phase === 'ended')
const waiting = computed(() => p.value?.exam.phase === 'upcoming')
</script>

<template>
  <ScreenShell v-if="p" data-testid="whoami">
    <template #side>
      <span
        class="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-4xl font-bold text-brand-fg"
        aria-hidden="true"
        >{{ initials }}</span
      >
      <div>
        <p class="text-fg-soft">Bu sizmisiz?</p>
        <h1 class="break-words text-3xl font-bold lg:text-4xl" data-testid="whoami-name">
          {{ p.participant.fullName }}
        </h1>
        <p v-if="p.participant.className" class="text-xl text-fg-soft" data-testid="whoami-class">
          {{ p.participant.className }}
        </p>
      </div>
      <p class="text-lg font-semibold" data-testid="whoami-title">{{ p.exam.title }}</p>
      <button
        type="button"
        class="min-h-11 text-fg-soft underline"
        data-testid="not-me"
        @click="store.rejectJoin()"
      >
        Bu men emasman
      </button>
    </template>

    <h2 class="text-2xl font-bold">Imtihon varag‘i</h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-2xl bg-muted p-4">
        <p class="flex items-center gap-1.5 text-sm text-fg-soft">
          <Icon name="clock" size="h-4 w-4" />Davomiyligi
        </p>
        <p class="text-xl font-bold" data-testid="whoami-duration">
          {{ p.exam.durationMin }} daqiqa
        </p>
      </div>
      <div class="rounded-2xl bg-muted p-4">
        <p class="flex items-center gap-1.5 text-sm text-fg-soft">
          <Icon name="list" size="h-4 w-4" />Fanlar soni
        </p>
        <p class="text-xl font-bold" data-testid="whoami-subjects">{{ p.exam.subjectsCount }}</p>
      </div>
      <div class="rounded-2xl bg-muted p-4">
        <p class="flex items-center gap-1.5 text-sm text-fg-soft">
          <Icon name="flag" size="h-4 w-4" />Boshlanishi
        </p>
        <p class="text-xl font-bold" data-testid="whoami-start">{{ fmt(p.exam.startsAt) }}</p>
      </div>
    </div>
    <div>
      <h3 class="mb-2 font-semibold">Qoidalar</h3>
      <ul class="space-y-2">
        <li class="flex gap-2.5">
          <Icon name="ok" class="mt-0.5 text-ok" />
          <span>Imtihon vaqtida boshqa oynaga o‘tmang: bu qayd qilinadi.</span>
        </li>
        <li class="flex gap-2.5">
          <Icon name="ok" class="mt-0.5 text-ok" />
          <span>To‘liq ekran rejimida qoling.</span>
        </li>
        <li class="flex gap-2.5">
          <Icon name="ok" class="mt-0.5 text-ok" />
          <span>Vaqt tugaganda javoblar avtomatik topshiriladi.</span>
        </li>
      </ul>
    </div>
    <p v-if="waiting" class="rounded-xl bg-muted p-3 text-fg-soft" data-testid="whoami-waiting">
      Imtihon hali boshlanmagan. Boshlanish vaqtini kuting va qayta kiring.
    </p>
    <p v-if="blocked" class="font-medium text-bad" data-testid="whoami-ended">
      Imtihon vaqti tugagan. Nazoratchiga murojaat qiling.
    </p>
    <p
      v-if="store.state.error"
      class="font-medium text-bad"
      role="alert"
      data-testid="whoami-error"
    >
      {{ store.state.error }}
    </p>
    <button
      class="btn-primary h-14 w-full text-lg"
      :disabled="store.state.busy || waiting || blocked"
      data-testid="whoami-yes"
      @click="store.confirmJoin()"
    >
      {{ store.state.busy ? 'Boshlanmoqda...' : 'Imtihonni boshlash' }}
    </button>
  </ScreenShell>
</template>
