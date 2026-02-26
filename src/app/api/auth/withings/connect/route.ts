import { NextRequest, NextResponse } from 'next/server'
import { getWithingsAuthUrl } from '@/lib/withings'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const clientId = process.env.WITHINGS_CLIENT_ID
  const redirectUri = process.env.WITHINGS_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL('/settings?error=withings_not_configured', request.url))
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID()

  // Store state in cookie for verification on callback
  const cookieStore = await cookies()
  cookieStore.set('withings_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  })

  // Generate authorization URL and redirect
  const authUrl = getWithingsAuthUrl(clientId, redirectUri, state)

  return NextResponse.redirect(authUrl)
}
