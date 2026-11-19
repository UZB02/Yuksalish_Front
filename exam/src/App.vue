<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from './inject'
import ConfirmScreen from './components/ConfirmScreen.vue'
import WhoAmIScreen from './components/WhoAmIScreen.vue'
import ExamScreen from './components/ExamScreen.vue'
import JoinScreen from './components/JoinScreen.vue'
import ResultScreen from './components/ResultScreen.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import ToastHost from './components/ToastHost.vue'

const store = useStore()
const s = store.state
const isExam = computed(() => s.screen === 'exam')
</script>

<template>
  <div class="min-h-screen">
    <header v-if="!isExam" class="mx-auto flex max-w-2xl items-center justify-between px-4 pt-4">
      <span class="text-lg font-bold text-brand">Onlayn imtihon</span>
      <ThemeToggle />
    </header>
    <main :class="isExam ? '' : 'mx-auto max-w-2xl px-4 py-6'">
      <div v-if="s.screen === 'loading'" class="card text-center" data-testid="loading">
        <p v-if="!s.error" class="text-fg-soft">Yuklanmoqda...</p>
        <template v-else>
          <p class="mb-4 text-bad" data-testid="load-error">{{ s.error }}</p>
          <button class="btn-primary" @click="store.retryInit()">Qayta urinish</button>
        </template>
      </div>
      <JoinScreen v-else-if="s.screen === 'join'" />
      <WhoAmIScreen v-else-if="s.screen === 'whoami'" />
      <ConfirmScreen v-else-if="s.screen === 'confirm'" />
      <ExamScreen v-else-if="s.screen === 'exam'" />
      <ResultScreen v-else-if="s.screen === 'result'" />
      <div v-else class="card text-center" data-testid="closed">
        <p class="text-lg">Imtihon yakunlangan.</p>
      </div>
    </main>
    <ToastHost />
  </div>
</template>
