# Deep Linking & Sharing — ConnectAfrik

End-to-end deep linking for the Next.js web app and the Capacitor iOS/Android
apps: account activation, email/OTP verification, password reset, social login
redirects, and opening specific screens from shared links.

---

## 1. Architecture

```
                       ┌──────────────────────────────────────────┐
                       │  https://connectafrik.com/<path>          │
   Shared link  ─────► │  (canonical Universal / App Link)         │
                       └───────────────┬──────────────────────────┘
                                       │
                 app installed?        │
            ┌──────────────────────────┴──────────────────────────┐
            │ YES                                                   │ NO
            ▼                                                       ▼
   OS hands URL to the app                              Browser loads the website
   (iOS Universal Link /                                normally (SSR page renders).
    Android App Link)                                   For "Open in app" buttons we
            │                                           use /open which detects the
            ▼                                           device and falls back to the
   Capacitor App.appUrlOpen                             App Store / Play Store, and
   → DeepLinkHandler.tsx                                remembers the destination for
   → Next.js router push                                after install (deferred link).
```

**Key principle:** every shareable URL is just a normal HTTPS URL on our own
domain (`https://connectafrik.com/post/123`). The OS decides whether to open the
app. This means links always work — in email, SMS, social media, and browsers —
with zero third-party dependency (no Firebase Dynamic Links / Branch required).

### Layers

| Layer | File(s) | Responsibility |
|-------|---------|----------------|
| Config | `lib/deeplink/config.ts` | Env-aware values: base URL, scheme, bundle/team/package ids, store URLs, signing secret. |
| Builders | `lib/deeplink/links.ts` | Build + validate links (allowlist), Universal / scheme / resolver URLs. Isomorphic. |
| Signing | `lib/deeplink/links.server.ts` | HMAC-sign + verify time-limited tokens for sensitive links. Server only. |
| Association files | `app/api/well-known/*` + `next.config.ts` rewrites | Serve AASA + `assetlinks.json` at `/.well-known/*`. |
| Resolver | `app/open/page.tsx` + `app/open/OpenClient.tsx` | Device detection, app-open attempt, store fallback, deferred link. |
| Generator API | `app/api/links/route.ts` | Authenticated dynamic link generation (optionally signed). |
| Native bridge | `app/components/DeepLinkHandler.tsx` | In Capacitor, turn inbound URLs into Next.js navigation. |
| Native config | `capacitor.config.ts`, `docs/deep-linking/{ios,android}/*` | Associated Domains, intent filters, custom scheme. |

---

## 2. Environment configuration

Set these in `.env` (web) and your CI/hosting for each environment. All are
optional with sensible defaults baked into `lib/deeplink/config.ts`.

```bash
NEXT_PUBLIC_APP_URL=https://connectafrik.com        # canonical web/base URL
NEXT_PUBLIC_DEEPLINK_ENV=production                  # development|staging|production
NEXT_PUBLIC_DEEPLINK_SCHEME=connectafrik            # custom scheme fallback
NEXT_PUBLIC_IOS_BUNDLE_ID=com.senyoapp.connectAfrick
APPLE_TEAM_ID=5P2C27ZV83
NEXT_PUBLIC_IOS_APP_STORE_ID=1234567890             # numeric App Store id
NEXT_PUBLIC_ANDROID_PACKAGE=com.senyoapp.connectAfrick
ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:..,CC:DD:..  # upload key + Play signing key
DEEPLINK_SIGNING_SECRET=<64+ random chars>
CAP_SERVER_URL=https://connectafrik.com             # native shell target
```

| Environment | `NEXT_PUBLIC_APP_URL` | iOS domain | Android host |
|-------------|----------------------|-----------|--------------|
| development | `http://localhost:3000` | n/a (use scheme) | n/a (use scheme) |
| staging | `https://staging.connectafrik.com` | `applinks:staging.connectafrik.com` | `staging.connectafrik.com` |
| production | `https://connectafrik.com` | `applinks:connectafrik.com` | `connectafrik.com` |

> Universal/App Links require HTTPS, so on local dev use the custom scheme
> (`connectafrik://post/123`) or a tunnel (ngrok/cloudflared) with a real
> domain + association files.

---

## 3. Domain configuration (association files)

Both files are generated dynamically from env so they stay correct per
environment. They are served at the **exact** required paths via rewrites in
`next.config.ts`.

- iOS: `https://connectafrik.com/.well-known/apple-app-site-association`
  - `Content-Type: application/json`, **no** extension, **no** redirects.
  - Handler: `app/api/well-known/apple-app-site-association/route.ts`
- Android: `https://connectafrik.com/.well-known/assetlinks.json`
  - `Content-Type: application/json`, **no** redirects.
  - Handler: `app/api/well-known/assetlinks/route.ts`
  - Requires `ANDROID_SHA256_CERT_FINGERPRINTS` (upload **and** Play signing key).

Verify after deploy:

```bash
curl -i https://connectafrik.com/.well-known/apple-app-site-association
curl -i https://connectafrik.com/.well-known/assetlinks.json
# Google verifier:
# https://developers.google.com/digital-asset-links/tools/generator
```

---

## 4. Mobile app configuration (Capacitor)

One-time native setup (requires the Capacitor CLI + platform packages):

```bash
npm i -D @capacitor/cli
npm i @capacitor/ios @capacitor/android @capacitor/app --legacy-peer-deps
npx cap add ios
npx cap add android
npx cap sync
```

### iOS
1. Copy `docs/deep-linking/ios/App.entitlements` → `ios/App/App/App.entitlements`.
2. In Xcode → target → Signing & Capabilities → add **Associated Domains** (it
   will pick up the entitlements file).
3. Merge `docs/deep-linking/ios/Info.plist.snippet.xml` into
   `ios/App/App/Info.plist` (registers the `connectafrik://` scheme).
4. Ensure the bundle id matches `NEXT_PUBLIC_IOS_BUNDLE_ID` and Team ID matches
   `APPLE_TEAM_ID` (these feed the AASA `appID`).

### Android
1. Merge `docs/deep-linking/android/AndroidManifest.snippet.xml` into the
   `MainActivity` of `android/app/src/main/AndroidManifest.xml`.
2. Set `applicationId` (+ `namespace`) in `android/app/build.gradle` to
   `NEXT_PUBLIC_ANDROID_PACKAGE` so it matches `assetlinks.json` — see
   `docs/deep-linking/android/build.gradle.snippet.gradle`.
   Current value: `com.example.connectafrik` (⚠ placeholder — replace before
   publishing to Play).
3. Get your SHA-256 fingerprints and put them in `ANDROID_SHA256_CERT_FINGERPRINTS`:
   ```bash
   keytool -list -v -keystore upload-keystore.jks -alias upload
   # Plus the Play App Signing key from Play Console → App integrity.
   ```
3. `npx cap sync android` and rebuild.

The inbound URL is delivered to the web layer by
`app/components/DeepLinkHandler.tsx` (already mounted in `app/providers.tsx`),
which routes it with the Next.js router (and does a full navigation for
server-handled routes like `/auth/callback`).

---

## 5. Auth flows (already wired)

All auth redirect URLs now use the canonical deep-link base URL, so the emails /
OAuth returns are Universal/App Links that open the app when installed:

| Flow | Where | Redirect target |
|------|-------|-----------------|
| Account activation | `app/api/auth/signup/route.ts` | `…/confirm-signup` → `/auth/callback` → `/account-activated` |
| Password reset | `app/api/auth/reset-password/route.ts`, `contexts/AuthContext.tsx` | `…/reset-password` (server-enforced host) |
| Social login | `app/(auth)/signin/page.tsx` | `…/auth/callback?redirect=<path>` |
| Email/OTP verify | `app/(auth)/verify-otp/page.tsx` | internal `redirect` param |

> In the Supabase dashboard → Authentication → URL Configuration, add the
> production/staging base URLs and `…/auth/callback`, `…/reset-password`,
> `…/confirm-signup` to the **Redirect URLs** allowlist.

---

## 6. Generating links from the backend

```ts
// Authenticated request
const res = await apiClient.post('/api/links', {
  target: '/post/123',     // validated against the allowlist
  signed: true,            // optional: HMAC + expiring token
  ttlSeconds: 3600,        // optional
})
// → { universalLink, schemeLink, resolverLink, environment, expiresIn }
```

In UI code, prefer the isomorphic helpers directly:

```ts
import { buildShareLink, buildResolverLink } from '@/lib/deeplink/links'
buildShareLink('/post/123')      // https://connectafrik.com/post/123
buildResolverLink('/post/123')   // https://connectafrik.com/open?target=/post/123
```

Sharing (`features/social/services/sharesService.ts`) and `ShareModal` already
produce Universal Links.

---

## 7. Deferred deep linking (preserve destination after install)

- The `/open` resolver stores the intended `target` in `localStorage` and, on
  Android, passes it via the Play Store `referrer` parameter.
- After first launch/login, call `consumeDeferredDeepLink()` (exported from
  `app/open/OpenClient.tsx`) and navigate to the returned target.
- iOS has no install referrer; the `localStorage` value works when the same
  in-app WebView/browser is used, otherwise the user lands on `/feed` (graceful
  default). For guaranteed cross-install attribution on iOS you would add a
  paste-board/fingerprint step or a vendor SDK — intentionally omitted to avoid
  third-party dependencies.

---

## 8. Example deep link URLs

| Purpose | URL |
|---------|-----|
| Open a post | `https://connectafrik.com/post/123` |
| Open a profile | `https://connectafrik.com/user/amina` |
| Open a group | `https://connectafrik.com/groups/42` |
| Marketplace listing | `https://connectafrik.com/marketplace/987` |
| Smart "open in app" | `https://connectafrik.com/open?target=/post/123` |
| Signed/expiring link | `https://connectafrik.com/open?target=/post/123&t=<token>` |
| Custom scheme fallback | `connectafrik://post/123` |
| Account activation | `https://connectafrik.com/confirm-signup?...` (from email) |
| Password reset | `https://connectafrik.com/reset-password?...` (from email) |
| OAuth return | `https://connectafrik.com/auth/callback?code=...&redirect=/feed` |

---

## 9. Testing checklist

**Association files**
- [ ] `curl` AASA returns `application/json`, valid JSON, no redirect.
- [ ] `curl` `assetlinks.json` returns JSON with correct package + fingerprints.
- [ ] Google statement-list verifier passes for the production host.

**iOS (real device — simulators don't fully support Universal Links)**
- [ ] Tap `https://connectafrik.com/post/123` in Notes/Mail → app opens to post.
- [ ] App installed, link from Safari long-press → "Open in ConnectAfrik".
- [ ] App not installed → website renders; `/open` offers App Store.
- [ ] `connectafrik://post/123` opens the app (custom scheme fallback).
- [ ] Password-reset email link opens the app to `/reset-password`.

**Android**
- [ ] `adb shell am start -W -a android.intent.action.VIEW -d "https://connectafrik.com/post/123" com.senyoapp.connectAfrick` opens the post.
- [ ] App Links verification: `adb shell pm get-app-links com.senyoapp.connectAfrick` shows `verified`.
- [ ] App not installed → website renders; `/open` offers Play Store with referrer.
- [ ] `connectafrik://post/123` custom scheme opens the app.

**Auth**
- [ ] Signup activation, password reset, Google login all return to the app when
      installed and to the web otherwise.
- [ ] Deep link to a protected route while signed out → `/signin?redirect=…`,
      then lands on the original destination after login.

**Web fallback**
- [ ] Desktop link → renders the page (no store nags).
- [ ] Unsupported/in-app browser → `/open` shows manual options.

---

## 10. Best practices & security

- **Allowlist everything.** `normalizeTarget()` rejects any path not on the
  allowlist and any external host — prevents open-redirect/phishing via links.
- **Never trust client redirect targets** for auth emails. The reset-password
  host is enforced server-side; signup/OAuth use the canonical base URL.
- **Sign sensitive links.** Use `signed: true` for invites/one-time actions;
  tokens are HMAC-SHA256 + expiring, verified with constant-time comparison.
- **Keep `DEEPLINK_SIGNING_SECRET` out of the client** (no `NEXT_PUBLIC_`).
- **Exclude `/api/*`, `/_next/*`, `/.well-known/*`** from app-opening paths so
  the web app keeps functioning (already configured in AASA + intent filters).
- **HTTPS only, no redirects** on association files; cache modestly (1h).
- **Match identifiers exactly**: AASA `appID` = `TeamID.BundleID`; assetlinks
  `package_name` + fingerprints must include the Play signing key.
- **Per-environment domains** avoid prod links opening staging builds.
- **Graceful degradation**: invalid/expired tokens and unknown targets fall back
  to `/feed` rather than erroring.
```
