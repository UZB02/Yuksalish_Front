import { useI18n } from 'vue-i18n'
import { studentsApi } from '@/api/students.api'
import type { Student } from '@/api/types'
import { useConfirm } from './useConfirm'
import { useToast } from './useToast'
import { errorMessage } from '@/utils/errors'

/** O'quvchini o'chirish (tasdiqlash bilan) va Excel eksport - sinf va umumiy sahifalarda umumiy. */
export function useStudentActions(reload: () => unknown) {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useConfirm()

  async function remove(student: Student) {
    const ok = await confirm({
      title: t('students.deleteTitle'),
      message: t('students.deleteText', { name: student.fullName }),
      confirmText: t('common.delete'),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await studentsApi.remove(student.id)
      toast.success(t('students.deleted'))
      await reload()
    } catch (e) {
      toast.error(errorMessage(e, t))
    }
  }

  async function exportXlsx(classId?: string) {
    try {
      await studentsApi.exportXlsx(classId)
    } catch (e) {
      toast.error(errorMessage(e, t))
    }
  }

  return { remove, exportXlsx }
}
