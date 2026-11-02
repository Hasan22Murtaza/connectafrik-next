'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useCreateReel } from '@/shared/hooks/useReels'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { MAX_REEL_DURATION, MAX_REEL_TITLE_LENGTH } from '@/shared/types/reels'
import ReelCameraCapture from './components/ReelCameraCapture'
import ReelMediaEditor, {
  DEFAULT_REEL_EDIT,
  type ReelEditState,
} from './components/ReelMediaEditor'
import ReelCaptionShare from './components/ReelCaptionShare'
import {
  makeThumbnail,
  revokePreviewUrl,
  type CapturedReelMedia,
} from './components/reelMediaUtils'

type Step = 'capture' | 'edit' | 'caption'
type SubmitStage = 'idle' | 'uploading-video' | 'uploading-thumbnail' | 'publishing'

const CreateReelPage: React.FC = () => {
  const router = useRouter()
  const { createReel } = useCreateReel()
  const { uploadFile } = useFileUpload()
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('capture')
  const [media, setMedia] = useState<CapturedReelMedia | null>(null)
  const [edit, setEdit] = useState<ReelEditState>(DEFAULT_REEL_EDIT)
  const [caption, setCaption] = useState('')
  const [submitStage, setSubmitStage] = useState<SubmitStage>('idle')

  const isSharing = submitStage !== 'idle'

  useEffect(() => {
    return () => {
      if (media) revokePreviewUrl(media.preview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, [])

  const replaceMedia = useCallback((next: CapturedReelMedia | null) => {
    setMedia((prev) => {
      if (prev && prev.preview !== next?.preview) revokePreviewUrl(prev.preview)
      return next
    })
  }, [])

  const exit = useCallback(() => {
    replaceMedia(null)
    router.back()
  }, [replaceMedia, router])

  const openGallery = useCallback(() => {
    galleryInputRef.current?.click()
  }, [])

  const applyGalleryFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file')
        return
      }

      const preview = URL.createObjectURL(file)
      const meta = await makeThumbnail(file, preview)

      if (meta.duration > MAX_REEL_DURATION) {
        revokePreviewUrl(preview)
        toast.error(`Video must be shorter than ${MAX_REEL_DURATION / 60} minutes`)
        return
      }

      replaceMedia({
        file,
        preview,
        duration: meta.duration,
        thumbnailUrl: meta.thumbnailUrl,
      })
      setEdit(DEFAULT_REEL_EDIT)
      setCaption('')
      setStep('edit')
    },
    [replaceMedia]
  )

  const onGalleryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) void applyGalleryFile(file)
    },
    [applyGalleryFile]
  )

  const dataUrlToFile = useCallback((dataUrl: string, filename: string): File | null => {
    if (!dataUrl.startsWith('data:')) return null
    const parts = dataUrl.split(',')
    if (parts.length < 2) return null
    const mimeMatch = parts[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    try {
      const binary = atob(parts[1])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new File([bytes], filename, { type: mime })
    } catch {
      return null
    }
  }, [])

  const shareReel = useCallback(async () => {
    if (!media) return
    const title = caption.trim()
    if (!title) {
      toast.error('Please write a caption')
      return
    }
    if (title.length > MAX_REEL_TITLE_LENGTH) {
      toast.error(`Caption must be ${MAX_REEL_TITLE_LENGTH} characters or less`)
      return
    }

    try {
      setSubmitStage('uploading-video')
      const uploadResult = await uploadFile(media.file, { bucket: 'post-videos' })
      if (uploadResult.error || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Video upload failed')
      }

      let uploadedThumbnailUrl: string | undefined
      if (media.thumbnailUrl) {
        setSubmitStage('uploading-thumbnail')
        const thumbFile = dataUrlToFile(media.thumbnailUrl, `thumbnail_${Date.now()}.jpg`)
        if (thumbFile) {
          const thumbUpload = await uploadFile(thumbFile, { bucket: 'post-images' })
          if (!thumbUpload.error && thumbUpload.url) uploadedThumbnailUrl = thumbUpload.url
        }
      }

      setSubmitStage('publishing')

      const { error } = await createReel({
        title,
        description: edit.textOverlay.trim() || undefined,
        video_url: uploadResult.url,
        thumbnail_url: uploadedThumbnailUrl,
        duration: media.duration || 1,
        aspect_ratio: '9:16',
        category: 'other',
        tags: [],
        is_public: edit.isPublic,
      })

      if (error) {
        toast.error(error)
        return
      }

      toast.success('Reel shared!')
      replaceMedia(null)
      router.push('/reels/foryou')
    } catch (err) {
      console.error('Error creating reel:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to share reel')
    } finally {
      setSubmitStage('idle')
    }
  }, [media, caption, edit, uploadFile, dataUrlToFile, createReel, replaceMedia, router])

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onGalleryChange}
      />

      {step === 'capture' && (
        <ReelCameraCapture
          onClose={exit}
          onOpenGallery={openGallery}
          onCaptured={(m) => {
            replaceMedia(m)
            setEdit(DEFAULT_REEL_EDIT)
            setCaption('')
            setStep('edit')
          }}
        />
      )}

      {step === 'edit' && media && (
        <ReelMediaEditor
          media={media}
          edit={edit}
          onChange={(patch) => setEdit((prev) => ({ ...prev, ...patch }))}
          onMediaChange={(next) => {
            replaceMedia(next)
          }}
          onClose={exit}
          onOpenCamera={() => {
            replaceMedia(null)
            setStep('capture')
          }}
          onContinue={() => {
            if (!caption.trim() && edit.textOverlay.trim()) setCaption(edit.textOverlay.trim())
            setStep('caption')
          }}
        />
      )}

      {step === 'caption' && media && (
        <ReelCaptionShare
          media={media}
          edit={edit}
          caption={caption}
          onCaptionChange={setCaption}
          onPublicChange={(v) => setEdit((prev) => ({ ...prev, isPublic: v }))}
          onClose={exit}
          onOpenCamera={() => {
            replaceMedia(null)
            setStep('capture')
          }}
          onChangeMedia={openGallery}
          onEditMedia={() => setStep('edit')}
          onShare={shareReel}
          isSharing={isSharing}
        />
      )}
    </>
  )
}

export default CreateReelPage
