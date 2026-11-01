type Translate = (key: string, params?: Record<string, unknown>) => string

/** Telegram sozlamasi qiymatini ko'rsatish (tasdiq xulosasi va "global qiymat" yozuvi). */
export function formatTelegramSetting(t: Translate, key: string, value: unknown): string {
  if (key === 'workdays') {
    return Array.isArray(value)
      ? value.map((d) => t(`settingsAttendance.weekdays.${d}`)).join(', ')
      : t('settingsTelegram.workdaysAutoShort')
  }
  if (key === 'weeklyReportDay') {
    return typeof value === 'number'
      ? t(`settingsTelegram.weekdaysFull.${value}`)
      : t('settingsTelegram.weeklyDayAuto')
  }
  if (key === 'notify' && value && typeof value === 'object') {
    const on = Object.entries(value as Record<string, boolean>)
      .filter(([, v]) => v)
      .map(([k]) => t(`settingsTelegram.notify.${k}.label`))
    return on.length ? on.join(', ') : t('settings.no')
  }
  if (typeof value === 'boolean') return value ? t('settings.yes') : t('settings.no')
  return value === null || value === undefined || value === '' ? t('settings.notSet') : String(value)
}
