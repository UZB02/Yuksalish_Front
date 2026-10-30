<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { ChevronDown, Download, LogOut, UserRound } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { ROLE_LABEL_KEYS } from '@/constants/roles'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import { useInstallPrompt } from '@/composables/useInstallPrompt'

const { t } = useI18n()
const auth = useAuthStore()
const schoolCtx = useSchoolContextStore()
const router = useRouter()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const installApp = useInstallPrompt()

onClickOutside(root, () => (open.value = false))
onKeyStroke('Escape', () => (open.value = false))

function install() {
  open.value = false
  void installApp.install()
}

async function logout() {
  open.value = false
  await auth.logout()
  schoolCtx.reset()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div v-if="auth.user" ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-muted"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <AvatarImage :name="auth.user.fullName" :src="auth.user.photo" size="md" alt="" />
      <span class="hidden text-left sm:block">
        <span class="block max-w-[10rem] truncate text-sm font-medium leading-tight text-fg">
          {{ auth.user.fullName }}
        </span>
        <span class="block text-xs leading-tight text-fg-muted">
          {{ t(ROLE_LABEL_KEYS[auth.user.role]) }}
        </span>
      </span>
      <ChevronDown class="hidden h-4 w-4 text-fg-muted sm:block" aria-hidden="true" />
      <span class="sr-only">{{ t('userMenu.open') }}</span>
    </button>

    <div
      v-if="open"
      role="menu"
      class="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
    >
      <div class="border-b border-border px-4 py-3">
        <p class="truncate text-sm font-medium text-fg">{{ auth.user.fullName }}</p>
        <p class="truncate text-xs text-fg-muted">{{ auth.user.username }}</p>
      </div>
      <RouterLink
        :to="{ name: 'profile' }"
        role="menuitem"
        class="flex items-center gap-2 px-4 py-2.5 text-sm text-fg hover:bg-surface-muted"
        @click="open = false"
      >
        <UserRound class="h-4 w-4" aria-hidden="true" /> {{ t('nav.profile') }}
      </RouterLink>
      <button
        v-if="installApp.canInstall.value"
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-fg hover:bg-surface-muted"
        @click="install"
      >
        <Download class="h-4 w-4" aria-hidden="true" /> {{ t('pwa.install.menu') }}
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-surface-muted"
        @click="logout"
      >
        <LogOut class="h-4 w-4" aria-hidden="true" /> {{ t('auth.logout') }}
      </button>
    </div>
  </div>
</template>
