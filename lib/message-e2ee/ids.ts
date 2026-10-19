/**
 * Device link payloads for CribsTalk Signal E2EE.
 * v2 uses bare UUIDs (no Matrix IDs). v1 Matrix-shaped payloads are still accepted.
 */

export function parseLinkPayload(payload: string): { userId: string; deviceId: string } | null {
  const trimmed = payload.trim().replace(/\s+/g, '')
  const v2 =
    /^cribstalk-link:2:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([A-Za-z0-9]{8,64})$/i.exec(
      trimmed,
    )
  if (v2) {
    return { userId: v2[1]!.toLowerCase(), deviceId: v2[2]! }
  }
  const v1 =
    /^cribstalk-link:1:@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):cribstalk:([A-Za-z0-9]{8,64})$/i.exec(
      trimmed,
    )
  if (v1) {
    return { userId: v1[1]!.toLowerCase(), deviceId: v1[2]! }
  }
  return null
}

/**
 * Accept a full QR payload, or a bare device id from another browser of the same account.
 */
export function normalizeLinkInput(
  raw: string,
  accountUserId: string,
): { userId: string; deviceId: string } | null {
  const trimmed = raw.trim()
  const parsed = parseLinkPayload(trimmed.replace(/\s+/g, ''))
  if (parsed) return parsed

  const deviceOnly =
    /^([A-Za-z0-9]{8,64})$/.exec(trimmed)?.[1] ||
    /^This\s*device:\s*([A-Za-z0-9]{8,64})$/i.exec(trimmed)?.[1]
  if (!deviceOnly) return null
  const userId = accountUserId.trim().toLowerCase()
  if (!userId) return null
  return { userId, deviceId: deviceOnly }
}

export function linkPayload(userId: string, deviceId: string): string {
  return `cribstalk-link:2:${userId.trim().toLowerCase()}:${deviceId}`
}
