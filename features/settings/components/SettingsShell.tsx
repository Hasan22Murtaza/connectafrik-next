'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from '@/shared/icons'
import { SETTINGS_NAV } from '../nav'
import type { SettingsTab } from '../types'

type SettingsShellProps = {
  activeTab: SettingsTab | 'hub'
  title: string
  description: string
  children: React.ReactNode
}

export function SettingsShell({ activeTab, title, description, children }: SettingsShellProps) {
  const isHub = activeTab === 'hub'
  const sidebarActive: SettingsTab = isHub ? 'profile' : activeTab

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background sm:min-h-[calc(100vh-5rem)]">
      <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-6 hidden md:block">
          <h1 className="text-[28px] font-semibold tracking-tight text-content">Settings</h1>
          <p className="mt-1 text-[15px] text-content-secondary">
            Manage your profile, privacy, notifications, and security.
          </p>
        </header>

        {isHub ? (
          <div className="md:hidden">
            <h1 className="mb-1 text-2xl font-semibold tracking-tight text-content">Settings</h1>
            <p className="mb-5 text-sm text-content-secondary">Choose a category to manage your account.</p>
            <nav className="overflow-hidden rounded-[16px] border border-border-subtle bg-surface" aria-label="Settings">
              {SETTINGS_NAV.map((item, index) => {
                const Icon = item.icon
                return (
                  <React.Fragment key={item.id}>
                    {index > 0 ? <div className="mx-4 h-px bg-border-subtle" /> : null}
                    <Link
                      href={item.href}
                      className="flex min-h-11 items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-surface-hover active:bg-surface-secondary"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-medium text-content">{item.label}</div>
                        <p className="text-sm text-content-secondary">{item.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-content-tertiary" aria-hidden />
                    </Link>
                  </React.Fragment>
                )
              })}
            </nav>
          </div>
        ) : null}

        <div
          className={`grid items-start gap-6 md:grid-cols-[184px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 ${
            isHub ? 'hidden md:grid' : ''
          }`}
        >
          <aside className="hidden md:block md:sticky md:top-20 md:self-start">
            <nav
              className="rounded-[16px] border border-border-subtle bg-surface p-2 space-y-1.5"
              aria-label="Settings sections"
            >
              {SETTINGS_NAV.map((item) => {
                const Icon = item.icon
                const active = sidebarActive === item.id
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex min-h-11 items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] font-medium transition-all duration-200 ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        active ? 'text-primary' : 'text-content-tertiary group-hover:text-content-secondary'
                      }`}
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            {!isHub ? (
              <div className="mb-4 flex items-center gap-1 md:hidden">
                <Link
                  href="/settings"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[14px] text-content transition-colors duration-200 hover:bg-surface-hover"
                  aria-label="Back to settings"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-xl font-semibold tracking-tight text-content">{title}</h1>
              </div>
            ) : null}

            <div className="mb-5 hidden border-b border-border-subtle pb-4 md:block">
              <h2 className="text-xl font-semibold tracking-tight text-content">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-content-secondary">{description}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
