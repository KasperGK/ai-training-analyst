import { NextRequest, NextResponse } from 'next/server'
import { exchangeWithingsCode } from '@/lib/withings'
import { saveIntegration, PROVIDERS } from '@/lib/db/integrations'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// HEAD request - Withings uses this to validate the callback URL exists
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

// GET request - OAuth callback with authorization code
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth errors
  if (error) {
    console.error('Withings OAuth error:', error)
    return NextResponse.redirect(new URL('/settings?error=withings_denied', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?error=missing_params', request.url))
  }

  // Verify state matches what we stored
  const cookieStore = await cookies()
  const storedState = cookieStore.get('withings_oauth_state')?.value

  if (!storedState || storedState !== state) {
    console.error('State mismatch:', { storedState, receivedState: state })
    return NextResponse.redirect(new URL('/settings?error=invalid_state', request.url))
  }

  // Clear the state cookie
  cookieStore.delete('withings_oauth_state')

  // Get OAuth credentials
  const clientId = process.env.WITHINGS_CLIENT_ID
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET
  const redirectUri = process.env.WITHINGS_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/settings?error=config_error', request.url))
  }

  // Get current user
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.redirect(new URL('/settings?error=db_error', request.url))
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.redirect(new URL('/login?error=not_authenticated', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await exchangeWithingsCode(
      code,
      clientId,
      clientSecret,
      redirectUri
    )

    // Calculate token expiration
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.body.expires_in)

    // Save integration to database
    await saveIntegration({
      athlete_id: user.id,
      provider: PROVIDERS.WITHINGS,
      access_token: tokenResponse.body.access_token,
      refresh_token: tokenResponse.body.refresh_token,
      external_athlete_id: tokenResponse.body.userid,
      token_expires_at: expiresAt.toISOString(),
      scopes: tokenResponse.body.scope.split(','),
    })

    // Redirect to settings with success
    return NextResponse.redirect(new URL('/settings?connected=withings', request.url))
  } catch (error) {
    console.error('Withings token exchange error:', error)
    return NextResponse.redirect(new URL('/settings?error=token_exchange', request.url))
  }
}
