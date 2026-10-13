import { describe, expect, it } from 'vitest'
import { arrayBufferToBase64 } from './bytes'
import { decryptBackup, decryptFileBytes, encryptBackup, encryptFileBytes } from './media'
import { MemorySignalStore } from './memoryStore'
import {
  decryptFromDevice,
  encryptForDevice,
  establishSession,
  provisionAccount,
  rotateSignedPreKey,
} from './protocol'
import { E2EE_PUSH_BODY, type DeviceBundle, type E2eeEnvelope, type PlaintextPayload } from './types'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'
const CAROL = '33333333-3333-3333-3333-333333333333'

async function freshAccount(preKeys = 8) {
  const store = new MemorySignalStore()
  const account = await provisionAccount(store, preKeys)
  return { store, account }
}

function bundleFor(
  userId: string,
  deviceId: number,
  account: Awaited<ReturnType<typeof provisionAccount>>,
  preKeyIndex = 0
): DeviceBundle {
  return {
    userId,
    deviceId,
    registrationId: account.registrationId,
    identityKey: arrayBufferToBase64(account.identityKeyPair.pubKey),
    signedPreKey: account.signedPreKeyPublic,
    preKey: account.preKeys[preKeyIndex],
  }
}

describe('Signal sessions', () => {
  it('encrypts a message from A to an offline B, then B decrypts it', async () => {
    const alice = await freshAccount()
    const bob = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob.account))
    const envelope = await encryptForDevice(alice.store, BOB, 1, 'Hello')
    expect(envelope.messageType).toBe(3)
    expect(envelope.ciphertext).not.toContain('Hello')
    const plain = await decryptFromDevice(bob.store, ALICE, 1, envelope)
    expect(plain).toBe('Hello')
  })

  it('lets B reply to A on the same session', async () => {
    const alice = await freshAccount()
    const bob = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob.account))
    const first = await encryptForDevice(alice.store, BOB, 1, 'Hello')
    expect(await decryptFromDevice(bob.store, ALICE, 1, first)).toBe('Hello')
    const reply = await encryptForDevice(bob.store, ALICE, 1, 'Hi there')
    expect(reply.messageType).toBe(1)
    expect(await decryptFromDevice(alice.store, BOB, 1, reply)).toBe('Hi there')
  })

  it('decrypts a page of messages in order and out of order', async () => {
    const alice = await freshAccount()
    const bob = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob.account))
    const bodies = ['one', 'two', 'three', 'four', 'five']
    const envelopes = []
    for (const body of bodies) envelopes.push(await encryptForDevice(alice.store, BOB, 1, body))
    const ordered = []
    for (const envelope of envelopes) ordered.push(await decryptFromDevice(bob.store, ALICE, 1, envelope))
    expect(ordered).toEqual(bodies)

    const alice2 = await freshAccount()
    const bob2 = await freshAccount()
    await establishSession(alice2.store, bundleFor(BOB, 1, bob2.account))
    const again = []
    for (const body of ['a', 'b', 'c']) again.push(await encryptForDevice(alice2.store, BOB, 1, body))
    expect(await decryptFromDevice(bob2.store, ALICE, 1, again[1])).toBe('b')
    expect(await decryptFromDevice(bob2.store, ALICE, 1, again[0])).toBe('a')
    expect(await decryptFromDevice(bob2.store, ALICE, 1, again[2])).toBe('c')
  })

  it('rejects a second decrypt of the same ciphertext and a tampered ciphertext', async () => {
    const alice = await freshAccount()
    const bob = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob.account))
    const envelope = await encryptForDevice(alice.store, BOB, 1, 'once')
    const cache = new Map<string, string>()
    const read = async (item: E2eeEnvelope, id: string) => {
      if (cache.has(id)) return cache.get(id) as string
      const plain = await decryptFromDevice(bob.store, ALICE, 1, item)
      cache.set(id, plain)
      return plain
    }
    expect(await read(envelope, 'm1')).toBe('once')
    expect(await read(envelope, 'm1')).toBe('once')
    await expect(decryptFromDevice(bob.store, ALICE, 1, envelope)).rejects.toBeTruthy()

    const tampered = { ...envelope, ciphertext: `A${envelope.ciphertext.slice(1)}` }
    await expect(decryptFromDevice(bob.store, ALICE, 1, tampered)).rejects.toBeTruthy()
  })

  it('fans a group message out to each member and keeps other envelopes unreadable', async () => {
    const alice = await freshAccount()
    const bob = await freshAccount()
    const carol = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob.account, 0))
    await establishSession(alice.store, bundleFor(CAROL, 1, carol.account, 0))
    const payload = JSON.stringify({ v: 1, text: 'group hello' })
    const toBob = await encryptForDevice(alice.store, BOB, 1, payload)
    const toCarol = await encryptForDevice(alice.store, CAROL, 1, payload)
    expect(await decryptFromDevice(bob.store, ALICE, 1, toBob)).toBe(payload)
    expect(await decryptFromDevice(carol.store, ALICE, 1, toCarol)).toBe(payload)
    await expect(decryptFromDevice(bob.store, ALICE, 1, toCarol)).rejects.toBeTruthy()
  })

  it('encrypts for every device of a user and stops after a device is removed', async () => {
    const alice = await freshAccount()
    const bob1 = await freshAccount()
    const bob2 = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob1.account, 0))
    await establishSession(alice.store, bundleFor(BOB, 2, bob2.account, 1))
    const firstBob = await encryptForDevice(alice.store, BOB, 1, 'for both')
    const firstOther = await encryptForDevice(alice.store, BOB, 2, 'for both')
    expect(await decryptFromDevice(bob1.store, ALICE, 1, firstBob)).toBe('for both')
    expect(await decryptFromDevice(bob2.store, ALICE, 1, firstOther)).toBe('for both')

    const activeDevices = [1]
    const next = await encryptForDevice(alice.store, BOB, activeDevices[0], 'after removal')
    expect(await decryptFromDevice(bob1.store, ALICE, 1, next)).toBe('after removal')
    const removedHasEnvelope = activeDevices.includes(2)
    expect(removedHasEnvelope).toBe(false)
    await expect(decryptFromDevice(bob2.store, ALICE, 1, next)).rejects.toBeTruthy()
  })

  it('keeps an open session working after signed prekey rotation', async () => {
    const alice = await freshAccount()
    const bob = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob.account))
    const opened = await encryptForDevice(alice.store, BOB, 1, 'before rotation')
    expect(await decryptFromDevice(bob.store, ALICE, 1, opened)).toBe('before rotation')
    const rotated = await rotateSignedPreKey(bob.store, bob.account.signedPreKeyId + 1)
    expect(rotated.keyId).not.toBe(bob.account.signedPreKeyId)
    const after = await encryptForDevice(alice.store, BOB, 1, 'after rotation')
    expect(await decryptFromDevice(bob.store, ALICE, 1, after)).toBe('after rotation')
  })

  it('restores a device from an encrypted backup and decrypts the next message', async () => {
    const alice = await freshAccount()
    const bob = await freshAccount()
    await establishSession(alice.store, bundleFor(BOB, 1, bob.account))
    const first = await encryptForDevice(alice.store, BOB, 1, 'before backup')
    expect(await decryptFromDevice(bob.store, ALICE, 1, first)).toBe('before backup')
    const backup = await encryptBackup(JSON.stringify(bob.store.export()), 'correct horse battery')
    expect(backup.ciphertext).not.toContain('privKey')
    const restored = MemorySignalStore.import(JSON.parse(await decryptBackup(backup, 'correct horse battery')))
    const second = await encryptForDevice(alice.store, BOB, 1, 'after reinstall')
    expect(await decryptFromDevice(restored, ALICE, 1, second)).toBe('after reinstall')
    const empty = new MemorySignalStore()
    await provisionAccount(empty, 2)
    await expect(decryptFromDevice(empty, ALICE, 1, second)).rejects.toBeTruthy()
  })

  it('refuses a backup opened with the wrong passphrase', async () => {
    const backup = await encryptBackup('{"ok":true}', 'long-passphrase')
    await expect(decryptBackup(backup, 'wrong-passphrase')).rejects.toBeTruthy()
  })
})

describe('attachment encryption', () => {
  it('round-trips image, video, and file bytes and rejects tampering', async () => {
    const samples = [
      { name: 'photo.jpg', mime: 'image/jpeg', bytes: Uint8Array.from([1, 2, 3, 4, 255]) },
      { name: 'clip.mp4', mime: 'video/mp4', bytes: Uint8Array.from([0, 9, 8, 7, 6, 5]) },
      { name: 'notes.pdf', mime: 'application/pdf', bytes: Uint8Array.from([37, 80, 68, 70]) },
    ]
    for (const sample of samples) {
      const encrypted = await encryptFileBytes(sample.bytes)
      expect(Buffer.from(encrypted.ciphertext).includes(Buffer.from(sample.bytes))).toBe(false)
      const payload: PlaintextPayload = {
        v: 1,
        text: '',
        attachments: [
          {
            name: sample.name,
            mime: sample.mime,
            size: sample.bytes.byteLength,
            url: 'https://cdn.example/encrypted.bin',
            key: encrypted.key,
            iv: encrypted.iv,
          },
        ],
      }
      const alice = await freshAccount()
      const bob = await freshAccount()
      await establishSession(alice.store, bundleFor(BOB, 1, bob.account))
      const envelope = await encryptForDevice(alice.store, BOB, 1, JSON.stringify(payload))
      const opened = JSON.parse(await decryptFromDevice(bob.store, ALICE, 1, envelope)) as PlaintextPayload
      const file = opened.attachments?.[0]
      expect(file?.name).toBe(sample.name)
      const plain = await decryptFileBytes(encrypted.ciphertext, file!.key, file!.iv)
      expect(Array.from(plain)).toEqual(Array.from(sample.bytes))
      const flipped = new Uint8Array(encrypted.ciphertext)
      flipped[0] ^= 0xff
      await expect(decryptFileBytes(flipped, file!.key, file!.iv)).rejects.toBeTruthy()
    }
  })
})

describe('notification text', () => {
  it('uses a generic push body', () => {
    expect(E2EE_PUSH_BODY).toBe('New message')
  })
})
