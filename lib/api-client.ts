import { supabase } from './supabase'
import { CHAT_LOCKED_CODE } from '@/features/chat/chatLockEvents'

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

export function isChatLockedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  const details = error.details as { code?: string } | undefined
  return error.status === 403 && details?.code === CHAT_LOCKED_CODE
}

let extraHeaderProvider: (endpoint?: string) => Record<string, string> = () => ({})

export function setApiClientExtraHeaders(provider: (endpoint?: string) => Record<string, string>) {
  extraHeaderProvider = provider
}

async function getAuthHeaders(endpoint?: string): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaderProvider(endpoint),
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
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

export const apiClient = {
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const url = buildUrl(endpoint, params)
    const response = await fetch(url, { headers, cache: 'no-store' })
    return handleResponse<T>(response)
  },

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  async patch<T>(endpoint: string, body: unknown, options?: { keepalive?: boolean }): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
      ...(options?.keepalive ? { keepalive: true } : {}),
    })
    return handleResponse<T>(response)
  },

  async put<T>(endpoint: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    })
    return handleResponse<T>(response)
  },

  async delete<T>(endpoint: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders(endpoint)
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
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
}
