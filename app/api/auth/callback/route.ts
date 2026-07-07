import { NextResponse, type NextRequest } from 'next/server'

/** Legacy OAuth callback path — redirect to the canonical /auth/callback route. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  url.pathname = '/auth/callback'
  return NextResponse.redirect(url)
}
