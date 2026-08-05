/**
 * Parse profile image URL from participant metadata (provider-agnostic).
 */
export function profileImageUrlFromMeta(meta: unknown): string {
  let o: Record<string, unknown> | null = null;
  if (typeof meta === 'string') {
    try {
      const p = JSON.parse(meta) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) o = p as Record<string, unknown>;
    } catch {
      return '';
    }
  } else if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    o = meta as Record<string, unknown>;
  }
  if (!o) return '';
  const raw =
    o.profileImage ??
    o.profile_image ??
    o.avatarUrl ??
    o.avatar_url ??
    o.picture;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
}
