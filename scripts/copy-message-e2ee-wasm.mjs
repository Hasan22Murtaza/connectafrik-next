/**
 * Copy the Matrix crypto WASM into /public so the browser can fetch it
 * without relying on Turbopack/webpack asset rules (Next.js 16 default).
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(
  root,
  'node_modules',
  '@matrix-org',
  'matrix-sdk-crypto-wasm',
  'pkg',
  'matrix_sdk_crypto_wasm_bg.wasm',
)
const destDir = join(root, 'public')
const dest = join(destDir, 'matrix_sdk_crypto_wasm_bg.wasm')

if (!existsSync(src)) {
  console.warn('[copy-message-e2ee-wasm] package wasm missing; skip copy:', src)
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log('[copy-message-e2ee-wasm] wrote', dest)
