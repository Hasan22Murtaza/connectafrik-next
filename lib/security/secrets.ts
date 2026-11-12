/**
 * Resolve HMAC/JWT signing secrets without silent production fallbacks.
 * In production, missing secrets fail closed.
 */

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

export function requireSigningSecret(
  envKeys: string[],
  options?: { allowDevFallback?: string; label?: string }
): string {
  for (const key of envKeys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim().length >= 16) {
      return value.trim()
    }
  }

  if (!isProductionRuntime() && options?.allowDevFallback) {
    return options.allowDevFallback
  }

  const label = options?.label || envKeys[0] || 'signing secret'
  throw new Error(
    `Missing required ${label}. Set ${envKeys.join(' or ')} in the environment.`
  )
}
