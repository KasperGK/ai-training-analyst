import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getIntegration, updateIntegration, PROVIDERS } from '@/lib/db/integrations'
import { saveBodyMeasurements, updateAthleteWeight } from '@/lib/db/body-measurements'
import {
  fetchWithingsMeasurements,
  parseMeasurements,
  refreshWithingsToken,
} from '@/lib/withings'

export async function POST() {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get Withings integration
  const integration = await getIntegration(user.id, PROVIDERS.WITHINGS)
  if (!integration) {
    return NextResponse.json({ error: 'Withings not connected' }, { status: 400 })
  }

  // Check if token needs refresh
  let accessToken = integration.access_token
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at)
    const now = new Date()
    // Refresh if less than 5 minutes remaining
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      const clientId = process.env.WITHINGS_CLIENT_ID
      const clientSecret = process.env.WITHINGS_CLIENT_SECRET

      if (!clientId || !clientSecret || !integration.refresh_token) {
        return NextResponse.json({ error: 'Cannot refresh token' }, { status: 500 })
      }

      try {
        const refreshResponse = await refreshWithingsToken(
          integration.refresh_token,
          clientId,
          clientSecret
        )

        const newExpiresAt = new Date()
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + refreshResponse.body.expires_in)

        await updateIntegration(user.id, PROVIDERS.WITHINGS, {
          access_token: refreshResponse.body.access_token,
          refresh_token: refreshResponse.body.refresh_token,
          token_expires_at: newExpiresAt.toISOString(),
        })

        accessToken = refreshResponse.body.access_token
      } catch (error) {
        console.error('Failed to refresh Withings token:', error)
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
      }
    }
  }

  try {
    // Fetch last 90 days of measurements
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const response = await fetchWithingsMeasurements(accessToken, startDate)
    const measurements = parseMeasurements(response)

    // Convert to database format
    const dbMeasurements = measurements.map((m) => ({
      athlete_id: user.id,
      measured_at: m.measured_at.toISOString(),
      source: 'withings',
      external_id: m.external_id,
      weight_kg: m.weight_kg ?? null,
      fat_mass_kg: m.fat_mass_kg ?? null,
      fat_ratio_percent: m.fat_ratio_percent ?? null,
      fat_free_mass_kg: m.fat_free_mass_kg ?? null,
      muscle_mass_kg: m.muscle_mass_kg ?? null,
      bone_mass_kg: m.bone_mass_kg ?? null,
      hydration_kg: m.hydration_kg ?? null,
    }))

    // Save to database
    const result = await saveBodyMeasurements(dbMeasurements)

    // Update athlete's current weight
    await updateAthleteWeight(user.id)

    return NextResponse.json({
      success: true,
      measurements_fetched: measurements.length,
      inserted: result.inserted,
      updated: result.updated,
    })
  } catch (error) {
    console.error('Withings sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Withings data' },
      { status: 500 }
    )
  }
}
