<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../inject'

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
const blocked = computed(() => p.value?.exam.phase === 'ended')
const waiting = computed(() => p.value?.exam.phase === 'upcoming')
</script>

<template>
  <div v-if="p" class="card space-y-5" data-testid="whoami">
    <p class="text-fg-soft">Bu sizmisiz?</p>
    <div>
      <h1 class="text-2xl font-bold" data-testid="whoami-name">{{ p.participant.fullName }}</h1>
      <p v-if="p.participant.className" class="text-lg text-fg-soft" data-testid="whoami-class">
        {{ p.participant.className }}
      </p>
    </div>
    <p class="text-lg font-semibold" data-testid="whoami-title">{{ p.exam.title }}</p>
    <ul class="space-y-2 rounded-xl bg-muted p-4 text-base">
      <li>
        Fanlar soni: <b data-testid="whoami-subjects">{{ p.exam.subjectsCount }}</b>
      </li>
      <li>
        Davomiyligi: <b data-testid="whoami-duration">{{ p.exam.durationMin }} daqiqa</b>
      </li>
      <li>
        Boshlanish vaqti: <b data-testid="whoami-start">{{ fmt(p.exam.startsAt) }}</b>
      </li>
    </ul>
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
    <div class="flex flex-col gap-3 sm:flex-row">
      <button class="btn-ghost sm:w-1/3" data-testid="not-me" @click="store.rejectJoin()">
        Men emasman
      </button>
      <button
        class="btn-primary flex-1"
        :disabled="store.state.busy || waiting || blocked"
        data-testid="whoami-yes"
        @click="store.confirmJoin()"
      >
        {{ store.state.busy ? 'Boshlanmoqda...' : 'Ha, boshlash' }}
      </button>
    </div>
  </div>
</template>
