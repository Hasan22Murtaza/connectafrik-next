'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Shield } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { messageE2eeActive } from '@/lib/message-e2ee/status'
import { formatSafetyNumber } from '@/lib/message-e2ee/safety'
import { SettingsCard, SettingsSectionHeader } from './SettingsPrimitives'

type DeviceStatus = { deviceId: string; ownsIdentity: boolean; payload: string }

export function MessageEncryptionPanel() {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [paste, setPaste] = useState('')
  const [otherUserId, setOtherUserId] = useState('')
  const [safetyGroups, setSafetyGroups] = useState<string[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanStop = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const on = await messageE2eeActive()
      if (cancelled) return
      setEnabled(on)
      if (!on || !user?.id) return
      try {
        const engine = await import('@/lib/message-e2ee/engine')
        const next = await engine.encryptionDeviceStatus(user.id)
        if (cancelled) return
        setStatus(next)
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(next.payload, { margin: 1, width: 220 })
        if (!cancelled) setQrUrl(url)
      } catch {
        if (!cancelled) setError('This browser could not start encryption.')
      }
    })()
    return () => {
      cancelled = true
      scanStop.current?.()
    }
  }, [user?.id])

  if (enabled === null) return null
  if (!enabled) {
    return (
      <SettingsCard>
        <SettingsSectionHeader
          title="Message encryption"
          description="End-to-end encryption is off for this account. Messages stay on the current storage path."
        />
      </SettingsCard>
    )
  }

  const link = async (payload: string) => {
    if (!user?.id) return
    setBusy('link')
    setError('')
    try {
      const engine = await import('@/lib/message-e2ee/engine')
      await engine.linkDeviceFromPayload(user.id, payload)
      setPaste('')
      scanStop.current?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link that device')
    } finally {
      setBusy('')
    }
  }

  const startScan = async () => {
    setError('')
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot scan a QR code. Paste the code instead.')
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    const video = videoRef.current
    if (!video) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    video.srcObject = stream
    await video.play()
    const detector = new Detector({ formats: ['qr_code'] })
    let stopped = false
    scanStop.current = () => {
      stopped = true
      stream.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }
    const tick = async () => {
      if (stopped) return
      try {
        const codes = await detector.detect(video)
        const value = codes.find((code) => code.rawValue?.startsWith('cribstalk-link:'))?.rawValue
        if (value) {
          scanStop.current?.()
          await link(value)
          return
        }
      } catch {
        // Keep scanning until the camera is stopped.
      }
      if (!stopped) requestAnimationFrame(() => void tick())
    }
    void tick()
  }

  const showSafety = async () => {
    if (!user?.id) return
    setBusy('safety')
    setError('')
    setSafetyGroups(null)
    try {
      const engine = await import('@/lib/message-e2ee/engine')
      const digits = await engine.safetyNumberForUser(user.id, otherUserId.trim())
      setSafetyGroups(formatSafetyNumber(digits))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the safety number')
    } finally {
      setBusy('')
    }
  }

  return (
    <SettingsCard>
      <SettingsSectionHeader
        title="Message encryption"
        description="Keys for this browser stay on this device. A linked device can read new messages. It does not receive older ones."
      />
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
          <div>
            <p className="text-sm text-content">This device: {status?.deviceId || 'Starting…'}</p>
            <p className="mt-1 text-sm text-content-secondary">
              {status?.ownsIdentity
                ? 'This device can link another browser. Scan that browser’s code, or paste it below.'
                : 'Show this code to a browser that already encrypts this account. Older messages stay on the devices that received them.'}
            </p>
          </div>
        </div>
        {qrUrl ? <img src={qrUrl} alt="Device linking code" className="h-[220px] w-[220px] rounded-xl bg-white p-2" /> : null}
        <video ref={videoRef} className="hidden" muted playsInline />
        {status?.ownsIdentity ? (
          <div className="space-y-2">
            <button type="button" onClick={() => void startScan()} className="btn-secondary min-h-11 rounded-[14px] px-4">
              Scan a device code
            </button>
            <textarea
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              placeholder="Paste a device code"
              className="min-h-20 w-full rounded-[14px] border border-line bg-surface px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!paste.trim() || busy === 'link'}
              onClick={() => void link(paste)}
              className="btn-secondary min-h-11 rounded-[14px] px-4 disabled:opacity-50"
            >
              {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Link device
            </button>
          </div>
        ) : null}
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm font-medium text-content">Safety number</p>
          <p className="text-sm text-content-secondary">
            Compare these 60 digits with the other person. CribsTalk does not confirm the number for you.
          </p>
          <input
            value={otherUserId}
            onChange={(event) => setOtherUserId(event.target.value)}
            placeholder="Other person’s user id"
            className="min-h-11 w-full rounded-[14px] border border-line bg-surface px-3 text-sm"
          />
          <button
            type="button"
            disabled={!otherUserId.trim() || busy === 'safety'}
            onClick={() => void showSafety()}
            className="btn-secondary min-h-11 rounded-[14px] px-4 disabled:opacity-50"
          >
            {busy === 'safety' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Show safety number
          </button>
          {safetyGroups ? (
            <p className="font-mono text-sm leading-6 text-content">{safetyGroups.join(' ')}</p>
          ) : null}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </SettingsCard>
  )
}
