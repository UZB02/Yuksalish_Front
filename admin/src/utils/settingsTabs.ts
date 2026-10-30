export type SettingsTabKey =
  | 'scoring'
  | 'rating'
  | 'public'
  | 'attendance'
  | 'timetable'
  | 'branding'
  | 'schoolLogo'

export const ALL_SETTINGS_TABS: SettingsTabKey[] = [
  'scoring',
  'rating',
  'public',
  'attendance',
  'timetable',
  'branding',
]

/**
 * Sozlamalar tablari: superadmin hammasini ko'radi; maktab admini faqat
 * `attendance.settings` ruxsati bilan va faqat "Davomat" hamda "Dars jadvali" tablarini.
 */
export function visibleSettingsTabs(
  isSuperadmin: boolean,
  hasPermission: (permission: string) => boolean,
  isSchoolAdmin = false,
): SettingsTabKey[] {
  if (isSuperadmin) return [...ALL_SETTINGS_TABS]
  const tabs: SettingsTabKey[] = hasPermission('attendance.settings')
    ? ['attendance', 'timetable']
    : []
  // Maktab logosini faqat maktab admini o'zi boshqaradi (superadmin: Maktablar sahifasida)
  if (isSchoolAdmin) tabs.push('schoolLogo')
  return tabs
}
