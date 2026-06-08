import { SupabaseClient } from '@supabase/supabase-js'
import { appendOrderLedgerEntry } from './orderLedger'
import { getPlatformSetting } from './platformSettings'
import { issueOrderRefund } from './refundService'
import { releaseOrderEscrow } from './escrowService'

export type DisputeReason =
  | 'not_received'
  | 'not_as_described'
  | 'damaged'
  | 'wrong_item'
  | 'counterfeit'
  | 'missing_parts'
  | 'other'

export type DisputeStatus =
  | 'open'
  | 'awaiting_seller'
  | 'under_review'
  | 'resolved_buyer'
  | 'resolved_seller'
  | 'resolved_partial'
  | 'withdrawn'
  | 'closed'

export type RequestedResolution = 'full_refund' | 'partial_refund' | 'replacement' | 'other'

export type ResolveOutcome = 'buyer_wins' | 'seller_wins' | 'partial'

const ACTIVE_DISPUTE_STATUSES = new Set([
  'open',
  'awaiting_seller',
  'under_review',
])

const TERMINAL_DISPUTE_STATUSES = new Set([
  'resolved_buyer',
  'resolved_seller',
  'resolved_partial',
  'withdrawn',
  'closed',
])

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function freezeOrderEscrow(
  serviceClient: SupabaseClient,
  orderId: string,
  disputeId: string,
  userId: string
): Promise<void> {
  const { data: order } = await serviceClient
    .from('orders')
    .select('currency')
    .eq('id', orderId)
    .single()

  await serviceClient
    .from('orders')
    .update({
      escrow_status: 'frozen',
      dispute_id: disputeId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  await serviceClient
    .from('seller_payouts')
    .update({
      status: 'cancelled',
      notes: 'Frozen due to open dispute',
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['pending', 'approved', 'processing'])

  await appendOrderLedgerEntry(serviceClient, {
    order_id: orderId,
    entry_type: 'dispute_freeze',
    amount: 0,
    currency: order?.currency ?? 'USD',
    reference_type: 'disputes',
    reference_id: disputeId,
    metadata: { action: 'dispute_opened' },
    created_by: userId,
  })
}

async function unfreezeOrderEscrow(
  serviceClient: SupabaseClient,
  orderId: string,
  disputeId: string,
  userId: string,
  restoreScheduled: boolean
): Promise<void> {
  const { data: order } = await serviceClient
    .from('orders')
    .select('release_eligible_at, delivery_confirmed_at, currency')
    .eq('id', orderId)
    .single()

  const escrowStatus =
    restoreScheduled && order?.release_eligible_at ? 'scheduled' : 'held'

  await serviceClient
    .from('orders')
    .update({
      escrow_status: escrowStatus,
      dispute_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  await appendOrderLedgerEntry(serviceClient, {
    order_id: orderId,
    entry_type: 'dispute_unfreeze',
    amount: 0,
    currency: order?.currency ?? 'USD',
    reference_type: 'disputes',
    reference_id: disputeId,
    metadata: { escrow_status: escrowStatus },
    created_by: userId,
  })
}

export function isDisputeActive(status: string): boolean {
  return ACTIVE_DISPUTE_STATUSES.has(status)
}

export async function openDispute(
  serviceClient: SupabaseClient,
  params: {
    orderId: string
    buyerId: string
    reason: DisputeReason
    description: string
    requestedResolution?: RequestedResolution
    requestedAmount?: number
  }
) {
  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('*')
    .eq('id', params.orderId)
    .single()

  if (orderError || !order) {
    throw new Error('Order not found')
  }

  if (order.buyer_id !== params.buyerId) {
    throw new Error('Only the buyer can open a dispute')
  }

  if (order.payment_status !== 'completed') {
    throw new Error('Disputes can only be opened for paid orders')
  }

  if (order.payout_status === 'completed') {
    throw new Error('Seller has already been paid — contact support for help')
  }

  if (order.status === 'cancelled' || order.status === 'refunded') {
    throw new Error('This order is already cancelled or refunded')
  }

  const disputableStatuses = ['shipped', 'completed', 'processing', 'confirmed']
  if (!disputableStatuses.includes(order.status)) {
    throw new Error('Disputes can be opened after the order is confirmed or shipped')
  }

  const windowDays = await getPlatformSetting(serviceClient, 'dispute_buyer_window_days', 30)
  const windowStart = order.delivery_confirmed_at || order.paid_at || order.created_at
  if (windowStart) {
    const deadline = addDays(new Date(windowStart), windowDays)
    if (new Date() > deadline) {
      throw new Error(`Dispute window closed (${windowDays} days from purchase/delivery)`)
    }
  }

  const { data: existing } = await serviceClient
    .from('disputes')
    .select('id, status')
    .eq('order_id', params.orderId)
    .not('status', 'in', '(resolved_buyer,resolved_seller,resolved_partial,withdrawn,closed)')
    .maybeSingle()

  if (existing) {
    throw new Error('An active dispute already exists for this order')
  }

  const sellerResponseDays = await getPlatformSetting(
    serviceClient,
    'seller_dispute_response_days',
    3
  )
  const slaSellerDeadline = addDays(new Date(), sellerResponseDays)

  const { data: dispute, error: disputeError } = await serviceClient
    .from('disputes')
    .insert({
      order_id: params.orderId,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      reason: params.reason,
      description: params.description,
      requested_resolution: params.requestedResolution ?? 'full_refund',
      requested_amount: params.requestedAmount ?? null,
      status: 'awaiting_seller',
      sla_seller_deadline: slaSellerDeadline.toISOString(),
    })
    .select('*')
    .single()

  if (disputeError || !dispute) {
    throw new Error(disputeError?.message || 'Failed to create dispute')
  }

  await freezeOrderEscrow(serviceClient, params.orderId, dispute.id, params.buyerId)

  await serviceClient.from('dispute_messages').insert({
    dispute_id: dispute.id,
    sender_id: params.buyerId,
    sender_role: 'buyer',
    message: params.description,
  })

  return dispute
}

export async function respondToDispute(
  serviceClient: SupabaseClient,
  disputeId: string,
  sellerId: string,
  response: string,
  acceptBuyerClaim?: boolean
) {
  const { data: dispute, error } = await serviceClient
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (error || !dispute) {
    throw new Error('Dispute not found')
  }

  if (dispute.seller_id !== sellerId) {
    throw new Error('Only the seller can respond to this dispute')
  }

  if (!isDisputeActive(dispute.status)) {
    throw new Error('This dispute is no longer active')
  }

  const now = new Date().toISOString()

  if (acceptBuyerClaim) {
    const refundResult = await issueOrderRefund(serviceClient, dispute.order_id, {
      reason: `Dispute accepted by seller: ${dispute.reason}`,
      initiatedBy: sellerId,
      initiatorRole: 'seller',
    })

    await serviceClient
      .from('disputes')
      .update({
        status: 'resolved_buyer',
        seller_response: response,
        seller_responded_at: now,
        resolution_notes: 'Seller accepted buyer claim',
        resolved_amount: refundResult.amount,
        resolved_at: now,
        updated_at: now,
      })
      .eq('id', disputeId)

    await serviceClient
      .from('refund_transactions')
      .update({ dispute_id: disputeId })
      .eq('id', refundResult.refund_id)

    return { dispute_id: disputeId, status: 'resolved_buyer', refund: refundResult }
  }

  await serviceClient
    .from('disputes')
    .update({
      status: 'under_review',
      seller_response: response,
      seller_responded_at: now,
      updated_at: now,
    })
    .eq('id', disputeId)

  await serviceClient.from('dispute_messages').insert({
    dispute_id: disputeId,
    sender_id: sellerId,
    sender_role: 'seller',
    message: response,
  })

  return { dispute_id: disputeId, status: 'under_review' }
}

export async function withdrawDispute(
  serviceClient: SupabaseClient,
  disputeId: string,
  buyerId: string
) {
  const { data: dispute, error } = await serviceClient
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (error || !dispute) {
    throw new Error('Dispute not found')
  }

  if (dispute.buyer_id !== buyerId) {
    throw new Error('Only the buyer can withdraw this dispute')
  }

  if (!isDisputeActive(dispute.status)) {
    throw new Error('This dispute cannot be withdrawn')
  }

  const now = new Date().toISOString()

  await serviceClient
    .from('disputes')
    .update({
      status: 'withdrawn',
      resolution_notes: 'Withdrawn by buyer',
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', disputeId)

  const { data: order } = await serviceClient
    .from('orders')
    .select('release_eligible_at')
    .eq('id', dispute.order_id)
    .single()

  await unfreezeOrderEscrow(
    serviceClient,
    dispute.order_id,
    disputeId,
    buyerId,
    Boolean(order?.release_eligible_at)
  )

  return { dispute_id: disputeId, status: 'withdrawn' }
}

export async function addDisputeEvidence(
  serviceClient: SupabaseClient,
  disputeId: string,
  userId: string,
  role: 'buyer' | 'seller' | 'admin',
  evidence: {
    evidence_type: string
    file_url?: string
    description?: string
  }
) {
  const { data: dispute } = await serviceClient
    .from('disputes')
    .select('buyer_id, seller_id, status')
    .eq('id', disputeId)
    .single()

  if (!dispute) {
    throw new Error('Dispute not found')
  }

  if (role === 'buyer' && dispute.buyer_id !== userId) {
    throw new Error('Unauthorized')
  }
  if (role === 'seller' && dispute.seller_id !== userId) {
    throw new Error('Unauthorized')
  }

  if (TERMINAL_DISPUTE_STATUSES.has(dispute.status)) {
    throw new Error('Cannot add evidence to a closed dispute')
  }

  const { data, error } = await serviceClient
    .from('dispute_evidence')
    .insert({
      dispute_id: disputeId,
      submitted_by: userId,
      submitter_role: role,
      evidence_type: evidence.evidence_type,
      file_url: evidence.file_url ?? null,
      description: evidence.description ?? null,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function addDisputeMessage(
  serviceClient: SupabaseClient,
  disputeId: string,
  userId: string,
  role: 'buyer' | 'seller' | 'admin',
  message: string,
  isInternal = false
) {
  const { data: dispute } = await serviceClient
    .from('disputes')
    .select('buyer_id, seller_id, status')
    .eq('id', disputeId)
    .single()

  if (!dispute) {
    throw new Error('Dispute not found')
  }

  if (role === 'buyer' && dispute.buyer_id !== userId) {
    throw new Error('Unauthorized')
  }
  if (role === 'seller' && dispute.seller_id !== userId) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await serviceClient
    .from('dispute_messages')
    .insert({
      dispute_id: disputeId,
      sender_id: userId,
      sender_role: role,
      message,
      is_internal: isInternal,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function resolveDispute(
  serviceClient: SupabaseClient,
  disputeId: string,
  adminId: string,
  params: {
    outcome: ResolveOutcome
    refundAmount?: number
    resolutionNotes: string
  }
) {
  const { data: dispute, error } = await serviceClient
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (error || !dispute) {
    throw new Error('Dispute not found')
  }

  if (!isDisputeActive(dispute.status) && dispute.status !== 'under_review') {
    if (TERMINAL_DISPUTE_STATUSES.has(dispute.status)) {
      throw new Error('Dispute is already resolved')
    }
  }

  const now = new Date().toISOString()

  if (params.outcome === 'seller_wins') {
    await serviceClient
      .from('disputes')
      .update({
        status: 'resolved_seller',
        assigned_admin_id: adminId,
        resolution_notes: params.resolutionNotes,
        resolved_at: now,
        updated_at: now,
      })
      .eq('id', disputeId)

    const { data: order } = await serviceClient
      .from('orders')
      .select('release_eligible_at, payout_status')
      .eq('id', dispute.order_id)
      .single()

    await unfreezeOrderEscrow(
      serviceClient,
      dispute.order_id,
      disputeId,
      adminId,
      Boolean(order?.release_eligible_at)
    )

    if (
      order?.release_eligible_at &&
      new Date(order.release_eligible_at) <= new Date() &&
      order.payout_status !== 'completed'
    ) {
      await releaseOrderEscrow(serviceClient, dispute.order_id)
    }

    return { dispute_id: disputeId, status: 'resolved_seller' }
  }

  const refundResult = await issueOrderRefund(serviceClient, dispute.order_id, {
    amount: params.outcome === 'partial' ? params.refundAmount : undefined,
    reason: `Dispute resolved (${params.outcome}): ${params.resolutionNotes}`,
    initiatedBy: adminId,
    initiatorRole: 'admin',
  })

  await serviceClient
    .from('refund_transactions')
    .update({ dispute_id: disputeId })
    .eq('id', refundResult.refund_id)

  const finalStatus =
    params.outcome === 'partial' ? 'resolved_partial' : 'resolved_buyer'

  await serviceClient
    .from('disputes')
    .update({
      status: finalStatus,
      assigned_admin_id: adminId,
      resolution_notes: params.resolutionNotes,
      resolved_amount: refundResult.amount,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', disputeId)

  return {
    dispute_id: disputeId,
    status: finalStatus,
    refund: refundResult,
  }
}

export async function getDisputeDetail(
  serviceClient: SupabaseClient,
  disputeId: string,
  userId: string,
  isAdmin: boolean
) {
  const { data: dispute, error } = await serviceClient
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (error || !dispute) {
    throw new Error('Dispute not found')
  }

  if (
    !isAdmin &&
    dispute.buyer_id !== userId &&
    dispute.seller_id !== userId
  ) {
    throw new Error('Unauthorized')
  }

  const messageQuery = serviceClient
    .from('dispute_messages')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true })

  if (!isAdmin) {
    messageQuery.eq('is_internal', false)
  }

  const [{ data: messages }, { data: evidence }, { data: order }] = await Promise.all([
    messageQuery,
    serviceClient
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: false }),
    serviceClient
      .from('orders')
      .select('id, order_number, product_title, total_amount, currency, status')
      .eq('id', dispute.order_id)
      .single(),
  ])

  return { dispute, messages: messages ?? [], evidence: evidence ?? [], order }
}

export async function listUserDisputes(
  serviceClient: SupabaseClient,
  userId: string,
  role?: 'buyer' | 'seller'
) {
  let query = serviceClient
    .from('disputes')
    .select('*, orders(order_number, product_title, total_amount, currency)')
    .order('created_at', { ascending: false })

  if (role === 'buyer') {
    query = query.eq('buyer_id', userId)
  } else if (role === 'seller') {
    query = query.eq('seller_id', userId)
  } else {
    query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listAdminDisputes(
  serviceClient: SupabaseClient,
  status?: string
) {
  let query = serviceClient
    .from('disputes')
    .select('*, orders(order_number, product_title, total_amount, currency)')
    .order('created_at', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  } else {
    query = query.in('status', ['awaiting_seller', 'under_review', 'open'])
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getOrderDispute(
  serviceClient: SupabaseClient,
  orderId: string
) {
  const { data } = await serviceClient
    .from('disputes')
    .select('*')
    .eq('order_id', orderId)
    .not('status', 'in', '(withdrawn,closed)')
    .order('created_at', { ascending: false })
    .maybeSingle()

  return data
}

export async function escalateOverdueDisputes(serviceClient: SupabaseClient) {
  const now = new Date().toISOString()

  const { data: overdue, error } = await serviceClient
    .from('disputes')
    .select('id, buyer_id, status, sla_seller_deadline')
    .eq('status', 'awaiting_seller')
    .lt('sla_seller_deadline', now)

  if (error) {
    throw new Error(error.message)
  }

  const results: Array<{ dispute_id: string; action: string }> = []

  for (const dispute of overdue ?? []) {
    await serviceClient
      .from('disputes')
      .update({
        status: 'under_review',
        updated_at: now,
      })
      .eq('id', dispute.id)

    if (dispute.buyer_id) {
      await serviceClient.from('dispute_messages').insert({
        dispute_id: dispute.id,
        sender_id: dispute.buyer_id,
        sender_role: 'admin',
        message:
          'This dispute was automatically escalated because the seller did not respond within the deadline.',
        is_internal: false,
      })
    }

    results.push({ dispute_id: dispute.id, action: 'escalated_to_under_review' })
  }

  return { escalated: results.length, results }
}
