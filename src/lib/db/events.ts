import { createClient } from '@/lib/supabase/server'
import type { Event } from '@/types'

export type EventRow = {
  id: string
  athlete_id: string
  name: string
  date: string
  priority: string
  event_type: string | null
  distance_km: number | null
  elevation_m: number | null
  target_ctl: number | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
}

export type EventInsert = Omit<EventRow, 'id' | 'created_at' | 'updated_at'>
export type EventUpdate = Partial<Omit<EventRow, 'id' | 'athlete_id' | 'created_at'>>

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    name: row.name,
    date: row.date,
    priority: row.priority as Event['priority'],
    event_type: row.event_type as Event['event_type'],
    distance_km: row.distance_km ?? undefined,
    elevation_m: row.elevation_m ?? undefined,
    status: row.status as Event['status'],
  }
}

export async function getEvents(athleteId: string): Promise<Event[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: true })

  if (error || !data) return []
  return data.map((row) => rowToEvent(row as EventRow))
}

export async function getUpcomingEvents(
  athleteId: string,
  limit: number = 5
): Promise<Event[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('status', 'planned')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => rowToEvent(row as EventRow))
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error || !data) return null
  return rowToEvent(data as EventRow)
}

export async function createEvent(event: EventInsert): Promise<Event | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single()

  if (error || !data) return null
  return rowToEvent(data as EventRow)
}

export async function updateEvent(
  eventId: string,
  updates: EventUpdate
): Promise<Event | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single()

  if (error || !data) return null
  return rowToEvent(data as EventRow)
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)

  return !error
}

export async function getNextAEvent(athleteId: string): Promise<Event | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('priority', 'A')
    .eq('status', 'planned')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) return null
  return rowToEvent(data as EventRow)
}
