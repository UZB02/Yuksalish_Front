<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from './inject'
import BrandLogo from './components/BrandLogo.vue'
import ConfirmScreen from './components/ConfirmScreen.vue'
import WhoAmIScreen from './components/WhoAmIScreen.vue'
import ExamScreen from './components/ExamScreen.vue'
import JoinScreen from './components/JoinScreen.vue'
import ResultScreen from './components/ResultScreen.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import ToastHost from './components/ToastHost.vue'

const store = useStore()
const s = store.state
/** Imtihon ekrani o'z to'liq maketini chizadi; qolganlari umumiy sarlavha va bitta konteyner ichida */
const own = computed(() => s.screen === 'exam')
</script>

<template>
  <div class="min-h-svh overflow-x-hidden">
    <ExamScreen v-if="s.screen === 'exam'" />
    <div v-if="!own" class="mx-auto flex min-h-svh max-w-5xl flex-col px-4 py-6 lg:py-10">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <BrandLogo size="h-9 w-9" />
          <span class="font-semibold">Yuksalish EDU</span>
        </div>
        <ThemeToggle />
      </header>
      <main class="flex flex-1 items-center py-6 lg:py-10">
        <div
          v-if="s.screen === 'loading'"
          class="card mx-auto w-full max-w-xl text-center"
          data-testid="loading"
        >
          <p v-if="!s.error" class="text-fg-soft">Yuklanmoqda...</p>
          <template v-else>
            <p class="mb-4 text-bad" data-testid="load-error">{{ s.error }}</p>
            <button class="btn-primary" @click="store.retryInit()">Qayta urinish</button>
          </template>
        </div>
        <JoinScreen v-else-if="s.screen === 'join'" />
        <WhoAmIScreen v-else-if="s.screen === 'whoami'" />
        <ConfirmScreen v-else-if="s.screen === 'confirm'" />
        <ResultScreen v-else-if="s.screen === 'result'" />
        <div v-else class="card mx-auto w-full max-w-xl text-center" data-testid="closed">
          <p class="text-lg">Imtihon yakunlangan.</p>
        </div>
      </main>
    </div>
    <ToastHost />
  </div>
</template>
