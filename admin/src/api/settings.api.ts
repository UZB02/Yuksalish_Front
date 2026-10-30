import { http } from './http'
import type {
  ApiSuccess,
  AttendanceSettings,
  PublicSettings,
  RatingSettings,
  SaveScoringSettingsPayload,
  SaveSettingsPayload,
  ScoringSettings,
  ScoringSettingsResponse,
  SettingsResponse,
  TimetableAttendanceSettings,
} from './types'

export type SettingsKind = 'scoring' | 'rating' | 'public' | 'attendance' | 'timetable'

interface SettingsMap {
  scoring: ScoringSettings
  rating: RatingSettings
  public: PublicSettings
  attendance: AttendanceSettings
  timetable: TimetableAttendanceSettings
}

export const settingsApi = {
  /** schoolId berilsa (superadmin) shu maktab uchun samarali va override qiymatlar olinadi. */
  async get<K extends SettingsKind>(
    kind: K,
    schoolId?: string,
  ): Promise<SettingsResponse<SettingsMap[K]>> {
    const res = await http.get<ApiSuccess<SettingsResponse<SettingsMap[K]>>>(`/settings/${kind}`, {
      headers: schoolId ? { 'X-School-Id': schoolId } : undefined,
    })
    return res.data.data
  },
  async save<K extends SettingsKind>(
    kind: K,
    payload: SaveSettingsPayload<SettingsMap[K]>,
  ): Promise<SettingsResponse<SettingsMap[K]>> {
    const res = await http.put<ApiSuccess<SettingsResponse<SettingsMap[K]>>>(
      `/settings/${kind}`,
      payload,
    )
    return res.data.data
  },
  getScoring: (schoolId?: string): Promise<ScoringSettingsResponse> =>
    settingsApi.get('scoring', schoolId),
  saveScoring: (payload: SaveScoringSettingsPayload): Promise<ScoringSettingsResponse> =>
    settingsApi.save('scoring', payload),
}
