import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { examsApi } from '@/api/exams.api'
import { isApiError } from '@/api/errors'
import type { ExamResultsResponse, ExamSession } from '@/api/types'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSchoolContextStore } from '@/stores/school-context'
import { errorMessage } from '@/utils/errors'
import { localToIso, nowLocal } from '@/utils/examSessions'
import { clearDraftById } from '@/utils/examWizardDraft'

/**
 * Imtihon darajasidagi amallar (rejalashtirish, tasdiq/rad, ochish/yopish, vaqt qo'shish, qayta ochish, nusxa,
 * o'chirish, bekor qilish, eslatma, PIN kartochkalari, e'lon qilish, Excel) va ularning dialog holati.
 * SessionDetailView faqat tartibga soladi; mantiq shu yerda (eski sahifadagi bilan bir xil xabarlar va tekshiruvlar).
 */
export function useSessionActions(o: {
  id: Ref<string>
  s: Ref<ExamSession | null>
  results: Ref<ExamResultsResponse | null>
  refresh: () => Promise<void>
}) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { confirm } = useConfirm()
  const auth = useAuthStore()
  const { schoolId } = storeToRefs(useSchoolContextStore())
  const busy = ref(false)

  async function run(fn: () => Promise<unknown>, okKey?: string) {
    busy.value = true
    try {
      await fn()
      if (okKey) toast.success(t(okKey))
      await o.refresh()
    } catch (e) {
      toast.error(errorMessage(e, t))
      await o.refresh()
    } finally {
      busy.value = false
    }
  }
  const act = (a: 'submit' | 'approve' | 'open' | 'close', okKey: string) =>
    run(() => examsApi.sessionAction(o.id.value, a), okKey)

  // ---- Rejalashtirish ----
  /** Maqsaddan kam savol bo'lsa tuzuvchi tasdiqlaydi (409 + details.path=blocks); tasdiqlanmagan fan: xabar */
  async function submitSession() {
    await run(async () => {
      try {
        await examsApi.submitSession(o.id.value)
      } catch (e) {
        if (isApiError(e) && e.status === 409 && e.details.some((d) => d.path === 'approval')) {
          toast.error(`${t('examFlow.needApproval')} ${e.details.map((d) => d.message).join('; ')}`)
          return
        }
        if (isApiError(e) && e.status === 409 && e.details.some((d) => d.path === 'blocks')) {
          const ok = await confirm({
            title: t('examBlocks.shortTitle'),
            message: `${t('examBlocks.shortText')}\n${e.details.map((d) => d.message).join('\n')}`,
            confirmText: t('examBlocks.shortConfirm'),
          })
          if (!ok) return
          await examsApi.submitSession(o.id.value, true)
        } else {
          throw e
        }
      }
      toast.success(t('examSessions.toast.scheduled'))
    })
  }

  // ---- Rad etish ----
  const rejectOpen = ref(false)
  const rejectReason = ref('')
  const rejectError = ref('')
  function openReject() {
    rejectReason.value = ''
    rejectError.value = ''
    rejectOpen.value = true
  }
  async function doReject() {
    if (!rejectReason.value.trim()) {
      rejectError.value = t('examSessions.errors.reasonRequired')
      return
    }
    rejectOpen.value = false
    await run(
      () => examsApi.rejectSession(o.id.value, rejectReason.value.trim()),
      'examSessions.toast.rejected',
    )
  }

  // ---- Qayta ochish ----
  const reopenOpen = ref(false)
  const reopenReason = ref('')
  const reopenEnd = ref('')
  const reopenError = ref<Record<string, string>>({})
  function openReopen() {
    reopenReason.value = ''
    reopenEnd.value = nowLocal(60)
    reopenError.value = {}
    reopenOpen.value = true
  }
  async function doReopen() {
    reopenError.value = {}
    if (!reopenReason.value.trim())
      reopenError.value.reason = t('examSessions.errors.reasonRequired')
    if (!reopenEnd.value) reopenError.value.end = t('examSessions.errors.newEndRequired')
    else if (new Date(localToIso(reopenEnd.value)).getTime() <= Date.now()) {
      reopenError.value.end = t('examSessions.errors.newEndPast')
    }
    if (Object.keys(reopenError.value).length) return
    busy.value = true
    try {
      const r = await examsApi.reopenSession(o.id.value, {
        reason: reopenReason.value.trim(),
        newEnd: localToIso(reopenEnd.value),
      })
      reopenOpen.value = false
      toast.success(
        r.codeChanged
          ? t('examSessions.detail.reopenedCode', { code: r.code ?? '' })
          : t('examSessions.toast.reopened'),
      )
      await o.refresh()
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }

  // ---- Hammaga vaqt qo'shish ----
  const extendOpen = ref(false)
  const extendMinutes = ref('15')
  const extendReason = ref('')
  const extendError = ref('')
  function openExtend() {
    extendMinutes.value = '15'
    extendReason.value = ''
    extendError.value = ''
    extendOpen.value = true
  }
  async function doExtend() {
    const n = Number(extendMinutes.value)
    if (!Number.isInteger(n) || n < 1 || n > 180) {
      extendError.value = t('examSessions.errors.minutesRange')
      return
    }
    busy.value = true
    try {
      await examsApi.extendSession(o.id.value, {
        minutes: n,
        reason: extendReason.value.trim() || undefined,
      })
      extendOpen.value = false
      toast.success(t('examSessions.toast.extended'))
      await o.refresh()
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }

  // ---- O'chirish ----
  const deleteOpen = ref(false)
  const deleteMode = ref<'exam_only' | 'with_results'>('exam_only')
  const deleteTitle = ref('')
  const deleteError = ref('')
  async function remove() {
    if (o.s.value?.hasAttempts) {
      deleteMode.value = 'exam_only'
      deleteTitle.value = ''
      deleteError.value = ''
      deleteOpen.value = true
      return
    }
    const ok = await confirm({
      title: t('examSessions.detail.deleteTitle'),
      message: t('examSessions.detail.deleteText'),
      confirmText: t('common.delete'),
      variant: 'danger',
    })
    if (ok) await doDelete()
  }
  async function doDelete() {
    const s = o.s.value
    if (!s) return
    if (deleteOpen.value && deleteMode.value === 'with_results' && deleteTitle.value !== s.title) {
      deleteError.value = t('examSessions.detail.deleteTitleMismatch')
      return
    }
    busy.value = true
    try {
      await examsApi.deleteSession(
        o.id.value,
        deleteOpen.value
          ? {
              mode: deleteMode.value,
              confirmTitle: deleteMode.value === 'with_results' ? deleteTitle.value : undefined,
            }
          : {},
      )
      clearDraftById(auth.user?.id ?? '', schoolId.value ?? auth.user?.schoolId ?? '', o.id.value)
      toast.success(t('examSessions.toast.deleted'))
      deleteOpen.value = false
      void router.replace({ name: 'exam-sessions' })
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }

  // ---- Bekor qilish, yopish, nusxa, qoralamaga qaytarish ----
  async function cancel() {
    const ok = await confirm({
      title: t('examSessions.detail.cancelTitle'),
      message: t('examSessions.detail.cancelText'),
      confirmText: t('examSessions.detail.cancel'),
      variant: 'danger',
    })
    if (ok) await run(() => examsApi.cancelSession(o.id.value), 'examSessions.toast.cancelled')
  }
  async function closeNow() {
    const ok = await confirm({
      title: t('examSessions.detail.closeTitle'),
      message: t('examSessions.detail.closeText'),
      confirmText: t('examSessions.detail.close'),
      variant: 'danger',
    })
    if (ok) await act('close', 'examSessions.toast.closed')
  }
  /** Nusxa olib yangi imtihon: yangi qoralama ustada ochiladi, ogohlantirishlar toast bilan */
  async function copySession() {
    busy.value = true
    try {
      const r = await examsApi.copySession(o.id.value)
      toast.success(t('examSessions.toast.copied'))
      for (const w of r.warnings) toast.info(w)
      void router.push({
        name: 'exam-session-edit',
        params: { id: r.session.id },
        query: { copied: '1' },
      })
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }
  async function returnToDraft() {
    const ok = await confirm({
      title: t('examSessions.detail.returnTitle'),
      message: t('examSessions.detail.returnText'),
      confirmText: t('examSessions.detail.returnConfirm'),
    })
    if (!ok) return
    busy.value = true
    try {
      await examsApi.returnToDraft(o.id.value)
      toast.success(t('examSessions.toast.returned'))
      void router.push({ name: 'exam-session-edit', params: { id: o.id.value } })
    } catch (e) {
      toast.error(errorMessage(e, t))
      await o.refresh()
    } finally {
      busy.value = false
    }
  }

  // ---- Eslatma (Telegram) ----
  async function remind() {
    busy.value = true
    try {
      const r = await examsApi.remindSession(o.id.value)
      if (r.disabled) toast.info(t('examFlow.remindDisabled'))
      else if (r.notConnected) toast.info(t('examFlow.remindNotConnected'))
      else if (r.blocks.length && r.blocks.every((b) => b.state === 'recent'))
        toast.info(t('examFlow.remindRecent'))
      else if (r.blocks.length === 0) toast.info(t('examFlow.remindNobody'))
      else
        toast.success(
          t('examFlow.remindSent', { n: r.blocks.filter((b) => b.state === 'sent').length }),
        )
      await o.refresh()
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }

  // ---- PIN kartochkalari (sinf tanlash bilan kichik modal) ----
  const printOpen = ref(false)
  const printClass = ref('')
  function openPrint() {
    printClass.value = ''
    printOpen.value = true
  }
  async function print() {
    busy.value = true
    try {
      await examsApi.downloadPinSheet(o.id.value, printClass.value || undefined)
      printOpen.value = false
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }

  // ---- Natijalar: Excel va e'lon qilish (ExamResultsView dagi bilan bir xil shart va tasdiq) ----
  async function exportExcel() {
    busy.value = true
    try {
      await examsApi.downloadResults(o.id.value, 'xlsx')
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }
  async function publish() {
    let confirmPending = false
    const pending = o.results.value?.summary.essayPending ?? 0
    if (pending > 0) {
      const ok = await confirm({
        title: t('examResults.publish.confirmTitle'),
        message: t('examResults.publish.confirmText', { n: pending }),
        confirmText: t('examResults.publish.confirmButton'),
      })
      if (!ok) return
      confirmPending = true
    }
    busy.value = true
    try {
      await examsApi.publishResults(o.id.value, { published: true, confirmPending })
      toast.success(t('examResults.publish.toastPublished'))
      await o.refresh()
    } catch (e) {
      toast.error(errorMessage(e, t))
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    run,
    act,
    submitSession,
    rejectOpen,
    rejectReason,
    rejectError,
    openReject,
    doReject,
    reopenOpen,
    reopenReason,
    reopenEnd,
    reopenError,
    openReopen,
    doReopen,
    extendOpen,
    extendMinutes,
    extendReason,
    extendError,
    openExtend,
    doExtend,
    deleteOpen,
    deleteMode,
    deleteTitle,
    deleteError,
    remove,
    doDelete,
    cancel,
    closeNow,
    copySession,
    returnToDraft,
    remind,
    printOpen,
    printClass,
    openPrint,
    print,
    exportExcel,
    publish,
  }
}
