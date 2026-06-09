import { apiClient } from '@/lib/api-client'

export type DisputeReason =
  | 'not_received'
  | 'not_as_described'
  | 'damaged'
  | 'wrong_item'
  | 'counterfeit'
  | 'missing_parts'
  | 'other'

export interface Dispute {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  reason: DisputeReason
  description: string
  requested_resolution: string
  requested_amount: number | null
  status: string
  seller_response: string | null
  resolution_notes: string | null
  resolved_amount: number | null
  sla_seller_deadline: string | null
  created_at: string
  updated_at: string
}

export const DISPUTE_REASONS: { value: DisputeReason; label: string }[] = [
  { value: 'not_received', label: 'Item not received' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'damaged', label: 'Damaged item' },
  { value: 'wrong_item', label: 'Wrong item sent' },
  { value: 'counterfeit', label: 'Counterfeit / fake' },
  { value: 'missing_parts', label: 'Missing parts' },
  { value: 'other', label: 'Other issue' },
]

export async function openDispute(params: {
  order_id: string
  reason: DisputeReason
  description: string
  requested_resolution?: string
  requested_amount?: number
}): Promise<Dispute> {
  const result = await apiClient.post<{ data: Dispute }>('/api/marketplace/disputes', params)
  return result.data
}

export async function getOrderDispute(orderId: string): Promise<Dispute | null> {
  const result = await apiClient.get<{ data: Dispute | null }>(
    `/api/marketplace/orders/${orderId}/dispute`
  )
  return result.data
}

export async function getDisputeDetail(disputeId: string) {
  const result = await apiClient.get<{ data: any }>(`/api/marketplace/disputes/${disputeId}`)
  return result.data
}

export async function respondToDispute(
  disputeId: string,
  response: string,
  acceptBuyerClaim?: boolean
) {
  const result = await apiClient.post<{ data: any }>(
    `/api/marketplace/disputes/${disputeId}/respond`,
    { response, accept_buyer_claim: acceptBuyerClaim }
  )
  return result.data
}

export async function withdrawDispute(disputeId: string) {
  const result = await apiClient.post<{ data: any }>(
    `/api/marketplace/disputes/${disputeId}/withdraw`,
    {}
  )
  return result.data
}

export async function addDisputeEvidence(
  disputeId: string,
  evidence: { evidence_type: string; file_url?: string; description?: string }
) {
  const result = await apiClient.post<{ data: any }>(
    `/api/marketplace/disputes/${disputeId}/evidence`,
    evidence
  )
  return result.data
}

export async function addDisputeMessage(disputeId: string, message: string) {
  const result = await apiClient.post<{ data: any }>(
    `/api/marketplace/disputes/${disputeId}/messages`,
    { message }
  )
  return result.data
}

export async function resolveDisputeAdmin(
  disputeId: string,
  params: {
    outcome: 'buyer_wins' | 'seller_wins' | 'partial'
    resolution_notes: string
    refund_amount?: number
  }
) {
  const result = await apiClient.patch<{ data: any }>(
    `/api/marketplace/disputes/${disputeId}/resolve`,
    params
  )
  return result.data
}

export async function listAdminDisputes(status?: string) {
  const result = await apiClient.get<{ data: Dispute[] }>(
    '/api/marketplace/admin/disputes',
    status ? { status } : undefined
  )
  return result.data || []
}
