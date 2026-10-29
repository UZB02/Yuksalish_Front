import type { RouteLocationNormalized, RouteLocationRaw, RouteMeta, Router } from 'vue-router'
import type { Role } from '@/api/types'
import { NAV_ITEMS } from '@/constants/navigation'
import { useAuthStore } from '@/stores/auth'
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

/**
 * Marshrutga o'tishga ruxsatni hal qiladi.
 * true - ruxsat; aks holda yo'naltirish manzili.
 */
export function resolveAccess(
  to: Pick<RouteLocationNormalized, 'name' | 'fullPath' | 'meta'>,
  ctx: AccessContext,
): true | RouteLocationRaw {
  const meta = to.meta

  if (meta.public) {
    if (meta.guestOnly && ctx.isAuthenticated) return { name: 'home' }
    return true
  }

  if (!ctx.isAuthenticated) {
    const redirect = to.fullPath && to.fullPath !== '/' ? to.fullPath : undefined
    return { name: 'login', query: redirect ? { redirect } : undefined }
  }

  if (to.name === 'home') {
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
    document.title = title ? `${title} | ${t('app.name')}` : t('app.name')
  })
}
