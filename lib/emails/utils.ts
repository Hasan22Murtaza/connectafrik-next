export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
}
