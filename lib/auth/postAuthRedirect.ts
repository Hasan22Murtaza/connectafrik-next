const ADMIN_ROLES = new Set(['admin', 'super_admin'])

export function getPostAuthRedirect(
  platformRole: string | null | undefined,
  redirectParam?: string | null
): string {
  if (platformRole && ADMIN_ROLES.has(platformRole)) {
    return '/admin/dashboard'
  }

  const redirect = redirectParam || '/feed'
  if (!redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/feed'
  }

  return redirect
}
