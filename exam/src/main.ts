import { createApp } from 'vue'
import App from './App.vue'
import { createStore } from './store'
import { STORE_KEY } from './inject'
import './style.css'

const store = createStore()
// Qorong'i mavzu (ixtiyoriy): oxirgi tanlov saqlanadi
try {
  if (localStorage.getItem('exam.theme') === 'dark') document.documentElement.classList.add('dark')
} catch {
  /* ignore */
}
createApp(App).provide(STORE_KEY, store).mount('#app')
void store.init()
