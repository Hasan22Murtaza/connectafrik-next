'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Tag, Globe, Lock, Trash2 } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useReel, useUpdateReel, useDeleteReel } from '@/shared/hooks/useReels'
import { useMembers } from '@/shared/hooks/useMembers'
import ReelShortsSlide from '@/features/social/components/ReelShortsSlide'
import ShareModal from '@/features/social/components/ShareModal'
import ReelComments from '@/features/social/components/ReelComments'
import { ReportReelModal } from '@/features/social/components/ReportReelModal'
import { sendNotification } from '@/shared/services/notificationService'
import {
  REEL_CATEGORIES,
  MAX_REEL_TITLE_LENGTH,
  MAX_REEL_DESCRIPTION_LENGTH,
  MAX_REEL_TAGS,
  ReelCategory,
} from '@/shared/types/reels'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { ReelsVerticalFeedShimmer } from '@/shared/components/ui/ShimmerLoaders'
import toast from 'react-hot-toast'

export default function ReelDetailClient({ reelId }: { reelId: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const { reel, loading, error, refresh } = useReel(reelId)
  const { updateReel, loading: updating } = useUpdateReel()
  const { deleteReel, loading: deleting } = useDeleteReel()
  const { confirm, dialog } = useConfirmDialog()
  const [shareOpen, setShareOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState<string>('entertainment')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editNewTag, setEditNewTag] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(true)
  const { members } = useMembers(shareOpen)

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/reels/${reelId}`
    return `${window.location.origin}/reels/${reelId}`
  }, [reelId])

  const openEdit = useCallback(() => {
    if (!reel) return
    setEditTitle(reel.title)
    setEditDescription(reel.description || '')
    setEditCategory(reel.category)
    setEditTags(reel.tags || [])
    setEditIsPublic(reel.is_public)
    setEditNewTag('')
    setEditOpen(true)
  }, [reel])

  const handleDelete = useCallback(async () => {
    if (!reel) return
    const confirmed = await confirm({
      title: 'Delete Reel',
      message: 'Are you sure you want to delete this reel? This action cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!confirmed) return
    const { success, error: deleteError } = await deleteReel(reel.id)
    if (success) {
      toast.success('Reel deleted successfully')
      router.push('/reels/my-videos')
    } else {
      toast.error(deleteError || 'Failed to delete reel')
    }
  }, [reel, confirm, deleteReel, router])

  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!reel) return
      if (!editTitle.trim()) {
        toast.error('Title is required')
        return
      }
      const { data, error: updateError } = await updateReel(reel.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory,
        tags: editTags,
        is_public: editIsPublic,
      })
      if (data) {
        toast.success('Reel updated successfully')
        setEditOpen(false)
        refresh()
      } else {
        toast.error(updateError || 'Failed to update reel')
      }
    },
    [reel, editTitle, editDescription, editCategory, editTags, editIsPublic, updateReel, refresh]
  )

  const handleSendToMembers = async (memberIds: string[], message: string) => {
    if (!memberIds.length || !reel) return
    const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
    const results = await Promise.allSettled(
      memberIds.map((memberId) =>
        sendNotification({
          user_id: memberId,
          title: 'Reel Shared With You',
          body: message
            ? `${senderName} shared a reel with you: "${message}"`
            : `${senderName} shared a reel with you`,
          notification_type: 'post_share',
          data: {
            type: 'reel_share',
            reel_id: reel.id,
            sender_id: user?.id || '',
            sender_name: senderName,
            message,
            url: `/reels/${reel.id}`,
          },
        })
      )
    )
    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    if (succeeded > 0) {
      toast.success(`Shared with ${succeeded} member${succeeded === 1 ? '' : 's'}`)
    } else {
      toast.error('Failed to send notifications')
    }
  }

  if (loading) {
    return <ReelsVerticalFeedShimmer variant="dark" />
  }

  if (error || !reel) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-content">This reel isn&apos;t available</h1>
          <p className="mt-2 text-sm text-content-secondary">
            It may have been deleted, or the link may be incorrect.
          </p>
          <button type="button" onClick={() => router.push('/reels/foryou')} className="btn-primary mt-6">
            Back to Reels
          </button>
        </div>
      </div>
    )
  }

  const isOwner = Boolean(user?.id && user.id === reel.author_id)

  return (
    <div className="bg-black">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg items-center justify-center">
        <div className="h-[calc(100dvh-4rem)] w-full">
          <ReelShortsSlide
            reel={reel}
            isActive
            loadMedia
            onComment={() => setCommentsOpen(true)}
            onShare={() => setShareOpen(true)}
            isOwner={isOwner}
            onEdit={openEdit}
            onDelete={() => void handleDelete()}
            onReport={() => setReportOpen(true)}
            onNotInterested={() => {
              toast.success('Thanks for the feedback')
              router.push('/reels/foryou')
            }}
          />
        </div>
      </div>
      {commentsOpen && (
        <ReelComments
          reelId={reel.id}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          commentsCount={reel.comments_count}
        />
      )}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postUrl={shareUrl}
        postId={reel.id}
        members={members}
        onSendToMembers={handleSendToMembers}
      />
      {reportOpen && (
        <ReportReelModal
          reelId={reel.id}
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => {
            setReportOpen(false)
            router.push('/reels/foryou')
          }}
        />
      )}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-2xl">
            <div className="flex items-center justify-between bg-primary-600 px-5 py-4">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-white" />
                <h2 className="text-lg font-semibold text-white">Edit Reel</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-white/80 transition-colors hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="max-h-[calc(90vh-4rem)] space-y-5 overflow-y-auto p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input-field"
                  maxLength={MAX_REEL_TITLE_LENGTH}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm text-content"
                  maxLength={MAX_REEL_DESCRIPTION_LENGTH}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ReelCategory)}
                  className="input-field"
                >
                  {REEL_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editNewTag}
                    onChange={(e) => setEditNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const tag = editNewTag.trim().toLowerCase()
                        if (tag && editTags.length < MAX_REEL_TAGS && !editTags.includes(tag)) {
                          setEditTags([...editTags, tag])
                          setEditNewTag('')
                        }
                      }
                    }}
                    className="input-field flex-1"
                    maxLength={20}
                    placeholder="Add a tag..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const tag = editNewTag.trim().toLowerCase()
                      if (tag && editTags.length < MAX_REEL_TAGS && !editTags.includes(tag)) {
                        setEditTags([...editTags, tag])
                        setEditNewTag('')
                      }
                    }}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Add
                  </button>
                </div>
                {editTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {editTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-xs"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button type="button" onClick={() => setEditTags(editTags.filter((t) => t !== tag))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={editIsPublic} onChange={() => setEditIsPublic(true)} />
                  <Globe className="h-4 w-4" />
                  <span className="text-sm">Public</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={!editIsPublic} onChange={() => setEditIsPublic(false)} />
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">Private</span>
                </label>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg px-4 py-2 text-sm">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || !editTitle.trim()}
                    className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {dialog}
    </div>
  )
}
