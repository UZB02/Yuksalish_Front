import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { examsApi } from '@/api/exams.api'
import type { ExamLiveResponse, ExamSessionStatus } from '@/api/types'

/**
 * Takroriy so'rov: bir vaqtda faqat BITTA so'rov (javob kechiksa yangisi boshlanmaydi), sahifa yashirin bo'lsa
 * to'xtaydi va ko'ringach darhol davom etadi, `enabled` o'chsa to'xtaydi. `refreshNow` navbatni kutmasdan yangilaydi.
 */
export function useVisiblePoll(fn: () => Promise<void>, ms: number, enabled: Ref<boolean>) {
  const hidden = ref(typeof document !== 'undefined' ? document.hidden : false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let alive = true

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  const schedule = () => {
    clear()
    if (!alive || !enabled.value || document.hidden) return
    timer = setTimeout(() => void run(), ms)
  }
  async function run() {
    if (inFlight || !alive || !enabled.value || document.hidden) return
    inFlight = true
    try {
      await fn()
    } finally {
      inFlight = false
      schedule()
    }
  }
  function onVisibility() {
    hidden.value = document.hidden
    if (document.hidden) clear()
    else void run()
  }
  function refreshNow() {
    clear()
    void run()
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    if (enabled.value) void run()
  })
  onBeforeUnmount(() => {
    alive = false
    document.removeEventListener('visibilitychange', onVisibility)
    clear()
  })
  watch(enabled, (on) => {
    if (on) void run()
    else clear()
  })
  return { hidden, refreshNow }
}

/** Yangi chiqish shuncha vaqt ajralib (miltillab) turadi */
export const FLASH_MS = 15_000
export const LIVE_POLL_MS = 5000

/**
 * Nazoratchi jonli ekrani ma'lumoti (E5): har 5 s da BITTA `sessionLive` so'rovi. Server soati farqi (offset) bilan
 * qolgan vaqt va "n s oldin" hisoblanadi; oynadan yangi chiqish `flashUntil` ga yoziladi. Birinchi yuklashdagi
 * mavjud chiqishlar "yangi" hisoblanmaydi. Imtihon holati o'zgargani `onStatus` bilan xabar qilinadi.
 */
export function useExamLive(
  sessionId: Ref<string>,
  enabled: Ref<boolean>,
  onStatus?: (status: ExamSessionStatus) => void,
) {
  const data = ref<ExamLiveResponse | null>(null)
  const loadError = ref(false)
  const offset = ref(0)
  const tick = ref(Date.now())
  const flashUntil = ref<Record<string, number>>({})
  const lastLeaves = new Map<string, number>()
  let clock: ReturnType<typeof setInterval> | null = null

  function apply(r: ExamLiveResponse) {
    offset.value = Date.parse(r.serverNow) - Date.now()
    tick.value = Date.now()
    const first = lastLeaves.size === 0 && data.value === null
    for (const it of r.items) {
      const prev = lastLeaves.get(it.key)
      if (!first && prev !== undefined && it.leaves > prev) {
        flashUntil.value = { ...flashUntil.value, [it.key]: Date.now() + FLASH_MS }
      }
      lastLeaves.set(it.key, it.leaves)
    }
    data.value = r
    onStatus?.(r.session.status)
  }

  const { hidden, refreshNow } = useVisiblePoll(
    async () => {
      const sid = sessionId.value
      try {
        const r = await examsApi.sessionLive(sid)
        // Boshqa imtihonga o'tilgan bo'lsa eski imtihonning kechikkan javobi qo'llanmaydi
        if (sid !== sessionId.value) return
        apply(r)
        loadError.value = false
      } catch {
        loadError.value = true
      }
    },
    LIVE_POLL_MS,
    enabled,
  )

  onMounted(() => {
    clock = setInterval(() => {
      if (!document.hidden) tick.value = Date.now()
    }, 1000)
  })
  onBeforeUnmount(() => {
    if (clock) clearInterval(clock)
  })
  watch(sessionId, () => {
    data.value = null
    lastLeaves.clear()
    flashUntil.value = {}
    refreshNow()
  })

  /** Server vaqti (ms) */
  const nowMs = computed(() => tick.value + offset.value)
  const staleMs = computed(() => (data.value?.staleAfterSec ?? 60) * 1000)
  return { data, loadError, hidden, offset, tick, nowMs, staleMs, flashUntil, refreshNow }
}
