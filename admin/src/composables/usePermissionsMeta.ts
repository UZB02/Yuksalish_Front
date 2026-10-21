import { ref } from 'vue'
import { metaApi } from '@/api/meta.api'
import type { PermissionMeta } from '@/api/types'
import { FALLBACK_PERMISSIONS } from '@/constants/permissions'
import { i18n } from '@/i18n'

// Modul darajasidagi kesh: ruxsatlar ro'yxati sessiya davomida bir marta yuklanadi.
const permissions = ref<PermissionMeta[]>([])
const loaded = ref(false)
const loading = ref(false)
let inflight: Promise<void> | null = null

function fallback(): PermissionMeta[] {
  const { t } = i18n.global
  return FALLBACK_PERMISSIONS.map((p) => ({
    ...p,
    label: t(`permissions.items.${p.key.replace('.', '_')}`),
    group: t(`permissions.groups.${p.group}`),
  }))
}

export function usePermissionsMeta() {
  function load(): Promise<void> {
    if (loaded.value) return Promise.resolve()
    if (!inflight) {
      loading.value = true
      inflight = metaApi
        .permissions()
        .then((list) => {
          permissions.value = list
        })
        .catch(() => {
          // Backend javob bermasa - mahalliy ro'yxatdan foydalanamiz.
          permissions.value = fallback()
        })
        .finally(() => {
          loaded.value = true
          loading.value = false
          inflight = null
        })
    }
    return inflight
  }

  return { permissions, loading, loaded, load }
}
