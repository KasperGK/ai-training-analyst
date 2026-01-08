import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/intervals-icu'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth errors
  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(new URL('/?error=oauth_denied', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=missing_params', request.url))
  }

  // Verify state matches what we stored
  const cookieStore = await cookies()
  const storedState = cookieStore.get('intervals_oauth_state')?.value

  if (!storedState || storedState !== state) {
    console.error('State mismatch:', { storedState, receivedState: state })
    return NextResponse.redirect(new URL('/?error=invalid_state', request.url))
  }

  // Clear the state cookie
  cookieStore.delete('intervals_oauth_state')

  // Get OAuth credentials
  const clientId = process.env.INTERVALS_ICU_CLIENT_ID
  const clientSecret = process.env.INTERVALS_ICU_CLIENT_SECRET
  const redirectUri = process.env.INTERVALS_ICU_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/?error=config_error', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(
      code,
      clientId,
      clientSecret,
      redirectUri
    )

    // Store the access token and athlete ID in cookies (for MVP)
    // In production, store encrypted in database
    cookieStore.set('intervals_access_token', tokenResponse.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    cookieStore.set('intervals_athlete_id', tokenResponse.athlete_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    // Redirect to dashboard with success
    return NextResponse.redirect(new URL('/?connected=intervals', request.url))
  } catch (error) {
    console.error('Token exchange error:', error)
    return NextResponse.redirect(new URL('/?error=token_exchange', request.url))
  }
}
