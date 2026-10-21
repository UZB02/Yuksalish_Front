import { getData } from './http'
import type { PermissionMeta } from './types'

export const metaApi = {
  permissions: () => getData<PermissionMeta[]>('/meta/permissions'),
}
