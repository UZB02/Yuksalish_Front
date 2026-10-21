import { getData, getPage, http, sendData } from './http'
import type {
  BulkScoresPayload,
  BulkScoresResult,
  Paginated,
  Score,
  ScoreListParams,
  ScorePayload,
  ScoringSheet,
  ScoreUpdatePayload,
  StudentScoreSummary,
  TodayProgress,
} from './types'

export const scoresApi = {
  list: (params: ScoreListParams = {}): Promise<Paginated<Score>> => getPage('/scores', params),
  create: (payload: ScorePayload) => sendData<Score>('post', '/scores', payload),
  update: (id: string, payload: ScoreUpdatePayload) =>
    sendData<Score>('patch', `/scores/${id}`, payload),
  remove: async (id: string): Promise<void> => {
    await http.delete(`/scores/${id}`)
  },
  bulk: (payload: BulkScoresPayload) => sendData<BulkScoresResult>('post', '/scores/bulk', payload),
  sheet: (classId: string, date?: string) =>
    getData<ScoringSheet>(`/classes/${classId}/scoring-sheet`, { date }),
  todayProgress: () => getData<TodayProgress[]>('/scores/today-progress'),
  studentSummary: (studentId: string, params: { from?: string; to?: string } = {}) =>
    getData<StudentScoreSummary>(`/students/${studentId}/score-summary`, params),
}
