'use client'

import React from 'react'
import { Loader2, Save } from '@/shared/icons'

type SettingsIcon = React.ComponentType<{ className?: string }>

export const settingsInputClass =
  'w-full min-h-12 px-4 rounded-[14px] border border-border bg-surface-input text-[15px] text-content placeholder:text-content-tertiary transition-[border-color,box-shadow,background-color] duration-200 focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_var(--interactive-focus-ring)] disabled:opacity-60'

export const settingsLabelClass = 'block text-sm font-medium text-content mb-2'

export function SettingsCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-[16px] border border-border-subtle bg-surface ${className}`}>
      {children}
    </section>
  )
}

export function SettingsSectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
      <h3 className="text-[15px] font-semibold tracking-tight text-content">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-sm leading-5 text-content-secondary">{description}</p>
      ) : null}
    </div>
  )
}

export function SettingsToggle({
  checked,
  onChange,
  disabled,
  labelledBy,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  labelledBy?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-surface-tertiary'
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

export function SettingsToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon?: SettingsIcon
  title: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  const id = React.useId()

  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          <div id={id} className="text-[15px] font-medium text-content">
            {title}
          </div>
          {description ? (
            <p className="mt-0.5 text-sm leading-5 text-content-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      <SettingsToggle checked={checked} onChange={onChange} disabled={disabled} labelledBy={id} />
    </div>
  )
}

export function SettingsChoiceRow<T extends string>({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
  name,
  value,
}: {
  icon: SettingsIcon
  title: string
  description: string
  selected: boolean
  onSelect: () => void
  name: string
  value: T
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-200 sm:px-5 ${
        selected ? 'bg-primary/10' : 'hover:bg-surface-hover'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition-colors duration-200 ${
            selected ? 'bg-primary/15 text-primary' : 'bg-surface-secondary text-content-secondary'
          }`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className={`text-[15px] font-medium ${selected ? 'text-primary' : 'text-content'}`}>
            {title}
          </div>
          <p className="mt-0.5 text-sm leading-5 text-content-secondary">{description}</p>
        </div>
      </div>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
          selected ? 'border-primary' : 'border-border-strong'
        }`}
        aria-hidden
      >
        <span
          className={`h-2.5 w-2.5 rounded-full bg-primary transition-transform duration-200 ${
            selected ? 'scale-100' : 'scale-0'
          }`}
        />
      </span>
    </label>
  )
}

export function SettingsActionRow({
  icon: Icon,
  title,
  description,
  action,
  disabled,
  danger,
}: {
  icon: SettingsIcon
  title: string
  description?: string
  action: React.ReactNode
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <div className={`flex min-h-11 items-center justify-between gap-4 px-4 py-3.5 sm:px-5 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${
            danger ? 'bg-red-50 text-danger' : 'bg-surface-secondary text-content-secondary'
          }`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className={`text-[15px] font-medium ${danger ? 'text-danger' : 'text-content'}`}>{title}</div>
          {description ? (
            <p className="mt-0.5 text-sm leading-5 text-content-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export function SettingsSaveBar({
  dirty,
  saving,
  onSave,
  saveLabel = 'Save Changes',
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  saveLabel?: string
}) {
  return (
    <div
      className={`flex flex-col-reverse items-stretch justify-between gap-3 rounded-[16px] sm:flex-row sm:items-center ${
        dirty
          ? 'sticky bottom-3 z-10 border border-border-subtle bg-surface/95 p-3 shadow-sm backdrop-blur-sm sm:bottom-4'
          : ''
      }`}
    >
      <p className={`text-sm ${dirty ? 'text-content-secondary' : 'text-content-tertiary'}`}>
        {saving ? 'Saving…' : dirty ? 'You have unsaved changes' : 'All changes saved'}
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="btn-primary min-h-11 rounded-[14px] px-5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        <span>{saving ? 'Saving…' : saveLabel}</span>
      </button>
    </div>
  )
}

export function SettingsSignInPrompt({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-content">Please sign in</h1>
        <p className="mt-2 text-content-secondary">{message}</p>
      </div>
    </div>
  )
}

export function SettingsPanelSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-28 animate-pulse rounded-[16px] bg-surface-secondary" />
      <div className="h-48 animate-pulse rounded-[16px] bg-surface-secondary" />
      <div className="h-32 animate-pulse rounded-[16px] bg-surface-secondary" />
    </div>
  )
}

export function Divider() {
  return <div className="h-px bg-border-subtle" />
}
