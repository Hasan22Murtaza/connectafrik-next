# Mobile E2EE handoff

Android and iOS live in their own repos. This web app is the reference. Implement **calls first**, then **messages**. Do not invent a second crypto format. A stock mobile build is refused a LiveKit token for an encrypted room until call sealing is done.

Server flags are not in the app binary. Ask the server on each sign-in:

| Flag | Status route | Meaning |
| --- | --- | --- |
| `CALL_E2EE` | `GET /api/call-e2ee/status` | Seal LiveKit media keys |
| `MESSAGE_E2EE` | `GET /api/message-e2ee/status` | Megolm messages and CLA1 files |

Both default to off. `{ "success": true, "data": { "enabled": true } }` means this account is in the rollout **and** the database migration is applied. Most chat routes wrap the payload as `{ success, data, message }`. Use `data`. The LiveKit token route does **not** use that wrapper. It returns `{ token, roomId, provider, wsUrl }` or `{ error }`.

Send the user JWT as `Authorization: Bearer …`, the same as the rest of the app.

Private keys stay on the device, in the platform keystore. Never log them, never send them, and never put a media key or an attachment key in a notification, analytics event, or crash report.

---

## Part 1 — Calls

Do this before message encryption. Web source: `lib/call-e2ee/protocol.ts` and `lib/call-e2ee/seal.ts`.

Call device keys are **not** the Olm keys in Part 2. They are a separate X25519 key pair stored in `user_devices`.

### 1. Create one call device and register it

On first launch after sign-in, if `CALL_E2EE` is enabled for this user:

1. Generate an X25519 key pair (32-byte private key, 32-byte public key). Use the platform CSPRNG. Keep both in the keystore.
2. Generate a device id with `UUID` and store it. The server lowercases it. Use that lowercase id everywhere below.
3. Register the public key:

```http
POST /api/call-e2ee/devices
{ "device_id": "<uuid>", "public_key": "<standard base64 of 32 bytes>", "platform": "android" }
```

`platform` is `"android"` or `"ios"`. A 409 means this device id was already registered with a different key. Generate a new device id and register again. Do not reuse a key the server has rejected.

### 2. Start a call

When status is enabled, the room must be LiveKit. Do not send `e2ee_key`.

1. `GET /api/call-e2ee/devices?thread_id=<thread uuid>`
2. `data.devices` is `{ userId, deviceId, publicKey }[]` for every participant, including you.
3. If `data.missingUserIds` is not empty, stop. Tell the user encrypted calling is not set up for every person in the chat. Do not fall back to an unsealed LiveKit room.
4. Generate a fresh 32-byte media key for this call.
5. Seal that same key once per device in the list, including your own device.
6. `POST /api/chat/threads/<threadId>/call-sessions` with `provider: "livekit"`, `sender_device_id`, and `sealed_keys`. Do not include the raw media key.

```json
{
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

7. Ask for a LiveKit token with `device_id` set to your call device id (`POST /api/videosdk/token` body, or the same field on the query string). Without that id, the server returns 403.
8. Pass the **standard base64 string of the 32-byte media key** to LiveKit’s external E2EE key provider. Web calls `setKey(base64)` and then `setE2EEEnabled(true)` **before** `room.connect`. Android and iOS must set that same string before connect. Raw bytes will not match web.

### Seal bytes

`sealed_key` is standard base64 of exactly 73 bytes:

| Offset | Length | Value |
| --- | --- | --- |
| 0 | 1 | version `0x01` |
| 1 | 24 | random XChaCha20 nonce |
| 25 | 48 | XChaCha20-Poly1305 ciphertext of the 32-byte media key, including the 16-byte tag |

```text
shared     = X25519(sender private, recipient public)
wrap key   = HKDF-SHA256(
               ikm  = shared,
               salt = utf8 "cribstalk-call-e2ee-v1",
               info = utf8 "cribstalk.call.seal.v1",
               len  = 32)
aad        = utf8 "cribstalk.call.v1\n{callId}\n{senderDeviceId}\n{recipientDeviceId}"
```

Both device ids in the AAD are trimmed and lowercased. `callId` is the call session id, not the LiveKit room name, unless those values are the same in that request. Use the id you send as `call_id`.

HKDF is extract-then-expand with SHA-256, the same as RFC 5869. Noble and libsodium’s HKDF-SHA256 match this. A single SHA-256 of the shared secret does not.

### 3. Join a call

1. If the session has `e2ee: true` or `metadata.e2ee === true`, it is sealed. Ignore any `e2eeKey` field. The server deletes that field on sealed sessions.
2. `GET /api/call-e2ee/keys?call_id=<call id>&device_id=<your call device uuid>`
3. `data` is `{ sealedKey, senderDeviceId, senderPublicKey }`.
4. Open the seal with your call private key and the sender’s call public key. The AAD uses the same call id, the sender device id, and your device id.
5. If the seal is missing, the tag fails, or the key is the wrong length, stop. Show this text exactly and do not connect:

```text
Unable to establish encrypted call.
Please leave and rejoin the call.
```

6. Request the LiveKit token with your `device_id`, set the base64 media key, enable frame encryption, then connect.

A device that registers after the call has started has no seal. Joining fails closed until someone invites them with a new seal.

### 4. Invite someone into a live sealed call

Keep the same media key. Do not generate a new one.

1. `GET /api/call-e2ee/devices?user_id=<invitee uuid>`
2. Seal the existing media key for each of their call devices.
3. Send `sender_device_id` and `sealed_keys` on the existing invite request (`POST /api/chat/calls/invite`). The first seal for a device wins. Later seals for that device are ignored.

If they have no registered call device, do not invite them into the encrypted room.

### 5. What “done” means for calls

- You can call web, and web can call you, with frame encryption on before connect.
- The LiveKit token request includes `device_id`.
- A wrong device, a flipped bit in `sealed_key`, or a missing seal shows the exact error above and does not connect.
- The server never receives the 32-byte media key.
- When `CALL_E2EE` is off for the account, keep today’s call path. Do not send seals.

---

## Part 2 — Messages

Start this only after Part 1 works. Web uses `@matrix-org/matrix-sdk-crypto-wasm` 18.9.0, which is vodozemac. On device, use the official Matrix Rust crypto stack (vodozemac / `matrix-sdk-crypto`) through JNI or a C/Swift binding. Do not reimplement Olm, Megolm, or the double ratchet.

Call X25519 keys stay in `user_devices`. Message keys use the `crypto_*` tables. A call device id is not a message device id.

### Identifiers

```text
user   = @<user uuid lowercase>:cribstalk
room   = !<thread uuid with hyphens removed>:cribstalk
device = 8 to 64 letters or digits, generated on device and stored in the keystore
```

Web uses a 10-character device id from `A-Z` and `0-9`. Any id in that length range is fine. Do not ask the server to mint it.

Example: user `550e8400-e29b-41d4-a716-446655440000` and thread `123e4567-e89b-12d3-a456-426614174000` become `@550e8400-e29b-41d4-a716-446655440000:cribstalk` and `!123e4567e89b12d3a456426614174000:cribstalk`.

### 1. Check the flag, then open OlmMachine

`GET /api/message-e2ee/status`. If `data.enabled` is false, send messages the way the app does today. Do not write `e2ee_version: 2`.

If it is true:

1. Create the Olm machine for that Matrix user id and device id. Persist the store in the keystore or an encrypted file. A new install is a new device. It does not receive old Megolm sessions.
2. Run the request loop below until the machine is quiet.
3. Track yourself and query keys.
4. If the server has no master key for this user, bootstrap cross-signing and upload it. That device owns the account identity.
5. If the server already has a master key and this device does not have the private keys, do **not** create a second identity. Show device linking (step 5). This device can send only after it imports the secret bundle and signs itself.

The first successful identity upload wins. A second device that also bootstraps gets `{ "existing": true }` and must link instead.

### 2. Key broker

One route carries every Matrix request. The machine produces the body. Post it, then pass the response back with `markRequestAsSent`.

```http
POST /api/message-e2ee/request
{
  "id": "<request id from the machine>",
  "type": 0,
  "body": "<raw JSON string from the machine>",
  "deviceId": "<this message device id>",
  "eventType": "m.room.encrypted"
}
```

`eventType` is only for to-device sends. `deviceId` is required for key upload.

| `type` | What the machine sent | What you return to the machine |
| --- | --- | --- |
| `0` | `/keys/upload` (`device_keys`, `one_time_keys`, `fallback_keys`) | `{ "one_time_key_counts": { "signed_curve25519": N } }` |
| `1` | `/keys/query` | `{ device_keys, master_keys, self_signing_keys, user_signing_keys, failures }` |
| `2` | `/keys/claim` | `{ one_time_keys, failures }` |
| `3` | `/sendToDevice` | `{}` |
| `4` | `/keys/signatures/upload` | `{}` |
| `"signing-keys"` | cross-signing public keys, no request id | `{ "existing": true }` or `{ "existing": false }` |

`device_keys.user_id` must be this account’s Matrix id, and `device_keys.device_id` must be `deviceId`. The server rejects anything else.

Signing-key upload does not replace an identity that already exists. Still upload the signature request afterward so this device becomes signed by that identity.

There is no Matrix `/sync`. Poll:

```http
GET /api/message-e2ee/sync?device_id=<this message device id>
```

`data.events` is `{ id, type, sender, content }[]`. Feed `{ type, sender, content }` to `receiveSyncChanges`. `data.oneTimeKeyCount` is the `signed_curve25519` count. `data.unusedFallback` lists algorithms that still have an unused fallback key (`["signed_curve25519"]` or `[]`).

After the machine accepts those events:

```http
POST /api/message-e2ee/sync/ack
{ "ids": ["<event uuid>", "..."] }
```

Ack only after processing succeeds. Then run the outgoing-request loop again so one-time keys refill. Poll every few seconds while the app is open, and once when a message fails to decrypt.

Share room keys with every published device (`allDevices`), matching web. That keeps web↔web and phone chats readable without waiting on cross-signing. Decrypt with trust requirement **Untrusted**, so a 1:1 chat works before the safety number is compared. Do not drop a message only because the safety number has not been compared.

### 3. Send a message

Skip encryption for call signals (`initiated`, `ringing`, `active`, `declined`, `ended`, `missed`, `failed`, `accepted_on_another_device`), group member system messages, and marketplace system messages. Those stay plain signaling.

For a normal message:

1. Load participant user ids, including yourself.
2. If that set is smaller than the last set you encrypted for in this thread, invalidate the Megolm session before sharing a new one. Also invalidate when you leave the group or remove a member.
3. Track those users, claim missing Olm sessions, then share the room key.
4. Rotation settings, matching web: 100 messages, 7 days (`604800000000` microseconds), history visibility `Joined`.
5. Encrypt an `m.room.message` event whose plaintext JSON is:

```json
{
  "msgtype": "m.text",
  "body": "hello",
  "attachments": []
}
```

`msgtype` is `m.text`, `m.image`, `m.audio`, `m.video`, or `m.file`.

6. Store the machine’s encrypted JSON as `ciphertext`. Copy `session_id` to `megolm_session_id` and the Olm device id to `sender_device_id`.

```http
POST /api/chat/threads/<threadId>/messages
{
  "content": "",
  "message_type": "text",
  "e2ee_version": 2,
  "ciphertext": "<encrypted event JSON string>",
  "megolm_session_id": "<session_id>",
  "sender_device_id": "<olm device id>"
}
```

Do not also run the old thread-id codec on that row. The server preview becomes `🔒 Encrypted message`. Keyword search cannot see the body. That is expected.

If Megolm fails and you have not uploaded a sealed file yet, send the message on the existing path and log a reason with no plaintext. If a file was already sealed, do not send the message. The URL would be ciphertext with no key.

Edits use `PATCH` with the same `e2ee_version`, `ciphertext`, `megolm_session_id`, and `sender_device_id`, and `content: ""`.

Delete-for-everyone must clear `content`, `ciphertext`, `megolm_session_id`, and `sender_device_id`. The server does this when the web delete route is used.

### 4. Receive a message

If `e2ee_version` is not `2`, use the existing decoder.

If it is `2`, build a room event and decrypt it in that thread’s Matrix room id:

```json
{
  "type": "m.room.encrypted",
  "sender": "@<sender user uuid>:cribstalk",
  "event_id": "$<message uuid with hyphens removed>",
  "origin_server_ts": 0,
  "content": "<JSON.parse(ciphertext)>"
}
```

`origin_server_ts` is the message `created_at` in milliseconds.

On success, show `content.body`. On failure, show:

```text
🔒 This message can't be read on this device
```

Offer device linking. When a to-device key arrives later, decrypt that message again. A new linked device does not get history, so older rows stay on that screen. That is intentional.

### 5. Attachments

Seal the file **before** upload, and only when message encryption is enabled. The key never goes in `message_attachments`, metadata, or the push body.

CLA1 layout, big-endian:

| Field | Size |
| --- | --- |
| magic `CLA1` | 4 bytes |
| version `1` | 1 byte |
| chunk size `65536` | uint32 |
| plaintext size | uint64 |
| SHA-256 of the plaintext | 32 bytes |
| repeated chunks | 12-byte nonce + AES-256-GCM ciphertext and tag |

The last chunk is shorter. The key is 32 random bytes, standard base64, stored only inside the Megolm attachment:

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

Upload the CLA1 bytes to the existing chat-media path. The attachment row may keep the original file name and mime so View Once still recognizes a photo or video. Decrypt to a memory blob for display. Do not write the plaintext file into gallery storage unless the user saves it.

View Once still downloads through the existing token route. After download, open CLA1 with the key from the decrypted message. If the key is missing, show the locked string. Do not render the ciphertext as an image.

### 6. Link a device

The QR payload has no secrets:

```text
cribstalk-link:1:@<user uuid>:cribstalk:<message device id>
```

The new device shows this code after its device keys are uploaded. The existing device, which holds the cross-signing private keys:

1. Parse the payload. Reject it if the user id is not the signed-in account.
2. Query and claim an Olm session for that device.
3. Export the secret bundle (`master`, `self-signing`, and `user-signing` seeds).
4. Olm-encrypt a to-device event whose plaintext type is `cribstalk.link` and whose content is `{ "v": 1, "bundle": <SecretsBundle JSON> }`.
5. `POST /api/message-e2ee/request` with `type: 3`, `eventType: "m.room.encrypted"`, and a body of `{ "messages": { "<matrix user id>": { "<new device id>": <encrypted content> } } }`.

The new device imports the bundle, then bootstraps with `reset: false` so it signs its own device with the imported self-signing key and uploads that signature. It does not copy old Megolm sessions.

### 7. Safety number

Compute this on the device from the two master public keys. Do not ask the server for the number.

1. Decode both master keys (standard or unpadded base64).
2. Sort the raw bytes lexicographically and concatenate smaller then larger.
3. SHA-512 that input, then SHA-512 the digest 1000 more times (1001 hashes total).
4. Read the final digest as a big-endian integer, reduce mod `10^60`, and pad to 60 digits.
5. Show groups of 5. The user compares them in person or on a call. The app does not mark the user verified by itself.

### 8. Push

For `e2ee_version === 2`, the notification body is exactly `🔒 New message` and the data field `e2ee` is `"1"`. Do not put `content`, the Megolm ciphertext, or an attachment key in the push payload. The server overwrites the body when `e2ee` is set or when that message row is version 2. The mobile notification extension must do the same if it builds the text locally.

Sender name as the title is allowed. Message text is not.

### 9. What “done” means for messages

- Web and this app can read each other’s new text and attachments in a 1:1 chat and in a group.
- A member leaving causes the next message to use a new Megolm session. The person who left cannot decrypt it.
- A second phone linked by QR reads messages sent after the link, and not the history from before it.
- The safety number matches web for the same pair of master keys.
- Push on a locked phone does not contain the message text.
- With `MESSAGE_E2EE` off, behavior matches today’s app.

Translation and abuse reports do not receive encrypted message text. Do not add a path that uploads decrypted history.
