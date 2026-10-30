import { bareHttp, deleteData, postFile, sendData } from './http'
import type { ApiSuccess, Branding } from './types'

export const brandingApi = {
  /** Ochiq (tokensiz): ilova ishga tushganda chaqiriladi */
  get: async (): Promise<Branding> => {
    const res = await bareHttp.get<ApiSuccess<Branding>>('/branding')
    return res.data.data
  },
  update: (payload: { appName: string; shortName: string }) =>
    sendData<Branding>('put', '/branding', payload),
  uploadLogo: (file: File) => postFile<Branding>('/branding/logo', file),
  deleteLogo: () => deleteData<Branding>('/branding/logo'),
}
