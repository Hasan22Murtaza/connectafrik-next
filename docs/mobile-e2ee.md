# CribsTalk mobile E2EE (Signal Protocol)

Web message E2EE now uses the **Signal Protocol** (`libsignal` on web) instead of Matrix Olm/Megolm.

Call E2EE (LiveKit / X25519 under `lib/call-e2ee`) is unchanged and separate.

## Architecture

```text
Mobile / Web client
      │
      │ Signal Protocol (identity + signed prekey + OTKs + Double Ratchet)
      ▼
CribsTalk API (public keys + ciphertext relay only)
```

The server never receives plaintext, private identity keys, session keys, or decrypted attachments.

## Wire version

| `e2ee_version` | Meaning |
|----------------|---------|
| `null` / unset | Legacy plaintext / non-E2EE |
| `1` | Legacy thread-derived codec (`messageCodec`) |
| `2` | Retired Matrix Megolm (show locked; do not attempt Matrix decrypt) |
| `3` | Signal Protocol multi-device envelope pack |

Version 3 stores a raw Signal body in `chat_messages.ciphertext` and per-device bodies/types in `signal_message_envelopes`.

## Device model

Each install is its own Signal identity. Upload only public material via `/api/message-e2ee/request` (`type: register`). Keep private keys in platform secure storage (Keystore / Keychain / sealed IndexedDB on web).

## Attachments

Attachment sealing (`lib/message-e2ee/attachment-seal.ts`, CLA1 wire format) is unchanged. File keys travel inside the Signal plaintext payload, never to the server in the clear.

## Linked devices

QR / paste uses `cribstalk-link:2:{userId}:{deviceId}` (unchanged). An owner device approves via `crypto_device_link_sessions`. Do not put private keys in the QR payload.

### Link session APIs (web + mobile)

Short-lived pairing metadata lives in `crypto_device_link_sessions` (5 minute TTL, same as the web QR UI). Paths stay under the existing message-e2ee API family:

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/message-e2ee/devices/link/session` | New device creates a pending session after key register |
| `GET` | `/api/message-e2ee/devices/link/session/:sessionId` | Poll status (`pending`…`completed` / `expired`) |
| `GET` | `/api/message-e2ee/devices/link/open?device_id=` | Owner resolves open session from scanned device id |
| `POST` | `/api/message-e2ee/devices/link/approve` | Trusted device records approval |
| `POST` | `/api/message-e2ee/devices/link/complete` | New device finalizes after seeing approved status |
| `GET` | `/api/message-e2ee/devices` | List this user’s crypto devices (public metadata) |
| `GET` | `/api/message-e2ee/devices/current?device_id=` | Current device metadata |
| `DELETE` | `/api/message-e2ee/devices/:deviceId` | Revoke device (`crypto_device_keys` + OTKs) |

Crypto register / claim / revoke via `/api/message-e2ee/request` is unchanged. The server never holds private keys or plaintext bootstrap material.

### Linking sequence

```text
new device → register keys → create link session → show QR (cribstalk-link:2:…)
     → trusted device scans/pastes → validates session + identity key
     → marks session approved → new device polls session → complete session
```

## Mobile checklist

- [ ] Flag on → Signal identity + prekey upload
- [ ] Encrypt for every recipient device (and own other devices)
- [ ] Decrypt version 3 envelopes for this device id
- [ ] Leave version 2 Megolm rows locked
- [ ] CLA1 attachments encrypt before upload
- [ ] Push payloads never include plaintext or ciphertext bodies
- [ ] Call E2EE remains on `/api/call-e2ee/*` — do not mix key stores
