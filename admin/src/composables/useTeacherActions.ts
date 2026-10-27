import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { teachersApi } from '@/api/teachers.api'
import type { Teacher } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import { useConfirm } from './useConfirm'
import { useClassLookup } from './useLookups'
import { useToast } from './useToast'

/**
 * O'qituvchi ustidagi amallar (tahrirlash, sinflar, ruxsatlar, parol, faollik) holati.
 * Ro'yxat va batafsil sahifada umumiy; `reload` har bir muvaffaqiyatli o'zgarishdan keyin chaqiriladi.
 */
export function useTeacherActions(reload: () => unknown) {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useConfirm()
  const auth = useAuthStore()
  const classLookup = useClassLookup()

  // Maktab admini o'zida mavjud ruxsatlarnigina bera oladi; superadmin - cheklovsiz.
  const allowedPermissions = computed(() =>
    auth.user?.role === 'school_admin' ? auth.user.permissions : null,
  )

  const formOpen = ref(false)
  const editing = ref<Teacher | null>(null)
  const classesTarget = ref<Teacher | null>(null)
  const permTarget = ref<Teacher | null>(null)
  const resetTarget = ref<Teacher | null>(null)

  function openCreate() {
    editing.value = null
    formOpen.value = true
  }
  function openEdit(tc: Teacher) {
    editing.value = tc
    formOpen.value = true
  }
  async function openClasses(tc: Teacher) {
    classesTarget.value = tc
    if (classLookup.items.value.length === 0) await classLookup.load()
  }
  const openPermissions = (tc: Teacher) => (permTarget.value = tc)
  const openReset = (tc: Teacher) => (resetTarget.value = tc)

  const submitPermissions = (perms: string[]) =>
    teachersApi.setPermissions(permTarget.value!.id, perms)
  const submitReset = (pw: string) => teachersApi.resetPassword(resetTarget.value!.id, pw)

  async function toggleActive(tc: Teacher) {
    const next = !tc.isActive
    const ok = await confirm({
      title: t(next ? 'teachers.activateTitle' : 'teachers.deactivateTitle'),
      message: t(next ? 'teachers.activateText' : 'teachers.deactivateText', { name: tc.fullName }),
      confirmText: t(next ? 'common.activate' : 'common.deactivate'),
      variant: next ? 'primary' : 'danger',
    })
    if (!ok) return
    try {
      await teachersApi.update(tc.id, { isActive: next })
      toast.success(t(next ? 'teachers.activated' : 'teachers.deactivated'))
      await reload()
    } catch (e) {
      toast.error(errorMessage(e, t))
    }
  }

  function closeAll() {
    formOpen.value = false
    classesTarget.value = null
    permTarget.value = null
    resetTarget.value = null
  }

  // reactive(): refs/computed shablon va prop orqali ochiq (.value siz) ishlatiladi
  return reactive({
    allowedPermissions,
    classLookup,
    formOpen,
    editing,
    classesTarget,
    permTarget,
    resetTarget,
    openCreate,
    openEdit,
    openClasses,
    openPermissions,
    openReset,
    submitPermissions,
    submitReset,
    toggleActive,
    closeAll,
    reload,
  })
}

export type TeacherActions = ReturnType<typeof useTeacherActions>
