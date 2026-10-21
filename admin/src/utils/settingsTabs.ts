export type SettingsTabKey = 'scoring' | 'rating' | 'public' | 'attendance'

export const ALL_SETTINGS_TABS: SettingsTabKey[] = ['scoring', 'rating', 'public', 'attendance']

/**
 * Sozlamalar tablari: superadmin hammasini ko'radi; maktab admini faqat
 * `attendance.settings` ruxsati bilan va faqat "Davomat" tabini.
 */
export function visibleSettingsTabs(
  isSuperadmin: boolean,
  hasPermission: (permission: string) => boolean,
): SettingsTabKey[] {
  if (isSuperadmin) return [...ALL_SETTINGS_TABS]
  return hasPermission('attendance.settings') ? ['attendance'] : []
}
