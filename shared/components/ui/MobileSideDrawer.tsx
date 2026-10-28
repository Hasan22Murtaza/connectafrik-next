
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useSpaceNavCounts } from '@/shared/hooks/useSpaceNavCounts'
import { UserSearch } from './UserSearch'
import DisplayModeMenu from '@/shared/components/theme/DisplayModeMenu'
import {
  Bookmark,
  ChevronRight,
  Clock3,
  Copy,
  Landmark,
  LogOut,
  MessageSquare,
  Palette,
  Search,
  UsersRound,
  UserRound,
  X,
  Settings,
} from 'lucide-react'

type MobileSideDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

type MenuItem = {
  label: string
  path?: string
  icon: React.ComponentType<{
    className?: string
    strokeWidth?: number
  }>
  badge?: string | number | null
  action?: 'search'
}

function formatBadge(count: number): string | null {
  if (count <= 0) return null
  return count > 99 ? '99+' : String(count)
}

const MobileSideDrawer: React.FC<MobileSideDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const { friendRequestCount } = useSpaceNavCounts()
  const [showUserSearch, setShowUserSearch] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Your profile'

  const username =
    profile?.username ||
    user?.user_metadata?.username ||
    'username'

  const avatar =
    profile?.avatar_url || '/assets/images/profile-dp.svg'

  const cover =
    profile?.banner_image ||
    '/assets/images/landing/profile-cover.png'

  const sections = useMemo<{ title: string; items: MenuItem[] }[]>(
    () => [
      {
        title: 'SOCIAL CORE',
        items: [
          {
            label: 'Friends',
            path: '/friends',
            icon: UserRound,
            badge: formatBadge(friendRequestCount),
          },
          { label: 'Groups', path: '/groups', icon: UsersRound },
          // { label: 'Culture', path: '/culture', icon: Palette },
          // { label: 'Politics', path: '/politics', icon: Landmark },
        ],
      },
      {
        title: 'PERSONAL',
        items: [
          { label: 'Memories', path: '/memories', icon: Clock3 },
          { label: 'Saved', path: '/saved', icon: Bookmark },
        ],
      },
      {
        title: 'PREFERENCES',
        items: [
          { label: 'Settings', path: '/settings', icon: Settings },
          { label: 'Feedback', path: '/feedback', icon: MessageSquare },
          { label: 'Search users', icon: Search, action: 'search' },
        ],
      },
    ],
    [friendRequestCount]
  )

  const navigate = (item: MenuItem) => {
    if (item.action === 'search') {
      setShowUserSearch(true)
      onClose()
      return
    }

    if (item.path) {
      router.push(item.path)
      onClose()
    }
  }

  const handleLogout = async () => {
    onClose()
    await signOut()
    router.push('/signin')
  }

  const copyUsername = async () => {
    try {
      await navigator.clipboard?.writeText(`@${username}`)
    } catch {
      // Clipboard access may be unavailable in some browsers.
    }
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-label="Account menu"
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-[51] flex h-[100dvh] w-[min(88vw,380px)] flex-col overflow-hidden rounded-l-2xl bg-surface shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Cover */}
              <div className="relative h-40 bg-surface-secondary xs:h-44">
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-white">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              ACTIVE NOW
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Profile */}
          <div className="px-5 pb-5 sm:px-6">
            <div className="-mt-11 flex items-end justify-between gap-3">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-surface bg-surface-secondary shadow-sm">
                <img
                  src={avatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />

                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-green-500 text-[10px] font-bold text-white">
                  ✓
                </span>
              </div>

              <button
                type="button"
                onClick={copyUsername}
                className="mb-1 flex min-w-0 max-w-[62%] items-center gap-2 rounded-full bg-surface-secondary px-3 py-2 text-xs font-medium text-content-secondary transition hover:bg-surface-hover"
                aria-label="Copy username"
              >
                <span className="truncate">@{username}</span>
                <Copy className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>

            <h2 className="mt-4 break-words text-xl font-bold leading-tight tracking-tight text-content sm:text-2xl">
              {displayName}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-content-secondary sm:text-sm">
              <span>
                <strong className="text-content">{profile?.follower_count}</strong> Tapped In
              </span>

              <span className="h-1 w-1 rounded-full bg-border" />

              <span>
                <strong className="text-content">
                  {profile?.following_count}
                </strong>
                Tapping In
              </span>

              <span className="h-1 w-1 rounded-full bg-border" />

              <span>
                <strong className="text-content">{profile?.posts_count}</strong> Posts
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav
            className="px-4 pb-3 sm:px-5"
            aria-label="Account navigation"
          >
            {sections.map((section, sectionIndex) => (
              <section
                key={section.title}
                className={
                  sectionIndex
                    ? 'border-t border-border-subtle pt-4'
                    : ''
                }
              >
                <h3 className="mb-2 px-2 text-[10px] font-semibold tracking-[0.12em] text-content-tertiary sm:text-[11px]">
                  {section.title}
                </h3>

                <ul className="space-y-1 pb-4">
                  {section.items.map((item) => {
                    const Icon = item.icon

                    const active = Boolean(
                      item.path &&
                        (pathname === item.path ||
                          pathname?.startsWith(`${item.path}/`))
                    )

                    return (
                      <li key={item.label}>
                        <button
                          type="button"
                          onClick={() => navigate(item)}
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-1 text-left transition-colors ${
                            active
                              ? 'bg-primary-50 text-primary-600'
                              : 'text-content hover:bg-surface-hover'
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              active
                                ? 'bg-primary-100 text-primary-600'
                                : 'bg-surface-secondary text-content-secondary'
                            }`}
                          >
                            <Icon
                              className="h-[19px] w-[19px]"
                              strokeWidth={1.8}
                            />
                          </span>

                          <span className="min-w-0 flex-1 text-sm font-medium">
                            {item.label}
                          </span>

                          {item.badge ? (
                            <span className="flex min-w-6 items-center justify-center rounded-full bg-green-500 px-2 py-1 text-[10px] font-semibold text-white">
                              {item.badge}
                            </span>
                          ) : item.path ? (
                            <ChevronRight className="h-4 w-4 shrink-0 text-content-tertiary" />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </nav>
        </div>

        {/* Fixed footer */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#f97316]">
              CribsTalk
              <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 text-[9px] font-normal text-content-tertiary">
                v1.00-dev
              </span>
            </p>

            <p className="mt-0.5 text-[10px] leading-tight text-content-tertiary">
              powered by allora digital group
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DisplayModeMenu variant="flyout" onClose={onClose} />

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary text-content transition hover:bg-surface-hover"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </footer>
      </aside>

      {showUserSearch && (
        <UserSearch
          onClose={() => setShowUserSearch(false)}
          onUserSelect={() => setShowUserSearch(false)}
        />
      )}
    </>
  )
}

export default MobileSideDrawer;