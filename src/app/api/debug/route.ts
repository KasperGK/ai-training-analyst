import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { intervalsClient } from '@/lib/intervals-icu'
import { syncAll } from '@/lib/sync/intervals-sync'

export async function GET() {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'No supabase' })
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated', userId: null })
  }

  const [athletes, sessions, fitness, insights, syncLog, insightGenLog] = await Promise.all([
    supabase.from('athletes').select('id, name').eq('id', user.id),
    supabase.from('sessions').select('id, date, sport', { count: 'exact' }).eq('athlete_id', user.id).limit(5),
    supabase.from('fitness_history').select('date, ctl, atl, tsb', { count: 'exact' }).eq('athlete_id', user.id).order('date', { ascending: false }).limit(5),
    supabase.from('insights').select('id, title, insight_type', { count: 'exact' }).eq('athlete_id', user.id).limit(5),
    supabase.from('sync_log').select('*').eq('athlete_id', user.id).single(),
    supabase.from('insight_generation_log').select('*', { count: 'exact' }).eq('athlete_id', user.id).order('generated_at', { ascending: false }).limit(3),
  ])

  return NextResponse.json({
    userId: user.id,
    athlete: athletes.data?.[0] ?? null,
    sessionsCount: sessions.count ?? 0,
    sessionsPreview: sessions.data,
    fitnessCount: fitness.count ?? 0,
    fitnessPreview: fitness.data,
    insightsCount: insights.count ?? 0,
    insightsPreview: insights.data,
    insightsError: insights.error?.message ?? null,
    insightGenLogCount: insightGenLog.count ?? 0,
    insightGenLogPreview: insightGenLog.data,
    insightGenLogError: insightGenLog.error?.message ?? null,
    syncLog: syncLog.data,
  })
}

/**
 * POST /api/debug - Run sync with detailed output for debugging
 */
export async function POST() {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'No supabase' })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  // Get intervals.icu credentials
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('intervals_access_token')?.value
  let intervalsAthleteId = cookieStore.get('intervals_athlete_id')?.value

  // Fall back to env vars
  if (!accessToken || !intervalsAthleteId) {
    accessToken = process.env.INTERVALS_ICU_API_KEY
    intervalsAthleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  if (!accessToken || !intervalsAthleteId) {
    return NextResponse.json({ error: 'intervals.icu not connected' })
  }

  // Set credentials
  intervalsClient.setCredentials(accessToken, intervalsAthleteId)

  // Count sessions before
  const { count: beforeCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', user.id)

  console.log('[debug-sync] Starting sync for athlete:', user.id)
  console.log('[debug-sync] Sessions before:', beforeCount)

  // Run sync with force
  const result = await syncAll(user.id, { force: true })

  // Count sessions after
  const { count: afterCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', user.id)

  console.log('[debug-sync] Sessions after:', afterCount)
  console.log('[debug-sync] Result:', JSON.stringify(result))

  return NextResponse.json({
    athleteId: user.id,
    sessionsBefore: beforeCount,
    sessionsAfter: afterCount,
    netChange: (afterCount || 0) - (beforeCount || 0),
    syncResult: result,
  })
}
