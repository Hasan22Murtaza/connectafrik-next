import { apiClient } from '@/lib/api-client'

export interface SavedCard {
  id: string
  user_id: string
  stripe_customer_id: string
  payment_method_id: string
  last_four: string
  card_brand: string
  is_default: boolean
  created_at: string
}

export async function fetchSavedCards(): Promise<SavedCard[]> {
  const result = await apiClient.get<SavedCard[]>('/api/marketplace/stripe-profile')
  return Array.isArray(result) ? result.filter((card) => card?.id) : []
}

export async function addSavedCard(payload: { name: string; token: string }): Promise<SavedCard> {
  return apiClient.post<SavedCard>('/api/marketplace/stripe-profile', payload)
}

export async function setDefaultCard(paymentMethodId: string): Promise<SavedCard> {
  return apiClient.put<SavedCard>('/api/marketplace/stripe-profile', { paymentMethodId })
}

export async function deleteSavedCard(paymentMethodId: string): Promise<void> {
  await apiClient.delete('/api/marketplace/stripe-profile', { paymentMethodId })
}
