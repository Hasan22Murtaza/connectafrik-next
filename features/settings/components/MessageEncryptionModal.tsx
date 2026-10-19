'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy, Loader2, Lock, Phone, X } from '@/shared/icons'
import Portal from '@/shared/components/ui/Portal'
import { useAuth } from '@/contexts/AuthContext'
import { messageE2eeActive } from '@/lib/message-e2ee/status'
import { formatSafetyNumber, friendlySafetyError } from '@/lib/message-e2ee/safety'

type DeviceStatus = { deviceId: string; ownsIdentity: boolean; payload: string }

export type MessageEncryptionPurpose = 'link' | 'encryption'

type MessageEncryptionModalProps = {
  open: boolean
  onClose: () => void
  /** 1:1 chat partner. Safety numbers are shown for this person. */
  otherUserId?: string | null
  otherName?: string | null
  /** `link` leads with device linking. `encryption` leads with the safety number. */
  purpose?: MessageEncryptionPurpose
  /** Settings can look up a safety number by user id when no chat partner is open. */
  showSafetyLookup?: boolean
}

export function MessageEncryptionModal({
  open,
  onClose,
  otherUserId,
  otherName,
  purpose = 'encryption',
  showSafetyLookup = false,
}: MessageEncryptionModalProps) {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [paste, setPaste] = useState('')
  const [manualUserId, setManualUserId] = useState('')
  const [safetyGroups, setSafetyGroups] = useState<string[] | null>(null)
  const [safetyError, setSafetyError] = useState('')
  const [safetyBusy, setSafetyBusy] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [showDevices, setShowDevices] = useState(purpose === 'link')
  const wasOwner = useRef<boolean | null>(null)
  const payloadRef = useRef('')
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const peerId = otherUserId?.trim() || ''
  const peerLabel = otherName?.trim() || 'the other person'

  useEffect(() => {
    if (!open) {
      setPaste('')
      setError('')
      setNotice('')
      setCopied(false)
      setSafetyError('')
      setSafetyGroups(null)
      setShowDevices(purpose === 'link')
      wasOwner.current = null
      payloadRef.current = ''
      return
    }

    let cancelled = false
    let stopKeys = () => {}

    void (async () => {
      const on = await messageE2eeActive()
      if (cancelled) return
      setEnabled(on)
      if (!on || !user?.id) return
      try {
        const engine = await import('@/lib/message-e2ee/engine')
        const applyStatus = async () => {
          const next = await engine.encryptionDeviceStatus(user.id)
          if (cancelled) return
          if (wasOwner.current === false && next.ownsIdentity) {
            setNotice('This browser is linked. New messages can be read here.')
          }
          wasOwner.current = next.ownsIdentity
          setStatus(next)
          if (payloadRef.current !== next.payload) {
            const QRCode = (await import('qrcode')).default
            const url = await QRCode.toDataURL(next.payload, {
              margin: 1,
              width: 280,
              color: { dark: '#111111', light: '#ffffff' },
            })
            if (cancelled) return
            payloadRef.current = next.payload
            setQrUrl(url)
          }
        }
        await applyStatus()
        stopKeys = engine.onMessageKeys(() => {
          void applyStatus()
        })
        if (peerId && purpose === 'encryption') {
          setSafetyBusy(true)
          try {
            const digits = await engine.safetyNumberForUser(user.id, peerId)
            if (!cancelled) {
              setSafetyGroups(formatSafetyNumber(digits))
              setSafetyError('')
            }
          } catch (err) {
            if (!cancelled) setSafetyError(friendlySafetyError(err))
          } finally {
            if (!cancelled) setSafetyBusy(false)
          }
        }
      } catch {
        if (!cancelled) setError('This browser could not start encryption.')
      }
    })()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      cancelled = true
      stopKeys()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, user?.id, peerId, purpose])

  const link = async (payload: string) => {
    if (!user?.id) return
    setBusy('link')
    setError('')
    setNotice('')
    try {
      const engine = await import('@/lib/message-e2ee/engine')
      await engine.linkDeviceFromPayload(user.id, payload.trim())
      setPaste('')
      setNotice('Device linked. It can read messages sent after this.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link that device')
    } finally {
      setBusy('')
    }
  }

  const copyDeviceId = async () => {
    const value = status?.deviceId
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the device id.')
    }
  }

  const showSafety = async () => {
    if (!user?.id) return
    const target = manualUserId.trim()
    if (!target) return
    setSafetyBusy(true)
    setSafetyError('')
    setSafetyGroups(null)
    try {
      const engine = await import('@/lib/message-e2ee/engine')
      const digits = await engine.safetyNumberForUser(user.id, target)
      setSafetyGroups(formatSafetyNumber(digits))
    } catch (err) {
      setSafetyError(friendlySafetyError(err))
    } finally {
      setSafetyBusy(false)
    }
  }

  if (!open) return null

  const title = purpose === 'link' ? 'Link a device' : 'End-to-end encrypted'
  const intro =
    purpose === 'link'
      ? status?.ownsIdentity
        ? 'Add another browser with its device id, or scan this code from the CribsTalk phone app.'
        : 'Share this device id with another CribsTalk browser that already reads your encrypted messages, or scan this QR from that phone.'
      : peerId
        ? `Messages with ${peerLabel} are encrypted on your devices. Not even CribsTalk can read them.`
        : 'New messages and files are encrypted on your devices. Not even CribsTalk can read them.'

  const deviceIdRow = (
    <div className="flex items-center justify-center gap-1.5 text-sm text-content">
      <span>
        This device:{' '}
        <span className="font-medium tracking-wide">{status?.deviceId || 'Starting…'}</span>
      </span>
      {status?.deviceId ? (
        <button
          type="button"
          onClick={() => void copyDeviceId()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content"
          aria-label={copied ? 'Copied' : 'Copy device id'}
          title={copied ? 'Copied' : 'Copy device id'}
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  )

  const qrBlock = (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-2">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="Device linking code"
            className="h-[200px] w-[200px] rounded-xl bg-white p-2"
          />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl bg-surface-secondary">
            <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
          </div>
        )}
        {deviceIdRow}
      </div>

      <div className="space-y-2 rounded-2xl bg-surface-secondary/70 px-3 py-3">
        <p className="text-sm font-medium text-content">Web browser</p>
        <p className="text-sm leading-5 text-content-secondary">
          {status?.ownsIdentity
            ? 'Paste the other browser’s device id below. No phone scan needed.'
            : 'On a browser that already works, open Link a device and paste this device id.'}
        </p>
        {status?.ownsIdentity ? (
          <>
            <input
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              placeholder="Paste other device id"
              className="min-h-11 w-full rounded-[14px] border border-line bg-surface px-3 text-sm text-content"
            />
            <button
              type="button"
              disabled={!paste.trim() || busy === 'link'}
              onClick={() => void link(paste)}
              className="btn-secondary min-h-11 w-full rounded-[14px] px-4 disabled:opacity-50"
            >
              {busy === 'link' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Link device
            </button>
          </>
        ) : null}
      </div>

      <div className="flex items-start gap-2 rounded-2xl bg-surface-secondary/70 px-3 py-3 text-sm leading-5 text-content-secondary">
        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-content" aria-hidden />
        <p>
          <span className="font-medium text-content">Phone: </span>
          Scan the QR with CribsTalk on a phone that already uses this account.
        </p>
      </div>
    </div>
  )

  const safetyBlock = (
    <div className="space-y-3">
      {!peerId && showSafetyLookup ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-content">Safety number</p>
          <input
            value={manualUserId}
            onChange={(event) => setManualUserId(event.target.value)}
            placeholder="Other person's user id"
            className="min-h-11 w-full rounded-[14px] border border-line bg-surface px-3 text-sm text-content"
          />
          <button
            type="button"
            disabled={!manualUserId.trim() || safetyBusy}
            onClick={() => void showSafety()}
            className="btn-secondary min-h-11 rounded-[14px] px-4 disabled:opacity-50"
          >
            {safetyBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Show safety number
          </button>
        </div>
      ) : peerId ? (
        <p className="text-sm font-medium text-content">Safety number</p>
      ) : null}
      {safetyBusy && peerId ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
        </div>
      ) : null}
      {safetyGroups ? (
        <>
          <div className="rounded-2xl bg-[#f3f1ee] px-3 py-5 dark:bg-white/5">
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-center text-[16px] font-medium tabular-nums tracking-[0.06em] text-[#1c1c1c] dark:text-content">
              {safetyGroups.map((group, index) => (
                <span key={`${index}-${group}`}>{group}</span>
              ))}
            </div>
          </div>
          {peerId ? (
            <p className="text-sm leading-5 text-content-secondary">
              Compare these numbers with {peerLabel} in person or on a call. If they match, nobody is in between.
            </p>
          ) : null}
        </>
      ) : null}
      {safetyError ? <p className="text-sm text-content-secondary">{safetyError}</p> : null}
    </div>
  )

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-encryption-title"
          className="max-h-[min(92vh,780px)] w-full max-w-[440px] overflow-y-auto rounded-t-2xl bg-surface px-5 pb-6 pt-4 shadow-dropdown sm:rounded-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Lock className="h-5 w-5 shrink-0 text-content" aria-hidden />
              <h2 id="message-encryption-title" className="text-[18px] font-semibold tracking-tight text-content">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-400 text-orange-500 transition hover:bg-orange-50 dark:hover:bg-orange-500/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {enabled === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
            </div>
          ) : enabled === false ? (
            <p className="text-sm leading-5 text-content-secondary">
              End-to-end encryption is off for this account.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-5 text-content-secondary">{intro}</p>
              {purpose === 'link' ? (
                qrBlock
              ) : (
                <>
                  {peerId || showSafetyLookup ? safetyBlock : null}
                  <div className={peerId || showSafetyLookup ? 'border-t border-line pt-4' : ''}>
                    {showDevices ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-content">Your devices</p>
                          {purpose === 'encryption' ? (
                            <button
                              type="button"
                              onClick={() => setShowDevices(false)}
                              className="text-sm text-content-secondary underline-offset-2 hover:underline"
                            >
                              Hide
                            </button>
                          ) : null}
                        </div>
                        <p className="text-sm leading-5 text-content-secondary">
                          Use this only to add another of <span className="font-medium text-content">your</span>{' '}
                          browsers or phones. Chatting with {peerLabel} on the web does not need a scan.
                        </p>
                        {qrBlock}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowDevices(true)}
                        className="text-sm font-medium text-content underline-offset-2 hover:underline"
                      >
                        Link another of your devices
                      </button>
                    )}
                  </div>
                </>
              )}
              {notice ? <p className="text-sm text-content">{notice}</p> : null}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
