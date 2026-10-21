import { getPage, sendData } from './http'
import type {
  BehaviorType,
  BehaviorTypeCreatePayload,
  BehaviorTypeListParams,
  BehaviorTypePayload,
  Paginated,
} from './types'

export const behaviorTypesApi = {
  list: (params: BehaviorTypeListParams = {}): Promise<Paginated<BehaviorType>> =>
    getPage('/behavior-types', { limit: 100, ...params }),
  create: (payload: BehaviorTypeCreatePayload) =>
    sendData<BehaviorType>('post', '/behavior-types', payload),
  update: (id: string, payload: Partial<BehaviorTypePayload>) =>
    sendData<BehaviorType>('patch', `/behavior-types/${id}`, payload),
  activate: (id: string) => sendData<BehaviorType>('post', `/behavior-types/${id}/activate`),
  deactivate: (id: string) => sendData<BehaviorType>('post', `/behavior-types/${id}/deactivate`),
}
