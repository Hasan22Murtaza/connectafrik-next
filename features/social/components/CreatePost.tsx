import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Image, MapPin, Send, X, Film, ChevronDown, Save } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import VideoUploader from '@/shared/components/ui/VideoUploader'
import toast from 'react-hot-toast'
import { CULTURE_SUBCATEGORIES, type CultureSubcategorySlug } from '@/shared/constants/culture'
import { POLITICS_SUBCATEGORIES, type PoliticsSubcategorySlug } from '@/shared/constants/politics'

type MediaType = 'image' | 'video' | 'none'
type Category = 'politics' | 'culture' | 'general'

export interface PostSubmitData {
  title: string
  content: string
  category: Category
  media_type: MediaType
  media_urls?: string[]
  tags?: string[]
}

export interface EditPostData {
  id: string
  title: string
  content: string
  category: Category
  media_urls?: string[] | null
  tags?: string[]
}

interface CreatePostProps {
  onSubmit: (postData: PostSubmitData) => void | Promise<void>
  onCancel?: () => void
  defaultCategory?: Category
  culturePageMode?: boolean
  politicsPageMode?: boolean
  editData?: EditPostData
}

const VIDEO_REGEX = /\.(mp4|webm|ogg|mov)(\?|$)/i
const MAX_FILES = 4
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 500 * 1024 * 1024

const CATEGORIES = [
  { value: 'general' as const, label: 'General', icon: '💬', active: 'bg-orange-50 border-orange-400 text-orange-700' },
  { value: 'politics' as const, label: 'Politics', icon: '🏛️', active: 'bg-red-50 border-red-400 text-red-700' },
  { value: 'culture' as const, label: 'Culture', icon: '🎭', active: 'bg-emerald-50 border-emerald-400 text-emerald-700' },
]

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

const getMediaBucket = (file: File): 'post-images' | 'post-videos' | 'post-audio' => {
  if (file.type.startsWith('image/')) return 'post-images'
  if (file.type.startsWith('video/')) return 'post-videos'
  if (file.type.startsWith('audio/')) return 'post-audio'
  return 'post-images'
}

const CreatePost: React.FC<CreatePostProps> = ({
  onSubmit,
  onCancel,
  defaultCategory,
  culturePageMode,
  politicsPageMode,
  editData,
}) => {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { uploadMultipleFiles, uploading } = useFileUpload()

  const isEditMode = !!editData
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const [title, setTitle] = useState(editData?.title ?? '')
  const [content, setContent] = useState(editData?.content ?? '')
  const [category, setCategory] = useState<Category>(
    editData?.category ?? (culturePageMode ? 'culture' : politicsPageMode ? 'politics' : (defaultCategory ?? 'general'))
  )
  const [cultureSubcategory, setCultureSubcategory] = useState<CultureSubcategorySlug | ''>(
    (editData?.category === 'culture' && editData?.tags?.[0] || '') as CultureSubcategorySlug | ''
  )
  const [politicsSubcategory, setPoliticsSubcategory] = useState<PoliticsSubcategorySlug | ''>(
    (editData?.category === 'politics' && editData?.tags?.[0] || '') as PoliticsSubcategorySlug | ''
  )
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>(editData?.media_urls ?? [])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoKey, setVideoKey] = useState('')
  const [showVideoUploader, setShowVideoUploader] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [showSubcategories, setShowSubcategories] = useState(false)

  const contentRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const existingImageUrls = existingMediaUrls.filter((u) => !VIDEO_REGEX.test(u))
  const existingVideoUrls = existingMediaUrls.filter((u) => VIDEO_REGEX.test(u))
  const totalMediaCount = mediaFiles.length + existingImageUrls.length
  const hasMedia = totalMediaCount > 0 || !!videoUrl || existingVideoUrls.length > 0
  const effectiveCategory = culturePageMode ? 'culture' : politicsPageMode ? 'politics' : category
  const isFormValid = title.trim().length >= 5 && content.trim().length >= 10 && !isSubmitting && !uploading
  const hasActiveVideo = videoUrl !== '' || existingVideoUrls.length > 0

  const autoResize = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(hasMedia ? 36 : 80, el.scrollHeight)}px`
  }, [hasMedia])

  useEffect(() => { autoResize() }, [content, autoResize, hasMedia])
  useEffect(() => { titleRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    if (title.trim().length < 5) return toast.error('Title must be at least 5 characters long')
    if (content.trim().length < 10) return toast.error('Content must be at least 10 characters long')
    if (effectiveCategory === 'culture' && !cultureSubcategory) return toast.error('Please select a cultural category')
    if (effectiveCategory === 'politics' && !politicsSubcategory) return toast.error('Please select a political topic')

    setIsSubmitting(true)
    let media_urls = [...existingMediaUrls]

    try {
      if (videoUrl) media_urls.push(videoUrl)

      if (mediaFiles.length > 0) {
        setUploadProgress('Uploading media...')
        const results = await uploadMultipleFiles(mediaFiles, { bucket: getMediaBucket(mediaFiles[0]), compress: true })
        const failed = results.filter((r) => r.error)
        if (failed.length > 0) throw new Error(`Failed to upload ${failed.length} file(s)`)
        media_urls = [...media_urls, ...results.filter((r) => r.url).map((r) => r.url!)]
      }

      setUploadProgress(isEditMode ? 'Saving...' : 'Creating post...')

      const media_type: MediaType =
        videoUrl || existingVideoUrls.length > 0 || mediaFiles.some((f) => f.type.startsWith('video/'))
          ? 'video'
          : mediaFiles.length > 0 || existingImageUrls.length > 0
            ? 'image'
            : 'none'

      const tags =
        effectiveCategory === 'culture' && cultureSubcategory ? [cultureSubcategory]
          : effectiveCategory === 'politics' && politicsSubcategory ? [politicsSubcategory]
            : undefined

      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        category: effectiveCategory,
        media_type,
        media_urls: media_urls.length > 0 ? media_urls : undefined,
        tags,
      })

      if (!isEditMode) {
        setTitle('')
        setContent('')
        setCategory(culturePageMode ? 'culture' : politicsPageMode ? 'politics' : 'general')
        setCultureSubcategory('')
        setPoliticsSubcategory('')
        setMediaFiles([])
        setExistingMediaUrls([])
        setVideoUrl('')
        setVideoKey('')
        setShowVideoUploader(false)
        setUploadProgress('')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save post')
    } finally {
      setIsSubmitting(false)
      setUploadProgress('')
    }
  }

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const oversized = files.find((f) => f.size > (f.type.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE))
    if (oversized) {
      const limit = oversized.type.startsWith('video/') ? 500 : 10
      return toast.error(`File exceeds the ${limit}MB limit (${Math.round(oversized.size / 1024 / 1024)}MB)`)
    }
    setMediaFiles((prev) => [...prev, ...files].slice(0, MAX_FILES - existingImageUrls.length))
  }

  const removeMedia = (i: number) => setMediaFiles((prev) => prev.filter((_, idx) => idx !== i))
  const removeExistingMedia = (url: string) => setExistingMediaUrls((prev) => prev.filter((u) => u !== url))
  const clearVideo = () => { setVideoUrl(''); setVideoKey('') }

  if (!user) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-6 py-8 text-center">
        <p className="text-gray-500 text-sm">Please sign in to create a post.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="flex items-center gap-3 px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 ring-2 ring-gray-100">
            <span className="text-white font-semibold text-sm">{profile?.full_name?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm sm:text-base leading-tight truncate">{profile?.full_name || 'User'}</p>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">{isEditMode ? 'Editing post' : 'Share with the community'}</p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {!culturePageMode && !politicsPageMode && (
          <div className="px-3 sm:px-4 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(({ value, label, icon, active }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCategory(value)
                    if (value !== 'culture') setCultureSubcategory('')
                    if (value !== 'politics') setPoliticsSubcategory('')
                    setShowSubcategories(value === 'culture' || value === 'politics')
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all duration-200 ${
                    category === value ? active : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <span className="text-sm">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(culturePageMode || category === 'culture') && (
          <SubcategoryPicker
            label="Cultural category"
            items={CULTURE_SUBCATEGORIES}
            selected={cultureSubcategory}
            onSelect={(slug) => { setCultureSubcategory(slug as CultureSubcategorySlug); setShowSubcategories(false) }}
            show={showSubcategories}
            onToggle={() => setShowSubcategories(!showSubcategories)}
            activeStyle="border-emerald-400 bg-emerald-50 text-emerald-700"
            badgeStyle="bg-emerald-100 text-emerald-700"
          />
        )}

        {(politicsPageMode || category === 'politics') && (
          <SubcategoryPicker
            label="Political topic"
            items={POLITICS_SUBCATEGORIES}
            selected={politicsSubcategory}
            onSelect={(slug) => { setPoliticsSubcategory(slug as PoliticsSubcategorySlug); setShowSubcategories(false) }}
            show={showSubcategories}
            onToggle={() => setShowSubcategories(!showSubcategories)}
            activeStyle="border-red-400 bg-red-50 text-red-700"
            badgeStyle="bg-red-100 text-red-700"
          />
        )}

        <div className="px-3 sm:px-4">
          <input
            ref={titleRef}
            type="text"
            placeholder={`What's on your mind, ${firstName}?`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm sm:text-base font-semibold text-gray-900 placeholder-gray-400 border-0 focus:outline-none focus:ring-0 bg-transparent p-0"
            maxLength={200}
            required
          />
          <div className="flex items-center justify-between mt-0.5">
            <div className="h-px flex-1 bg-gray-100" />
            <span className={`text-[10px] tabular-nums ml-2 ${title.length > 180 ? 'text-red-400' : 'text-gray-300'}`}>{title.length}/200</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 mt-1">
          <textarea
            ref={contentRef}
            placeholder="Share your thoughts, experiences, or insights..."
            value={content}
            onChange={(e) => { setContent(e.target.value); autoResize() }}
            className="w-full text-xs sm:text-sm text-gray-700 placeholder-gray-400 border-0 focus:outline-none focus:ring-0 resize-none bg-transparent p-0 leading-relaxed"
            maxLength={2000}
            style={{ minHeight: hasMedia ? '36px' : '80px' }}
            required
          />
          <div className="flex items-center justify-end">
            <span className={`text-[10px] tabular-nums ${content.length > 1900 ? 'text-red-400' : 'text-gray-300'}`}>{content.length}/2000</span>
          </div>
        </div>

        {existingImageUrls.length > 0 && (
          <MediaGrid>
            {existingImageUrls.map((url) => (
              <MediaTile key={url} aspect={existingImageUrls.length === 1 ? 'video' : 'square'}>
                <img src={url} alt="" className="w-full h-full object-cover" />
                <RemoveButton onClick={() => removeExistingMedia(url)} />
              </MediaTile>
            ))}
          </MediaGrid>
        )}

        {existingVideoUrls.map((url) => (
          <div key={url} className="px-3 sm:px-4 mt-1">
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video src={url} controls className="w-full max-h-56 object-contain" />
              <RemovePill onClick={() => removeExistingMedia(url)} />
            </div>
          </div>
        ))}

        {mediaFiles.length > 0 && (
          <MediaGrid>
            {mediaFiles.map((file, i) => (
              <MediaTile
                key={i}
                aspect={mediaFiles.length === 1 ? 'video' : mediaFiles.length === 3 && i === 0 ? 'row-span' : 'square'}
              >
                {file.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/80">
                    <Film className="w-8 h-8 text-white/70" />
                    <span className="text-[10px] text-white/60 mt-1">{formatFileSize(file.size)}</span>
                  </div>
                )}
                <RemoveButton onClick={() => removeMedia(i)} />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">{file.name}</p>
                </div>
              </MediaTile>
            ))}
          </MediaGrid>
        )}

        {totalMediaCount >= MAX_FILES && (
          <p className="text-[10px] text-gray-400 text-center mt-1">Maximum {MAX_FILES} files</p>
        )}

        {showVideoUploader && (
          <div className="px-3 sm:px-4 mt-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Upload Video</h4>
                <button type="button" onClick={() => setShowVideoUploader(false)} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <VideoUploader
                onUploadComplete={(url, key) => { setVideoUrl(url); setVideoKey(key); setShowVideoUploader(false); toast.success('Video uploaded!') }}
                onUploadError={(err) => toast.error(err)}
                maxSizeMB={500}
              />
            </div>
          </div>
        )}

        {videoUrl && !showVideoUploader && (
          <div className="px-3 sm:px-4 mt-2">
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video src={videoUrl} controls className="w-full max-h-56 object-contain" />
              <RemovePill onClick={clearVideo} />
            </div>
          </div>
        )}

        <div className="mx-3 sm:mx-4 mt-2 h-px bg-gray-100" />

        <div className="flex items-center justify-between px-1.5 sm:px-2 py-1.5">
          <div className="flex items-center">
            <label className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${totalMediaCount >= MAX_FILES ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-green-50 hover:text-green-600'}`}>
              <Image className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-green-500" />
              <span className="hidden sm:inline text-xs">Photo</span>
              <input type="file" accept="image/*" multiple onChange={handleMediaUpload} className="hidden" disabled={totalMediaCount >= MAX_FILES || uploading || isSubmitting} />
            </label>

            <button
              type="button"
              onClick={() => setShowVideoUploader(!showVideoUploader)}
              disabled={hasActiveVideo || uploading || isSubmitting}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${hasActiveVideo || uploading || isSubmitting ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-red-50 hover:text-red-500'}`}
            >
              <Film className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-red-400" />
              <span className="hidden sm:inline text-xs">{hasActiveVideo ? 'Video added' : 'Video'}</span>
            </button>

            <button type="button" disabled className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-300 cursor-not-allowed">
              <MapPin className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-orange-300" />
              <span className="hidden sm:inline text-xs">Location</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!isFormValid}
            className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
              isFormValid
                ? 'bg-[var(--african-orange)] text-white hover:bg-[var(--african-orange-dark)] shadow-sm hover:shadow'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {uploading || isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span className="hidden sm:inline">{uploading ? 'Uploading' : isEditMode ? 'Saving' : 'Posting'}</span>
              </>
            ) : (
              <>
                {isEditMode ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>{isEditMode ? 'Save' : 'Post'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {(uploadProgress || isSubmitting) && (
        <div className="absolute inset-0 z-20 rounded-xl bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-full border-[3px] border-gray-200 border-t-[var(--african-orange)] animate-spin" />
          <span className="text-sm font-medium text-gray-700 mt-3">{uploadProgress || (isEditMode ? 'Saving...' : 'Creating post...')}</span>
        </div>
      )}
    </div>
  )
}

export default CreatePost

function SubcategoryPicker({
  label, items, selected, onSelect, show, onToggle, activeStyle, badgeStyle,
}: {
  label: string
  items: readonly { slug: string; name: string; icon: string }[]
  selected: string
  onSelect: (slug: string) => void
  show: boolean
  onToggle: () => void
  activeStyle: string
  badgeStyle: string
}) {
  const selectedItem = items.find((c) => c.slug === selected)

  return (
    <div className="px-3 sm:px-4 pb-2">
      <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 mb-2 transition-colors">
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${show ? 'rotate-180' : ''}`} />
        {selectedItem && <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${badgeStyle}`}>{selectedItem.name}</span>}
      </button>
      {show && (
        <div className="flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {items.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onSelect(cat.slug)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                selected === cat.slug ? activeStyle : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MediaGrid({ children }: { children: React.ReactNode }) {
  const count = React.Children.count(children)
  return (
    <div className="px-3 sm:px-4 mt-1">
      <div className={`grid gap-1 rounded-lg overflow-hidden ${count === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {children}
      </div>
    </div>
  )
}

function MediaTile({ children, aspect }: { children: React.ReactNode; aspect: 'video' | 'square' | 'row-span' }) {
  const cls =
    aspect === 'video' ? 'aspect-video'
      : aspect === 'row-span' ? 'row-span-2 aspect-square'
        : 'aspect-square'
  return <div className={`relative group bg-gray-100 ${cls}`}>{children}</div>
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-red-600"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  )
}

function RemovePill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-red-600 transition-colors"
    >
      Remove
    </button>
  )
}
