import { getData, getPage } from './http'
import type { AuditFilters, AuditLogItem, AuditLogParams, Paginated } from './types'

export const auditApi = {
  list: (params: AuditLogParams = {}): Promise<Paginated<AuditLogItem>> =>
    getPage('/audit-logs', params),
  filters: () => getData<AuditFilters>('/audit-logs/filters'),
}
