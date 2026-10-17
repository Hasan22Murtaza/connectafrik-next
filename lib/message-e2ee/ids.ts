const SERVER = 'cribstalk'

export function matrixUserId(userId: string): string {
  return `@${userId.trim().toLowerCase()}:${SERVER}`
}

export function matrixRoomId(threadId: string): string {
  return `!${threadId.replace(/-/g, '').toLowerCase()}:${SERVER}`
}

export function userIdFromMatrix(matrixId: string): string | null {
  const match = /^@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):cribstalk$/i.exec(
    matrixId.trim(),
  )
  return match ? match[1].toLowerCase() : null
}

export function parseLinkPayload(payload: string): { userId: string; deviceId: string } | null {
  const match = /^cribstalk-link:1:(@[^:\s]+:cribstalk):([A-Za-z0-9]{8,64})$/.exec(payload.trim())
  if (!match) return null
  const userId = userIdFromMatrix(match[1])
  if (!userId) return null
  return { userId, deviceId: match[2] }
}

export function linkPayload(userId: string, deviceId: string): string {
  return `cribstalk-link:1:${matrixUserId(userId)}:${deviceId}`
}
