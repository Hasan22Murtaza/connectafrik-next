import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

type RouteContext = { params: Promise<{ threadId: string }> }

type Tab = 'media' | 'docs' | 'links'

const SECTION_FIXED = ['RECENT', 'LAST_WEEK', 'LAST_MONTH'] as const

function parseTab(raw: string | null): Tab {
  const t = (raw || 'media').toLowerCase()
  if (t === 'docs' || t === 'documents') return 'docs'
  if (t === 'links') return 'links'
  return 'media'
}

function dayStart(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** WhatsApp-style section labels (uppercase). */
function sectionLabelForDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return 'OLDER'

  const diffDays = Math.floor((dayStart(Date.now()) - dayStart(d.getTime())) / 86400000)

  if (diffDays <= 6) return 'RECENT'
  if (diffDays <= 13) return 'LAST_WEEK'
  if (diffDays <= 29) return 'LAST_MONTH'

  const month = d.toLocaleString('en-US', { month: 'long' }).toUpperCase()
  const year = d.getFullYear()
  return `${month} ${year}`
}

function sectionSortKey(label: string): number {
  const idx = SECTION_FIXED.indexOf(label as (typeof SECTION_FIXED)[number])
  if (idx !== -1) return idx
  return 3
}

function attachmentKind(fileType: string): 'image' | 'video' | 'audio' | 'document' {
  const ft = (fileType || '').toLowerCase()
  if (ft.startsWith('image/')) return 'image'
  if (ft.startsWith('video/')) return 'video'
  if (ft.startsWith('audio/')) return 'audio'
  return 'document'
}

function isDeletedForUser(deletedFor: unknown, userId: string): boolean {
  return Array.isArray(deletedFor) && deletedFor.includes(userId)
}

const URL_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi

function extractFirstUrl(content: string): string | null {
  if (!content || typeof content !== 'string') return null
  const matches = content.match(URL_RE)
  if (!matches?.length) return null
  let u = matches[0].replace(/[),.]+$/g, '')
  if (u.startsWith('www.')) u = `https://${u}`
  return u
}

const ATTACHMENT_SELECT = `
  id,
  file_name,
  file_size,
  file_type,
  file_url,
  message_id,
  chat_messages!inner(
    id,
    thread_id,
    created_at,
    sender_id,
    content,
    is_deleted,
    deleted_for,
    sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
  )
`

/** Supabase may return `chat_messages` as an object or a one-element array depending on client/version. */
function embeddedChatMessage(row: Record<string, unknown>): Record<string, unknown> | null {
  const raw = row.chat_messages ?? row.message
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { searchParams } = new URL(request.url)
    const tab = parseTab(searchParams.get('tab') ?? searchParams.get('type'))
    const parsedLimit = parseInt(searchParams.get('limit') || '60', 10)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const limit = Number.isNaN(parsedLimit) ? 60 : Math.min(Math.max(parsedLimit, 1), 100)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const from = page * limit
    const to = from + limit - 1

    if (tab === 'links') {
      const { data: rows, error } = await serviceClient
        .from('chat_messages')
        .select(
          `
          id,
          created_at,
          sender_id,
          content,
          deleted_for,
          sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
        `
        )
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        .or('content.ilike.%http://%,content.ilike.%https://%,content.ilike.%www.%')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) return errorResponse(error.message, 400)

      const items: Record<string, unknown>[] = []
      for (const row of rows || []) {
        if (isDeletedForUser(row.deleted_for, user.id)) continue
        const linkUrl = extractFirstUrl(row.content as string)
        if (!linkUrl) continue
        const createdAt = row.created_at as string
        items.push({
          id: `${row.id}:link`,
          message_id: row.id,
          sender_id: row.sender_id,
          sender: row.sender ?? null,
          kind: 'link',
          created_at: createdAt,
          section: sectionLabelForDate(createdAt),
          url: linkUrl,
          thumbnail_url: null,
          file_name: null,
          file_size: null,
          mime_type: null,
          content_preview: String(row.content || '').slice(0, 280),
        })
      }

      const sectionsMap = new Map<string, Record<string, unknown>[]>()
      for (const it of items) {
        const label = String(it.section)
        if (!sectionsMap.has(label)) sectionsMap.set(label, [])
        sectionsMap.get(label)!.push(it)
      }

      const sections = [...sectionsMap.entries()]
        .sort((a, b) => {
          const ak = sectionSortKey(a[0])
          const bk = sectionSortKey(b[0])
          if (ak !== bk) return ak - bk
          const ad = new Date(a[1][0]?.created_at as string).getTime()
          const bd = new Date(b[1][0]?.created_at as string).getTime()
          return bd - ad
        })
        .map(([label, secItems]) => ({
          label,
          items: secItems.sort(
            (x, y) =>
              new Date(String(y.created_at)).getTime() - new Date(String(x.created_at)).getTime()
          ),
        }))

      const hasMore = (rows || []).length >= limit

      return jsonResponse({
        tab: 'links',
        sections,
        items,
        page,
        pageSize: limit,
        hasMore,
      })
    }

    let query = serviceClient
      .from('message_attachments')
      .select(ATTACHMENT_SELECT)
      .eq('chat_messages.thread_id', threadId)
      .eq('chat_messages.is_deleted', false)

    if (tab === 'media') {
      query = query.or('file_type.like.image%,file_type.like.video%,file_type.like.audio%')
    } else {
      query = query
        .not('file_type', 'like', 'image%')
        .not('file_type', 'like', 'video%')
        .not('file_type', 'like', 'audio%')
    }

    const { data: rows, error } = await query
      .order('created_at', { ascending: false, foreignTable: 'chat_messages' })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    const items: Record<string, unknown>[] = []
    for (const row of rows || []) {
      const msg = embeddedChatMessage(row as Record<string, unknown>)
      if (!msg) continue
      if (isDeletedForUser(msg.deleted_for, user.id)) continue

      const fileType = String(row.file_type || '')
      const kind = attachmentKind(fileType)
      if (tab === 'media' && kind === 'document') continue
      if (tab === 'docs' && kind !== 'document') continue

      const createdAt = msg.created_at as string
      const url = String(row.file_url || '')
      items.push({
        id: row.id,
        message_id: row.message_id,
        sender_id: msg.sender_id,
        sender: msg.sender ?? null,
        kind,
        created_at: createdAt,
        section: sectionLabelForDate(createdAt),
        url,
        thumbnail_url: kind === 'image' || kind === 'video' ? url : null,
        file_name: row.file_name ?? null,
        file_size: row.file_size ?? null,
        mime_type: fileType || null,
        content_preview: typeof msg.content === 'string' ? msg.content.slice(0, 160) : null,
      })
    }

    const sectionsMap = new Map<string, Record<string, unknown>[]>()
    for (const it of items) {
      const label = String(it.section)
      if (!sectionsMap.has(label)) sectionsMap.set(label, [])
      sectionsMap.get(label)!.push(it)
    }

    const sections = [...sectionsMap.entries()]
      .sort((a, b) => {
        const ak = sectionSortKey(a[0])
        const bk = sectionSortKey(b[0])
        if (ak !== bk) return ak - bk
        const ad = new Date(a[1][0]?.created_at as string).getTime()
        const bd = new Date(b[1][0]?.created_at as string).getTime()
        return bd - ad
      })
      .map(([label, secItems]) => ({
        label,
        items: secItems.sort(
          (x, y) =>
            new Date(String(y.created_at)).getTime() - new Date(String(x.created_at)).getTime()
        ),
      }))

    const hasMore = (rows || []).length >= limit

    return jsonResponse({
      tab,
      sections,
      items,
      page,
      pageSize: limit,
      hasMore,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to load shared media', 500)
  }
}
