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
    <div className="min-h-[calc(100vh-4rem)] bg-background sm:min-h-[calc(100vh-5rem)] sm:mb-0 mb-10">
      <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-6 hidden md:block">
          <h1 className="text-[28px] font-semibold tracking-tight text-content">Settings</h1>
          <p className="mt-1 text-[15px] text-content-secondary">
            Manage your profile, privacy, notifications, and security.
          </p>
        </header>

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

        <div
          className="grid items-start gap-6 md:grid-cols-[184px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8"
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
    </div>
  )
}
