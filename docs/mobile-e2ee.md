# Mobile End-to-End Encryption Guide

**Audience:** Android and iOS engineers  
**Reference implementation:** this web app (`lib/call-e2ee/*`, `lib/message-e2ee/*`)  
**Goal:** Interoperate with web for encrypted calls, encrypted chat messages, file attachments, and linked devices.

Do not invent a second crypto format. Protocols, byte layouts, AAD strings, Matrix id shapes, and error copy must match web exactly.

---

## Table of contents

1. [Overview](#1-overview)
2. [Security rules](#2-security-rules)
3. [Feature flags and auth](#3-feature-flags-and-auth)
4. [Part A — Call encryption](#4-part-a--call-encryption)
5. [Part B — Message encryption](#5-part-b--message-encryption)
6. [Part C — Linked devices](#6-part-c--linked-devices)
7. [Safety number](#7-safety-number)
8. [Push notifications](#8-push-notifications)
9. [API quick reference](#9-api-quick-reference)
10. [Acceptance checklists](#10-acceptance-checklists)
11. [Reference source files](#11-reference-source-files)

---

## 1. Overview

CribsTalk E2EE is two independent systems. They share auth and rollout flags, but **not** key material or device ids.

| System | Purpose | Crypto | Server storage | Device id |
| --- | --- | --- | --- | --- |
| **Call E2EE** | Seal LiveKit media keys | X25519 + HKDF + XChaCha20-Poly1305 | Sealed keys only (`user_devices`, call seal rows) | UUID (lowercased) |
| **Message E2EE** | Encrypt chat text and attachment keys | Matrix Olm / Megolm (vodozemac) | Public keys, to-device events, ciphertext rows | 8–64 alphanumeric |

```text
┌─────────────┐     sealed media key      ┌─────────────┐
│  Device A   │ ─────────────────────────▶│   Server    │──▶ LiveKit (encrypted frames)
│ call X25519 │◀───────────────────────── │ never sees  │
└─────────────┘     sealed blob only      │ raw media key│
                                          └─────────────┘

┌─────────────┐     Megolm ciphertext     ┌─────────────┐
│  Device A   │ ─────────────────────────▶│   Server    │──▶ other devices
│ Olm machine │◀── to-device key events ──│ never sees  │
└─────────────┘                           │ plaintext   │
                                          └─────────────┘
```

**Implementation order:** finish call encryption first, then messages. A stock mobile build is refused a LiveKit token for an encrypted room until call sealing works.

**Libraries:**

| Platform | Calls | Messages |
| --- | --- | --- |
| Web (reference) | `@noble/curves` + `@noble/ciphers` | `@matrix-org/matrix-sdk-crypto-wasm` 18.9.0 (vodozemac) |
| Android / iOS | X25519 + XChaCha20-Poly1305 + HKDF-SHA256 (libsodium / similar) | Official Matrix Rust crypto (`matrix-sdk-crypto` / vodozemac) via JNI or C/Swift bindings |

Do **not** reimplement Olm, Megolm, or the double ratchet on mobile.

---

## 2. Security rules

1. Private keys stay on device (platform keystore / Secure Enclave / Keystore).
2. Never log private keys, media keys, Megolm session keys, attachment keys, or secret bundles.
3. Never put keys or message plaintext in notifications, analytics, crash reports, or deep-link query params.
4. The server never receives the 32-byte call media key or message plaintext for `e2ee_version: 2`.
5. Fail closed on seal/decrypt failure — do not fall back to an unencrypted path when the feature flag is on.
6. Call device keys and message (Olm) device keys are separate. A call device id is **not** a message device id.

---

## 3. Feature flags and auth

Flags live on the **server**, not in the app binary. Ask on every sign-in (and after token refresh if you cache them).

| Flag | Status route | Meaning when `enabled: true` |
| --- | --- | --- |
| `CALL_E2EE` | `GET /api/call-e2ee/status` | Seal LiveKit media keys |
| `MESSAGE_E2EE` | `GET /api/message-e2ee/status` | Megolm messages + CLA1 files |

Both default to off. Response shape:

```json
{ "success": true, "data": { "enabled": true }, "message": "..." }
```

Use `data.enabled`. For message E2EE, `enabled` is true only when the account is in the rollout **and** the crypto DB migration is applied.

**Auth:** send the user JWT as `Authorization: Bearer <token>` on every E2EE route (same as the rest of the app).

**Response wrappers:** most chat/E2EE routes return `{ success, data, message }`. Use `data`.  
**Exception:** `POST /api/videosdk/token` returns `{ token, roomId, provider, wsUrl }` or `{ error }` — no wrapper.

When a flag is off for the account, keep today’s unencrypted path. Do not send seals or `e2ee_version: 2`.

---

## 4. Part A — Call encryption

Web sources: `lib/call-e2ee/protocol.ts`, `lib/call-e2ee/seal.ts`.

### 4.1 Register a call device

On first launch after sign-in, if call E2EE is enabled:

1. Generate an **X25519** key pair (32-byte private, 32-byte public) with the platform CSPRNG. Store both in the keystore.
2. Generate a **device id** with `UUID`, store it, and always use the **lowercased** form (the server lowercases it).
3. Register the public key:

```http
POST /api/call-e2ee/devices
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "device_id": "<uuid>",
  "public_key": "<standard base64 of 32 bytes>",
  "platform": "android"
}
```

`platform` is `"android"` or `"ios"`.

| Status | Meaning | Action |
| --- | --- | --- |
| 200 | Registered | Store device id + keys |
| 409 | Device id already registered with a different key | Generate a **new** device id and register again. Do not reuse a rejected key. |

### 4.2 Start an encrypted call

When status is enabled, the room must be **LiveKit**. Do not send `e2ee_key` in the clear.

1. List participant call devices:

```http
GET /api/call-e2ee/devices?thread_id=<thread uuid>
```

`data.devices` is `{ userId, deviceId, publicKey }[]` (includes you).  
If `data.missingUserIds` is non-empty → **stop**. Tell the user encrypted calling is not set up for everyone in the chat. Do **not** fall back to an unsealed room.

2. Generate a fresh **32-byte media key** for this call.
3. Seal that same key once per device in the list (including your own).
4. Create the call session with seals only:

```http
POST /api/chat/threads/<threadId>/call-sessions
```

```json
{
  "provider": "livekit",
  "sender_device_id": "<your call device uuid>",
  "sealed_keys": [
    {
      "recipient_user_id": "<user uuid>",
      "recipient_device_id": "<their call device uuid>",
      "sealed_key": "<standard base64, 73 bytes decoded>"
    }
  ]
}
```

Do **not** include the raw media key.

5. Request a LiveKit token with `device_id` set to your call device id (`POST /api/videosdk/token` body, or the same field on the query string). Without that id on a sealed room, the server returns **403**.
6. Pass the **standard base64 string of the 32-byte media key** to LiveKit’s external E2EE key provider, enable frame encryption, then connect. Web calls `setKey(base64)` then `setE2EEEnabled(true)` **before** `room.connect`. Raw bytes will not match web.

### 4.3 Seal format (must match byte-for-byte)

`sealed_key` is standard base64 of **exactly 73 bytes**:

| Offset | Length | Value |
| --- | --- | --- |
| 0 | 1 | version `0x01` |
| 1 | 24 | random XChaCha20 nonce |
| 25 | 48 | XChaCha20-Poly1305 ciphertext of the 32-byte media key (includes 16-byte tag) |

```text
shared     = X25519(sender_private, recipient_public)
wrap_key   = HKDF-SHA256(
               ikm  = shared,
               salt = utf8 "cribstalk-call-e2ee-v1",
               info = utf8 "cribstalk.call.seal.v1",
               len  = 32)
aad        = utf8 "cribstalk.call.v1\n{callId}\n{senderDeviceId}\n{recipientDeviceId}"
```

- Both device ids in the AAD are **trimmed and lowercased**.
- `callId` is the **call session id** (the id you send / receive as `call_id`), not necessarily the LiveKit room name.
- HKDF is extract-then-expand with SHA-256 (RFC 5869). A single SHA-256 of the shared secret does **not** match.

### 4.4 Join an encrypted call

1. If the session has `e2ee: true` or `metadata.e2ee === true`, it is sealed. **Ignore** any `e2eeKey` field (the server strips it on sealed sessions).
2. Fetch your seal:

```http
GET /api/call-e2ee/keys?call_id=<call id>&device_id=<your call device uuid>
```

`data` is `{ sealedKey, senderDeviceId, senderPublicKey }`.

3. Open the seal with your call private key and the sender’s call public key. AAD uses the same `callId`, `senderDeviceId`, and **your** device id.
4. On missing seal, auth-tag failure, or wrong key length → **do not connect**. Show this text exactly:

```text
Unable to establish encrypted call.
Please leave and rejoin the call.
```

5. Request the LiveKit token with your `device_id`, set the base64 media key, enable frame encryption, then connect.

A device that registers **after** the call started has no seal. Joining fails closed until someone invites them with a new seal.

### 4.5 Invite into a live sealed call

Keep the **same** media key. Do not generate a new one.

1. `GET /api/call-e2ee/devices?user_id=<invitee uuid>`
2. Seal the existing media key for each of their call devices.
3. Send `sender_device_id` and `sealed_keys` on `POST /api/chat/calls/invite`. The first seal for a device wins; later seals for that device are ignored.

If they have no registered call device, do not invite them into the encrypted room.

### 4.6 Call E2EE done when

- You can call web and web can call you, with frame encryption on before connect.
- LiveKit token requests include `device_id`.
- Wrong device / flipped bit / missing seal shows the exact error above and does not connect.
- The server never receives the 32-byte media key.
- When `CALL_E2EE` is off, behavior matches today’s call path.

---

## 5. Part B — Message encryption

Start only after Part A works.

Web uses `@matrix-org/matrix-sdk-crypto-wasm` 18.9.0 (vodozemac). On device, use the official Matrix Rust crypto stack through JNI or a C/Swift binding.

### 5.1 Identifiers

```text
user   = @<user uuid lowercase>:cribstalk
room   = !<thread uuid with hyphens removed>:cribstalk
device = 8 to 64 letters or digits, generated on device and stored in the keystore
```

Web uses a 10-character device id from `A-Z` and `0-9`. Any id in the 8–64 length range is fine. Do **not** ask the server to mint it.

**Example:**

| App value | Matrix id |
| --- | --- |
| User `550e8400-e29b-41d4-a716-446655440000` | `@550e8400-e29b-41d4-a716-446655440000:cribstalk` |
| Thread `123e4567-e89b-12d3-a456-426614174000` | `!123e4567e89b12d3a456426614174000:cribstalk` |

### 5.2 Bootstrap OlmMachine

1. `GET /api/message-e2ee/status`. If `data.enabled` is false → send messages the existing way. Do not write `e2ee_version: 2`.
2. If true:
   - Create the Olm machine for that Matrix user id and device id.
   - Persist the store in the keystore or an encrypted file. A new install is a **new device**; it does not receive old Megolm sessions.
   - Run the [key broker](#53-key-broker) loop until the machine is quiet.
   - Track yourself and query keys.
   - If the server has **no** master key for this user → bootstrap cross-signing and upload it. That device **owns** the account identity.
   - If the server **already** has a master key and this device does not have the private keys → **do not** create a second identity. Show [device linking](#6-part-c--linked-devices). This device can send only after it imports the secret bundle and signs itself.

The first successful identity upload wins. A second device that also bootstraps gets `{ "existing": true }` and must link instead.

### 5.3 Key broker

One route carries every Matrix-style crypto request. The machine produces the body; you POST it, then pass the response back with `markRequestAsSent`.

```http
POST /api/message-e2ee/request
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "id": "<request id from the machine>",
  "type": 0,
  "body": "<raw JSON string from the machine>",
  "deviceId": "<this message device id>",
  "eventType": "m.room.encrypted"
}
```

- `eventType` is only for to-device sends (`type: 3`).
- `deviceId` is required for key upload.
- `device_keys.user_id` must be this account’s Matrix id, and `device_keys.device_id` must equal `deviceId`. The server rejects anything else.

| `type` | Machine intent | Return to machine |
| --- | --- | --- |
| `0` | `/keys/upload` | `{ "one_time_key_counts": { "signed_curve25519": N } }` |
| `1` | `/keys/query` | `{ device_keys, master_keys, self_signing_keys, user_signing_keys, failures }` |
| `2` | `/keys/claim` | `{ one_time_keys, failures }` |
| `3` | `/sendToDevice` | `{}` |
| `4` | `/keys/signatures/upload` | `{}` |
| `"signing-keys"` | cross-signing public keys (no request id) | `{ "existing": true }` or `{ "existing": false }` |

Signing-key upload does **not** replace an identity that already exists. Still upload the signature request afterward so this device becomes signed by that identity.

There is **no** Matrix `/sync`. Poll:

```http
GET /api/message-e2ee/sync?device_id=<this message device id>
```

`data`:

| Field | Meaning |
| --- | --- |
| `events` | `{ id, type, sender, content }[]` — feed `{ type, sender, content }` to `receiveSyncChanges` |
| `oneTimeKeyCount` | `signed_curve25519` count |
| `unusedFallback` | `["signed_curve25519"]` or `[]` |

After the machine accepts those events:

```http
POST /api/message-e2ee/sync/ack
{ "ids": ["<event uuid>", "..."] }
```

Ack **only** after processing succeeds. Then run the outgoing-request loop again so one-time keys refill.

**Polling cadence:** every few seconds while the app is open, and once when a message fails to decrypt.

**Trust / sharing (match web):**

- Share room keys with every published device (`allDevices`).
- Decrypt with trust requirement **Untrusted** so 1:1 chat works before the safety number is compared.
- Do not drop a message only because the safety number has not been compared.

### 5.4 Send a message

**Skip encryption** for:

- Call signals: `initiated`, `ringing`, `active`, `declined`, `ended`, `missed`, `failed`, `accepted_on_another_device`
- Group member system messages
- Marketplace system messages

Those stay plain signaling.

For a normal message:

1. Load participant user ids (including yourself).
2. If that set is **smaller** than the last set you encrypted for in this thread → invalidate the Megolm session before sharing a new one. Also invalidate when you leave the group or remove a member.
3. Track those users, claim missing Olm sessions, then share the room key.
4. Rotation settings (match web): **100 messages**, **7 days** (`604800000000` microseconds), history visibility **Joined**.
5. Encrypt an `m.room.message` whose plaintext JSON is:

```json
{
  "msgtype": "m.text",
  "body": "hello",
  "attachments": []
}
```

`msgtype`: `m.text` | `m.image` | `m.audio` | `m.video` | `m.file`.

6. Persist:

```http
POST /api/chat/threads/<threadId>/messages
```

```json
{
  "content": "",
  "message_type": "text",
  "e2ee_version": 2,
  "ciphertext": "<encrypted event JSON string>",
  "megolm_session_id": "<session_id>",
  "sender_device_id": "<olm device id>"
}
```

- Do **not** also run the old thread-id codec on that row.
- Server preview becomes `🔒 Encrypted message`. Keyword search cannot see the body (expected).
- If Megolm fails and you have **not** uploaded a sealed file yet → fall back to the existing path and log a reason with **no** plaintext.
- If a file was already sealed → **do not** send the message (URL would be ciphertext with no key).

**Edits:** `PATCH` with the same `e2ee_version`, `ciphertext`, `megolm_session_id`, `sender_device_id`, and `content: ""`.

**Delete for everyone:** must clear `content`, `ciphertext`, `megolm_session_id`, and `sender_device_id` (server does this on the web delete route).

### 5.5 Receive a message

| `e2ee_version` | Action |
| --- | --- |
| not `2` | Existing decoder |
| `2` | Decrypt Megolm in that thread’s Matrix room id |

Build a room event:

```json
{
  "type": "m.room.encrypted",
  "sender": "@<sender user uuid>:cribstalk",
  "event_id": "$<message uuid with hyphens removed>",
  "origin_server_ts": 0,
  "content": "<JSON.parse(ciphertext)>"
}
```

`origin_server_ts` = message `created_at` in milliseconds.

| Result | UI |
| --- | --- |
| Success | Show `content.body` (and attachments from plaintext) |
| Failure | `🔒 This message can't be read on this device` |

Offer device linking. When a to-device key arrives later, decrypt that message again. A newly linked device does **not** get history — older rows stay locked. That is intentional.

### 5.6 Attachments (CLA1)

Seal the file **before** upload, and only when message encryption is enabled. The key never goes in `message_attachments`, metadata, or the push body.

**CLA1 layout** (big-endian):

| Field | Size |
| --- | --- |
| magic `CLA1` | 4 bytes |
| version `1` | 1 byte |
| chunk size `65536` | uint32 |
| plaintext size | uint64 |
| SHA-256 of the plaintext | 32 bytes |
| repeated chunks | 12-byte nonce + AES-256-GCM ciphertext and tag |

The last chunk may be shorter. The AES key is 32 random bytes, standard base64, stored **only** inside the Megolm attachment object:

```json
{
  "name": "photo.jpg",
  "mime": "image/jpeg",
  "size": 12345,
  "sha256": "<hex sha256 of plaintext>",
  "key": "<standard base64 of the 32-byte AES key>",
  "url": "<uploaded ciphertext url>"
}
```

1. Upload CLA1 bytes to the existing chat-media path.
2. Attachment row may keep original file name and mime (View Once still needs to recognize photo/video).
3. Decrypt to a memory blob for display. Do not write plaintext into gallery storage unless the user saves it.
4. View Once: download via the existing token route, then open CLA1 with the key from the decrypted message. Missing key → locked string. Never render ciphertext as an image.

---

## 6. Part C — Linked devices

Linked devices share the **account cross-signing identity** so a second phone/tablet can decrypt new Megolm messages. They do **not** copy old Megolm sessions (no history backfill).

### 6.0 UI — one Link a device modal

Match web: **one modal** everywhere — settings, chat **Encryption** menu, and locked-message **Link a device** CTA. Do **not** use a separate “End-to-end encrypted” hub with Safety number / Link a device menu items.

**Link a device (the only encryption modal):**

- Title: **Link a device** (padlock)
- Intro: add another browser with its device id, or scan this code from the CribsTalk phone app
- Large QR for `cribstalk-link:1:…` with ~5 minute refresh (“Code refreshes in m:ss”)
- Section **Or link another browser**: paste device id + copy this device’s id
- Owner copy: device id alone is not authentication — this device must already hold the encryption keys

Safety number comparison is a separate concern (see §7); it is not nested in this modal.

Web reference: `MessageEncryptionModal`.

### 6.1 Roles

| Role | Device | Responsibility |
| --- | --- | --- |
| **Owner** | Already holds master / self-signing / user-signing private keys | Scans or pastes the new device’s code; exports and Olm-encrypts the secret bundle |
| **New device** | Just uploaded device keys; no identity yet | Shows QR / code; imports bundle; signs itself (`reset: false`) |

### 6.2 QR / paste payload

The payload has **no secrets**:

```text
cribstalk-link:1:@<user uuid>:cribstalk:<message device id>
```

Example:

```text
cribstalk-link:1:@550e8400-e29b-41d4-a716-446655440000:cribstalk:ABC12XYZ90
```

Also accepted on web (for same-account paste): bare device id, or `This device: <id>`. Mobile should prefer the full `cribstalk-link:1:…` form.

Reject the payload if the Matrix user id is not the signed-in account.

### 6.3 New device flow

1. Create Olm machine + upload device keys via the broker (`type: 0`).
2. Detect that the server already has a master key (or signing-keys returns `{ "existing": true }`).
3. Show “Link this device” UI with the QR payload from §6.2.
4. Poll `/api/message-e2ee/sync` until a to-device event decrypts to type `cribstalk.link`.
5. Import the secret bundle from `content.bundle`.
6. Bootstrap cross-signing with **`reset: false`** so the device signs itself with the imported self-signing key and uploads signatures.
7. Do **not** create a new identity. Do **not** expect old chat history to decrypt.

Plaintext event shape inside the Olm to-device message:

```json
{
  "type": "cribstalk.link",
  "content": {
    "v": 1,
    "bundle": { }
  }
}
```

`bundle` is the Matrix `SecretsBundle` JSON from the crypto SDK.

### 6.4 Owner device flow

1. Parse / normalize the payload. Reject wrong account or self-link.
2. Ensure the owner device `ownsIdentity` (has cross-signing private keys).
3. Mark tracked users dirty → flush → query keys so the new device is visible.
4. `getDevice` for the new device id; if missing, wait / flush again (new device must have published keys).
5. Claim / establish an Olm session (`getMissingSessions` + broker).
6. `exportSecretsBundle()` → encrypt to-device event type `cribstalk.link` with `{ v: 1, bundle }`.
7. Send via broker:

```http
POST /api/message-e2ee/request
{
  "type": 3,
  "eventType": "m.room.encrypted",
  "deviceId": "<owner message device id>",
  "body": "{\"messages\":{\"<matrix user id>\":{\"<new device id>\":<encrypted content>}}}"
}
```

### 6.5 After linking

| Behavior | Expected |
| --- | --- |
| Messages sent **after** link | Decrypt on both devices |
| Messages sent **before** link | Stay locked on the new device |
| Call device registration | Still separate — register call X25519 keys independently on each physical device |
| Safety number | Same for the account identity (master keys), not per message device |

### 6.6 Linked devices done when

- A second phone linked by QR reads messages sent after the link, and not history from before it.
- Web ↔ mobile linking works in both directions (web owns identity ↔ phone is new, and the reverse when phone owns identity).
- A second bootstrap attempt does not overwrite the existing identity.

---

## 7. Safety number

Compute on device from the two users’ **master public keys**. Do not ask the server for the number.

1. Decode both master keys (standard or unpadded base64). If the SDK gives a JSON CrossSigningKey (`{ "keys": { "ed25519:…": "…" } }`), extract the ed25519 value first.
2. Sort the raw bytes lexicographically; concatenate smaller then larger.
3. SHA-512 that input, then SHA-512 the digest **1000 more times** (1001 hashes total).
4. Read the final digest as a big-endian integer, reduce mod `10^60`, pad to **60 digits**.
5. Show groups of **5**. Users compare in person or on a call. The app does **not** auto-mark verified.

Reference: `lib/message-e2ee/safety.ts`.

---

## 8. Push notifications

For `e2ee_version === 2`:

| Field | Value |
| --- | --- |
| Notification body | Exactly `🔒 New message` |
| Data `e2ee` | `"1"` |

Do **not** put `content`, Megolm ciphertext, or an attachment key in the push payload. The server overwrites the body when `e2ee` is set or when the message row is version 2. The mobile notification extension must do the same if it builds the text locally.

Sender name as the title is allowed. Message text is not.

---

## 9. API quick reference

### Call E2EE

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/call-e2ee/status` | `{ enabled }` |
| `POST` | `/api/call-e2ee/devices` | Register call device |
| `GET` | `/api/call-e2ee/devices?thread_id=` | List devices for thread |
| `GET` | `/api/call-e2ee/devices?user_id=` | List devices for one user (shared chat required) |
| `GET` | `/api/call-e2ee/keys?call_id=&device_id=` | Fetch own sealed media key |
| `POST` | `/api/chat/threads/:id/call-sessions` | Start call (+ `sealed_keys`) |
| `POST` | `/api/chat/calls/invite` | Invite (+ `sealed_keys`) |
| `POST` | `/api/videosdk/token` | LiveKit JWT (`device_id` required when sealed) |

### Message E2EE

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/message-e2ee/status` | `{ enabled }` |
| `POST` | `/api/message-e2ee/request` | Key broker (upload/query/claim/to-device/signatures) |
| `GET` | `/api/message-e2ee/sync?device_id=` | Pull to-device crypto events |
| `POST` | `/api/message-e2ee/sync/ack` | Ack processed event ids |
| `POST` | `/api/chat/threads/:id/messages` | Send (`e2ee_version: 2`, …) |
| `PATCH` | `/api/chat/threads/:id/messages/:messageId` | Edit encrypted message |

---

## 10. Acceptance checklists

### Calls

- [ ] Register call device; 409 regenerates device id
- [ ] Start sealed call with seals for every participant device
- [ ] Join: open seal → set LiveKit key → connect with encryption on
- [ ] Interop with web (both directions)
- [ ] Missing / corrupt seal shows exact join error and does not connect
- [ ] Invite into live call re-seals same media key
- [ ] Flag off → legacy call path

### Messages

- [ ] Flag off → legacy messages (`e2ee_version` not 2)
- [ ] Flag on → OlmMachine bootstrap + key broker + sync loop
- [ ] 1:1 and group text decrypt web ↔ mobile
- [ ] CLA1 attachments encrypt before upload; key only in Megolm plaintext
- [ ] Member leave rotates Megolm; left member cannot decrypt later messages
- [ ] Decrypt failure UI: `🔒 This message can't be read on this device`
- [ ] Push body never contains plaintext

### Linked devices

- [ ] New device shows `cribstalk-link:1:…` QR
- [ ] Owner exports bundle over Olm to-device `cribstalk.link`
- [ ] New device imports bundle and signs itself without resetting identity
- [ ] Post-link messages decrypt; pre-link history stays locked
- [ ] Safety number matches web for the same master keys

---

## 11. Reference source files

| Area | Path |
| --- | --- |
| Call protocol constants / AAD | `lib/call-e2ee/protocol.ts` |
| Call seal / open | `lib/call-e2ee/seal.ts` |
| Call device persistence | `lib/call-e2ee/persist.ts` |
| Call flag | `lib/call-e2ee/flag.ts` |
| Message ids / link payload | `lib/message-e2ee/ids.ts` |
| Message crypto engine (web) | `lib/message-e2ee/engine.ts` |
| Key broker | `lib/message-e2ee/broker.ts` |
| CLA1 attachments | `lib/message-e2ee/cla1.ts` |
| Safety number | `lib/message-e2ee/safety.ts` |
| Message flag | `lib/message-e2ee/flag.ts` |
| Call status API | `app/api/call-e2ee/status/route.ts` |
| Call devices API | `app/api/call-e2ee/devices/route.ts` |
| Call keys API | `app/api/call-e2ee/keys/route.ts` |
| Message status API | `app/api/message-e2ee/status/route.ts` |
| Message request API | `app/api/message-e2ee/request/route.ts` |
| Message sync API | `app/api/message-e2ee/sync/route.ts` |
| Message sync ack | `app/api/message-e2ee/sync/ack/route.ts` |

When behavior is ambiguous, match the web implementation in these files — they are the contract.
