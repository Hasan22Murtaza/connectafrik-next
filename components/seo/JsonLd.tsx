function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[]
}) {
  if (!data || (Array.isArray(data) && data.length === 0)) return null
  const payload = Array.isArray(data) ? (data.length === 1 ? data[0] : data) : data
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
    />
  )
}
