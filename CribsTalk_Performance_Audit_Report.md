# CribsTalk Performance Audit Report

**Date:** 2026-11-10  
**Scope:** Full-stack audit of https://cribstalk.com/ (Next.js 16 + Supabase) and safe optimizations in this repository  
**Build verification:** `npx tsc --noEmit` ✅ · `npm run build` ✅  

---

## A. Executive Summary

CribsTalk’s main performance cost is not the public landing HTML (TTFB ~320–470 ms on production). It is the **authenticated application shell**: duplicated badge/profile GETs, global chat/call providers, idle preload of VideoSDK/CallModal, oversized `SELECT *` payloads, and call-session polling fan-out.

### Major problems identified

1. **N× `GET /api/users/me`** — every `useProfile()` mount fetched independently with `cache: 'no-store'`.
2. **Duplicate inbox / friend-request badge hooks** — Header + LeftSidebar each fetched and subscribed.
3. **Active-call polling** — up to **30** `GET …/call-sessions?active=1` every **20s** on all authenticated routes.
4. **Idle preload of `@videosdk.live/js-sdk` + `CallModal`** (both VideoSDK and LiveKit) on every login.
5. **Feed wasted work** — `FeedLayout` fetched friend suggestions that `RightSidebar` never rendered (inline `PeopleYouMayKnow` already fetches).
6. **Oversized API payloads** — posts `SELECT *` + author `banner_image`; notifications `SELECT *` up to limit 200; message attachments `SELECT *`.
7. **Font/CSS waste** — Poppins weights 100–900 + italic; unused `slick-carousel` CSS on every page.
8. **Firebase/FCM** statically imported via `AuthContext` on all routes.

### Most important optimizations (implemented)

| Priority | Change | Expected impact |
|---|---|---|
| P0 | Shared profile + GET in-flight/TTL cache | Cuts duplicate `/users/me` and badge GETs |
| P0 | Singleton inbox counts store | One unread/missed fetch + one realtime channel |
| P0 | Gate call-session fan-out to `/chat` + 60s fallback | Removes ≤30×/20s polls from feed/settings |
| P0 | Stop idle VideoSDK/CallModal preload | Less JS contention on first authenticated paint |
| P1 | Narrow posts/notifications/attachments selects | Smaller payloads, less DB I/O |
| P1 | Trim fonts; drop slick CSS; lazy FCM | Smaller critical CSS/JS path |
| P1 | Remove dead suggestions fetch; stories page size 25 | Fewer round-trips |

**Security note:** No RLS, auth, E2EE, LiveKit/VideoSDK call logic, or parental-control gates were removed. Unused APIs were **not** deleted (mobile/external consumers may still use them).

---

## B. Website Performance

### Measurement method

- **Before (production):** `curl.exe` + Chrome DevTools Protocol on https://cribstalk.com/ (2026-11-10).
- **After (local optimized build):** `npm run build` + `next start -p 5010`, then same CDP/curl against `http://127.0.0.1:5010/`.
- Localhost TTFB is **not** comparable to Cloudflare/production TTFB. Production CWV **after** deploy is **not yet measured**.

| Metric | Before (cribstalk.com) | After (local :5010) | Notes |
|---|---|---|---|
| Initial Load (nav `loadEvent`) | ~376–892 ms | ~199 ms | Environments differ; do not treat as % win |
| TTFB (HTML) | ~320–472 ms | ~4–27 ms | Localhost vs edge — not comparable |
| FCP | ~428–748 ms | ~196 ms | Local only after optimize |
| LCP | Not captured in automation | Not captured | Needs field/RUM or Lighthouse CI post-deploy |
| INP | Not measured (needs interaction) | Not measured | Requires authenticated UX lab |
| CLS | 0.0 | 0.0 | Stable on landing |
| Bundle Size | Poppins 9 weights + italic; slick CSS global; FCM eager | Poppins 6 normal weights; slick removed; FCM dynamic; no idle CallModal/VideoSDK | Verified by code + successful production build |

**Honest claim:** Verified improvements are **request fan-out reduction**, **payload narrowing**, and **bundle/preload removal**. Live Core Web Vitals deltas require a production deploy + Lighthouse/CrUX.

---

## C. API Audit

**Inventory:** 211 `app/api/**/route.ts` files · ~279 HTTP handlers.

| Endpoint | Status | Response Time | Payload Size | Recommendation |
|---|---|---|---|---|
| `GET /api/users/me` | Active / inefficient | High frequency (multi-mount) | Full `profiles.*` + 5 counts | **Implemented:** shared `useProfile` + 30s TTL/dedupe. Next: optional lite fields / skip counts |
| `PATCH /api/users/me` (presence) | Active / inefficient | ~45–60s heartbeat | Full profile return path | Prefer dedicated `PATCH /api/users/me/presence` (exists) |
| `GET …/call-sessions?active=1` | Active / inefficient | Was ≤30×/20s | Session + metadata | **Implemented:** `/chat` only + 60s fallback; keep realtime |
| `GET /api/chat/unread-count` | Active / duplicate | Multi-mount | Small | **Implemented:** singleton store + 5s TTL |
| `GET /api/chat/calls/missed-count` | Active / duplicate | Multi-mount | Small | **Implemented:** singleton store + 5s TTL |
| `GET /api/friends/requests/count` | Active / duplicate | Multi-mount | Small | **Implemented:** shared hook + 10s TTL |
| `GET /api/notifications/unread-count` | Active / required | Per header | Small | Keep; rely on TTL + realtime |
| `GET /api/posts` | Active / inefficient | Feed hot path | Was `*` + banner | **Implemented:** explicit columns; drop author banner |
| `GET /api/chat/threads/*/messages` | Active / inefficient | Chat hot path | `*` + attachments `*` | **Implemented:** narrow attachments; messages `*` still TODO |
| `GET /api/notifications` | Active / inefficient | Dropdown/page | `*` up to 200 | **Implemented:** explicit cols; max limit 50 |
| `GET /api/friends/suggestions` | Active / duplicate on feed | Feed | Medium | **Implemented:** removed dead FeedLayout fetch |
| `GET /api/friends` | Active / required | Feed sidebar | Medium–large | Keep; short TTL |
| `GET /api/stories` | Active / inefficient | Stories bar walk | Small pages (limit 5) | **Implemented:** client page size 25 |
| `GET /api/family/me` | Active / required | 30s + 60s polls | Medium | Consolidate ScreenTimeGate + parental pollers (remaining) |
| `GET /api/search/global` | Active / required | Debounced | Medium | **Implemented:** AbortSignal wired |
| `POST /api/auth/sessions/heartbeat` | Active / low traffic | Devices settings | Small | OK |
| Call stack polls 4s/8s/15s/25s | Active / overlapping | During calls | Medium | Remaining: collapse to one poller when realtime up |

---

## D. Unused API Report

Checked outside `app/api/**`. Dynamic `/api/…/${id}` callers count as used. **Do not delete** without mobile/Capacitor/webhook review.

| Endpoint / symbol | References checked | Safe to remove? |
|---|---|---|
| `POST /api/links` | No web/service callers found | **No** — may be mobile/external |
| `PATCH /api/users/me/presence` | Route exists; web uses `PATCH /api/users/me` | Keep; migrate client later |
| `GET /api/users/[identifier]/connections` | Profile UI uses `/friends` | Candidate deprecate after mobile check |
| `GET /api/reels/stats` | Deprecated re-export; clients use `/analytics` | Candidate deprecate |
| Chat transcript routes | `lib/chat/chatTranscript.ts` only; no UI | Keep for admin/export |
| `BatchEventLogger` class | Unused; `trackEvent` still hits `/api/engagement` | Dead code candidate only |
| FCM / push-notifications / well-known | Server/native | Required |

---

## E. Database Optimization

### Findings (code + migrations review; no production `EXPLAIN` access)

| Area | Issue | Recommendation |
|---|---|---|
| `posts` feed | Was selecting all columns + author banner | Explicit feed columns (done) |
| `notifications` | `select('*')`, large pages | Explicit columns + max 50 (done) |
| `message_attachments` | `select('*')` | Explicit file fields (done) |
| `chat_messages` | Still `MESSAGE_SELECT = *` | Next: explicit E2EE-safe column list |
| `call_sessions` | Many `select('*')` including growing `metadata` | Narrow for active/list endpoints |
| `profiles` `/users/me` | `select('*')` + 5 count heads every time | Lite endpoint or `include_counts=0` |
| Indexes | Reels/family/reports well indexed in migrations | Confirm composite indexes: `notifications(user_id, is_read, created_at DESC)`, `chat_participants(user_id)`, `friend_requests(receiver_id, status)`, `call_sessions(status, updated_at)` in staging |
| RLS | Privacy policies on reads are correct but can be expensive | Prefer service-role scoped queries already used in hot APIs; avoid changing policy semantics for speed |
| N+1 | Call-session per-thread active checks | Batch `GET /api/chat/calls/active` (remaining) |

**No schema migrations applied** in this pass (per safety rules).

---

## F. Background Request Analysis

| Pattern | Before | After / status |
|---|---|---|
| Inbox unread + missed (Header + Sidebar) | 2× fetch + 2× realtime channels | **Singleton store** — one fetch/channel |
| Friend request badge | 2–3× mounts | **Shared hook** + TTL |
| `useProfile` | N independent fetches | **Shared module cache** |
| Active call indicators | ≤30 GETs / 20s app-wide | **`/chat` only**, 60s fallback + realtime |
| Idle VideoSDK + CallModal preload | On every auth session | **Removed** (only light `callWindow` warm) |
| Presence PATCH | 45s / ≥60s | Unchanged (safe; migrate to `/presence` later) |
| Family `GET /family/me` | 30s + 60s overlapping | Remaining: single poller |
| In-call polls 4/8/15/25s | Overlap with realtime | Remaining: collapse |
| Search AbortController | Created but unused | **Wired** through `apiClient` |
| FCM/Firebase | Static import from Auth | **Dynamic import** on login/logout |

---

## G. Changes Implemented

### New files
- `lib/request-cache.ts` — in-flight GET dedupe + short TTL for hot endpoints  
- `shared/hooks/inboxCountsStore.ts` — singleton unread/missed badge store  
- `CribsTalk_Performance_Audit_Report.md` — this report  

### Modified files
- `lib/api-client.ts` — cache/dedupe, `AbortSignal`, mutation cache invalidation  
- `shared/hooks/useProfile.ts` — shared profile loader  
- `shared/hooks/useHeaderInboxCounts.ts` — uses singleton store  
- `shared/hooks/useSpaceNavCounts.ts` — shared friend-request count  
- `shared/hooks/useSearch.ts` / `shared/services/searchService.ts` — abort support  
- `shared/components/layout/FeedLayout.jsx` — removed unused suggestions fetch  
- `shared/components/ui/RightSidebar.jsx` — removed unused import/prop  
- `contexts/ProductionChatContext.tsx` — chat-scoped call polls; no VideoSDK idle preload  
- `contexts/AuthContext.tsx` — dynamic FCM import  
- `app/layout.tsx` — trim Poppins; remove slick CSS  
- `app/api/posts/format-posts-response.ts` — narrower `POST_SELECT`  
- `app/api/notifications/route.ts` — explicit columns; max limit 50  
- `app/api/chat/threads/[threadId]/messages/route.ts` — narrow attachments  
- `app/api/chat/threads/[threadId]/messages/[messageId]/route.ts` — narrow attachments  
- `app/api/chat/threads/[threadId]/messages/[messageId]/info/route.ts` — narrow reads/attachments  
- `features/social/services/storiesService.ts` — stories page size 25  

---

## H. Before vs After Comparison

### Verified (this session)

| Check | Result |
|---|---|
| TypeScript | `tsc --noEmit` exit 0 |
| Production build | `npm run build` exit 0 |
| Landing HTML (prod) | 200, TTFB ~0.32–0.47 s, ~90 KB body |
| Landing HTML (local optimized) | 200, serves correctly |
| Request architecture | Duplicate profile/badge paths collapsed in code |
| Call-session background fan-out | Disabled off `/chat` |
| Heavy call SDK preload | Removed from idle path |

### Not yet verified (needs deploy + auth lab)

- Production LCP / INP / CrUX  
- Authenticated feed waterfall in Network panel  
- Mobile API consumers against narrowed selects (attachments/posts/notifications — fields kept compatible)  
- Call UX regression on `/chat` with realtime-only + 60s fallback  

### Expected authenticated feed request reduction (structural)

| Request class | Before (typical feed shell) | After |
|---|---|---|
| `GET /users/me` | 4–8+ parallel | 1 shared (+ TTL) |
| Unread + missed | 2× each | 1× each |
| Friend request count | 2–3× | 1× |
| Friend suggestions | FeedLayout + PeopleYouMayKnow | PeopleYouMayKnow only |
| Active call-sessions | ≤30 / 20s always | 0 off `/chat` |

---

## I. Remaining Issues

1. **`ProductionChatProvider` still global** — chat realtime/state loads for non-chat pages.  
2. **In-call overlapping polls** (4s/8s/15s/25s) still stack.  
3. **`MESSAGE_SELECT = *`** and call-session `select('*')` still oversized.  
4. **Family ScreenTimeGate + parental controls** still double-poll `/family/me`.  
5. **No batch active-calls API** — still N thread GETs on `/chat`.  
6. **Landing still uses many raw `<img>`** — `next/image` opportunity.  
7. **`ChatWindow` ~4k LOC** — not yet dynamically imported from chat layout.  
8. **Production CWV after deploy** not measured.  
9. **Database index confirmation** needs staging `EXPLAIN ANALYZE`.  
10. Pre-existing ESLint issues in `AuthContext` / `ProductionChatContext` (`any`, refs) untouched except new-code cleanup.

---

## J. Recommendations (prioritized)

1. **Deploy this branch** and re-run Lighthouse (mobile + desktop) on landing, `/signin`, authenticated `/feed`, `/chat`.  
2. Add **`GET /api/chat/calls/active`** (batch) and delete per-thread active polling.  
3. Collapse **in-call session pollers** to one interval when realtime is healthy.  
4. Introduce **`GET /api/users/me?lite=1`** (id, username, avatar, status, privacy flags) for shell mounts.  
5. Dynamic-import **`ChatWindow`** and split media/call drawers.  
6. Route-split **chat provider** so feed does not pay full messaging bootstrap.  
7. Confirm/add DB indexes listed in §E; add notification page cap already done client-side.  
8. Migrate presence client to **`/api/users/me/presence`**.  
9. Add SWR/React Query **or** expand `request-cache` TTLs carefully for feed/posts.  
10. After mobile QA, deprecate orphan endpoints in §D.

---

## Appendix — Baseline raw samples

**Production curl (2026-11-10):**
```
home_code:200 ttfb:0.472400s total:0.511675s size:89644
feed_code:307 ttfb:0.427614s total:0.427700s size:46
```

**Production CDP (landing):**
```
ttfb_ms≈320–360, fcp_ms≈428–748, cls=0, load_ms≈376–892
```

**Local optimized curl:**
```
local_home_code:200 ttfb:0.027s total:0.027s size:85738
```
