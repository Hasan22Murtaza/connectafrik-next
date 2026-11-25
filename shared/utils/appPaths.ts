/** Auth pages and other routes that never show the global left nav. */
const HIDE_SIDEBAR_EXACT = new Set([
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/account-activated",
  "/confirm-signup",
  "/auth/callback",
  "/api-docs",
  "/create-password",
  "/verify-otp",
]);

/** Paths that use authenticated app chrome (aligned with middleware protected routes). */
const APP_CHROME_PREFIXES = [
  "/feed",
  "/chat",
  "/calls",
  "/call",
  "/notifications",
  "/friends",
  "/groups",
  "/profile",
  "/settings",
  "/saved",
  "/reels",
  "/stories",
  "/my-orders",
  "/culture",
  "/politics",
  "/youth-leadership",
  "/global-hub",
  "/user/",
  "/marketplace/selling",
  "/marketplace/buying",
] as const;

function matchesAppChromePath(pathname: string, route: string): boolean {
  if (route.endsWith("/")) return pathname.startsWith(route);
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function shouldHideAppSidebar(pathname: string | null): boolean {
  if (!pathname) return true;
  if (HIDE_SIDEBAR_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/call/")) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

/** True for protected app routes where chrome should stay stable during auth hydration. */
export function isAppChromePath(pathname: string | null): boolean {
  if (!pathname || shouldHideAppSidebar(pathname)) return false;
  return APP_CHROME_PREFIXES.some((prefix) => matchesAppChromePath(pathname, prefix));
}
