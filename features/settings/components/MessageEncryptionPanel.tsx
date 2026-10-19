'use client'

import React, { useEffect, useState } from 'react'
import { messageE2eeActive } from '@/lib/message-e2ee/status'
import { MessageEncryptionModal } from './MessageEncryptionModal'
import { SettingsCard, SettingsSectionHeader } from './SettingsPrimitives'

export function MessageEncryptionPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void messageE2eeActive().then((on) => {
      if (!cancelled) setEnabled(on)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  return (
    <SettingsCard>
      <SettingsSectionHeader
        title="Message encryption"
        description="Keys for this browser stay on this device. Open Link a device to show a QR code the CribsTalk phone app can scan. A linked device can read new messages. It does not receive older ones."
      />
      <div className="px-4 py-4 sm:px-5">
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary min-h-11 rounded-[14px] px-4">
          Link a device
        </button>
      </div>
      <MessageEncryptionModal
        open={open}
        onClose={() => setOpen(false)}
        purpose="link"
        showSafetyLookup
      />
    </SettingsCard>
  )
}
