'use client'

import React, { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useSpaceNavCounts } from '@/shared/hooks/useSpaceNavCounts'
import DisplayModeMenu from '@/shared/components/theme/DisplayModeMenu'
import {
  Award,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Globe,
  Landmark,
  LogOut,
  Megaphone,
  Palette,
  QrCode,
  Settings,
  UserRound,
  Users,
  UsersRound,
  X,
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
  badgeTone?: 'green' | 'orange'
}

function formatBadge(count: number): string | null {
  if (count <= 0) return null
  return count > 99 ? '99+' : String(count)
}

function formatStat(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '0'
  return String(value)
}

const BRAND_ORANGE = '#F97316'
const SECTION_LABEL = '#B08A5B'

const MobileSideDrawer: React.FC<MobileSideDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const { friendRequestCount } = useSpaceNavCounts()

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
            icon: UsersRound,
            badge: formatBadge(friendRequestCount),
            badgeTone: 'green',
          },
          { label: 'Groups', path: '/groups', icon: Users },
          { label: 'Culture', path: '/culture', icon: Palette },
          { label: 'Politics', path: '/politics', icon: Landmark },
        ],
      },
      {
        title: 'GROWTH',
        items: [
          {
            label: 'Youth Leadership',
            path: '/youth-leadership',
            icon: Award,
          },
          {
            label: 'Global Hub',
            path: '/global-hub',
            icon: Globe,
          },
        ],
      },
      {
        title: 'PERSONAL',
        items: [
          { label: 'Memories', path: '/memories', icon: Clock3 },
          {
            label: 'Saved',
            path: '/saved',
            icon: Bookmark,
            badge: formatBadge(profile?.saved_count ?? 0),
            badgeTone: 'orange',
          },
        ],
      },
      {
        title: 'PREFERENCES',
        items: [
          {
            label: 'Account Center',
            path: '/profile',
            icon: UserRound,
          },
          { label: 'Settings', path: '/settings', icon: Settings },
          {
            label: 'Family Circle',
            path: '/family-circle',
            icon: UsersRound,
          },
          { label: 'Feedback', path: '/feedback', icon: Megaphone },
        ],
      },
      {
        title: 'LEGAL',
        items: [
          {
            label: 'Privacy Policy',
            path: '/privacy',
            icon: FileText,
          },
          {
            label: 'Terms of Service',
            path: '/terms',
            icon: FileText,
          },
        ],
      },
    ],
    [friendRequestCount, profile?.saved_count]
  )

  const navigate = (item: MenuItem) => {
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

  const copyProfileLink = async () => {
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''
      await navigator.clipboard?.writeText(`${origin}/user/${username}`)
    } catch {
      // Clipboard access may be unavailable in some browsers.
    }
  }

  const goToProfile = () => {
    router.push(`/user/${username}`)
    onClose()
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-label="Account menu"
        aria-hidden={!isOpen}
        className={`fixed inset-y-3 right-3 z-[51] flex w-[min(86vw,360px)] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-transform duration-300 ease-out dark:bg-surface lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1.5rem)]'
        }`}
      >
        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-3.5 pt-3.5 sm:px-4 sm:pt-4">
            {/* Cover */}
            <div className="relative h-36 overflow-hidden rounded-[22px] bg-surface-secondary xs:h-40">
              <img
                src={cover}
                alt=""
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />

              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ACTIVE NOW
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-black/35"
              >
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>

            {/* Profile */}
            <div className="px-1 pb-4 pt-0">
              <div className="-mt-10 flex items-end justify-between gap-3">
                <button
                  type="button"
                  onClick={goToProfile}
                  className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[22px] border-[3px] border-white bg-surface-secondary shadow-sm dark:border-surface"
                  aria-label="Open profile"
                >
                  <img
                    src={avatar}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />

                  <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white dark:border-surface">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </button>

                <div className="mb-1 flex min-w-0 max-w-[62%] items-center gap-1 rounded-full bg-[#F3EFE8] px-2.5 py-1.5 dark:bg-surface-secondary">
                  <button
                    type="button"
                    onClick={copyUsername}
                    className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-content-secondary transition hover:text-content"
                    aria-label="Copy username"
                  >
                    <span className="truncate">@{username}</span>
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={copyProfileLink}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-content-secondary transition hover:bg-black/5 hover:text-content dark:hover:bg-white/10"
                    aria-label="Copy profile link"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={goToProfile}
                className="mt-3 block text-left"
              >
                <h2 className="break-words text-[22px] font-bold leading-tight tracking-tight text-content">
                  {displayName}
                </h2>
              </button>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-content-secondary">
                <span>
                  <strong className="font-semibold text-content">
                    {formatStat(profile?.follower_count)}
                  </strong>{' '}
                  Tapped In
                </span>

                <span className="h-1 w-1 rounded-full bg-border" />

                <span>
                  <strong className="font-semibold text-content">
                    {formatStat(profile?.following_count)}
                  </strong>{' '}
                  Tapping In
                </span>

                <span className="h-1 w-1 rounded-full bg-border" />

                <span>
                  <strong className="font-semibold text-content">
                    {formatStat(profile?.posts_count)}
                  </strong>{' '}
                  Posts
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="px-3.5 pb-2 sm:px-4" aria-label="Account navigation">
            {sections.map((section, sectionIndex) => (
              <section
                key={section.title}
                className={
                  sectionIndex
                    ? 'border-t border-[#EDE8E1] pt-3.5 dark:border-border-subtle'
                    : ''
                }
              >
                <h3
                  className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.14em]"
                  style={{ color: SECTION_LABEL }}
                >
                  {section.title}
                </h3>

                <ul className="space-y-0.5 pb-3.5">
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
                          className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors ${
                            active
                              ? 'bg-surface-secondary text-content'
                              : 'text-content hover:bg-surface-hover'
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              active
                                ? 'bg-surface-tertiary text-content'
                                : 'bg-[#EEF1F5] text-content-secondary dark:bg-surface-secondary'
                            }`}
                          >
                            <Icon
                              className="h-[18px] w-[18px]"
                              strokeWidth={1.85}
                            />
                          </span>

                          <span className="min-w-0 flex-1 text-[15px] font-medium">
                            {item.label}
                          </span>

                          {item.badge ? (
                            <span
                              className={`flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                                item.badgeTone === 'orange'
                                  ? 'bg-[#F97316]'
                                  : 'bg-emerald-500'
                              }`}
                            >
                              {item.badge}
                            </span>
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-content-tertiary" />
                          )}
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
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#EDE8E1] bg-[#FAFAF8] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] dark:border-border-subtle dark:bg-surface">
          <div className="min-w-0">
            <p
              className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold"
              style={{ color: BRAND_ORANGE }}
            >
              CribsTalk
              <span className="rounded-full bg-[#ECECEC] px-1.5 py-0.5 text-[9px] font-medium text-content-tertiary dark:bg-surface-secondary">
                v1.05
              </span>
            </p>

            <p className="mt-0.5 text-[10px] leading-tight text-content-tertiary">
              powered by allora digital group
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DisplayModeMenu variant="icon" onClose={onClose} />

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF1F5] transition hover:bg-surface-hover dark:bg-surface-secondary"
              style={{ color: BRAND_ORANGE }}
            >
              <LogOut className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </footer>
      </aside>
    </>
  )
}

export default MobileSideDrawer
