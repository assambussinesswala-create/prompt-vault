// Server-side encryption for saved passwords and notes.
//
// Algorithm: AES-256-GCM (authenticated encryption).
// Key: VAULT_ENCRYPTION_KEY, a Base64 string that must decode to EXACTLY 32 bytes.
// The key only ever exists on the server. It is never sent to the browser,
// never logged and never has a fallback value.
//
// Stored format:  v1.<iv>.<authTag>.<ciphertext>   (each part is Base64URL)
// A fresh random 12-byte IV is generated for every single encryption.
// "Additional authenticated data" (AAD) ties every ciphertext to its owner, row and
// field, so a ciphertext copied to another row or user fails to decrypt.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { HttpError } from './errors.js'

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const KEY_HELP = 'VAULT_ENCRYPTION_KEY must be a Base64 string that decodes to exactly 32 bytes. Run "npm run generate-key" to create one.'

/**
 * Reads and validates the encryption key. Throws (fails safely) if it is missing or wrong.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Buffer}
 */
export function loadKey(env = process.env) {
  const raw = env.VAULT_ENCRYPTION_KEY
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new HttpError(500, 'Server setup needed: the VAULT_ENCRYPTION_KEY environment variable is missing. ' + KEY_HELP, 'KEY_MISSING')
  }
  const text = raw.trim()
  if (text.length % 4 !== 0 || !BASE64.test(text)) {
    throw new HttpError(500, 'Server setup needed: VAULT_ENCRYPTION_KEY is not valid Base64. ' + KEY_HELP, 'KEY_INVALID')
  }
  const key = Buffer.from(text, 'base64')
  if (key.length !== 32) {
    throw new HttpError(500, 'Server setup needed: VAULT_ENCRYPTION_KEY has the wrong length. ' + KEY_HELP, 'KEY_INVALID')
  }
  return key
}

/** Builds the AAD string that binds a ciphertext to its user, row and field. */
export function aadFor(userId, entryId, field) {
  return `pv1|${userId}|${entryId}|${field}`
}

/**
 * @param {string} plaintext
 * @param {string} aad
 * @param {Buffer} [key]
 * @returns {string}
 */
export function encryptSecret(plaintext, aad, key = loadKey()) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

/**
 * @param {string} payload value produced by encryptSecret
 * @param {string} aad
 * @param {Buffer} [key]
 * @returns {string}
 */
export function decryptSecret(payload, aad, key = loadKey()) {
  const fail = () => new HttpError(500, 'This saved value could not be decrypted. The encryption key may have changed, or the record is damaged.', 'DECRYPT_FAILED')
  if (typeof payload !== 'string') throw fail()
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') throw fail()
  try {
    const iv = Buffer.from(parts[1], 'base64url')
    const tag = Buffer.from(parts[2], 'base64url')
    const data = Buffer.from(parts[3], 'base64url')
    if (iv.length !== 12 || tag.length !== 16) throw fail()
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
    decipher.setAAD(Buffer.from(aad, 'utf8'))
    decipher.setAuthTag(tag) // final() throws if the tag does not match
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    throw fail()
  }
}
