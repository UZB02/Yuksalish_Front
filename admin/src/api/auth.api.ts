import { bareHttp, deleteData, getData, http, putPhoto, sendData } from './http'
import { toApiError } from './errors'
import type { ApiSuccess, AuthResult, ChangePasswordPayload, LoginPayload, User } from './types'

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResult> {
    try {
      const res = await bareHttp.post<ApiSuccess<AuthResult>>('/auth/login', payload)
      return res.data.data
    } catch (e) {
      throw toApiError(e)
    }
  },
  async logout(): Promise<void> {
    await http.post('/auth/logout')
  },
  me: () => getData<User>('/auth/me'),
  setOwnPhoto: (file: File) => putPhoto<User>('/auth/me/photo', file),
  removeOwnPhoto: () => deleteData<User>('/auth/me/photo'),
  changePassword: (payload: ChangePasswordPayload) =>
    sendData<{ accessToken: string }>('patch', '/auth/password', payload),
}
