# Prompt Vault PK

Links, encrypted passwords and AI prompts in one secure vault.

| Part | What it does | Where data lives |
|---|---|---|
| **Link Saver** | Save, search, edit and delete website links | Cloud database (Neon Postgres), per user |
| **Password Saver** | Save website logins. Passwords and notes are encrypted | Cloud database, per user |
| **Prompt library** | The original prompt manager (import, export, backup) | This browser only (`localStorage`) |

**Tech:** React + TypeScript + Vite + Tailwind (frontend), Vercel Functions in `/api` (backend), Clerk (sign-in), Neon Postgres (database).

---

## 1. How security works (plain English)

1. **Sign-in is handled by Clerk.** The browser sends a short-lived signed token with every request. The server verifies it on **every** request and takes the user id from the token, never from the request body.
2. **Every database query is limited to that user** (`WHERE user_id = ...`). Asking for someone else's record returns "not found". This is checked on the server, not just in the page.
3. **Passwords and notes are encrypted on the server with AES-256-GCM** using the secret `VAULT_ENCRYPTION_KEY`.
   - A new random 12-byte IV is used for every encryption.
   - The auth tag is checked when decrypting, so tampered data is rejected.
   - Each ciphertext is tied to its user, row and field, so copying it to another row or user fails.
4. **The key never reaches the browser.** It only exists in Vercel's environment variables. The server refuses to start saving passwords if the key is missing, is not valid Base64, or does not decode to exactly 32 bytes. There is no fallback key.
5. **The password list never contains passwords.** A password is decrypted only when you click the eye or copy button (`/api/reveal`, rate limited to 30 per minute). A shown password hides itself after 30 seconds. Copying a password does not keep it in page state.
6. Other protections: input validation (only `http`/`https` links; `javascript:` is rejected), rate limits on all endpoints, `no-store` caching on API responses, no request bodies in logs, no source maps, security headers, `rel="noopener noreferrer"` on external links.

### Honest limits (please read)

- **This is not zero-knowledge.** Because the server holds the key, anyone who can read **both** your database **and** your Vercel environment variables (for example you, as the owner, or someone who breaks into your Vercel account) could decrypt the passwords. Protect your Vercel, Neon and Clerk accounts with strong passwords and 2-step verification.
- **Usernames, emails, website names and URLs are not encrypted** (so search works). Passwords and notes are.
- **If you lose `VAULT_ENCRYPTION_KEY`, saved passwords cannot be recovered.** Keep a backup copy in a password manager. Do **not** change the key later, or old passwords will fail to decrypt. (Key rotation is not built in.)
- Copying to the clipboard means the password sits in your clipboard until you copy something else.
- There is no Content-Security-Policy header yet (Clerk needs several domains; a wrong policy would break sign-in).
- Your **prompt library is not synced**. It stays in this browser, as before. Use *Export and Backup*.

---

## 2. One-time setup

You need free accounts at **GitHub**, **Vercel**, **Clerk** and **Neon**.

### A. Clerk (sign-in)
1. Go to clerk.com, create an application, choose Email (and anything else you like).
2. Open **API Keys**. Copy the **Publishable key** (`pk_...`) and the **Secret key** (`sk_...`).

### B. Neon (database)
1. Go to neon.tech, create a project.
2. Copy the **connection string** (`postgresql://...`). This is `DATABASE_URL`.
3. Create the tables. Easiest way: open Neon's **SQL Editor**, paste the whole file `db/schema.sql`, press **Run**. (Safe to run again.)
   Or from your computer: `DATABASE_URL="postgresql://..." npm run db:migrate`

### C. Encryption key
Run this on your computer (after `npm install`):
```
npm run generate-key
```
It prints one line of letters and numbers. That is your `VAULT_ENCRYPTION_KEY`. **Save a backup copy somewhere private.** Do not paste it in chat, GitHub or code.

---

## 3. Put it on GitHub

1. Create an empty repository on github.com (no README).
2. In the project folder:
```
npm install
git init
git add .
git commit -m "Prompt Vault PK"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
git push -u origin main
```
`.env` files are listed in `.gitignore`, so your secrets are not uploaded. Before pushing, run `git status` and make sure no `.env.local` file is listed.

## 4. Deploy on Vercel

1. On vercel.com choose **Add New → Project** and import your GitHub repository. (Or open your existing `prompt-vaultpk` project and connect it to this repository.)
2. Vercel detects Vite. Leave the defaults (the build command is set in `vercel.json`).
3. Open **Environment Variables** and add these four. Apply to Production, Preview and Development:

| Name | Value | Secret? |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | public |
| `CLERK_SECRET_KEY` | Clerk secret key | **secret** |
| `DATABASE_URL` | Neon connection string | **secret** |
| `VAULT_ENCRYPTION_KEY` | output of `npm run generate-key` | **secret** |

4. Click **Deploy**. (If you add or change variables later, **redeploy**.)
5. In Clerk → **Domains/Paths**, make sure your Vercel address (for example `prompt-vaultpk.vercel.app`) is allowed.
6. Open `https://YOUR-SITE.vercel.app/api/health`. You should see `"ok": true`. If something says `missing` or `invalid`, that is the variable to fix. It never shows secret values.
7. Visit your site, create an account, and try adding a link and a password.

Use **Production** keys from Clerk for your real site (switch the Clerk app to production), not the `pk_test` ones.

## 5. Run on your computer

```
npm install
cp .env.example .env.local      # then fill in real values
npx vercel dev                  # runs the website AND the /api functions
```
`npm run dev` alone only runs the pages, not `/api`, so links and passwords will not load.

Commands: `npm run build` (type-check + build), `npm test` (prompt-library tests + server security tests), `npm run typecheck`.

## 6. Project map

```
api/                 Vercel Functions (plain JavaScript, ES modules)
  links.js           list / create / update / delete links
  passwords.js       list / create / update / delete password entries (encrypts)
  reveal.js          decrypts ONE password or notes value for its owner
  health.js          setup check (no secrets)
  _lib/crypto.js     AES-256-GCM + key validation
  _lib/auth.js       verifies the Clerk token
  _lib/http.js       method check, auth, rate limit, safe errors
  _lib/validate.js   input validation
db/schema.sql        database tables
scripts/             generate-key.mjs, migrate.mjs
test/                server tests (node --test)
src/pages/           Dashboard, Links, Passwords, Settings, + original prompt pages
src/lib/api.ts       browser helper that calls /api with the session token
```

## 7. Troubleshooting

| Message | Fix |
|---|---|
| "One setup step is missing" page | `VITE_CLERK_PUBLISHABLE_KEY` is not set. Add it and redeploy. |
| "VAULT_ENCRYPTION_KEY ... missing / wrong length" | Add it in Vercel, run `npm run generate-key` if you need a new one, redeploy. |
| `/api/health` shows `database: error` | Check `DATABASE_URL`, and that `db/schema.sql` was run. |
| "Could not be decrypted" | The key was changed. Restore the original key from your backup. |
| Links/passwords never load locally | Use `npx vercel dev`, not `npm run dev`. |

## 8. Prompt library (original features, unchanged)

Import `.txt`/`.md`/`.json`/ChatGPT exports, categories, favorites, search, Markdown/JSON export, and backup/restore all work as before. The backup file format (`prompt-vault-backup`) is unchanged, so old backups still restore. Storage keys (`promptvault:v1:*`) are unchanged, so existing prompts in your browser are kept.
