export type SettingsTabKey = 'scoring' | 'rating' | 'public' | 'attendance' | 'timetable'

export const ALL_SETTINGS_TABS: SettingsTabKey[] = [
  'scoring',
  'rating',
  'public',
  'attendance',
  'timetable',
]

/**
 * Sozlamalar tablari: superadmin hammasini ko'radi; maktab admini faqat
 * `attendance.settings` ruxsati bilan va faqat "Davomat" hamda "Dars jadvali" tablarini.
 */
export function visibleSettingsTabs(
  isSuperadmin: boolean,
  hasPermission: (permission: string) => boolean,
): SettingsTabKey[] {
  if (isSuperadmin) return [...ALL_SETTINGS_TABS]
  return hasPermission('attendance.settings') ? ['attendance', 'timetable'] : []
}
