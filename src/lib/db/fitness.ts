import { createClient } from '@/lib/supabase/server'
import type { FitnessHistory, CurrentFitness } from '@/types'

export type FitnessRow = {
  id: string
  athlete_id: string
  date: string
  ctl: number
  atl: number
  tsb: number
  tss_day: number
  // Sleep and recovery metrics
  sleep_seconds: number | null
  sleep_score: number | null
  hrv: number | null
  resting_hr: number | null
  readiness: number | null
  created_at: string
}

function rowToFitness(row: FitnessRow): FitnessHistory {
  return {
    athlete_id: row.athlete_id,
    date: row.date,
    ctl: row.ctl,
    atl: row.atl,
    tsb: row.tsb,
    tss_day: row.tss_day,
    sleep_seconds: row.sleep_seconds,
    sleep_score: row.sleep_score,
    hrv: row.hrv,
    resting_hr: row.resting_hr,
    readiness: row.readiness,
  }
}

export async function getFitnessHistory(
  athleteId: string,
  days: number = 90
): Promise<FitnessHistory[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('fitness_history')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error || !data) return []
  return data.map((row) => rowToFitness(row as FitnessRow))
}

export async function getCurrentFitness(athleteId: string): Promise<CurrentFitness | null> {
  const supabase = await createClient()
  if (!supabase) return null

  // Get the latest fitness entry
  const { data: latest, error: latestError } = await supabase
    .from('fitness_history')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (latestError || !latest) return null

  // Get fitness from 7 days ago to calculate trend
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const { data: weekAgoData } = await supabase
    .from('fitness_history')
    .select('ctl')
    .eq('athlete_id', athleteId)
    .lte('date', weekAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(1)
    .single()

  // Calculate trend
  let ctlTrend: 'up' | 'down' | 'stable' = 'stable'
  if (weekAgoData) {
    const diff = latest.ctl - weekAgoData.ctl
    if (diff > 2) ctlTrend = 'up'
    else if (diff < -2) ctlTrend = 'down'
  }

  // Get upcoming event
  const { data: nextEvent } = await supabase
    .from('events')
    .select('name, date')
    .eq('athlete_id', athleteId)
    .eq('status', 'planned')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(1)
    .single()

  let daysUntilEvent: number | undefined
  let eventName: string | undefined

  if (nextEvent) {
    const eventDate = new Date(nextEvent.date)
    const today = new Date()
    daysUntilEvent = Math.ceil(
      (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    eventName = nextEvent.name
  }

  return {
    ctl: latest.ctl,
    atl: latest.atl,
    tsb: latest.tsb,
    ctl_trend: ctlTrend,
    days_until_event: daysUntilEvent,
    event_name: eventName,
    // Sleep data from last night
    sleep_seconds: latest.sleep_seconds,
    sleep_score: latest.sleep_score,
    hrv: latest.hrv,
    resting_hr: latest.resting_hr,
  }
}

export async function upsertFitness(fitness: {
  athlete_id: string
  date: string
  ctl: number
  atl: number
  tsb: number
  tss_day: number
}): Promise<FitnessHistory | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('fitness_history')
    .upsert(fitness, {
      onConflict: 'athlete_id,date',
    })
    .select()
    .single()

  if (error || !data) return null
  return rowToFitness(data as FitnessRow)
}

// Calculate CTL/ATL/TSB from sessions using exponential decay
// CTL uses 42-day time constant, ATL uses 7-day
export async function recalculateFitness(
  athleteId: string,
  startDate?: string
): Promise<void> {
  const supabase = await createClient()
  if (!supabase) return

  // Get all sessions ordered by date
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('date, tss')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: true })

  if (error || !sessions || sessions.length === 0) return

  // Group TSS by date
  const tssByDate = new Map<string, number>()
  for (const session of sessions) {
    const existing = tssByDate.get(session.date) || 0
    tssByDate.set(session.date, existing + (session.tss || 0))
  }

  // Calculate fitness metrics
  const CTL_DAYS = 42
  const ATL_DAYS = 7
  let ctl = 0
  let atl = 0

  const sortedDates = Array.from(tssByDate.keys()).sort()
  const fitnessRecords: Array<{
    athlete_id: string
    date: string
    ctl: number
    atl: number
    tsb: number
    tss_day: number
  }> = []

  for (const date of sortedDates) {
    const tss = tssByDate.get(date) || 0

    // Exponential moving average
    ctl = ctl + (tss - ctl) / CTL_DAYS
    atl = atl + (tss - atl) / ATL_DAYS
    const tsb = ctl - atl

    fitnessRecords.push({
      athlete_id: athleteId,
      date,
      ctl: Math.round(ctl * 100) / 100,
      atl: Math.round(atl * 100) / 100,
      tsb: Math.round(tsb * 100) / 100,
      tss_day: tss,
    })
  }

  // Batch upsert
  if (fitnessRecords.length > 0) {
    await supabase
      .from('fitness_history')
      .upsert(fitnessRecords, { onConflict: 'athlete_id,date' })
  }
}
