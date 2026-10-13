# CribsTalk end-to-end encryption

CribsTalk encrypts new chat messages with the Signal protocol before they leave the browser. The API and Supabase store ciphertext. Private keys stay on the device, wrapped by a non-extractable Web Crypto key in IndexedDB.

Existing plaintext messages stay readable. They are not labeled as encrypted.

## Architecture

```text
Sender browser
  plaintext
    → Signal session (X3DH + Double Ratchet)
  ciphertext envelopes, one per recipient device
    → POST /api/chat/threads/:id/messages
Supabase chat_messages.content = ''
Supabase e2ee_envelopes = opaque ciphertext
    → Realtime INSERT
Recipient browser
  Signal decrypt
    → plaintext shown in the existing chat UI
```

The protocol implementation is `@privacyresearch/libsignal-protocol-typescript` (Signal's X3DH handshake and Double Ratchet). CribsTalk does not define its own cipher.

Group chats and multiple devices use that same session cipher once per recipient device (client fan-out). Each device has its own identity key. The Signal address name is `userId~deviceId` because this library pins trust to the address name. Removing a device stops new envelopes from being addressed to it.

Attachments use Web Crypto AES-256-GCM. The file key is inside the Signal payload. The uploaded object is ciphertext.

## Database

Migration: `supabase/migrations/20261013120000_e2ee.sql`

| Object | What it stores |
| --- | --- |
| `chat_messages.e2ee_version` | `null` legacy plaintext, `1` encrypted |
| `chat_messages.e2ee_sender_device_id` | Sending device id |
| `chat_messages.content` | Empty when `e2ee_version = 1` |
| `user_devices` | Public identity key, signed prekey, registration id |
| `device_prekeys` | Public one-time prekeys |
| `e2ee_envelopes` | Ciphertext for one recipient device |
| `e2ee_key_backups` | Optional passphrase-encrypted key backup |

Private keys are not columns. Session state stays in IndexedDB. Tables have row level security and no client policies; the chat API uses the service role and returns only the caller's envelopes.

Apply the migration before relying on encryption:

```bash
supabase db push
```

Until the migration exists, new messages stay on the legacy plaintext path and the client does not claim they are encrypted.

## Packages

- `@privacyresearch/libsignal-protocol-typescript` — Signal protocol
- `qrcode` — safety-number QR in the verification dialog
- `vitest` — `npm test`

## Key management

On sign-in, `E2eeBootstrap` calls `ensureDevice()`:

1. Open IndexedDB database `cribstalk-e2ee`.
2. Create a non-extractable AES-GCM wrapping key if needed.
3. If this browser has no device yet, generate an identity key, registration id, signed prekey, and 100 one-time prekeys.
4. Upload only public material to `POST /api/e2ee/devices`.
5. Keep private keys in the encrypted vault.

Signed prekeys rotate every 7 days. One-time prekeys are refilled when fewer than 25 remain. Logout revokes the current device and deletes the local vault. Sign out of all devices revokes every device. A revoked device is left out of later fan-out, so it cannot decrypt new messages.

Optional backup (`PUT /api/e2ee/backup`) encrypts the vault with PBKDF2-SHA-256 (600,000 iterations) and AES-GCM. The passphrase never goes to the server. A weak passphrase can be guessed by anyone who gets the backup, including someone operating the database. CribsTalk cannot reset it.

## Message flow

`prepareOutgoingMessage` runs inside `supabaseMessagingService.sendMessage` before the API call.

- Call signals and membership system lines stay plaintext. They are not user message content.
- If any participant has no encryption device yet, the message stays legacy plaintext and is not marked encrypted.
- Once every participant has a device, the server rejects plaintext user messages (`E2EE_REQUIRED`).
- The client encrypts a JSON payload `{ text, attachments }` for every other device, including the sender's other devices.
- `content` sent to the API is empty. `last_message_preview` and push body are `New message`.
- The sending device keeps the plaintext in the encrypted local cache so it can show its own history.
- Decrypt failures render “Unable to decrypt this message”. A duplicate Realtime delivery is served from that cache because a Signal message cannot be decrypted twice.

Search of encrypted history runs on this device over decrypted text. Server `ilike` still finds legacy plaintext only. Translation is not offered for encrypted messages, because that would send plaintext to the server.

## Media

`fileUploadService.uploadFiles` encrypts bytes when the thread is end-to-end encrypted, then uploads the ciphertext to the existing storage path. The original name and type travel inside the Signal payload. The recipient downloads the ciphertext and decrypts it locally. View Once uses the same keys when the existing claim flow returns the stored bytes.

## Multi-device

```text
User
  Device 1  identity, signed prekey, one-time prekeys, sessions
  Device 2  its own keys and sessions
```

Device list, last active time, and remove are in Settings → Security.

## Migration

| Messages | Behavior |
| --- | --- |
| Already stored | `e2ee_version` is null. Shown as normal text. Not described as encrypted. |
| New, before the other person has a device | Legacy plaintext. The lock is hidden. |
| New, after every participant has a device | Signal ciphertext. |

## Tests

```bash
npm test
```

`lib/e2ee/e2ee.test.ts` covers A→B, replies, offline prekey delivery, ordered and out-of-order pages, duplicates, tampered ciphertext, group fan-out, multiple devices, device removal, signed prekey rotation, backup/reinstall, image/video/file encryption, and the generic push string.

## Security notes

- TLS stays enabled. This does not replace it.
- Do not log message text, file keys, or private keys.
- Do not put private keys in `localStorage` or in a normal table column.
- IndexedDB is still readable by script running in this origin. The wrapping key is non-extractable, which stops casual export, not a malicious extension or XSS.
- Public prekey bundles are available to signed-in users so a new chat can start. They are public keys.
- Group fan-out creates one ciphertext per device. It uses the Signal session cipher rather than a separate sender-key implementation, which this library does not provide.
- Calls are unchanged and are not message-content encryption.

## Deploy

1. Apply `20261013120000_e2ee.sql`.
2. Deploy the web app.
3. Users pick up a device automatically the next time they open CribsTalk while signed in.
4. New messages between users who both have a device become encrypted. Old messages stay as they are.

## Rollback

1. Deploy the previous web build. New sends go back to plaintext. Encrypted rows stay in the database with empty `content` and cannot be shown as plaintext without the device keys.
2. Leave the tables in place. Dropping them deletes ciphertext people may still decrypt locally.
3. To disable new encryption without dropping data, stop calling `prepareOutgoingMessage` and stop rejecting `E2EE_REQUIRED`. Do not flip `e2ee_version` on old rows.
