<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../inject'
import Icon from './Icon.vue'
import ScreenShell from './ScreenShell.vue'

const store = useStore()
const j = computed(() => store.state.join)
const perBlock = computed(() => j.value?.exam.timingMode === 'per_block')
const blocks = computed(() => j.value?.exam.blocks ?? [])
const initials = computed(() =>
  (j.value?.participant.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join(''),
)
const who = computed(() => {
  const p = j.value?.participant
  if (!p) return ''
  return p.className ? `${p.fullName}, ${p.className}` : p.fullName
})
</script>

<template>
  <ScreenShell v-if="j" data-testid="confirm">
    <template #side>
      <span
        class="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-4xl font-bold text-brand-fg"
        aria-hidden="true"
        >{{ initials }}</span
      >
      <div>
        <p class="text-fg-soft">Siz:</p>
        <h1 class="break-words text-3xl font-bold lg:text-4xl" data-testid="confirm-who">
          {{ who }}
        </h1>
      </div>
      <p class="text-lg font-semibold">{{ j.exam.title }}</p>
      <button
        type="button"
        class="min-h-11 text-fg-soft underline"
        data-testid="not-me"
        @click="store.leave()"
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
        <p class="text-xl font-bold">{{ j.exam.durationMin }} daqiqa</p>
      </div>
      <div class="rounded-2xl bg-muted p-4">
        <p class="flex items-center gap-1.5 text-sm text-fg-soft">
          <Icon name="list" size="h-4 w-4" />Savollar soni
        </p>
        <p class="text-xl font-bold">{{ j.exam.questionCount }}</p>
      </div>
      <div class="rounded-2xl bg-muted p-4">
        <p class="flex items-center gap-1.5 text-sm text-fg-soft">
          <Icon name="grid" size="h-4 w-4" />Fanlar soni
        </p>
        <p class="text-xl font-bold">{{ blocks.length || 1 }}</p>
      </div>
    </div>
    <div v-if="blocks.length > 1" data-testid="confirm-blocks">
      <h3 class="mb-2 font-semibold">Fanlar</h3>
      <ul class="divide-y divide-line rounded-xl border border-line">
        <li
          v-for="b in blocks"
          :key="b.id"
          class="flex items-center justify-between gap-3 px-4 py-2.5"
        >
          <b class="min-w-0 break-words">{{ b.title }}</b>
          <span class="shrink-0 text-sm tabular-nums text-fg-soft"
            >{{ b.questionCount }} savol<template v-if="perBlock && b.durationMin"
              >, {{ b.durationMin }} daq.</template
            ></span
          >
        </li>
      </ul>
    </div>
    <div>
      <h3 class="mb-2 font-semibold">Qoidalar</h3>
      <ul class="space-y-2">
        <li v-if="perBlock" class="flex gap-2.5" data-testid="confirm-per-block">
          <Icon name="ok" class="mt-0.5 text-ok" />
          <span
            >Bloklar ketma-ket yechiladi, har birining o‘z vaqti bor. Blokni yakunlagach yoki vaqti
            tugagach keyingisiga o‘tiladi va <b>orqaga qaytib bo‘lmaydi</b>.</span
          >
        </li>
        <li v-else class="flex gap-2.5">
          <Icon name="ok" class="mt-0.5 text-ok" />
          <span
            >Savollar orasida erkin yurish, javobni o‘zgartirish va keyin qaytish uchun savolni
            “Belgilash” mumkin.</span
          >
        </li>
        <li class="flex gap-2.5">
          <Icon name="ok" class="mt-0.5 text-ok" />
          <span
            >Imtihon vaqtida boshqa oynaga yoki ilovaga o‘tsangiz, bu qayd qilinadi va nazoratchiga
            ko‘rinadi. To‘liq ekran rejimida qoling.</span
          >
        </li>
        <li class="flex gap-2.5">
          <Icon name="ok" class="mt-0.5 text-ok" />
          <span>Vaqt tugaganda javoblaringiz avtomatik topshiriladi.</span>
        </li>
      </ul>
    </div>
    <p v-if="store.state.error" class="font-medium text-bad" role="alert" data-testid="start-error">
      {{ store.state.error }}
    </p>
    <button
      class="btn-primary h-14 w-full text-lg"
      :disabled="store.state.busy"
      data-testid="start-exam"
      @click="store.start()"
    >
      {{ store.state.busy ? 'Boshlanmoqda...' : 'Imtihonni boshlash' }}
    </button>
  </ScreenShell>
</template>
