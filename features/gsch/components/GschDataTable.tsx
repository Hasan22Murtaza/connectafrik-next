'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  Bookmark,
  BookmarkX,
  Eye,
  EyeOff,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from '@/shared/icons'
import Portal from '@/shared/components/ui/Portal'
import { GSCH_TABLE, GSCH_TABLE_WRAP } from '@/features/gsch/constants/styles'

const MENU_WIDTH = 188
const MENU_GAP = 4

export function GschDataTable({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`${GSCH_TABLE_WRAP} ${className}`}>
      <table className={GSCH_TABLE}>{children}</table>
    </div>
  )
}

export function GschTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border bg-surface-secondary/50">{children}</tr>
    </thead>
  )
}

export function GschTableHeadCell({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-content-secondary sm:px-5 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  )
}

export function GschTableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>
}

export function GschTableRow({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      className={`border-b border-border/70 last:border-b-0 ${
        onClick ? 'cursor-pointer hover:bg-surface-secondary/40' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function GschTableCell({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  return (
    <td
      className={`px-4 py-4 align-middle text-sm text-content-secondary sm:px-5 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  )
}

export function GschRowActions({
  onEdit,
  onDelete,
  onView,
  onSave,
  onPublish,
  onEnquire,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  viewLabel = 'View',
  saveLabel = 'Save',
  publishLabel = 'Publish',
  enquireLabel = 'Send trade enquiry',
  deleting = false,
  saving = false,
  publishing = false,
}: {
  onEdit?: () => void
  onDelete?: () => void
  onView?: () => void
  onSave?: () => void
  onPublish?: () => void
  onEnquire?: () => void
  editLabel?: string
  deleteLabel?: string
  viewLabel?: string
  saveLabel?: string
  publishLabel?: string
  enquireLabel?: string
  deleting?: boolean
  saving?: boolean
  publishing?: boolean
}) {
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasActions = Boolean(
    onView || onEdit || onDelete || onSave || onPublish || onEnquire
  )
  const SaveIcon = saveLabel === 'Unsave' ? BookmarkX : Bookmark
  const PublishIcon = publishLabel === 'Unpublish' ? EyeOff : Megaphone

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null)
      return
    }

    function updatePosition() {
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const menuHeight = menu?.offsetHeight ?? 120
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP
      const openUp = spaceBelow < menuHeight && rect.top > spaceBelow
      const top = openUp
        ? Math.max(MENU_GAP, rect.top - menuHeight - MENU_GAP)
        : Math.min(rect.bottom + MENU_GAP, window.innerHeight - menuHeight - MENU_GAP)
      const left = Math.min(
        Math.max(MENU_GAP, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - MENU_GAP
      )
      setMenuPos({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (!hasActions) return null

  return (
    <div className="relative inline-flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-secondary transition hover:bg-surface-secondary hover:text-content disabled:opacity-50"
        aria-label="Actions"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={deleting || saving || publishing}
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((open) => !open)
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuOpen ? (
        <Portal>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="fixed z-[10060] rounded-lg border border-border bg-surface py-1 shadow-lg"
            style={{
              width: MENU_WIDTH,
              top: menuPos?.top ?? -9999,
              left: menuPos?.left ?? -9999,
              visibility: menuPos ? 'visible' : 'hidden',
            }}
          >
            {onView ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onView()
                }}
              >
                <Eye className="h-4 w-4 shrink-0" />
                {viewLabel}
              </button>
            ) : null}
            {onSave ? (
              <button
                type="button"
                role="menuitem"
                disabled={saving}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onSave()
                }}
              >
                <SaveIcon className="h-4 w-4 shrink-0" />
                {saving ? '…' : saveLabel}
              </button>
            ) : null}
            {onPublish ? (
              <button
                type="button"
                role="menuitem"
                disabled={publishing}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onPublish()
                }}
              >
                <PublishIcon className="h-4 w-4 shrink-0" />
                {publishing ? '…' : publishLabel}
              </button>
            ) : null}
            {onEnquire ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onEnquire()
                }}
              >
                <Send className="h-4 w-4 shrink-0" />
                {enquireLabel}
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onEdit()
                }}
              >
                <Pencil className="h-4 w-4 shrink-0" />
                {editLabel}
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                role="menuitem"
                disabled={deleting}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onDelete()
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                {deleting ? '…' : deleteLabel}
              </button>
            ) : null}
          </div>
        </Portal>
      ) : null}
    </div>
  )
}
