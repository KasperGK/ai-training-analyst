import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
