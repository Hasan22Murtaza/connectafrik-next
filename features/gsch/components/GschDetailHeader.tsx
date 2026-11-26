'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Bookmark,
  BookmarkX,
  EyeOff,
  ExternalLink,
  Megaphone,
  MoreHorizontal,
  Send,
  UserPlus,
} from '@/shared/icons'

export type GschDetailMenuItem = {
  id: string
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  external?: boolean
}

function menuIconFor(item: GschDetailMenuItem) {
  const label = item.label.toLowerCase()
  if (label === 'unsave') return BookmarkX
  if (label === 'save' || label === 'saved' || label === 'follow city') return Bookmark
  if (label === 'unpublish') return EyeOff
  if (label === 'publish') return Megaphone
  if (label.includes('external')) return ExternalLink
  if (
    label.includes('register') ||
    label.includes('message') ||
    label.includes('partnership') ||
    label.includes('manage')
  ) {
    return UserPlus
  }
  if (
    label.includes('interest') ||
    label.includes('enquire') ||
    label.includes('enquiry') ||
    label.includes('apply') ||
    label.includes('proposal') ||
    label.includes('request')
  ) {
    return Send
  }
  return null
}

export default function GschDetailHeader({
  backHref,
  backLabel,
  title,
  badges,
  subtitle,
  meta,
  menuItems = [],
}: {
  backHref: string
  backLabel: string
  title: string
  badges?: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  /** Page actions — shown in a ⋯ list menu at the top right */
  menuItems?: GschDetailMenuItem[]
}) {
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const visibleItems = menuItems.filter(Boolean)
  const hasMenu = visibleItems.length > 0

  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node)) return
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

  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm text-content-secondary transition hover:bg-surface-secondary hover:text-content"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>

        {hasMenu ? (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 text-content-secondary transition hover:bg-surface-secondary hover:text-content"
              aria-label="Actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 min-w-[12rem] rounded-xl border border-border bg-surface py-1 shadow-lg"
              >
                {visibleItems.map((item) => {
                  const Icon = menuIconFor(item)
                  const className =
                    'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50'

                  const content = (
                    <>
                      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                      {item.label}
                    </>
                  )

                  if (item.href) {
                    if (item.external) {
                      return (
                        <a
                          key={item.id}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          role="menuitem"
                          className={className}
                          onClick={() => setMenuOpen(false)}
                        >
                          {content}
                        </a>
                      )
                    }
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        role="menuitem"
                        className={className}
                        onClick={() => setMenuOpen(false)}
                      >
                        {content}
                      </Link>
                    )
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      className={className}
                      onClick={() => {
                        setMenuOpen(false)
                        item.onClick?.()
                      }}
                    >
                      {content}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2 rounded-2xl border border-border/80 bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-content sm:text-2xl">
            {title}
          </h2>
          {badges}
        </div>
        {subtitle ? (
          <div className="text-sm leading-relaxed text-content-secondary">{subtitle}</div>
        ) : null}
        {meta ? <div className="text-sm text-content-tertiary">{meta}</div> : null}
      </div>
    </header>
  )
}
