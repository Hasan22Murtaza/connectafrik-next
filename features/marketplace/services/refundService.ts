import { apiClient } from '@/lib/api-client'

export interface RefundTransaction {
  id: string
  order_id: string
  gateway: string
  gateway_refund_id: string | null
  amount: number
  currency: string
  reason: string | null
  status: string
  initiator_role: string | null
  created_at: string
  completed_at: string | null
  failure_reason: string | null
}

export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; message?: string; refunded?: boolean; amount?: number }> {
  const result = await apiClient.post<{ data: any }>(
    `/api/marketplace/orders/${orderId}/cancel`,
    { reason }
  )
  return result.data
}

export async function getOrderRefunds(orderId: string): Promise<RefundTransaction[]> {
  const result = await apiClient.get<{ data: RefundTransaction[] }>(
    `/api/marketplace/orders/${orderId}/refunds`
  )
  return result.data || []
}
