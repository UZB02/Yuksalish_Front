<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../inject'

const store = useStore()
const j = computed(() => store.state.join)
const who = computed(() => {
  const p = j.value?.participant
  if (!p) return ''
  return p.className ? `${p.fullName}, ${p.className}` : p.fullName
})
</script>

<template>
  <div v-if="j" class="card space-y-5" data-testid="confirm">
    <p class="text-fg-soft">Siz:</p>
    <h1 class="text-2xl font-bold" data-testid="confirm-who">{{ who }}</h1>
    <p class="text-lg font-semibold">{{ j.exam.title }}</p>
    <ul class="space-y-2 rounded-xl bg-muted p-4 text-base">
      <li>
        Davomiyligi: <b>{{ j.exam.durationMin }} daqiqa</b>
      </li>
      <li>
        Savollar soni: <b>{{ j.exam.questionCount }}</b>
      </li>
      <li>
        Savollar orasida erkin yurish, javobni o‘zgartirish va “Keyinroq qaytaman” belgisi mumkin.
      </li>
      <li>
        Imtihon vaqtida boshqa oynaga yoki ilovaga o‘tsangiz, bu qayd qilinadi va nazoratchiga
        ko‘rinadi.
      </li>
      <li>Vaqt tugaganda javoblaringiz avtomatik topshiriladi.</li>
    </ul>
    <p v-if="store.state.error" class="font-medium text-bad" data-testid="start-error">
      {{ store.state.error }}
    </p>
    <div class="flex flex-col gap-3 sm:flex-row">
      <button class="btn-ghost sm:w-1/3" data-testid="not-me" @click="store.leave()">
        Bu men emasman
      </button>
      <button
        class="btn-primary flex-1"
        :disabled="store.state.busy"
        data-testid="start-exam"
        @click="store.start()"
      >
        {{ store.state.busy ? 'Boshlanmoqda...' : 'Boshlash' }}
      </button>
    </div>
  </div>
</template>
