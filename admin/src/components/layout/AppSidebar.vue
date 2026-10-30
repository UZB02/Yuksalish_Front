<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onKeyStroke, useMediaQuery } from '@vueuse/core'
import { BarChart3, ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-vue-next'
import { NAV_DISPLAY_ORDER, NAV_GROUPS, NAV_ITEMS } from '@/constants/navigation'
import type { NavGroup, NavGroupKey, NavItem } from '@/constants/navigation'
import { canAccess } from '@/router/guards'
import { useAuthStore } from '@/stores/auth'
import { useBrandingStore } from '@/stores/branding'
import { useUiStore } from '@/stores/ui'
import SidebarNavLink from './SidebarNavLink.vue'

const { t } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
const branding = useBrandingStore()
const route = useRoute()
const router = useRouter()
const isDesktop = useMediaQuery('(min-width: 1024px)')
const closeBtn = ref<HTMLButtonElement | null>(null)

const OPEN_GROUP_KEY = 'sidebar-open-group'

const items = computed(() =>
  NAV_ITEMS.filter((i) => canAccess(auth, i)).sort(
    (a, b) => NAV_DISPLAY_ORDER.indexOf(a.name) - NAV_DISPLAY_ORDER.indexOf(b.name),
  ),
)

/** Guruhsiz bandlar (tepada) va ko'rinadigan bandlari bor guruhlar (tartib bilan). */
const ungrouped = computed(() => items.value.filter((i) => !i.group))
const railGroups = computed(() => {
  const groups: { key: string; items: NavItem[] }[] = []
  if (ungrouped.value.length) groups.push({ key: '_top', items: ungrouped.value })
  for (const g of NAV_GROUPS) {
    const list = items.value.filter((i) => i.group === g.key)
    if (list.length) groups.push({ key: g.key, items: list })
  }
  return groups
})

type Entry =
  | { kind: 'link'; key: string; item: NavItem }
  | (NavGroup & { kind: 'group'; items: NavItem[]; active: boolean })

/** Joriy marshrutga mos band: aniq nom, aks holda eng uzun yo'l prefiksi (masalan /classes/:id). */
function activeItem(): NavItem | null {
  const exact = NAV_ITEMS.find((i) => i.name === route.name)
  if (exact) return exact
  let best: NavItem | null = null
  let bestLen = -1
  for (const i of NAV_ITEMS) {
    try {
      const p = router.resolve({ name: i.name }).path
      if ((route.path === p || route.path.startsWith(p + '/')) && p.length > bestLen) {
        best = i
        bestLen = p.length
      }
    } catch {
      // marshrut ro'yxatda yo'q
    }
  }
  return best
}
const activeGroup = computed<NavGroupKey | null>(() => {
  void route.fullPath
  return activeItem()?.group ?? null
})

const entries = computed<Entry[]>(() => {
  const out: Entry[] = ungrouped.value.map((item) => ({ kind: 'link', key: item.name, item }))
  for (const g of NAV_GROUPS) {
    const list = items.value.filter((i) => i.group === g.key)
    if (list.length === 1) out.push({ kind: 'link', key: list[0].name, item: list[0] })
    else if (list.length > 1) {
      out.push({ ...g, kind: 'group', items: list, active: activeGroup.value === g.key })
    }
  }
  return out
})

function readOpenGroup(): NavGroupKey | null {
  try {
    const v = localStorage.getItem(OPEN_GROUP_KEY)
    return NAV_GROUPS.some((g) => g.key === v) ? (v as NavGroupKey) : null
  } catch {
    return null
  }
}
function writeOpenGroup(v: NavGroupKey | null) {
  try {
    localStorage.setItem(OPEN_GROUP_KEY, v ?? '')
  } catch {
    // ignore
  }
}

// Akkordeon: bir vaqtda faqat bitta guruh ochiq. Yuklanganda faol marshrut guruhi ustun.
const openGroup = ref<NavGroupKey | null>(activeGroup.value ?? readOpenGroup())
function toggleGroup(key: NavGroupKey) {
  openGroup.value = openGroup.value === key ? null : key
  writeOpenGroup(openGroup.value)
}
watch(activeGroup, (g) => {
  if (g && openGroup.value !== g) {
    openGroup.value = g
    writeOpenGroup(g)
  }
})

// Mobilda sahifa o'zgarganda drawer yopiladi.
watch(
  () => route.fullPath,
  () => ui.closeSidebar(),
)
watch(isDesktop, (v) => v && ui.closeSidebar())
watch(
  () => ui.sidebarOpen,
  async (open) => {
    if (open && !isDesktop.value) {
      await nextTick()
      closeBtn.value?.focus()
    }
  },
)
onKeyStroke('Escape', () => ui.sidebarOpen && ui.closeSidebar())

// Yopiq drawer ichidagi elementlar klaviatura va ekran o'quvchidan yashiriladi.
const collapsed = computed(() => ui.sidebarCollapsed)
const rail = computed(() => collapsed.value && isDesktop.value)
const hidden = computed(() => !isDesktop.value && !ui.sidebarOpen)
</script>

<template>
  <div>
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.sidebarOpen && !isDesktop"
        class="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        aria-hidden="true"
        @click="ui.closeSidebar()"
      />
    </Transition>

    <aside
      id="app-sidebar"
      class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-[transform,width] duration-200 lg:w-[var(--sidebar-w,16rem)] lg:translate-x-0"
      :class="ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      :inert="hidden"
      :aria-label="t('nav.main')"
    >
      <div
        :class="[
          'flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-5',
          collapsed && 'lg:justify-center lg:px-0',
        ]"
      >
        <div class="flex items-center gap-2.5" :class="collapsed && 'lg:hidden'">
          <img
            v-if="branding.logoSrc"
            :src="branding.logoSrc"
            alt=""
            class="h-8 w-8 rounded-lg object-contain"
            data-testid="sidebar-brand-logo"
          />
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white"
          >
            <BarChart3 class="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            class="text-sm font-semibold leading-tight text-fg"
            data-testid="sidebar-brand-label"
            >{{ branding.appName }}</span
          >
        </div>
        <!-- Yig'ish/yoyish (faqat lg+): yig'ilganda logotipning o'zi yoyish tugmasi bo'ladi -->
        <button
          v-if="collapsed"
          type="button"
          class="group hidden h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-primary-700 lg:flex"
          :class="branding.logoSrc ? 'bg-surface-muted' : 'bg-primary-600'"
          :aria-label="t('nav.expand')"
          :title="t('nav.expand')"
          :aria-expanded="false"
          aria-controls="app-sidebar"
          data-testid="sidebar-collapse-toggle"
          @click="ui.toggleSidebarCollapsed()"
        >
          <img
            v-if="branding.logoSrc"
            :src="branding.logoSrc"
            alt=""
            class="h-7 w-7 rounded object-contain group-hover:hidden group-focus-visible:hidden"
          />
          <BarChart3
            v-else
            class="h-4 w-4 group-hover:hidden group-focus-visible:hidden"
            aria-hidden="true"
          />
          <PanelLeftOpen
            class="hidden h-4 w-4 group-hover:block group-focus-visible:block"
            aria-hidden="true"
          />
        </button>
        <button
          v-else
          type="button"
          class="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg lg:flex"
          :aria-label="t('nav.collapse')"
          :title="t('nav.collapse')"
          :aria-expanded="true"
          aria-controls="app-sidebar"
          data-testid="sidebar-collapse-toggle"
          @click="ui.toggleSidebarCollapsed()"
        >
          <PanelLeftClose class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          ref="closeBtn"
          type="button"
          class="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted lg:hidden"
          :aria-label="t('common.close')"
          @click="ui.closeSidebar()"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
        <!-- Ixcham rejim (lg+): akkordeonsiz, barcha ikonkalar guruh tartibida -->
        <template v-if="rail">
          <template v-for="(g, gi) in railGroups" :key="g.key">
            <div
              v-if="gi > 0"
              class="mx-2 my-2 h-px bg-border"
              role="separator"
              data-testid="nav-separator"
            />
            <SidebarNavLink v-for="item in g.items" :key="item.name" :item="item" rail />
          </template>
        </template>

        <template v-else>
          <template v-for="entry in entries" :key="entry.key">
            <SidebarNavLink v-if="entry.kind === 'link'" :item="entry.item" />
            <div v-else data-testid="nav-group">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-surface-muted hover:text-fg"
                :class="
                  openGroup !== entry.key && entry.active ? 'text-primary-700' : 'text-fg-muted'
                "
                :aria-expanded="openGroup === entry.key"
                :aria-controls="`nav-group-${entry.key}`"
                :data-active="entry.active ? 'true' : undefined"
                @click="toggleGroup(entry.key)"
              >
                <component :is="entry.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
                <span class="flex-1 truncate">{{ t(entry.labelKey) }}</span>
                <span
                  v-if="openGroup !== entry.key && entry.active"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600"
                  data-testid="nav-group-dot"
                  aria-hidden="true"
                />
                <ChevronDown
                  class="h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                  :class="openGroup === entry.key && 'rotate-180'"
                  aria-hidden="true"
                />
              </button>
              <div
                :id="`nav-group-${entry.key}`"
                class="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                :class="openGroup === entry.key ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
                :inert="openGroup !== entry.key"
              >
                <ul class="min-h-0 space-y-1 overflow-hidden">
                  <li v-for="item in entry.items" :key="item.name" class="first:mt-1">
                    <SidebarNavLink :item="item" nested />
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </template>
      </nav>
    </aside>
  </div>
</template>
