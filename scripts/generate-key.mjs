// Prints a new random 32-byte key (Base64) for VAULT_ENCRYPTION_KEY.
// Copy it into Vercel -> Settings -> Environment Variables. Do NOT commit it to GitHub.
import { randomBytes } from 'node:crypto'
console.log(randomBytes(32).toString('base64'))
