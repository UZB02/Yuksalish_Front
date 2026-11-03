import { bareHttp, deleteData, getData, http, putPhoto, sendData } from './http'
import { toApiError } from './errors'
import type {
  ApiSuccess,
  AuthResult,
  ChangePasswordPayload,
  LoginPayload,
  PasswordResetInfo,
  UpdateProfilePayload,
  User,
} from './types'

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
  updateMe: (payload: UpdateProfilePayload) => sendData<User>('patch', '/auth/me', payload),
  usernameAvailable: (username: string) =>
    getData<{ username: string; available: boolean }>('/auth/username-available', { username }),
  setOwnPhoto: (file: File) => putPhoto<User>('/auth/me/photo', file),
  removeOwnPhoto: () => deleteData<User>('/auth/me/photo'),
  changePassword: (payload: ChangePasswordPayload) =>
    sendData<{ accessToken: string }>('patch', '/auth/password', payload),
  // Parolni Telegram orqali tiklash (ommaviy: tokensiz, bareHttp)
  async passwordResetInfo(): Promise<PasswordResetInfo> {
    try {
      const res = await bareHttp.get<ApiSuccess<PasswordResetInfo>>('/auth/password-reset/info')
      return res.data.data
    } catch (e) {
      throw toApiError(e)
    }
  },
  async passwordResetRequest(username: string): Promise<void> {
    try {
      await bareHttp.post('/auth/password-reset/request', { username })
    } catch (e) {
      throw toApiError(e)
    }
  },
  async passwordResetVerify(username: string, code: string): Promise<string> {
    try {
      const res = await bareHttp.post<ApiSuccess<{ resetToken: string }>>(
        '/auth/password-reset/verify',
        { username, code },
      )
      return res.data.data.resetToken
    } catch (e) {
      throw toApiError(e)
    }
  },
  async passwordResetComplete(resetToken: string, password: string): Promise<void> {
    try {
      await bareHttp.post('/auth/password-reset/complete', { resetToken, password })
    } catch (e) {
      throw toApiError(e)
    }
  },
}
