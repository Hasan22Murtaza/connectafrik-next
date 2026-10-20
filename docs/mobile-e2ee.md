# CribsTalk mobile E2EE (Signal Protocol)

Web message E2EE uses the **Signal Protocol** (`libsignal` on web).

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

There is no multi-device linking / QR pairing flow. Keys stay on the device that created them.

## Attachments

Attachment sealing (`lib/message-e2ee/attachment-seal.ts`, CLA1 wire format) is unchanged. File keys travel inside the Signal plaintext payload, never to the server in the clear.

## Crypto APIs

Register / claim / revoke via `/api/message-e2ee/request`. Status via `/api/message-e2ee/status`. The server never holds private keys or plaintext.

## Mobile checklist

- [ ] Flag on → Signal identity + prekey upload
- [ ] Encrypt for every recipient device (and own other devices)
- [ ] Decrypt version 3 envelopes for this device id
- [ ] Leave version 2 Megolm rows locked
- [ ] CLA1 attachments encrypt before upload
- [ ] Push payloads never include plaintext or ciphertext bodies
- [ ] Call E2EE remains on `/api/call-e2ee/*` — do not mix key stores
