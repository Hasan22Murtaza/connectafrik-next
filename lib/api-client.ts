import { supabase } from './supabase'

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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    const headers = await getAuthHeaders()
    const url = buildUrl(endpoint, params)
    const response = await fetch(url, { headers, cache: 'no-store' })
    return handleResponse<T>(response)
  },

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    })
    return handleResponse<T>(response)
  },

  async delete<T>(endpoint: string): Promise<T> {
    const headers = await getAuthHeaders()
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers,
    })
    return handleResponse<T>(response)
  },
}
