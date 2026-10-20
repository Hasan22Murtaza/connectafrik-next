'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Loader2, Lock, Phone, RefreshCw, X } from '@/shared/icons'
import Portal from '@/shared/components/ui/Portal'
import { useAuth } from '@/contexts/AuthContext'
import { localLinkDeviceInfo } from '@/lib/message-e2ee/device-local'
import { messageE2eeStatus } from '@/lib/message-e2ee/status'

type DeviceStatus = { deviceId: string; ownsIdentity: boolean; payload: string }

type MessageEncryptionModalProps = {
  open: boolean
  onClose: () => void
}

type LinkPhase =
  | 'starting'
  | 'ready'
  | 'waiting'
  | 'success'
  | 'failed'
  | 'expired'

const QR_TTL_MS = 5 * 60 * 1000

/**
 * Single encryption modal: Link a device (QR + paste).
 * Local device id + QR render first (no Signal/network).
 * Engine bootstrap is best-effort and must never blank the QR.
 */
export function MessageEncryptionModal({ open, onClose }: MessageEncryptionModalProps) {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [backendReady, setBackendReady] = useState(true)
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [linkPhase, setLinkPhase] = useState<LinkPhase>('starting')
  const [expiresAt, setExpiresAt] = useState(0)
  const [remainingSec, setRemainingSec] = useState(0)
  const wasOwner = useRef<boolean | null>(null)
  const payloadRef = useRef('')
  const statusRef = useRef<DeviceStatus | null>(null)
  const onCloseRef = useRef(onClose)
  const sessionGen = useRef(0)
  const userIdRef = useRef<string | undefined>(user?.id)
  onCloseRef.current = onClose
  userIdRef.current = user?.id

  const resetTransient = useCallback(() => {
    setPaste('')
    setError('')
    setNotice('')
    setCopied(false)
    setQrUrl('')
    setStatus(null)
    statusRef.current = null
    setLinkPhase('starting')
    setExpiresAt(0)
    setRemainingSec(0)
    setEnabled(null)
    setBackendReady(true)
    wasOwner.current = null
    payloadRef.current = ''
  }, [])

  const renderQr = useCallback(async (payload: string, gen: number) => {
    try {
      const url = await QRCode.toDataURL(payload, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      if (gen !== sessionGen.current) return
      payloadRef.current = payload
      setQrUrl(url)
      setExpiresAt(Date.now() + QR_TTL_MS)
      setRemainingSec(Math.floor(QR_TTL_MS / 1000))
      setLinkPhase((prev) => (prev === 'success' ? prev : 'ready'))
    } catch {
      if (gen !== sessionGen.current) return
      setQrUrl('')
      setLinkPhase('failed')
      setError('Unable to generate QR code. Please try again.')
    }
  }, [])

  const showLocalQr = useCallback(
    async (userId: string, gen: number) => {
      const local = localLinkDeviceInfo(userId)
      // Always publish device id immediately — even if this session gen is stale —
      // so the UI never sticks on "Preparing…" after a cancelled in-flight run.
      statusRef.current = local
      setStatus(local)
      wasOwner.current = local.ownsIdentity
      if (gen !== sessionGen.current) return local
      await renderQr(local.payload, gen)
      return local
    },
    [renderQr],
  )

  const bootstrapCrypto = useCallback(
    async (userId: string, gen: number) => {
      try {
        const engine = await import('@/lib/message-e2ee/engine')
        if (gen !== sessionGen.current) return
        const next = await engine.encryptionDeviceStatus(userId)
        if (gen !== sessionGen.current) return
        if (wasOwner.current === false && next.ownsIdentity) {
          setNotice('Device linked successfully')
          setLinkPhase('success')
        } else {
          setLinkPhase((prev) => {
            if (prev === 'success' || prev === 'expired') return prev
            return next.ownsIdentity ? 'ready' : 'waiting'
          })
        }
        wasOwner.current = next.ownsIdentity
        statusRef.current = next
        setStatus(next)
        if (payloadRef.current !== next.payload) {
          await renderQr(next.payload, gen)
        }
      } catch (err) {
        if (gen !== sessionGen.current) return
        const message = err instanceof Error ? err.message : ''
        // Keep local QR / device id. Engine publish is best-effort.
        setLinkPhase((prev) => {
          if (prev === 'ready' || prev === 'waiting' || prev === 'expired') {
            return prev
          }
          return payloadRef.current || statusRef.current ? 'waiting' : prev
        })
        setError(
          message && !/^off$/i.test(message)
            ? `${message} You can still share the device id or QR below.`
            : 'Still preparing encryption on this browser. You can still share the device id or QR below.',
        )
      }
    },
    [renderQr],
  )

  const prepareLinkSession = useCallback(async () => {
    const userId = userIdRef.current
    if (!userId) return
    const gen = ++sessionGen.current
    setError('')
    setNotice('')
    setQrUrl('')
    setLinkPhase((prev) => (prev === 'success' ? prev : 'starting'))

    try {
      await showLocalQr(userId, gen)
    } catch (err) {
      if (gen !== sessionGen.current) return
      setLinkPhase('failed')
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Device linking failed. Your encryption keys were not changed.',
      )
      return
    }

    if (gen !== sessionGen.current) return
    await bootstrapCrypto(userId, gen)
  }, [showLocalQr, bootstrapCrypto])

  const prepareRef = useRef(prepareLinkSession)
  prepareRef.current = prepareLinkSession

  useEffect(() => {
    if (!open) {
      sessionGen.current += 1
      resetTransient()
      return
    }

    let cancelled = false
    let stopKeys = () => {}
    const userId = userIdRef.current
    const gen = ++sessionGen.current

    // Local device id + QR first — before status API or Signal engine.
    if (userId) {
      try {
        const local = localLinkDeviceInfo(userId)
        if (!cancelled) {
          statusRef.current = local
          setStatus(local)
          wasOwner.current = local.ownsIdentity
          void renderQr(local.payload, gen)
        }
      } catch (err) {
        if (!cancelled) {
          setLinkPhase('failed')
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'This browser could not create a device id.',
          )
        }
      }
    }

    void (async () => {
      const flag = await messageE2eeStatus()
      if (cancelled) return
      setEnabled(flag.enabled)
      setBackendReady(flag.ready)
      // Keep local QR even when the rollout flag is off or storage is not ready.
      if (!userId) return
      if (!flag.enabled) return

      if (!flag.ready) {
        setError(
          'Encryption storage is not ready on this server yet. You can still share this device id or QR; key sync will work after migrations are applied.',
        )
        setLinkPhase((prev) => (prev === 'expired' ? prev : 'waiting'))
        return
      }

      if (gen === sessionGen.current) {
        await bootstrapCrypto(userId, gen)
      }

      try {
        const engine = await import('@/lib/message-e2ee/engine')
        if (cancelled) return
        stopKeys = engine.onMessageKeys(() => {
          void (async () => {
            try {
              const next = await engine.encryptionDeviceStatus(userId)
              if (cancelled) return
              if (wasOwner.current === false && next.ownsIdentity) {
                setNotice('Device linked successfully')
                setLinkPhase('success')
              }
              wasOwner.current = next.ownsIdentity
              statusRef.current = next
              setStatus(next)
            } catch {
              // Keep the existing QR; pairing can still be retried.
            }
          })()
        })
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        // Never blank a working local QR because Signal failed to load.
        if (payloadRef.current || statusRef.current) {
          setLinkPhase((prev) => (prev === 'expired' ? prev : 'waiting'))
          setError(
            message && !/^off$/i.test(message)
              ? `${message} You can still share the device id or QR below.`
              : 'Encryption keys are still loading. You can still share the device id or QR below.',
          )
          return
        }
        // Last resort: try local device info again before hard-fail.
        try {
          const local = localLinkDeviceInfo(userId)
          statusRef.current = local
          setStatus(local)
          await renderQr(local.payload, sessionGen.current)
          setError(
            message && !/^off$/i.test(message)
              ? `${message} You can still share the device id or QR below.`
              : 'Encryption keys are still loading. You can still share the device id or QR below.',
          )
        } catch (localErr) {
          setLinkPhase('failed')
          setError(
            localErr instanceof Error && localErr.message
              ? localErr.message
              : message && !/^off$/i.test(message)
                ? message
                : 'This browser could not start encryption. Use HTTPS, then refresh and try again.',
          )
        }
      }
    })()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      cancelled = true
      // Do not bump sessionGen here — that discarded in-flight QR when deps refreshed.
      // sessionGen advances only on explicit close/retry/new open session.
      stopKeys()
      window.removeEventListener('keydown', onKey)
    }
    // Intentionally omit prepareLinkSession — use refs to avoid canceling the local QR mid-flight.
  }, [open, user?.id, resetTransient, renderQr, bootstrapCrypto])

  useEffect(() => {
    if (!open || !expiresAt || linkPhase === 'success') return
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setRemainingSec(left)
      if (left <= 0) {
        setQrUrl('')
        setLinkPhase('expired')
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [open, expiresAt, linkPhase])

  const link = async (payload: string) => {
    if (!user?.id) return
    setBusy('link')
    setError('')
    setNotice('')
    setLinkPhase('waiting')
    try {
      const engine = await import('@/lib/message-e2ee/engine')
      await engine.linkDeviceFromPayload(user.id, payload.trim())
      setPaste('')
      setNotice('Device linked successfully')
      setLinkPhase('success')
    } catch (err) {
      setLinkPhase('failed')
      setError(err instanceof Error ? err.message : 'Device linking failed. Your encryption keys were not changed.')
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

  const retryQr = () => {
    void prepareRef.current()
  }

  if (!open) return null

  const intro = status?.ownsIdentity
    ? 'Add another browser with its device id, or scan this code from the CribsTalk phone app.'
    : 'Share this device id with another CribsTalk browser that already reads your encrypted messages, or scan this QR from that phone.'

  const qrVisual = (() => {
    if (linkPhase === 'expired') {
      return (
        <div className="flex h-[200px] w-[200px] flex-col items-center justify-center gap-3 rounded-xl bg-surface-secondary px-3 text-center">
          <p className="text-sm font-medium text-content">QR expired</p>
          <button
            type="button"
            onClick={retryQr}
            className="btn-secondary inline-flex min-h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generate new QR
          </button>
        </div>
      )
    }
    if (qrUrl) {
      return (
        <img
          src={qrUrl}
          alt="Device linking code"
          className="h-[200px] w-[200px] rounded-xl bg-white p-2"
        />
      )
    }
    if (linkPhase === 'failed' && !status) {
      return (
        <div className="flex h-[200px] w-[200px] flex-col items-center justify-center gap-3 rounded-xl bg-surface-secondary px-3 text-center">
          <p className="text-sm font-medium text-content">Could not prepare linking</p>
          {error ? <p className="text-xs text-content-secondary">{error}</p> : null}
          <button type="button" onClick={retryQr} className="btn-secondary min-h-9 rounded-[12px] px-3 text-sm">
            Try again
          </button>
        </div>
      )
    }
    return (
      <div className="flex h-[200px] w-[200px] flex-col items-center justify-center gap-2 rounded-xl bg-surface-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-content-tertiary" />
        <p className="px-3 text-center text-xs text-content-secondary">Generating QR code…</p>
      </div>
    )
  })()

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
              <h2
                id="message-encryption-title"
                className="text-[18px] font-semibold tracking-tight text-content"
              >
                Link a device
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

          {enabled === false ? (
            <p className="text-sm leading-5 text-content-secondary">
              End-to-end encryption is off for this account.
            </p>
          ) : enabled === null && !status && !qrUrl ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-5 text-content-secondary">{intro}</p>

              {!backendReady ? (
                <p className="text-sm leading-5 text-content-secondary">
                  Server encryption storage is still catching up. The QR below is valid for scanning once
                  this environment finishes setup.
                </p>
              ) : null}

              <div className="flex flex-col items-center gap-2">
                {qrVisual}
                {linkPhase === 'ready' || linkPhase === 'waiting' ? (
                  <p className="text-xs text-content-tertiary">
                    {remainingSec > 0
                      ? `Code refreshes in ${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`
                      : null}
                  </p>
                ) : null}
                {linkPhase === 'failed' && (qrUrl || error) ? (
                  <button
                    type="button"
                    onClick={retryQr}
                    className="btn-secondary min-h-10 rounded-[12px] px-4 text-sm"
                  >
                    Try again
                  </button>
                ) : null}
              </div>

              <div className="space-y-2 rounded-2xl bg-surface-secondary/70 px-3 py-3">
                <p className="text-sm font-medium text-content">Or link another browser</p>
                <p className="text-sm leading-5 text-content-secondary">
                  {status?.ownsIdentity
                    ? 'Paste the other browser’s device id below. Device id alone is not authentication — this browser must already hold your encryption keys.'
                    : 'On a browser that already works, open Link a device and paste this device id.'}
                </p>
                <div className="flex items-center justify-center gap-1.5 text-sm text-content">
                  <span>
                    Device ID:{' '}
                    <span className="font-medium tracking-wide">
                      {status?.deviceId || 'Preparing…'}
                    </span>
                  </span>
                  {status?.deviceId ? (
                    <button
                      type="button"
                      onClick={() => void copyDeviceId()}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content"
                      aria-label={copied ? 'Copied' : 'Copy device id'}
                      title={copied ? 'Copied' : 'Copy device id'}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                </div>
                {status?.ownsIdentity ? (
                  <>
                    <input
                      value={paste}
                      onChange={(event) => setPaste(event.target.value)}
                      placeholder="Paste another device ID"
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
                  Scan the QR with CribsTalk on a phone that already uses this account. Your messages
                  remain end-to-end encrypted.
                </p>
              </div>

              {notice && linkPhase === 'success' ? (
                <p className="text-sm text-content">{notice}</p>
              ) : null}
              {error && linkPhase !== 'failed' ? <p className="text-sm text-danger">{error}</p> : null}
              {error && linkPhase === 'failed' && qrUrl ? (
                <p className="text-sm text-danger">{error}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
