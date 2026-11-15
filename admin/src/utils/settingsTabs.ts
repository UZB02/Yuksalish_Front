export type SettingsTabKey =
  | 'scoring'
  | 'rating'
  | 'public'
  | 'attendance'
  | 'timetable'
  | 'exams'
  | 'branding'
  | 'schoolLogo'
  | 'telegram'

export const ALL_SETTINGS_TABS: SettingsTabKey[] = [
  'scoring',
  'rating',
  'public',
  'attendance',
  'timetable',
  'exams',
  'branding',
  'telegram',
]

/**
 * Sozlamalar tablari: superadmin hammasini ko'radi; maktab admini faqat
 * `attendance.settings` ruxsati bilan va "Davomat", "Dars jadvali" va "Telegram bot" (xabarlar sozlamalari) tablarini.
 */
export function visibleSettingsTabs(
  isSuperadmin: boolean,
  hasPermission: (permission: string) => boolean,
  isSchoolAdmin = false,
): SettingsTabKey[] {
  if (isSuperadmin) return [...ALL_SETTINGS_TABS]
  const tabs: SettingsTabKey[] = hasPermission('attendance.settings')
    ? ['attendance', 'timetable', 'telegram']
    : []
  // Imtihon sozlamalari: exams.manage li maktab admini (enabled dan tashqari)
  if (hasPermission('exams.manage')) tabs.push('exams')
  // Maktab logosini faqat maktab admini o'zi boshqaradi (superadmin: Maktablar sahifasida)
  if (isSchoolAdmin) tabs.push('schoolLogo')
  return tabs
}
