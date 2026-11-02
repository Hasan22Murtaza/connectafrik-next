import { apiClient } from '@/lib/api-client'
import type {
  MonitoringRange,
  MonitoringSnapshot,
} from '@/lib/admin/monitoringService'

export type {
  MonitoringRange,
  MonitoringSnapshot,
  MonitoringKpis,
  MonitoringActivityEvent,
  MonitoringCallRow,
  MonitoringContentRow,
  MonitoringAdminAction,
  MonitoringServiceHealth,
  MonitoringEventType,
  MonitoringEventStatus,
  MonitoringEventSeverity,
} from '@/lib/admin/monitoringService'

export async function fetchMonitoringSnapshot(params?: {
  range?: MonitoringRange
  search?: string
  event_type?: string
  status?: string
  severity?: string
}): Promise<MonitoringSnapshot> {
  return apiClient.get<MonitoringSnapshot>('/api/admin/monitoring', params)
}
