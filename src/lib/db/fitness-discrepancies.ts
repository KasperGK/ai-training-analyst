import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface FitnessDiscrepancy {
  id: string
  athlete_id: string
  detected_at: string
  date: string
  local_ctl: number
  local_atl: number
  remote_ctl: number
  remote_atl: number
  ctl_delta: number
  atl_delta: number
  status: 'active' | 'acknowledged' | 'resolved'
  resolved_at: string | null
  notes: string | null
}

export interface DiscrepancyInsert {
  athlete_id: string
  date: string
  local_ctl: number
  local_atl: number
  remote_ctl: number
  remote_atl: number
  ctl_delta: number
  atl_delta: number
}

/**
 * Get active (unresolved) fitness discrepancies for an athlete
 */
export async function getActiveDiscrepancies(
  athleteId: string
): Promise<FitnessDiscrepancy[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('fitness_discrepancies')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .order('detected_at', { ascending: false })

  if (error || !data) return []
  return data as FitnessDiscrepancy[]
}

/**
 * Get most recent discrepancy for an athlete
 */
export async function getLatestDiscrepancy(
  athleteId: string
): Promise<FitnessDiscrepancy | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('fitness_discrepancies')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .order('detected_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as FitnessDiscrepancy
}

/**
 * Insert a new fitness discrepancy record
 */
export async function insertDiscrepancy(
  discrepancy: DiscrepancyInsert
): Promise<FitnessDiscrepancy | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('fitness_discrepancies')
    .insert(discrepancy)
    .select()
    .single()

  if (error) {
    logger.error('[FitnessDiscrepancies] Insert error:', error)
    return null
  }
  return data as FitnessDiscrepancy
}

/**
 * Acknowledge a discrepancy (user has seen it)
 */
export async function acknowledgeDiscrepancy(
  discrepancyId: string,
  athleteId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('fitness_discrepancies')
    .update({ status: 'acknowledged' })
    .eq('id', discrepancyId)
    .eq('athlete_id', athleteId)

  return !error
}

/**
 * Resolve a discrepancy (no longer relevant)
 */
export async function resolveDiscrepancy(
  discrepancyId: string,
  athleteId: string,
  notes?: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('fitness_discrepancies')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq('id', discrepancyId)
    .eq('athlete_id', athleteId)

  return !error
}

/**
 * Resolve all active discrepancies for an athlete
 */
export async function resolveAllDiscrepancies(
  athleteId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('fitness_discrepancies')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('athlete_id', athleteId)
    .eq('status', 'active')

  return !error
}
