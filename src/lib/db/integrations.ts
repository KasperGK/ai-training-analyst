import { createClient } from '@/lib/supabase/server'

export interface Integration {
  id: string
  athlete_id: string
  provider: string
  access_token: string
  refresh_token: string | null
  external_athlete_id: string | null
  token_expires_at: string | null
  scopes: string[] | null
  created_at: string
  updated_at: string
}

export type IntegrationRow = {
  id: string
  athlete_id: string
  provider: string
  access_token: string
  refresh_token: string | null
  external_athlete_id: string | null
  token_expires_at: string | null
  scopes: string[] | null
  created_at: string
  updated_at: string
}

export type IntegrationInsert = Omit<IntegrationRow, 'id' | 'created_at' | 'updated_at'>
export type IntegrationUpdate = Partial<Omit<IntegrationRow, 'id' | 'athlete_id' | 'provider' | 'created_at'>>

function rowToIntegration(row: IntegrationRow): Integration {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    provider: row.provider,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    external_athlete_id: row.external_athlete_id,
    token_expires_at: row.token_expires_at,
    scopes: row.scopes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getIntegration(
  athleteId: string,
  provider: string
): Promise<Integration | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('provider', provider)
    .single()

  if (error || !data) return null
  return rowToIntegration(data as IntegrationRow)
}

export async function getIntegrations(athleteId: string): Promise<Integration[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('athlete_id', athleteId)

  if (error || !data) return []
  return data.map((row) => rowToIntegration(row as IntegrationRow))
}

export async function saveIntegration(
  integration: IntegrationInsert
): Promise<Integration | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('integrations')
    .upsert(integration, {
      onConflict: 'athlete_id,provider',
    })
    .select()
    .single()

  if (error || !data) return null
  return rowToIntegration(data as IntegrationRow)
}

export async function updateIntegration(
  athleteId: string,
  provider: string,
  updates: IntegrationUpdate
): Promise<Integration | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('integrations')
    .update(updates)
    .eq('athlete_id', athleteId)
    .eq('provider', provider)
    .select()
    .single()

  if (error || !data) return null
  return rowToIntegration(data as IntegrationRow)
}

export async function deleteIntegration(
  athleteId: string,
  provider: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('provider', provider)

  return !error
}

export async function isTokenExpired(integration: Integration): Promise<boolean> {
  if (!integration.token_expires_at) return false

  const expiresAt = new Date(integration.token_expires_at)
  const now = new Date()

  // Consider expired if less than 5 minutes remaining
  return expiresAt.getTime() - now.getTime() < 5 * 60 * 1000
}

// Supported providers
export const PROVIDERS = {
  INTERVALS_ICU: 'intervals_icu',
  STRAVA: 'strava',
  GARMIN: 'garmin',
} as const

export type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS]
