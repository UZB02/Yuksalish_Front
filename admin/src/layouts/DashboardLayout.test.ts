import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardLayout from './DashboardLayout.vue'
import { i18n } from '@/i18n'

const Page = { template: '<div>sahifa</div>' }

async function mountAt(path: string) {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: DashboardLayout,
        children: [
          { path: 'journal', component: Page },
          { path: 'settings', component: Page, meta: { narrow: true } },
        ],
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(
    { template: '<RouterView />' },
    {
      global: {
        plugins: [router, i18n],
        stubs: { AppSidebar: true, AppHeader: true },
      },
    },
  )
  await flushPromises()
  return w
}

describe('DashboardLayout: kenglik', () => {
  it('jadval sahifalari keng (sidebar yig`ilganda kengayadi)', async () => {
    const main = (await mountAt('/journal')).get('[data-testid="main"]')
    expect(main.classes()).toContain('max-w-[120rem]')
    expect(main.classes()).not.toContain('max-w-7xl')
  })

  it('forma sahifalari (meta.narrow) o`qishga qulay kenglikda', async () => {
    const main = (await mountAt('/settings')).get('[data-testid="main"]')
    expect(main.classes()).toContain('max-w-7xl')
  })
})
