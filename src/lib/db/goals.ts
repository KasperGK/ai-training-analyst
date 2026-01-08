import { createClient } from '@/lib/supabase/server'

export interface Goal {
  id: string
  athlete_id: string
  event_id: string | null
  title: string
  description: string | null
  target_type: string
  target_value: number | null
  current_value: number | null
  deadline: string | null
  status: 'active' | 'completed' | 'abandoned'
  created_at: string
  updated_at: string
}

export type GoalRow = {
  id: string
  athlete_id: string
  event_id: string | null
  title: string
  description: string | null
  target_type: string
  target_value: number | null
  current_value: number | null
  deadline: string | null
  status: string
  created_at: string
  updated_at: string
}

export type GoalInsert = Omit<GoalRow, 'id' | 'created_at' | 'updated_at'>
export type GoalUpdate = Partial<Omit<GoalRow, 'id' | 'athlete_id' | 'created_at'>>

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    event_id: row.event_id,
    title: row.title,
    description: row.description,
    target_type: row.target_type,
    target_value: row.target_value,
    current_value: row.current_value,
    deadline: row.deadline,
    status: row.status as Goal['status'],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getGoals(
  athleteId: string,
  status?: Goal['status']
): Promise<Goal[]> {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('goals')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data.map((row) => rowToGoal(row as GoalRow))
}

export async function getActiveGoals(athleteId: string): Promise<Goal[]> {
  return getGoals(athleteId, 'active')
}

export async function getGoal(goalId: string): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

export async function createGoal(goal: GoalInsert): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('goals')
    .insert(goal)
    .select()
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

export async function updateGoal(
  goalId: string,
  updates: GoalUpdate
): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

export async function deleteGoal(goalId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)

  return !error
}

export async function completeGoal(goalId: string): Promise<Goal | null> {
  return updateGoal(goalId, { status: 'completed' })
}

export async function abandonGoal(goalId: string): Promise<Goal | null> {
  return updateGoal(goalId, { status: 'abandoned' })
}

// Common goal types with templates
export const GOAL_TYPES = {
  ftp: { name: 'Increase FTP', unit: 'watts', targetType: 'ftp' },
  weight: { name: 'Target Weight', unit: 'kg', targetType: 'weight' },
  ctl: { name: 'Build Fitness (CTL)', unit: 'TSS/day', targetType: 'ctl' },
  weekly_hours: { name: 'Weekly Training Hours', unit: 'hours', targetType: 'weekly_hours' },
  event_finish: { name: 'Complete Event', unit: null, targetType: 'event_finish' },
} as const
