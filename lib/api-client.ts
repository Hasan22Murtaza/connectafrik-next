import { CHAT_LOCKED_CODE } from '@/features/chat/chatLockEvents'
import { PARENTAL_RESTRICTED_CODE } from '@/shared/types/family'
import { getAccessToken } from './auth-session-cache'
import { cachedGet, invalidateRequestCache } from './request-cache'

export const PRIVACY_DENIED_CODE = 'PRIVACY_DENIED'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function apiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined
  const details = error.details as { code?: string } | undefined
  return details?.code
}

export function isChatLockedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && apiErrorCode(error) === CHAT_LOCKED_CODE
}

export function isPrivacyDeniedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && apiErrorCode(error) === PRIVACY_DENIED_CODE
}

export function isParentalRestrictedError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    apiErrorCode(error) === PARENTAL_RESTRICTED_CODE
  )
}

let extraHeaderProvider: (endpoint?: string) => Record<string, string> = () => ({})

export function setApiClientExtraHeaders(provider: (endpoint?: string) => Record<string, string>) {
  extraHeaderProvider = provider
}

async function getAuthHeaders(endpoint?: string): Promise<Record<string, string>> {
  // Use in-memory session cache — do not call supabase.auth.getSession()/getUser()
  // per request (that spammed GET /auth/v1/user in DevTools).
  const accessToken = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaderProvider(endpoint),
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  return headers
}

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(endpoint, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString()
}

async function handleResponse<T>(response: Response): Promise<T> {
  let body: any
  try {
    body = await response.json()
  } catch {
    throw new ApiError(
      `${response.status} ${response.statusText}`,
      response.status
    )
  }

  if (!response.ok || body.success === false) {
    throw new ApiError(
      body?.message || `Request failed with status ${response.status}`,
      response.status,
      body
    )
  }

  return body.data as T
}

type GetOptions = {
  signal?: AbortSignal
  /** Skip short TTL cache / still dedupe in-flight */
  bypassCache?: boolean
}

export const apiClient = {
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: GetOptions
  ): Promise<T> {
    const url = buildUrl(endpoint, params)
    const run = async () => {
      const headers = await getAuthHeaders(endpoint)
      const response = await fetch(url, {
        headers,
        cache: 'no-store',
        signal: options?.signal,
      })
      return handleResponse<T>(response)
    }

    if (options?.bypassCache) return run()
    return cachedGet(url, run, { signal: options?.signal })
  },

  async post<T>(endpoint: string, body?: unknown, options?: { signal?: AbortSignal }): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    })
    // Mutations invalidate related GET caches
    invalidateRequestCache(endpoint.split('?')[0])
    return handleResponse<T>(response)
  },

  async patch<T>(
    endpoint: string,
    body: unknown,
    options?: { keepalive?: boolean; signal?: AbortSignal }
  ): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
      signal: options?.signal,
      ...(options?.keepalive ? { keepalive: true } : {}),
    })
    invalidateRequestCache(endpoint.split('?')[0])
    return handleResponse<T>(response)
  },

  async put<T>(endpoint: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      signal: options?.signal,
    })
    invalidateRequestCache(endpoint.split('?')[0])
    return handleResponse<T>(response)
  },

  async delete<T>(endpoint: string, body?: unknown, options?: { signal?: AbortSignal }): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    })
    invalidateRequestCache(endpoint.split('?')[0])
    return handleResponse<T>(response)
  },

  async getBlob(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    extraHeaders?: Record<string, string>
  ): Promise<Blob> {
    const headers = await getAuthHeaders(endpoint)
    delete headers['Content-Type']
    const response = await fetch(buildUrl(endpoint, params), {
      headers: { ...headers, ...extraHeaders },
      cache: 'no-store',
    })
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`
      try {
        const body = await response.json()
        if (body?.message) message = body.message
        throw new ApiError(message, response.status, body)
      } catch (error) {
        if (error instanceof ApiError) throw error
        throw new ApiError(message, response.status)
      }
    }
    return response.blob()
  },

  /** Drop short-lived GET caches (e.g. after profile update). */
  invalidateCache(matcher?: string | RegExp) {
    invalidateRequestCache(matcher)
  },
}
