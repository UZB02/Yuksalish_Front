import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

export function usePermission() {
  const auth = useAuthStore()
  const { user, role } = storeToRefs(auth)
  return {
    user,
    role,
    can: (permission: string) => auth.hasPermission(permission),
    isSuperadmin: () => auth.isSuperadmin,
  }
}
