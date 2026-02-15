import { createClient } from '@/lib/supabase/server'

export interface RaceResult {
  id: string
  athlete_id: string
  session_id: string | null
  race_name: string
  race_date: string
  source: 'zwiftpower' | 'manual' | 'strava' | 'other'
  external_race_id: string | null
  category: string | null
  position: number | null
  total_riders: number | null
  avg_power: number | null
  normalized_power: number | null
  avg_hr: number | null
  duration_seconds: number | null
  race_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface GetRaceResultsOptions {
  startDate?: string
  endDate?: string
  nameSearch?: string
  source?: string
  limit?: number
}

export async function getRaceResults(
  athleteId: string,
  options: GetRaceResultsOptions = {}
): Promise<RaceResult[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { startDate, endDate, nameSearch, source, limit = 50 } = options

  let query = supabase
    .from('race_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('race_date', { ascending: false })
    .limit(limit)

  if (startDate) {
    query = query.gte('race_date', startDate)
  }
  if (endDate) {
    query = query.lte('race_date', endDate)
  }
  if (nameSearch) {
    query = query.ilike('race_name', `%${nameSearch}%`)
  }
  if (source) {
    query = query.eq('source', source)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data as RaceResult[]
}

export async function getRaceResultsBySessionIds(
  athleteId: string,
  sessionIds: string[]
): Promise<RaceResult[]> {
  if (sessionIds.length === 0) return []

  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('race_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .in('session_id', sessionIds)

  if (error || !data) return []
  return data as RaceResult[]
}
