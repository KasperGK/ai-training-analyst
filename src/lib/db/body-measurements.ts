import { createClient } from '@/lib/supabase/server'

export interface BodyMeasurement {
  id: string
  athlete_id: string
  measured_at: string
  source: string
  external_id: string | null
  weight_kg: number | null
  fat_mass_kg: number | null
  fat_ratio_percent: number | null
  fat_free_mass_kg: number | null
  muscle_mass_kg: number | null
  bone_mass_kg: number | null
  hydration_kg: number | null
  bmi: number | null
  created_at: string
  updated_at: string
}

export type BodyMeasurementInsert = {
  athlete_id: string
  measured_at: string
  source: string
  external_id?: string | null
  weight_kg?: number | null
  fat_mass_kg?: number | null
  fat_ratio_percent?: number | null
  fat_free_mass_kg?: number | null
  muscle_mass_kg?: number | null
  bone_mass_kg?: number | null
  hydration_kg?: number | null
  bmi?: number | null
}

/**
 * Get body measurements for an athlete
 */
export async function getBodyMeasurements(
  athleteId: string,
  options?: {
    limit?: number
    startDate?: Date
    endDate?: Date
    source?: string
  }
): Promise<BodyMeasurement[]> {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('body_measurements')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('measured_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.startDate) {
    query = query.gte('measured_at', options.startDate.toISOString())
  }

  if (options?.endDate) {
    query = query.lte('measured_at', options.endDate.toISOString())
  }

  if (options?.source) {
    query = query.eq('source', options.source)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching body measurements:', error)
    return []
  }

  return data as BodyMeasurement[]
}

/**
 * Get the latest body measurement for an athlete
 */
export async function getLatestBodyMeasurement(
  athleteId: string
): Promise<BodyMeasurement | null> {
  const measurements = await getBodyMeasurements(athleteId, { limit: 1 })
  return measurements[0] || null
}

/**
 * Save body measurements (upsert based on athlete_id, measured_at, source)
 */
export async function saveBodyMeasurements(
  measurements: BodyMeasurementInsert[]
): Promise<{ inserted: number; updated: number }> {
  const supabase = await createClient()
  if (!supabase) return { inserted: 0, updated: 0 }

  let inserted = 0
  let updated = 0

  for (const measurement of measurements) {
    const { data, error } = await supabase
      .from('body_measurements')
      .upsert(measurement, {
        onConflict: 'athlete_id,measured_at,source',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      console.error('Error saving body measurement:', error)
      continue
    }

    if (data && data.length > 0) {
      // Check if it was an insert or update by comparing created_at and updated_at
      const record = data[0]
      if (record.created_at === record.updated_at) {
        inserted++
      } else {
        updated++
      }
    }
  }

  return { inserted, updated }
}

/**
 * Delete body measurements by source
 */
export async function deleteBodyMeasurementsBySource(
  athleteId: string,
  source: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('body_measurements')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('source', source)

  if (error) {
    console.error('Error deleting body measurements:', error)
    return false
  }

  return true
}

/**
 * Update athlete's current weight from latest measurement
 */
export async function updateAthleteWeight(athleteId: string): Promise<void> {
  const latest = await getLatestBodyMeasurement(athleteId)
  if (!latest?.weight_kg) return

  const supabase = await createClient()
  if (!supabase) return

  await supabase
    .from('athletes')
    .update({
      weight_kg: latest.weight_kg,
      weight_updated_at: latest.measured_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', athleteId)
}

/**
 * Get weight trend over time
 */
export async function getWeightTrend(
  athleteId: string,
  days: number = 30
): Promise<{ date: string; weight_kg: number }[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const measurements = await getBodyMeasurements(athleteId, {
    startDate,
    limit: 100,
  })

  return measurements
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({
      date: m.measured_at.split('T')[0],
      weight_kg: m.weight_kg!,
    }))
    .reverse() // Oldest first for charting
}
