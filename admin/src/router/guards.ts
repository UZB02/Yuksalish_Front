import type { RouteLocationNormalized, RouteLocationRaw, RouteMeta, Router } from 'vue-router'
import type { Role } from '@/api/types'
import { NAV_ITEMS } from '@/constants/navigation'
import { useAuthStore } from '@/stores/auth'
import { useBrandingStore } from '@/stores/branding'
import { i18n } from '@/i18n'

declare module 'vue-router' {
  interface RouteMeta {
    /** Autentifikatsiya talab qilinadi (standart: true) */
    public?: boolean
    /** Faqat mehmonlar uchun (login) */
    guestOnly?: boolean
    roles?: Role[]
    permission?: string
    /** Ruxsatlardan kamida bittasi yetarli */
    anyPermission?: string[]
    titleKey?: string
    /**
     * Forma sahifalari uchun o'qishga qulay kenglik (max-w-7xl). Belgilanmasa sahifa
     * ekran kengligini egallaydi (jadval/ro'yxatlar sidebar yig'ilganda kengayadi).
     */
    narrow?: boolean
  }
}

/** Guard ishlatadigan minimal auth interfeysi (testlash oson bo'lishi uchun). */
export interface AccessContext {
  isAuthenticated: boolean
  /** Ilova ochilganda tarmoq yo'q edi: sessiya holati noma'lum, login'ga emas, offline ekraniga yo'naltiramiz. */
  networkError?: boolean
  hasRole: (roles?: Role[]) => boolean
  hasPermission: (permission?: string) => boolean
}

export function canAccess(
  ctx: Pick<AccessContext, 'hasRole' | 'hasPermission'>,
  meta: Pick<RouteMeta, 'roles' | 'permission' | 'anyPermission'>,
): boolean {
  if (!ctx.hasRole(meta.roles) || !ctx.hasPermission(meta.permission)) return false
  if (meta.anyPermission && meta.anyPermission.length > 0) {
    return meta.anyPermission.some((p) => ctx.hasPermission(p))
  }
  return true
}

/** Foydalanuvchi uchun birinchi ruxsat etilgan menyu bandi (bosh sahifa). */
export function firstAllowedRouteName(ctx: AccessContext): string | null {
  const item = NAV_ITEMS.find((i) => canAccess(ctx, i))
  return item?.name ?? null
}

/** PWA shortcut (`/?go=...`) uchun nomzod marshrutlar: birinchi ruxsat etilgani tanlanadi. */
export const SHORTCUT_TARGETS: Record<string, string[]> = {
  scoring: ['scoring', 'my-classes'],
  grading: ['grading'],
  attendance: ['attendance'],
}

function shortcutTarget(go: unknown, ctx: AccessContext): string | null {
  const key = Array.isArray(go) ? go[0] : go
  const candidates = typeof key === 'string' ? SHORTCUT_TARGETS[key] : undefined
  if (!candidates) return null
  for (const name of candidates) {
    const item = NAV_ITEMS.find((i) => i.name === name)
    if (item && canAccess(ctx, item)) return name
  }
  return null
}

/**
 * Marshrutga o'tishga ruxsatni hal qiladi.
 * true - ruxsat; aks holda yo'naltirish manzili.
 */
export function resolveAccess(
  to: Pick<RouteLocationNormalized, 'name' | 'fullPath' | 'meta'> &
    Partial<Pick<RouteLocationNormalized, 'query'>>,
  ctx: AccessContext,
): true | RouteLocationRaw {
  const meta = to.meta

  if (meta.public) {
    if (meta.guestOnly && ctx.isAuthenticated) return { name: 'home' }
    return true
  }

  if (!ctx.isAuthenticated) {
    if (ctx.networkError) {
      return { name: 'offline', query: { redirect: to.fullPath || '/' } }
    }
    const redirect = to.fullPath && to.fullPath !== '/' ? to.fullPath : undefined
    return { name: 'login', query: redirect ? { redirect } : undefined }
  }

  if (to.name === 'home') {
    const shortcut = shortcutTarget(to.query?.go, ctx)
    if (shortcut) return { name: shortcut }
    const target = firstAllowedRouteName(ctx)
    return target ? { name: target } : { name: 'forbidden' }
  }

  if (!canAccess(ctx, meta)) {
    return { name: 'forbidden' }
  }
  return true
}

export function installGuards(router: Router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    // Sessiyani (httpOnly refresh cookie orqali) bir marta tiklaymiz.
    if (!auth.initialized) await auth.init()
    return resolveAccess(to, auth)
  })

  router.afterEach((to) => {
    const t = i18n.global.t
    const title = to.meta.titleKey ? t(to.meta.titleKey) : ''
    useBrandingStore().setPageTitle(title)
  })
}
