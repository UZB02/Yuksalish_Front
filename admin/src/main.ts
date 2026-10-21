import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { setUnauthorizedHandler } from './api/http'
import { useUiStore, applyTheme } from './stores/ui'
import { useSchoolContextStore } from './stores/school-context'
import './styles/tailwind.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia).use(router).use(i18n)

// Sessiya tiklanmasa: maktab kontekstini tozalab, /login ga yo'naltiramiz.
setUnauthorizedHandler(() => {
  useSchoolContextStore().reset()
  const current = router.currentRoute.value
  if (current.name !== 'login') {
    void router.replace({
      name: 'login',
      query: current.fullPath !== '/' ? { redirect: current.fullPath } : undefined,
    })
  }
})

// Tizim mavzusi o'zgarsa (theme === 'system') avtomatik yangilanadi.
const ui = useUiStore()
applyTheme(ui.theme)
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => ui.syncSystemTheme())

app.mount('#app')
