export const FRIENDS_REQUIRED_FOR_CALL_EVENT = 'friendsRequiredForCall'

export type FriendshipCallStatus = 'none' | 'pending_sent' | 'pending_received'

export type FriendsRequiredForCallDetail = {
  targetUserId: string
  targetUserName?: string
  status: FriendshipCallStatus
  requestId?: string | null
}

export class FriendsRequiredForCallError extends Error {
  readonly code = 'FRIENDS_REQUIRED_FOR_CALL' as const
  readonly targetUserId: string
  readonly targetUserName?: string
  readonly status: FriendshipCallStatus
  readonly requestId: string | null

  constructor(detail: FriendsRequiredForCallDetail) {
    super('You need to be friends to start a call.')
    this.name = 'FriendsRequiredForCallError'
    this.targetUserId = detail.targetUserId
    this.targetUserName = detail.targetUserName
    this.status = detail.status
    this.requestId = detail.requestId ?? null
  }
}

export function isFriendsRequiredForCallError(
  error: unknown
): error is FriendsRequiredForCallError {
  return (
    error instanceof FriendsRequiredForCallError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'FRIENDS_REQUIRED_FOR_CALL')
  )
}

export function dispatchFriendsRequiredForCall(
  detail: FriendsRequiredForCallDetail
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(FRIENDS_REQUIRED_FOR_CALL_EVENT, { detail })
  )
}
