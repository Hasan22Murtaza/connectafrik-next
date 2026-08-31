import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  getBunnyCdnUrl,
  getBunnyStorageConfig,
  PRESIGN_EXPIRES_SECONDS,
} from '@/lib/bunny'

let s3Client: S3Client | null = null

const S3_REGIONS = new Set(['de', 'uk', 'ny', 'la', 'sg', 'se', 'jh', 'syd'])

function getS3Client(): S3Client {
  if (s3Client) return s3Client

  const { accessKey, storageZone, s3Region, s3Endpoint } = getBunnyStorageConfig()

  if (!S3_REGIONS.has(s3Region)) {
    throw new Error(
      `Bunny S3 is not available in region "${s3Region}". Direct browser uploads ` +
        'need one of: de, uk, ny, la, sg, se, jh, syd. See docs/bunny-storage.md.'
    )
  }

  s3Client = new S3Client({
    region: s3Region,
    endpoint: s3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: storageZone,
      secretAccessKey: accessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  return s3Client
}

function explainS3Failure(error: unknown): Error {
  const message =
    error instanceof Error ? error.message : 'Unknown Bunny S3 error'
  const haystack = message.toLowerCase()

  if (
    haystack.includes('not implemented') ||
    haystack.includes('serviceunavailable') ||
    haystack.includes('s3 compatibility')
  ) {
    return new Error(
      'Bunny S3 compatibility is not enabled for this storage zone. ' +
        'Direct browser uploads require an S3-compatible zone. ' +
        'See docs/bunny-storage.md.'
    )
  }

  return error instanceof Error ? error : new Error(message)
}

export interface PresignedPutUpload {
  uploadUrl: string
  method: 'PUT'
  headers: Record<string, string>
  path: string
  publicUrl: string
  expiresAt: string
}

export async function createPresignedPut(params: {
  path: string
  contentType: string
  expiresIn?: number
}): Promise<PresignedPutUpload> {
  const expiresIn = params.expiresIn ?? PRESIGN_EXPIRES_SECONDS
  const contentType = params.contentType || 'application/octet-stream'
  const { storageZone } = getBunnyStorageConfig()

  try {
    const uploadUrl = await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({
        Bucket: storageZone,
        Key: params.path,
        ContentType: contentType,
      }),
      { expiresIn }
    )

    return {
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      path: params.path,
      publicUrl: getBunnyCdnUrl(params.path),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    }
  } catch (error) {
    throw explainS3Failure(error)
  }
}
