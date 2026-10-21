import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'theme'

function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // ignore
  }
  return 'system'
}

export function applyTheme(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const theme = ref<ThemeMode>(readTheme())

  function openSidebar() {
    sidebarOpen.value = true
  }
  function closeSidebar() {
    sidebarOpen.value = false
  }
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function setTheme(mode: ThemeMode) {
    theme.value = mode
    try {
      localStorage.setItem(THEME_KEY, mode)
    } catch {
      // ignore
    }
    applyTheme(mode)
  }

  /** light -> dark -> system -> light */
  function cycleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : theme.value === 'dark' ? 'system' : 'light')
  }

  /** Tizim mavzusi o'zgarganda (theme === 'system') yangilash uchun. */
  function syncSystemTheme() {
    if (theme.value === 'system') applyTheme('system')
  }

  return {
    sidebarOpen,
    theme,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    setTheme,
    cycleTheme,
    syncSystemTheme,
  }
})
