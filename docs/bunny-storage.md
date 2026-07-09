# Bunny.net Storage & CDN

ConnectAfrik stores all user-uploaded media (images, videos, audio, chat
attachments) in a **Bunny.net Storage Zone** and serves it back through a
**Bunny.net Pull Zone (CDN)**. This replaces the previous Backblaze B2 setup.

Only the public CDN URL is ever stored in the database.

---

## 1. Architecture at a glance

```
Browser (Client Component)
  │  XMLHttpRequest (with upload progress)
  │  POST /api/upload?folder=…&filename=…   body = raw file bytes
  ▼
Next.js Route Handler  (app/api/upload/route.ts)   ← holds the SECRET access key
  │  validates Supabase auth token
  │  streams the body straight to Bunny Storage
  ▼
Bunny.net Storage Zone   (write side, private)
  ▲
  │  origin pull
Bunny.net Pull Zone / CDN   (read side, public)  ──►  served to all users
```

- **Write path** goes through our own server so the Storage Zone Access Key
  never reaches the browser.
- **Read path** is the public Pull Zone CDN — fast, cached, global, great for
  video streaming with low buffering.
- We **store only the CDN URL** (e.g. `https://…b-cdn.net/reels/…/clip.mp4`).

Key files:

| File | Responsibility |
|------|----------------|
| `lib/bunny.ts` | Server-only Bunny Storage client (upload/delete/URL helpers). |
| `app/api/upload/route.ts` | Authenticated upload endpoint (streams to Bunny). |
| `app/api/upload/delete/route.ts` | Authenticated delete endpoint. |
| `shared/lib/uploadClient.ts` | Browser helper using XHR for upload progress. |
| `shared/hooks/useFileUpload.ts` | General upload hook (avatars/images/videos/audio). |
| `shared/hooks/useImageUpload.ts` | Image-focused hook with progress + compression. |
| `shared/services/fileUploadService.ts` | Chat attachment uploads. |

---

## 2. One-time Bunny.net setup

### Step 1 — Create a Storage Zone
1. Bunny dashboard → **Storage** → **Add Storage Zone**.
2. Name it (e.g. `connectafrik-media`). → `BUNNY_STORAGE_ZONE_NAME`.
3. Choose the **main storage region** closest to your users. The region sets the
   storage hostname; put its code in `BUNNY_STORAGE_REGION` (leave empty for the
   default Falkenstein/DE region).
4. Open the zone → **FTP & API Access** → copy the **Password**.
   → `BUNNY_STORAGE_ACCESS_KEY` (**secret**).

### Step 2 — Create a Pull Zone (CDN)
1. Bunny dashboard → **CDN** → **Add Pull Zone**.
2. **Origin type:** `Storage Zone` → select the zone from Step 1.
3. Bunny assigns a hostname like `connectafrik-media.b-cdn.net`. Optionally
   attach a custom domain (e.g. `media.connectafrik.com`).
4. The full base URL (`https://connectafrik-media.b-cdn.net` or your custom
   domain) → `NEXT_PUBLIC_BUNNY_CDN_URL`.

### Region code → storage hostname

| `BUNNY_STORAGE_REGION` | Hostname |
|------------------------|----------|
| _(empty)_ / `de` | `storage.bunnycdn.com` |
| `uk` | `uk.storage.bunnycdn.com` |
| `ny` | `ny.storage.bunnycdn.com` |
| `la` | `la.storage.bunnycdn.com` |
| `sg` | `sg.storage.bunnycdn.com` |
| `se` | `se.storage.bunnycdn.com` |
| `br` | `br.storage.bunnycdn.com` |
| `jh` | `jh.storage.bunnycdn.com` |
| `syd` | `syd.storage.bunnycdn.com` |

You can bypass the table with an explicit `BUNNY_STORAGE_HOST`.

---

## 3. Environment variables

Add these to `.env` (local) and to your hosting provider's env settings
(production). See `.env.example` for the full template.

| Variable | Public? | Description |
|----------|---------|-------------|
| `BUNNY_STORAGE_ZONE_NAME` | server | Storage Zone name. |
| `BUNNY_STORAGE_ACCESS_KEY` | **server (secret)** | Storage Zone password. |
| `BUNNY_STORAGE_REGION` | server | Region code (empty = DE default). |
| `BUNNY_STORAGE_HOST` | server | Optional explicit storage hostname override. |
| `NEXT_PUBLIC_BUNNY_CDN_URL` | public | Pull Zone (CDN) base URL. |

> The access key is **only** read inside `lib/bunny.ts`, which runs server-side.
> Never expose it via a `NEXT_PUBLIC_` variable or import `lib/bunny.ts` from a
> Client Component.

After changing env vars, restart `next dev`. `NEXT_PUBLIC_BUNNY_CDN_URL` is also
read in `next.config.ts` to allow `next/image` to serve CDN images.

---

## 4. Upload & delivery flow (what actually happens)

**Upload**
1. A component calls `uploadFile()` / `uploadImage()` / `fileUploadService.uploadFiles()`.
2. The browser helper (`shared/lib/uploadClient.ts`) attaches the Supabase
   access token and `POST`s the **raw file** to `/api/upload?folder=…&filename=…`
   using `XMLHttpRequest`, reporting progress through `upload.onprogress`.
3. `app/api/upload/route.ts` authenticates the user, builds a collision-safe
   storage path (`{folder}/{userId}/{year}/{month}/{timestamp}_{rand}.{ext}`),
   and **streams** the body to the Bunny Storage Zone via `PUT` with the
   `AccessKey` header.
4. The route returns the **public CDN URL**, which the caller stores in the DB.

**Delivery**
- Clients load the stored CDN URL directly. Bunny's Pull Zone caches and serves
  it globally; videos stream with HTTP range requests for fast, low-buffer
  playback.

**Delete**
- `deleteFileFromBunny(url)` → `POST /api/upload/delete` → `DELETE` on the
  Storage Zone. A missing object (404) is treated as already-deleted.

---

## 5. Large video uploads

- Uploads stream through the server, so memory use stays low even for large
  files. Per-bucket size caps live in `useFileUpload.ts` (videos default 500MB).
- **Serverless body limits:** some platforms cap request body size (e.g. Vercel
  ~4.5MB per invocation). For large videos either:
  - run `/api/upload` on infrastructure without that cap (Node server /
    container), or
  - raise the platform's body-size limit, or
  - move very large video to **Bunny Stream** (TUS resumable uploads) — out of
    scope for this Storage integration.
- `maxDuration` for the upload route is set to 300s; adjust to your plan.

Locally (`next dev`) there is no body-size cap, so any size up to the configured
limits uploads fine.
