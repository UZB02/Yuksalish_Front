import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'

/** Superadmin maktab tanlamaguncha maktab-doirali sahifalar so'rov yubormaydi. */
export function useNeedsSchool() {
  const auth = useAuthStore()
  const schoolCtx = useSchoolContextStore()
  return computed(() => auth.isSuperadmin && !schoolCtx.schoolId)
}
