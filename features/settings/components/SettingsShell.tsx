'use client'

import React from 'react'
import Link from 'next/link'
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
    <div className="flex min-h-[calc(100dvh-4.5rem)] bg-background sm:mb-0 mb-10">
      {/* Secondary nav — Supabase-style pane beside global LeftSidebar */}
      <aside className="sticky top-[73px] hidden h-[calc(100dvh-73px)] w-52 shrink-0 self-start border-r border-border-subtle bg-background md:block lg:w-56">
        <div className="flex h-full flex-col px-3 py-4">
          <h1 className="mb-4 px-2 text-lg font-semibold tracking-tight text-content">
            Settings
          </h1>
          <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Settings sections">
            <p className="mb-1 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
              Account
            </p>
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon
              const active = sidebarActive === item.id
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-surface-tertiary text-content'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-content' : 'text-content-tertiary group-hover:text-content-secondary'
                    }`}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-5 md:hidden">
            {isHub ? (
              <>
                <h1 className="mb-1 text-2xl font-semibold tracking-tight text-content">Settings</h1>
                <p className="mb-4 text-sm text-content-secondary">Manage your account preferences.</p>
              </>
            ) : null}
            <nav
              className="flex gap-1 overflow-x-auto border-b border-border-subtle pb-px scrollbar-none"
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
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-200 ${
                      active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-content-secondary hover:border-border hover:text-content'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {!isHub ? (
            <h1 className="mb-4 text-xl font-semibold tracking-tight text-content md:hidden">{title}</h1>
          ) : null}

          <div className="mb-5 hidden border-b border-border-subtle pb-4 md:block">
            <h2 className="text-xl font-semibold tracking-tight text-content">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-content-secondary">{description}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
