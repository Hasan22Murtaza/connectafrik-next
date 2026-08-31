import { supabase } from '@/lib/supabase'

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export interface UploadOptions {
  folder: string
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

export interface UploadResponse {
  publicUrl: string
  path: string
}

export function isUploadCancelledError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const err = error as { name?: unknown; message?: unknown }
  if (err.name === 'AbortError') return true
  const message = typeof err.message === 'string' ? err.message : ''
  return /upload cancelled|aborted/i.test(message)
}

type AuthorizePayload = {
  uploadUrl: string
  headers: Record<string, string>
  path: string
  publicUrl: string
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new Error('You must be logged in to upload files')
  }
  return data.session.access_token
}

export async function uploadFileToBunny(
  file: File,
  options: UploadOptions
): Promise<UploadResponse> {
  const token = await getAccessToken()
  const contentType = file.type || 'application/octet-stream'

  const authorizeResponse = await fetch('/api/upload/authorize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folder: options.folder,
      filename: file.name || 'file',
      contentType,
      size: file.size,
    }),
    signal: options.signal,
  })

  const payload = await authorizeResponse.json().catch(() => ({}))
  if (!authorizeResponse.ok || payload?.success === false) {
    throw new Error(payload?.message || `Authorize failed (HTTP ${authorizeResponse.status})`)
  }

  const auth = (payload?.data ?? payload) as AuthorizePayload
  if (!auth?.uploadUrl || !auth?.publicUrl) {
    throw new Error('Upload authorization did not return an upload URL')
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', auth.uploadUrl)

    Object.entries(auth.headers || {}).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value)
    })

    if (options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress!({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          })
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Direct upload failed (HTTP ${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort()
        return
      }
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(file)
  })

  return {
    publicUrl: auth.publicUrl,
    path: auth.path,
  }
}

export async function deleteFileFromBunny(urlOrPath: string): Promise<boolean> {
  try {
    const token = await getAccessToken()

    const response = await fetch('/api/upload/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: urlOrPath }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.message || 'Failed to delete file')
    }

    return true
  } catch (error) {
    console.error('Error deleting file from Bunny:', error)
    return false
  }
}
