import { createClient } from '@/lib/supabase/server'
import type { Athlete } from '@/types'

export type AthleteRow = {
  id: string
  name: string
  email: string
  ftp: number | null
  ftp_updated_at: string | null
  max_hr: number | null
  lthr: number | null
  resting_hr: number | null
  weight_kg: number | null
  weekly_hours_available: number | null
  timezone: string | null
  created_at: string
  updated_at: string
}

export type AthleteUpdate = Partial<Omit<AthleteRow, 'id' | 'created_at' | 'email'>>

function rowToAthlete(row: AthleteRow): Athlete {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    ftp: row.ftp ?? 200,
    ftp_updated_at: row.ftp_updated_at ?? '',
    max_hr: row.max_hr ?? 190,
    lthr: row.lthr ?? 165,
    resting_hr: row.resting_hr ?? undefined,
    weight_kg: row.weight_kg ?? 75,
    weekly_hours_available: row.weekly_hours_available ?? 10,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getAthlete(userId: string): Promise<Athlete | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return rowToAthlete(data as AthleteRow)
}

export async function updateAthlete(
  userId: string,
  updates: AthleteUpdate
): Promise<Athlete | null> {
  const supabase = await createClient()
  if (!supabase) return null

  // If FTP is being updated, also update the timestamp
  if (updates.ftp !== undefined) {
    updates.ftp_updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('athletes')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error || !data) return null
  return rowToAthlete(data as AthleteRow)
}

export async function createAthlete(athlete: {
  id: string
  name: string
  email: string
  ftp?: number
  weight_kg?: number
}): Promise<Athlete | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('athletes')
    .insert({
      id: athlete.id,
      name: athlete.name,
      email: athlete.email,
      ftp: athlete.ftp ?? 200,
      weight_kg: athlete.weight_kg ?? 75,
    })
    .select()
    .single()

  if (error || !data) return null
  return rowToAthlete(data as AthleteRow)
}
