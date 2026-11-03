import { getData, sendData } from './http'
import type { Superadmin, SuperadminCreatePayload, SuperadminUpdatePayload } from './types'

export const superadminsApi = {
  list: () => getData<Superadmin[]>('/superadmins'),
  create: (payload: SuperadminCreatePayload) =>
    sendData<Superadmin>('post', '/superadmins', payload),
  update: (id: string, payload: SuperadminUpdatePayload) =>
    sendData<Superadmin>('patch', `/superadmins/${id}`, payload),
  transferOwnership: (id: string, currentPassword: string) =>
    sendData<Superadmin[]>('post', `/superadmins/${id}/transfer-ownership`, { currentPassword }),
}
