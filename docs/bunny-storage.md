# Bunny.net Storage & CDN

ConnectAfrik stores all user-uploaded media (images, videos, audio, chat
attachments) in a **Bunny.net Storage Zone** and serves it back through a
**Bunny.net Pull Zone (CDN)**. This replaces the previous Backblaze B2 setup.

Only the public CDN URL is ever stored in the database.

---

## 1. Architecture at a glance

Large files never pass through Next.js. The browser uploads directly to Bunny
using a short-lived, path-scoped S3 presigned URL. Next.js only authorizes the
upload. Callers then store the CDN URL in `chat_messages`, posts, reels,
profiles, and so on — same as before.

```
Browser
  │  1. Request upload authorization
  ▼
Next.js API   POST /api/upload/authorize
  │  2. Auth user, assign path, issue S3 presigned credentials
  ▼
Browser
  │  3. PUT file directly (XHR progress)
  ▼
Bunny.net Storage (S3 API)
  │  4. Upload completed
  ▼
Chat / post / reel / profile create  →  save CDN URL in the database
```

- **Write path:** browser → Bunny. The Storage Zone password never leaves the server.
- **Credentials:** AWS Signature V4 presigned PUT. Each URL is bound to one
  object key and expires in 1 hour.
- **Read path:** public Pull Zone CDN.
- **Stored in DB:** only the public CDN URL.

Key files:

| File | Responsibility |
|------|----------------|
| `lib/bunny.ts` | Path helpers, CDN URLs, server-side HTTP upload/delete. |
| `lib/bunny-s3.ts` | S3 presigned PUT URLs. |
| `app/api/upload/authorize/route.ts` | Auth + issue upload credentials. |
| `app/api/upload/delete/route.ts` | Authenticated delete. |
| `shared/lib/uploadClient.ts` | Browser: authorize → direct PUT to Bunny. |
| `shared/hooks/useFileUpload.ts` | Avatars / images / videos / audio. |
| `shared/hooks/useImageUpload.ts` | Image uploads with compression. |
| `shared/services/fileUploadService.ts` | Chat attachments. |

---

## 2. One-time Bunny.net setup

### Step 1 — Create a Storage Zone
1. Bunny dashboard → **Storage** → **Add Storage Zone**.
2. Name it (e.g. `connectafrik-media`). → `BUNNY_STORAGE_ZONE_NAME`.
3. **Enable S3 Compatibility.** Direct browser uploads use Bunny's S3 API
   (presigned URLs). This must be turned on when the zone is created; it cannot
   be added to an existing zone yet.
4. Choose a region that supports S3: `de`, `uk`, `ny`, `la`, `sg`, `se`, `jh`,
   or `syd`. Put the code in `BUNNY_STORAGE_REGION` (leave empty for `de`).
5. Open the zone → **FTP & API Access** → copy the **Password**.
   → `BUNNY_STORAGE_ACCESS_KEY` (**secret**). S3 uses the zone name as Access
   Key ID and this password as Secret Access Key.

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
| `BUNNY_S3_ENDPOINT` | server | Optional S3 endpoint override (default `https://{region}-s3.storage.bunnycdn.com`). |
| `NEXT_PUBLIC_BUNNY_CDN_URL` | public | Pull Zone (CDN) base URL. |

> The access key is **only** read inside `lib/bunny.ts` / `lib/bunny-s3.ts`,
> which run server-side. Never expose it via a `NEXT_PUBLIC_` variable or import
> those modules from a Client Component. Presigned URLs are the only write
> credentials the browser receives, and they are limited to one path.

After changing env vars, restart `next dev`. `NEXT_PUBLIC_BUNNY_CDN_URL` is also
read in `next.config.ts` to allow `next/image` to serve CDN images.

---

## 4. Upload & delivery flow (what actually happens)

**Upload**
1. A component calls `uploadFile()` / `uploadImage()` / `fileUploadService.uploadFiles()`.
2. `shared/lib/uploadClient.ts` asks `POST /api/upload/authorize` for credentials
   (`folder`, `filename`, `contentType`) with the Supabase access token.
3. Next.js authenticates the user, checks the folder whitelist, builds a
   collision-safe path (`{folder}/{userId}/{year}/{month}/{timestamp}_{rand}.{ext}`),
   and returns a presigned PUT URL plus the public CDN URL.
4. The browser uploads **directly to Bunny** with `XMLHttpRequest` (progress
   via `upload.onprogress`).
5. The caller saves that CDN URL in `chat_messages.attachments`, `posts.media_urls`,
   reels, avatars, products, etc.

**Delivery**
- Clients load the stored CDN URL directly. Bunny's Pull Zone caches and serves
  it globally; videos stream with HTTP range requests for fast, low-buffer
  playback.

**Delete**
- `deleteFileFromBunny(url)` → `POST /api/upload/delete` → `DELETE` on the
  Storage Zone. A missing object (404) is treated as already-deleted.

Server-side exceptions (feedback screenshots) still use `uploadToBunny()` in
`lib/bunny.ts` because those files are already on the server.

---

## 5. Large video uploads

The file goes straight from the browser to Bunny on a single presigned PUT, so
Next.js body-size limits do not apply. There is no app-level video size cap.
