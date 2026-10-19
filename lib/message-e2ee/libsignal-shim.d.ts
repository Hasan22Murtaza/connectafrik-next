declare module 'libsignal' {
  import type { Buffer } from 'buffer'

  export interface KeyPairType {
    pubKey: Buffer
    privKey: Buffer
  }

  export const keyhelper: {
    generateIdentityKeyPair: () => KeyPairType
    generateRegistrationId: () => number
    generateSignedPreKey: (
      identityKeyPair: KeyPairType,
      signedKeyId: number,
    ) => { keyId: number; keyPair: KeyPairType; signature: Buffer }
    generatePreKey: (keyId: number) => { keyId: number; keyPair: KeyPairType }
  }

  export class ProtocolAddress {
    constructor(name: string, deviceId: number)
    id: string
    deviceId: number
    toString(): string
    static from(encodedAddress: string): ProtocolAddress
  }

  export class SessionRecord {
    static deserialize(serialized: unknown): SessionRecord
    serialize(): unknown
    haveOpenSession(): boolean
  }

  export class SessionCipher {
    constructor(storage: unknown, remoteAddress: ProtocolAddress)
    decryptPreKeyWhisperMessage(ciphertext: Buffer): Promise<Buffer>
    decryptWhisperMessage(ciphertext: Buffer): Promise<Buffer>
    encrypt(data: Buffer): Promise<{ type: number; body: Buffer | string }>
  }

  export class SessionBuilder {
    constructor(storage: unknown, remoteAddress: ProtocolAddress)
    initOutgoing(session: unknown): Promise<void>
  }
}

declare module 'libsignal/src/numeric_fingerprint' {
  export class FingerprintGenerator {
    constructor(iterations: number)
    createFor(
      localIdentifier: string,
      localIdentityKey: ArrayBuffer,
      remoteIdentifier: string,
      remoteIdentityKey: ArrayBuffer,
    ): Promise<string>
  }
}
