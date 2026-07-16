/**
 * Single source of truth for marketplace order statuses.
 * Buyer inbox, seller actions, and admin views all derive labels from here.
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed'

/** User-facing status shared by buyer and seller (inbox filter chips). */
export type OrderDisplayLabel =
  | 'all'
  | 'pending_payment'
  | 'paid'
  | 'to_be_shipped'
  | 'shipped'
  | 'cash_on_delivery'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed'

export type MarketplaceInboxRole = 'selling' | 'buying'

export type MarketplaceInboxLabel = Exclude<OrderDisplayLabel, 'cancelled' | 'refunded' | 'disputed'>

export const MARKETPLACE_INBOX_LABELS: { value: MarketplaceInboxLabel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'to_be_shipped', label: 'To be shipped' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'cash_on_delivery', label: 'Cash on delivery' },
  { value: 'completed', label: 'Completed' },
]

export const ORDER_DISPLAY_LABEL_TEXT: Record<OrderDisplayLabel, string> = {
  all: 'All',
  pending_payment: 'Pending payment',
  paid: 'Paid',
  to_be_shipped: 'To be shipped',
  shipped: 'Shipped',
  cash_on_delivery: 'Cash on delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  disputed: 'Disputed',
}

/** Canonical DB statuses used in admin filters and reporting. */
export const ADMIN_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
]

export const COMPLETED_ORDER_STATUSES: OrderStatus[] = ['completed', 'delivered']

/** Allowed seller-driven status transitions. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['completed'],
  delivered: [],
  completed: [],
  cancelled: [],
  refunded: [],
  disputed: [],
}

export interface OrderStatusContext {
  status: string
  payment_status: string
  payment_method?: string | null
}

function normalizeStatus(status: string | null | undefined): string {
  return (status || '').toLowerCase()
}

function isCashOnDelivery(method: string | null | undefined): boolean {
  const normalized = (method || '').toLowerCase()
  return normalized === 'cash_on_delivery' || normalized === 'cod'
}

export function resolveOrderDisplayLabel(
  order: OrderStatusContext | null | undefined
): OrderDisplayLabel | null {
  if (!order) return null

  const status = normalizeStatus(order.status)

  if (status === 'cancelled') return 'cancelled'
  if (status === 'refunded') return 'refunded'
  if (status === 'disputed') return 'disputed'

  if (isCashOnDelivery(order.payment_method)) {
    if (status === 'completed' || status === 'delivered') return 'completed'
    return 'cash_on_delivery'
  }

  if (order.payment_status !== 'completed') return 'pending_payment'
  if (status === 'completed' || status === 'delivered') return 'completed'
  if (status === 'shipped') return 'shipped'
  if (status === 'confirmed' || status === 'processing') return 'to_be_shipped'
  if (order.payment_status === 'completed') return 'paid'

  return null
}

/** @deprecated Use resolveOrderDisplayLabel */
export const resolveOrderInboxLabel = resolveOrderDisplayLabel

export function getOrderDisplayLabelText(order: OrderStatusContext): string {
  const label = resolveOrderDisplayLabel(order)
  return label ? ORDER_DISPLAY_LABEL_TEXT[label] : 'Unknown'
}

export function orderMatchesDisplayLabel(
  order: OrderStatusContext | null | undefined,
  label: OrderDisplayLabel
): boolean {
  if (label === 'all') return true
  return resolveOrderDisplayLabel(order) === label
}

/** @deprecated Use orderMatchesDisplayLabel */
export const orderMatchesInboxLabel = orderMatchesDisplayLabel

export function getNextOrderStatuses(currentStatus: string): OrderStatus[] {
  const key = normalizeStatus(currentStatus) as OrderStatus
  return ORDER_STATUS_TRANSITIONS[key] || []
}

/** Label shown on seller action buttons / dropdown options. */
export function getSellerTransitionLabel(toStatus: string): string {
  const labels: Record<string, string> = {
    confirmed: 'Confirm order',
    processing: 'Start processing',
    shipped: 'Mark as shipped',
    completed: 'Mark as completed',
    cancelled: 'Cancel order',
  }
  return labels[normalizeStatus(toStatus)] ?? formatOrderStatus(toStatus)
}

export function formatOrderStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown'
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getOrderDisplayBadgeClasses(label: OrderDisplayLabel | null): string {
  const colors: Record<OrderDisplayLabel, string> = {
    all: 'bg-surface-secondary text-content border-border',
    pending_payment: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    paid: 'bg-blue-100 text-blue-700 border-blue-300',
    to_be_shipped: 'bg-purple-100 text-purple-700 border-purple-300',
    shipped: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    cash_on_delivery: 'bg-amber-100 text-amber-800 border-amber-300',
    completed: 'bg-green-100 text-green-700 border-green-300',
    cancelled: 'bg-red-100 text-red-700 border-red-300',
    refunded: 'bg-surface-secondary text-content border-border',
    disputed: 'bg-orange-100 text-orange-700 border-orange-300',
  }
  return label ? colors[label] : 'bg-surface-secondary text-content border-border'
}

export function getOrderDisplayBadgeClassesFromOrder(order: OrderStatusContext): string {
  return getOrderDisplayBadgeClasses(resolveOrderDisplayLabel(order))
}

export function getDeliveryStatusForOrderStatus(newStatus: string): string {
  const status = normalizeStatus(newStatus)
  if (status === 'cancelled') return 'cancelled'
  if (status === 'processing') return 'processing'
  if (status === 'shipped') return 'shipped'
  if (status === 'completed') return 'delivered'
  return 'pending'
}

export function getSellerStatusHint(currentStatus: string): string {
  const status = normalizeStatus(currentStatus)
  const hints: Record<string, string> = {
    pending: 'Confirm the order once payment is received.',
    confirmed: 'Start processing when you are preparing the order.',
    processing: 'Mark as shipped when the item is dispatched.',
    shipped: 'Mark as completed when the buyer receives the item.',
  }
  return hints[status] ?? ''
}
