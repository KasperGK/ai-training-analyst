import { NextResponse } from 'next/server'
import { getOAuthAuthorizationUrl } from '@/lib/intervals-icu'
import { cookies } from 'next/headers'

export async function GET() {
  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const redirectUri = process.env.INTERVALS_ICU_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'intervals.icu OAuth not configured' },
      { status: 500 }
    )
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID()

  // Store state in cookie for verification on callback
  const cookieStore = await cookies()
  cookieStore.set('intervals_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  })

  // Generate authorization URL and redirect
  const authUrl = getOAuthAuthorizationUrl(clientId, redirectUri, state)

  return NextResponse.redirect(authUrl)
}
