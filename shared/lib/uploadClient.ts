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

  const query = new URLSearchParams({
    folder: options.folder,
    filename: file.name || 'file',
  })

  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/upload?${query.toString()}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

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
      let payload: any = {}
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.data?.publicUrl) {
        resolve({
          publicUrl: payload.data.publicUrl,
          path: payload.data.path,
        })
      } else {
        reject(
          new Error(
            payload?.message || `Upload failed (HTTP ${xhr.status})`
          )
        )
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
