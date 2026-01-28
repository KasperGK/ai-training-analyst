/**
 * ZwiftPower Sync API Route
 *
 * Triggers sync of race results from ZwiftPower.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncZwiftPowerRaces, isZwiftPowerConnected } from '@/lib/sync/zwiftpower-sync'

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

    // Check if ZwiftPower is connected
    const connected = await isZwiftPowerConnected(user.id)
    if (!connected) {
      return NextResponse.json(
        { error: 'ZwiftPower not connected. Please connect ZwiftPower in Settings first.' },
        { status: 400 }
      )
    }

    // Parse optional options from request body
    let options = {}
    try {
      const body = await request.json()
      options = {
        since: body.since,
        force: body.force,
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Run sync
    console.log('[ZwiftPower Sync] Starting sync for user:', user.id)
    const result = await syncZwiftPowerRaces(user.id, options)

    if (!result.success && result.errors.length > 0) {
      console.error('[ZwiftPower Sync] Sync completed with errors:', result.errors)
    }

    return NextResponse.json({
      success: result.success,
      racesSynced: result.racesSynced,
      competitorsSynced: result.competitorsSynced,
      errors: result.errors,
      duration_ms: result.duration_ms,
    })
  } catch (error) {
    console.error('[ZwiftPower Sync] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred during sync' },
      { status: 500 }
    )
  }
}

/**
 * GET handler to check sync status / get recent races
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

    // Check if ZwiftPower is connected
    const connected = await isZwiftPowerConnected(user.id)

    // Get recent race count
    const { count } = await supabase
      .from('race_results')
      .select('*', { count: 'exact', head: true })
      .eq('athlete_id', user.id)

    // Get most recent race
    const { data: recentRace } = await supabase
      .from('race_results')
      .select('race_name, race_date, placement, total_in_category, category')
      .eq('athlete_id', user.id)
      .order('race_date', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      connected,
      totalRaces: count || 0,
      recentRace: recentRace || null,
    })
  } catch (error) {
    console.error('[ZwiftPower Sync] Status check error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
