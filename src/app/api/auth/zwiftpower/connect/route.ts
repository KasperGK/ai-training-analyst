/**
 * ZwiftPower Connect API Route
 *
 * Handles ZwiftPower credential submission and validation.
 * Unlike intervals.icu which uses OAuth, ZwiftPower requires
 * username/password authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ZwiftPowerAPI, ZwiftAPI } from '@codingwithspike/zwift-api-wrapper'
import { encryptPassword } from '@/lib/zwiftpower'
import { z } from 'zod'

const connectSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = connectSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { username, password } = validation.data

    // Test credentials by authenticating with ZwiftPower
    console.log('[ZwiftPower Connect] Testing credentials...')
    const api = new ZwiftPowerAPI(username, password)

    try {
      await api.authenticate()
    } catch (authError) {
      console.error('[ZwiftPower Connect] Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Invalid Zwift credentials. Please check your username and password.' },
        { status: 401 }
      )
    }

    // Credentials are valid - encrypt password for storage
    const encryptedPassword = await encryptPassword(password)

    // Get the user's Zwift ID using ZwiftAPI (main Zwift API, not ZwiftPower)
    // This is essential for matching race results in rider history
    let zwiftId: string | undefined
    try {
      console.log('[ZwiftPower Connect] Fetching Zwift ID...')
      const zwiftApi = new ZwiftAPI(username, password)
      await zwiftApi.authenticate()

      // Get the user's activity feed which includes profile info
      const feedResponse = await zwiftApi.getActivityFeed()
      if (feedResponse.statusCode === 200 && feedResponse.body && feedResponse.body.length > 0) {
        const firstActivity = feedResponse.body[0]
        // Activity feed includes profile.id
        if (firstActivity.profile?.id) {
          zwiftId = String(firstActivity.profile.id)
          console.log('[ZwiftPower Connect] Found Zwift ID from activity feed:', zwiftId)
        }
      }
    } catch (err) {
      // Non-critical - continue without Zwift ID but log the error
      console.warn('[ZwiftPower Connect] Could not fetch Zwift ID:', err)
    }

    // Store/update integration
    const { error: upsertError } = await supabase
      .from('integrations')
      .upsert({
        athlete_id: user.id,
        provider: 'zwiftpower',
        access_token: 'zwiftpower_credential', // Placeholder since we use user/pass
        zwift_username: username,
        zwift_password_encrypted: encryptedPassword,
        zwift_id: zwiftId || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'athlete_id,provider',
      })

    if (upsertError) {
      console.error('[ZwiftPower Connect] Failed to save credentials:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save credentials' },
        { status: 500 }
      )
    }

    console.log('[ZwiftPower Connect] Connected successfully for user:', user.id)

    return NextResponse.json({
      success: true,
      message: 'ZwiftPower connected successfully',
    })
  } catch (error) {
    console.error('[ZwiftPower Connect] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

/**
 * GET handler to check ZwiftPower connection status
 */
export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check for ZwiftPower integration
    const { data, error } = await supabase
      .from('integrations')
      .select('zwift_username, zwift_id, updated_at')
      .eq('athlete_id', user.id)
      .eq('provider', 'zwiftpower')
      .single()

    if (error || !data) {
      return NextResponse.json({
        connected: false,
      })
    }

    return NextResponse.json({
      connected: true,
      username: data.zwift_username,
      zwiftId: data.zwift_id,
      connectedAt: data.updated_at,
    })
  } catch (error) {
    console.error('[ZwiftPower Connect] Status check error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

/**
 * DELETE handler to disconnect ZwiftPower
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Delete the integration
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('athlete_id', user.id)
      .eq('provider', 'zwiftpower')

    if (error) {
      console.error('[ZwiftPower Connect] Failed to disconnect:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect ZwiftPower' },
        { status: 500 }
      )
    }

    // Optionally: Delete race data when disconnecting?
    // For now, we keep the race data as it's still useful

    console.log('[ZwiftPower Connect] Disconnected for user:', user.id)

    return NextResponse.json({
      success: true,
      message: 'ZwiftPower disconnected',
    })
  } catch (error) {
    console.error('[ZwiftPower Connect] Disconnect error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
