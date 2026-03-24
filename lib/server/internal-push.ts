/**
 * Server-only: POST to the app's push-notifications API using an absolute origin.
 * Client-side notificationService uses relative URLs which do not work in Route Handlers.
 */
export function getInternalSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  const trimmed = (raw || '').replace(/\/$/, '')
  return trimmed || 'http://localhost:3000'
}

export async function postInternalPushNotification(payload: Record<string, unknown>): Promise<void> {
  const url = `${getInternalSiteOrigin()}/api/push-notifications`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.ok) return

  const text = await res.text().catch(() => '')
  console.warn('[internal-push] push failed', res.status, text)

  if (payload.notification_type === 'ringing') {
    const retryPayload = { ...payload, notification_type: 'system' }
    const retryRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retryPayload),
    })
    if (!retryRes.ok) {
      const retryText = await retryRes.text().catch(() => '')
      console.warn('[internal-push] ringing fallback push failed', retryRes.status, retryText)
    } else {
      console.info('[internal-push] ringing push delivered via system fallback')
    }
  }
}
