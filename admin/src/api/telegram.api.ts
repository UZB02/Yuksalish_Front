import { deleteData, getData, sendData } from './http'
import type { TelegramConfig, TelegramLinkInfo, TelegramMe } from './types'

export const telegramApi = {
  getConfig: () => getData<TelegramConfig>('/telegram/config'),
  updateConfig: (payload: { token?: string; enabled?: boolean }) =>
    sendData<TelegramConfig>('put', '/telegram/config', payload),
  deleteConfig: () => deleteData<TelegramConfig>('/telegram/config'),
  me: () => getData<TelegramMe>('/telegram/me'),
  createLink: () => sendData<TelegramLinkInfo>('post', '/telegram/me/link'),
  unlink: () => deleteData<TelegramMe>('/telegram/me/link'),
}
