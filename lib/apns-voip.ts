import apn from 'apn'

type VoipNotification = apn.Notification & {
  headers: () => Record<string, string>
}

let apnProvider: apn.Provider | null = null

export function getApnsVoipProvider(): apn.Provider {
  if (apnProvider) return apnProvider

  const keyPath = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID

  if (!keyPath || !keyId || !teamId) {
    throw new Error('APNS_PRIVATE_KEY/APNS_KEY_ID/APNS_TEAM_ID are required for VoIP push')
  }

  const production = process.env.APNS_PRODUCTION === 'true'

  apnProvider = new apn.Provider({
    token: {
      key: keyPath,
      keyId,
      teamId,
    },
    production,
  })
  return apnProvider
}

export function shutdownApnsVoipProvider(): void {
  try {
    apnProvider?.shutdown()
  } catch {
    /* ignore */
  }
  apnProvider = null
}

/** Strip spaces; ensure 64 hex chars (PushKit device token). */
export function normalizeVoipDeviceToken(token: string): string {
  const t = token.replace(/\s/g, '')
  if (!/^[0-9a-f]{64}$/i.test(t)) {
    throw new Error('Invalid VoIP device token (expected 64 hex characters)')
  }
  return t
}

/**
 * Same construction as `scripts/send-test-voip.cjs` (topic, expiry, payload, aps, VoIP headers).
 */
export function buildVoipApnsNotification(options: {
  bundleId: string
  title: string
  body: string
  /** Custom JSON root fields (e.g. type, call id). */
  payload: Record<string, string>
  silent?: boolean
}): VoipNotification {
  const note = new apn.Notification() as VoipNotification
  note.topic = `${options.bundleId}.voip`
  note.priority = 10
  note.expiry = Math.floor(Date.now() / 1000) + 30
  note.payload = {
    ...options.payload,
  }
  note.contentAvailable = true
  note.alert = {
    title: options.title,
    body: options.body,
  }
  if (!options.silent) {
    note.sound = 'default'
  }

  const origHeaders = note.headers.bind(note)
  note.headers = function apnsVoipHeaders() {
    return {
      ...origHeaders(),
      'apns-push-type': 'voip',
      'apns-priority': '10',
    }
  }

  return note
}

export function formatApnsVoipFailure(firstFailure: unknown): string {
  if (typeof firstFailure === 'string') return firstFailure
  const f = firstFailure as {
    response?: { reason?: string }
    error?: { message?: string }
  }
  return f.response?.reason || f.error?.message || JSON.stringify(firstFailure)
}

export async function sendVoipApnsPush(params: {
  token: string
  title: string
  body: string
  data: Record<string, string>
  silent?: boolean
}): Promise<void> {
  const bundleId = process.env.IOS_BUNDLE_ID || process.env.APNS_BUNDLE_ID
  if (!bundleId) {
    throw new Error('IOS_BUNDLE_ID (or APNS_BUNDLE_ID) is required for VoIP push')
  }

  const deviceToken = normalizeVoipDeviceToken(params.token)
  const note = buildVoipApnsNotification({
    bundleId,
    title: params.title,
    body: params.body,
    payload: params.data,
    silent: params.silent,
  })

  const provider = getApnsVoipProvider()
  const result = await provider.send(note, deviceToken)

  if (result.failed && result.failed.length > 0) {
    throw new Error(`APNs VoIP failed: ${formatApnsVoipFailure(result.failed[0])}`)
  }
}
